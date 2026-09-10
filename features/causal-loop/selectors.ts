import type { LoopRun, MetricValue } from "./types";

export function firstPassRate(runs: readonly LoopRun[]): MetricValue {
  const attempted = runs.filter((run) => run.receipts.length > 0);
  if (attempted.length === 0) return "Insufficient observations";
  return attempted.filter((run) => run.receipts[0].outcome === "PASS").length / attempted.length;
}

export function replayRecoveryRate(runs: readonly LoopRun[]): MetricValue {
  const failed = runs.filter((run) => run.receipts[0]?.outcome === "FAIL");
  if (failed.length === 0) return "Insufficient observations";
  return failed.filter((run) => run.receipts.some((receipt) => receipt.outcome === "PASS")).length / failed.length;
}

export function transcript(run: LoopRun) { return run.audit.map(({ at, actorId, action, outcome, reason }) => ({ at, actorId, action, outcome, reason })); }
export function loopMetrics(run: LoopRun) { return { attempts: run.currentAttempt, rejectedActions: run.audit.filter((entry) => entry.outcome === "REJECTED").length, closed: run.phase === "CLOSED" }; }

export function loopReadiness(run: LoopRun): { state: "EVIDENCE_PENDING" | "BLOCKED" | "REPLAY_REQUIRED" | "VERIFIED" | "CLOSED_WITH_EVIDENCE"; reason: string } {
  const latestReceipt = run.receipts.at(-1);
  if (run.phase === "CLOSED") return { state: "CLOSED_WITH_EVIDENCE", reason: `Human closure cites passing receipt ${latestReceipt?.id}.` };
  if (latestReceipt?.outcome === "PASS" && latestReceipt.runbookVersionId === run.activeRunbookVersionId) return { state: "VERIFIED", reason: `Passing receipt ${latestReceipt.id} cites active ${run.activeRunbookVersionId}.` };
  if (run.phase === "REPLAY_FAILED") return { state: "BLOCKED", reason: run.escalationReason ?? "The approved candidate failed replay and remains inactive." };
  if (run.phase === "FIRST_VERIFICATION_FAILED") return { state: "BLOCKED", reason: `Failed receipt ${latestReceipt?.id} blocks closure and proposes learning only.` };
  if (run.phase === "RUNBOOK_APPROVED") return { state: "REPLAY_REQUIRED", reason: `${run.learningRecord?.runbookVersionId ?? "The candidate version"} is human-approved but inactive until a passing replay receipt.` };
  return { state: "EVIDENCE_PENDING", reason: "No independent passing receipt exists for the active loop." };
}

export interface OperationalLearningMetrics {
  reviewerCorrectionRate: MetricValue;
  detectionToOwnerMinutes: MetricValue;
  handoffCompleteness: MetricValue;
  firstPassVerificationRate: MetricValue;
  repeatedFailureRate: MetricValue;
  runbookFreshness: MetricValue;
  evidenceCompleteClosureRate: MetricValue;
}

export function operationalLearningMetrics(run: LoopRun): OperationalLearningMetrics {
  const handoff = run.workItem?.handoff;
  const handoffFields = handoff
    ? [
        handoff.situation,
        handoff.impact,
        handoff.currentOwnerId,
        handoff.receivingOwnerId,
        handoff.hypothesis,
        ...handoff.evidenceGathered,
        ...handoff.evidenceMissing,
        ...handoff.actionsTaken,
        ...handoff.actionsNotTaken,
        handoff.pendingApproval,
        handoff.nextAction,
        handoff.rollback,
        handoff.deadline,
      ]
    : [];
  return {
    reviewerCorrectionRate: "Insufficient observations",
    detectionToOwnerMinutes: run.workItem?.claimedAt
      ? Math.max(0, (new Date(run.workItem.claimedAt).valueOf() - new Date(run.change.detectedAt).valueOf()) / 60_000)
      : "Insufficient observations",
    handoffCompleteness: handoff
      ? Number(handoffFields.length > 0 && handoffFields.every((value) => value.trim().length > 0))
      : "Insufficient observations",
    firstPassVerificationRate: "Insufficient observations",
    repeatedFailureRate: "Insufficient observations",
    runbookFreshness: "Insufficient observations",
    evidenceCompleteClosureRate: "Insufficient observations",
  };
}

export function lineage(run: LoopRun) {
  return {
    changeId: run.change.id,
    reviewDecisionId: run.reviewDecision?.id ?? null,
    missionId: run.mission?.id ?? null,
    workItemId: run.workItem?.id ?? null,
    verificationReceiptId: run.receipts.at(-1)?.id ?? null,
    learningRecordId: run.learningRecord?.id ?? null,
    runbookVersion: run.learningRecord?.runbookVersionId ?? run.activeRunbookVersionId,
  };
}
