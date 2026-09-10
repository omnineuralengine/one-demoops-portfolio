import { createGoldenLoopRun } from "./fixture";
import type { AuditRecord, LoopAction, LoopRun } from "./types";

const HUMAN_ONLY = new Set<LoopAction["type"]>(["ACCEPT_CHANGE", "CLAIM_WORK", "APPROVE_MISSION", "APPROVE_VERIFICATION_PLAN", "APPROVE_LEARNING", "CLOSE_LOOP", "RESET"]);

export function causalLoopReducer(state: LoopRun, action: LoopAction): LoopRun {
  if (state.processedActionIds.includes(action.actionId)) {
    const duplicateAlreadyAudited = state.audit.some((record) =>
      record.actionId === action.actionId &&
      record.outcome === "REJECTED" &&
      record.reason === "Repeated action ID rejected without changing causal state."
    );
    if (duplicateAlreadyAudited) return state;
    return {
      ...state,
      audit: [...state.audit, {
        actionId: action.actionId,
        action: action.type,
        actorId: action.actor.id,
        at: Number.isFinite(new Date(action.at).valueOf()) ? iso(action.at) : action.at,
        outcome: "REJECTED",
        reason: "Repeated action ID rejected without changing causal state.",
      }],
    };
  }
  const invalid = validateAction(state, action);
  if (invalid) {
    const denied = rejected(state, action, invalid);
    const escalated = /maximum attempts|owner|backup|handoff|separated|failed replay/i.test(invalid);
    return escalated
      ? { ...denied, escalated: true, stopReason: invalid.includes("maximum attempts") ? invalid : denied.stopReason, escalationReason: invalid }
      : denied;
  }

  let next: LoopRun;
  switch (action.type) {
    case "ACCEPT_CHANGE":
      {
        const reviewDecision = { id: `review:${state.change.id}`, changeId: state.change.id, acceptedBy: action.actor.id, at: iso(action.at), classification: "DERIVED" as const };
        const mission = { id: `mission:${state.change.id}`, reviewDecisionId: reviewDecision.id, state: "DRAFT" as const, approvedBy: null, classification: "PROPOSED" as const };
        next = {
          ...state,
          phase: "CHANGE_ACCEPTED",
          reviewDecision,
          mission,
          affectedRunbook: {
            changeId: state.change.id,
            runbookVersionId: state.activeRunbookVersionId,
            state: "STALE_REVIEW_REQUIRED",
            reason: "The accepted entitlement observation makes the active preflight assumption reviewable; no runbook content changed.",
          },
          workItem: {
            id: `work:${mission.id}`,
            missionId: mission.id,
            state: "HANDED_OFF",
            proposedOwnerId: state.contract.ownerId,
            ownerId: null,
            backupOwnerId: state.contract.backupOwnerId,
            reviewerId: state.contract.reviewerId,
            approverId: state.contract.approverId,
            claimedBy: null,
            claimedAt: null,
            closedAt: null,
            handoff: {
              situation: state.contract.handoff.situation,
              impact: state.contract.handoff.impact,
              currentOwnerId: state.contract.reviewerId,
              receivingOwnerId: state.contract.ownerId,
              hypothesis: "The active runbook may omit an effective-entitlement compatibility check.",
              evidenceGathered: [...state.contract.handoff.evidence],
              evidenceMissing: ["Independent synthetic verification receipt"],
              actionsTaken: ["Validated the event schema and bounded evidence."],
              actionsNotTaken: ["No entitlement, role, policy, source, or credential was changed."],
              pendingApproval: "Mission scope and reversible verification plan",
              nextAction: state.contract.handoff.nextAction,
              rollback: state.contract.handoff.rollback,
              deadline: "2026-09-02T18:30:00.000Z",
            },
          },
        };
      }
      break;
    case "CLAIM_WORK":
      next = { ...state, phase: "WORK_CLAIMED", workItem: { ...state.workItem!, state: "OWNED", ownerId: action.actor.id, claimedBy: action.actor.id, claimedAt: iso(action.at) } };
      break;
    case "APPROVE_MISSION": {
      next = { ...state, phase: "MISSION_APPROVED", mission: { ...state.mission!, state: "APPROVED", approvedBy: action.actor.id } };
      break;
    }
    case "APPROVE_VERIFICATION_PLAN":
      next = { ...state, phase: "PLAN_APPROVED", verificationPlan: { id: `plan:${state.workItem!.id}`, workItemId: state.workItem!.id, approvedBy: action.actor.id, mode: "LOCAL_DETERMINISTIC_SYNTHETIC", reversible: true, checks: [...state.contract.verificationChecks], classification: "PROPOSED" } };
      break;
    case "RUN_VERIFICATION": {
      const replay = state.phase === "RUNBOOK_APPROVED";
      const runbook = replay
        ? state.runbookVersions.find((version) => version.id === state.learningRecord?.runbookVersionId)!
        : activeRunbook(state);
      const observedEntitlement = "claude-sonnet";
      const checks = [
        {
          name: "requested model is effectively entitled",
          outcome: runbook.expectedEntitlement === observedEntitlement ? "PASS" as const : "FAIL" as const,
          evidence: runbook.expectedEntitlement === observedEntitlement
            ? `${observedEntitlement} matches the active runbook control`
            : `${runbook.expectedEntitlement} absent; ${observedEntitlement} is the bounded fallback`,
        },
        { name: "fallback remains available", outcome: "PASS" as const, evidence: "synthetic Sonnet profile available" },
      ];
      const result = checks.every((check) => check.outcome === "PASS") ? "PASS" as const : "FAIL" as const;
      const receiptId = `receipt:${state.workItem!.id}:${replay ? "replay" : "initial"}`;
      const learningId = result === "FAIL" ? `learning:${receiptId}` : state.learningRecord?.id ?? null;
      const receipt = { id: receiptId, lineage: { changeId: state.change.id, reviewDecisionId: state.reviewDecision!.id, missionId: state.mission!.id, workItemId: state.workItem!.id, verificationReceiptId: receiptId, learningRecordId: learningId, runbookVersionId: runbook.id }, workItemId: state.workItem!.id, planId: state.verificationPlan!.id, runbookVersionId: runbook.id, outcome: result, actor: action.actor, checks, observedEntitlement, durationMs: 34, reversible: true as const, at: iso(action.at), classification: "DERIVED" as const };
      if (result === "FAIL" && replay) {
        next = {
          ...state,
          phase: "REPLAY_FAILED",
          currentAttempt: state.currentAttempt + 1,
          receipts: [...state.receipts, receipt],
          escalated: true,
          stopReason: "Stop condition reached: the approved candidate failed replay at the maximum attempt budget.",
          escalationReason: `Failed replay receipt ${receipt.id} requires accountable-human review; no candidate was activated.`,
          affectedRunbook: {
            changeId: state.change.id,
            runbookVersionId: runbook.id,
            state: "REPLAY_FAILED",
            reason: `Failed receipt ${receipt.id} left ${runbook.id} inactive; ${state.activeRunbookVersionId} remains active.`,
          },
        };
      } else if (result === "FAIL") {
        next = {
          ...state,
          phase: "FIRST_VERIFICATION_FAILED",
          currentAttempt: state.currentAttempt + 1,
          receipts: [...state.receipts, receipt],
          affectedRunbook: { changeId: state.change.id, runbookVersionId: runbook.id, state: "LEARNING_PROPOSED", reason: `Failed receipt ${receipt.id} proposed a correction; the active runbook is unchanged.` },
          learningRecord: { id: learningId!, verificationReceiptId: receipt.id, activationReceiptId: null, state: "PROPOSED", originalPrediction: "Runbook v1 predicts claude-opus is entitled.", supportingEvidence: receipt.checks.map((check) => check.evidence), humanDecision: null, verificationResult: "FAIL", approvedOperationalLesson: null, runbookVersionId: null, actor: action.actor, at: iso(action.at), lineage: receipt.lineage, classification: "PROPOSED" },
        };
      } else {
        next = {
          ...state,
          phase: "REPLAY_PASSED",
          activeRunbookVersionId: runbook.id,
          currentAttempt: state.currentAttempt + 1,
          receipts: [...state.receipts, receipt],
          learningRecord: state.learningRecord
            ? { ...state.learningRecord, activationReceiptId: receipt.id, state: "ACTIVE", verificationResult: "PASS", classification: "DERIVED" }
            : null,
          affectedRunbook: { changeId: state.change.id, runbookVersionId: runbook.id, state: "VERIFIED_CURRENT", reason: `Passing receipt ${receipt.id} independently verified and activated the human-approved immutable version.` },
        };
      }
      break;
    }
    case "APPROVE_LEARNING": {
      const v1 = activeRunbook(state);
      const nextVersion = v1.version + 1;
      const nextVersionId = `${v1.id.replace(/:v\d+$/, "")}:v${nextVersion}`;
      const learning = { ...state.learningRecord!, state: "PROPOSED" as const, humanDecision: { outcome: "CORRECTED" as const, actorId: action.actor.id, at: iso(action.at) }, approvedOperationalLesson: "Preflight the effective entitled model and use the bounded fallback.", runbookVersionId: nextVersionId, lineage: { ...state.learningRecord!.lineage, runbookVersionId: nextVersionId }, classification: "PROPOSED" as const };
      next = { ...state, phase: "RUNBOOK_APPROVED", learningRecord: learning, runbookVersions: [...state.runbookVersions, { id: nextVersionId, previousVersionId: v1.id, version: nextVersion, immutable: true, approvedBy: action.actor.id, approvedAt: iso(action.at), learningRecordId: learning.id, expectedEntitlement: "claude-sonnet" }], affectedRunbook: { changeId: state.change.id, runbookVersionId: nextVersionId, state: "UPDATED_AWAITING_REPLAY", reason: `Human-approved learning ${learning.id} created immutable candidate ${nextVersionId}; ${v1.id} stays active until a passing replay.` } };
      break;
    }
    case "CLOSE_LOOP": next = { ...state, phase: "CLOSED", closedBy: action.actor.id, workItem: { ...state.workItem!, state: "CLOSED", closedAt: iso(action.at) } }; break;
    case "RESET": return createGoldenLoopRun(state.contract);
  }
  return withAudit(next, action, "ACCEPTED", "Causal transition accepted.");
}

function validateAction(state: LoopRun, action: LoopAction): string | null {
  if (!action.actionId.trim() || !action.actor.id.trim() || !Number.isFinite(new Date(action.at).valueOf())) return "Action ID, actor, and valid timestamp are required.";
  if (HUMAN_ONLY.has(action.type) && action.actor.kind !== "HUMAN") return `${action.type} requires a human actor.`;
  if (action.actor.kind === "AGENT" && !state.contract.permittedAgentActions.includes(action.type)) return "Agent authority denied.";
  if (action.type === "ACCEPT_CHANGE") {
    const governanceError = validateGovernance(state);
    if (governanceError) return governanceError;
  }
  const expected: Partial<Record<LoopAction["type"], LoopRun["phase"]>> = { ACCEPT_CHANGE: "OBSERVED", CLAIM_WORK: "CHANGE_ACCEPTED", APPROVE_MISSION: "WORK_CLAIMED", APPROVE_VERIFICATION_PLAN: "MISSION_APPROVED", APPROVE_LEARNING: "FIRST_VERIFICATION_FAILED", CLOSE_LOOP: "REPLAY_PASSED" };
  if (expected[action.type] && state.phase !== expected[action.type]) return `${action.type} is invalid from ${state.phase}.`;
  if (action.type === "RUN_VERIFICATION" && !["PLAN_APPROVED", "RUNBOOK_APPROVED"].includes(state.phase)) return `RUN_VERIFICATION is invalid from ${state.phase}.`;
  if (action.type === "RUN_VERIFICATION" && state.currentAttempt >= state.contract.maximumAttempts) return "Stop condition reached: maximum attempts exhausted; escalate to the accountable human.";
  if (action.type === "RUN_VERIFICATION" && (!state.verificationPlan || state.verificationPlan.workItemId !== state.workItem?.id)) return "Verification requires the linked human-approved plan.";
  if (action.type === "RUN_VERIFICATION" && state.phase === "RUNBOOK_APPROVED") {
    const candidateId = state.learningRecord?.runbookVersionId;
    const candidate = state.runbookVersions.find((version) => version.id === candidateId);
    if (
      !state.learningRecord ||
      state.learningRecord.state !== "PROPOSED" ||
      !state.learningRecord.humanDecision ||
      !candidate ||
      candidate.previousVersionId !== state.activeRunbookVersionId
    ) return "Replay requires a linked, human-approved immutable candidate while the prior version remains active.";
  }
  if (action.type === "CLAIM_WORK" || action.type === "APPROVE_MISSION") {
    const c = state.contract;
    if (!c.ownerId || !c.backupOwnerId) return "Mission requires a named owner and backup.";
    if (!c.handoff.situation || !c.handoff.impact || !c.handoff.nextAction || !c.handoff.rollback || c.handoff.evidence.length === 0) return "Mission requires a complete handoff.";
    if (new Set([c.ownerId, c.reviewerId, c.approverId]).size !== 3) return "Owner, reviewer, and approver must be separated.";
    if (action.type === "CLAIM_WORK" && action.actor.id !== c.ownerId) return "Only the named owner may claim work.";
    if (action.type === "APPROVE_MISSION" && action.actor.id !== c.approverId) return "Only the named mission approver may approve.";
  }
  if (action.type === "ACCEPT_CHANGE" && action.actor.id !== state.contract.reviewerId) return "Only the named reviewer may accept the change.";
  if (action.type === "APPROVE_VERIFICATION_PLAN" && action.actor.id !== state.contract.verificationPlanApproverId) return "Only the named verification-plan approver may approve.";
  if (action.type === "APPROVE_LEARNING" && action.actor.id !== state.contract.runbookApproverId) return "Only the named runbook approver may approve.";
  if (action.type === "APPROVE_LEARNING") {
    const failedReceipt = state.receipts.at(-1);
    if (
      !state.learningRecord ||
      state.learningRecord.state !== "PROPOSED" ||
      !failedReceipt ||
      failedReceipt.outcome !== "FAIL" ||
      state.learningRecord.verificationReceiptId !== failedReceipt.id
    ) return "Runbook learning requires a linked failed receipt and proposed learning record.";
  }
  if (action.type === "RUN_VERIFICATION" && (action.actor.kind !== "AGENT" || action.actor.id !== state.contract.verificationAgentId)) return "Only the bounded verification agent may run deterministic verification.";
  if (action.type === "CLOSE_LOOP") {
    if (action.actor.id !== state.contract.closureApproverId) return "Only the named closure approver may close the loop.";
    const pass = state.receipts.at(-1);
    const lineageIsComplete = Boolean(
      pass &&
      state.reviewDecision &&
      state.mission &&
      state.workItem &&
      state.verificationPlan &&
      pass.lineage.changeId === state.change.id &&
      pass.lineage.reviewDecisionId === state.reviewDecision.id &&
      pass.lineage.missionId === state.mission.id &&
      pass.lineage.workItemId === state.workItem.id &&
      pass.lineage.verificationReceiptId === pass.id &&
      pass.lineage.runbookVersionId === state.activeRunbookVersionId
    );
    if (
      !pass ||
      pass.outcome !== "PASS" ||
      pass.actor.kind !== "AGENT" ||
      pass.actor.id !== state.contract.verificationAgentId ||
      pass.actor.id === state.contract.ownerId ||
      pass.workItemId !== state.workItem?.id ||
      pass.planId !== state.verificationPlan?.id ||
      pass.runbookVersionId !== state.activeRunbookVersionId ||
      pass.checks.length !== state.contract.verificationChecks.length ||
      pass.checks.some((check, index) =>
        check.outcome !== "PASS" ||
        check.name !== state.contract.verificationChecks[index] ||
        !check.evidence.trim()
      ) ||
      state.learningRecord?.state !== "ACTIVE" ||
      state.learningRecord.activationReceiptId !== pass.id ||
      !lineageIsComplete
    ) return "Closure requires an independent, linked passing receipt for every approved check.";
  }
  return null;
}

function validateGovernance(state: LoopRun): string | null {
  const contract = state.contract;
  const requiredHumans = [
    contract.accountableHuman,
    contract.ownerId,
    contract.backupOwnerId,
    contract.reviewerId,
    contract.approverId,
    contract.verificationPlanApproverId,
    contract.runbookApproverId,
    contract.closureApproverId,
  ];
  if (requiredHumans.some((id) => !id.trim()) || !contract.verificationAgentId.trim()) {
    return "Loop governance requires every human owner, backup, reviewer, approver, and verification agent to be named.";
  }
  if (new Set([contract.ownerId, contract.reviewerId, contract.approverId]).size !== 3) {
    return "Owner, reviewer, and approver must be separated.";
  }
  if (
    !contract.handoff.situation ||
    !contract.handoff.impact ||
    !contract.handoff.nextAction ||
    !contract.handoff.rollback ||
    contract.handoff.evidence.length === 0
  ) {
    return "Mission requires a complete handoff.";
  }
  if (
    !Number.isInteger(contract.maximumAttempts) ||
    contract.maximumAttempts < 2 ||
    !Number.isFinite(contract.executionBudgetMs) ||
    contract.executionBudgetMs <= 0 ||
    !Number.isFinite(contract.timeBudgetMinutes) ||
    contract.timeBudgetMinutes <= 0 ||
    contract.evidenceRequirements.length === 0 ||
    contract.verificationChecks.length === 0 ||
    contract.stopConditions.length === 0 ||
    contract.escalationConditions.length === 0
  ) {
    return "Loop governance requires bounded attempts, budgets, evidence, checks, stop conditions, and escalation conditions.";
  }
  if (contract.permittedAgentActions.some((action) => action !== "RUN_VERIFICATION")) {
    return "Loop governance cannot expand agent authority beyond reversible verification.";
  }
  const requiredDecisions: readonly LoopAction["type"][] = [
    "ACCEPT_CHANGE",
    "CLAIM_WORK",
    "APPROVE_MISSION",
    "APPROVE_VERIFICATION_PLAN",
    "APPROVE_LEARNING",
    "CLOSE_LOOP",
  ];
  if (requiredDecisions.some((decision) => !contract.humanRequiredDecisions.includes(decision))) {
    return "Loop governance must declare every consequential transition as a human-required decision.";
  }
  return null;
}

function activeRunbook(state: LoopRun) {
  return state.runbookVersions.find((version) => version.id === state.activeRunbookVersionId)!;
}
function iso(value: string) { return new Date(value).toISOString(); }
function rejected(state: LoopRun, action: LoopAction, reason: string) { return withAudit(state, action, "REJECTED", reason); }
function withAudit(state: LoopRun, action: LoopAction, outcome: AuditRecord["outcome"], reason: string): LoopRun {
  return { ...state, processedActionIds: [...state.processedActionIds, action.actionId], audit: [...state.audit, { actionId: action.actionId, action: action.type, actorId: action.actor.id, at: Number.isFinite(new Date(action.at).valueOf()) ? iso(action.at) : action.at, outcome, reason }] };
}
