import { describe, expect, it } from "vitest";
import { causalLoopReducer, createGoldenLoopRun, firstPassRate, GOLDEN_LOOP_CONTRACT, lineage, replayRecoveryRate, type LoopAction, type LoopRun } from "../../features/causal-loop";

const AT = "2026-09-02T18:00:00.000Z";
const human = (id: string) => ({ id, kind: "HUMAN" as const });
const agent = { id: "verification-agent", kind: "AGENT" as const };
let sequence = 0;
function act(state: LoopRun, action: Omit<LoopAction, "actionId" | "at">): LoopRun {
  sequence += 1;
  return causalLoopReducer(state, { ...action, actionId: `action-${sequence}`, at: AT } as LoopAction);
}
function throughFailure() {
  let run = createGoldenLoopRun();
  run = act(run, { type: "ACCEPT_CHANGE", actor: human("aisha") });
  run = act(run, { type: "CLAIM_WORK", actor: human("maya") });
  run = act(run, { type: "APPROVE_MISSION", actor: human("mateo") });
  run = act(run, { type: "APPROVE_VERIFICATION_PLAN", actor: human("aisha") });
  return act(run, { type: "RUN_VERIFICATION", actor: agent });
}

describe("golden causal loop", () => {
  it("creates downstream objects only after causal human decisions", () => {
    let run = createGoldenLoopRun();
    expect(run.affectedRunbook).toBeNull();
    expect(lineage(run)).toMatchObject({ reviewDecisionId: null, missionId: null, workItemId: null, verificationReceiptId: null, learningRecordId: null });
    run = act(run, { type: "APPROVE_MISSION", actor: human("mateo") });
    expect(run.phase).toBe("OBSERVED"); expect(run.audit.at(-1)?.outcome).toBe("REJECTED");
    run = act(run, { type: "ACCEPT_CHANGE", actor: human("aisha") });
    expect(run.affectedRunbook).toMatchObject({ state: "STALE_REVIEW_REQUIRED", changeId: run.change.id, runbookVersionId: "runbook:model-access:v1" });
    expect(run.mission).toMatchObject({ state: "DRAFT" });
    expect(run.workItem).toMatchObject({ state: "HANDED_OFF", claimedBy: null });
    run = act(run, { type: "CLAIM_WORK", actor: human("maya") });
    expect(run.workItem).toMatchObject({ state: "OWNED", claimedBy: "maya" });
    run = act(run, { type: "APPROVE_MISSION", actor: human("mateo") });
    expect(lineage(run)).toMatchObject({ changeId: run.change.id, reviewDecisionId: `review:${run.change.id}`, missionId: `mission:${run.change.id}`, workItemId: `work:mission:${run.change.id}` });
  });

  it("fails first preflight, proposes learning, approves immutable v2, passes replay, then closes", () => {
    let run = throughFailure();
    expect(run.receipts[0]).toMatchObject({ outcome: "FAIL", observedEntitlement: "claude-sonnet", runbookVersionId: "runbook:model-access:v1" });
    expect(run.learningRecord).toMatchObject({ state: "PROPOSED", humanDecision: null });
    expect(run.affectedRunbook).toMatchObject({ state: "LEARNING_PROPOSED", runbookVersionId: "runbook:model-access:v1" });
    expect(run.runbookVersions).toHaveLength(1);
    run = act(run, { type: "CLOSE_LOOP", actor: human("priya") });
    expect(run.phase).toBe("FIRST_VERIFICATION_FAILED");
    run = act(run, { type: "APPROVE_LEARNING", actor: human("mateo") });
    expect(run.runbookVersions).toHaveLength(2); expect(run.runbookVersions[0]).toMatchObject({ version: 1, immutable: true, expectedEntitlement: "claude-opus" });
    expect(run.runbookVersions[1]).toMatchObject({ version: 2, immutable: true, expectedEntitlement: "claude-sonnet" });
    expect(run.activeRunbookVersionId).toBe("runbook:model-access:v1");
    expect(run.learningRecord).toMatchObject({ state: "PROPOSED", activationReceiptId: null, runbookVersionId: "runbook:model-access:v2" });
    expect(run.affectedRunbook).toMatchObject({ state: "UPDATED_AWAITING_REPLAY", runbookVersionId: "runbook:model-access:v2" });
    run = act(run, { type: "RUN_VERIFICATION", actor: agent });
    expect(run.receipts[1].outcome).toBe("PASS");
    expect(run.activeRunbookVersionId).toBe("runbook:model-access:v2");
    expect(run.learningRecord).toMatchObject({ state: "ACTIVE", verificationResult: "PASS", activationReceiptId: run.receipts[1].id });
    expect(run.affectedRunbook).toMatchObject({ state: "VERIFIED_CURRENT", runbookVersionId: "runbook:model-access:v2" });
    run = act(run, { type: "CLOSE_LOOP", actor: human("priya") });
    expect(run.phase).toBe("CLOSED");
    expect(lineage(run)).toMatchObject({ verificationReceiptId: `receipt:work:mission:${run.change.id}:replay`, learningRecordId: `learning:receipt:work:mission:${run.change.id}:initial`, runbookVersion: "runbook:model-access:v2" });
  });

  it("rejects closure when passing evidence is forged or not fully linked", () => {
    let run = throughFailure();
    run = act(run, { type: "APPROVE_LEARNING", actor: human("mateo") });
    run = act(run, { type: "RUN_VERIFICATION", actor: agent });
    const receipt = run.receipts.at(-1)!;
    const forged = {
      ...run,
      receipts: [{
        ...receipt,
        actor: { id: "maya", kind: "HUMAN" as const },
        lineage: { ...receipt.lineage, workItemId: "work:unrelated" },
      }],
    };
    const rejected = act(forged, { type: "CLOSE_LOOP", actor: human("priya") });
    expect(rejected.phase).toBe("REPLAY_PASSED");
    expect(rejected.audit.at(-1)).toMatchObject({
      outcome: "REJECTED",
      reason: expect.stringMatching(/independent, linked passing receipt/),
    });
  });

  it("rejects closure when a forged pass omits the exact approved check evidence", () => {
    let run = throughFailure();
    run = act(run, { type: "APPROVE_LEARNING", actor: human("mateo") });
    run = act(run, { type: "RUN_VERIFICATION", actor: agent });
    const pass = run.receipts.at(-1)!;
    const forged = {
      ...run,
      receipts: [
        ...run.receipts.slice(0, -1),
        { ...pass, checks: pass.checks.map((check, index) => index === 0 ? { ...check, name: "different control", evidence: "" } : check) },
      ],
    };
    const rejected = act(forged, { type: "CLOSE_LOOP", actor: human("priya") });
    expect(rejected.phase).toBe("REPLAY_PASSED");
    expect(rejected.audit.at(-1)).toMatchObject({ outcome: "REJECTED", reason: expect.stringMatching(/passing receipt/) });
  });

  it("keeps the prior version active and escalates when an approved candidate fails replay", () => {
    let run = throughFailure();
    run = act(run, { type: "APPROVE_LEARNING", actor: human("mateo") });
    run = {
      ...run,
      runbookVersions: run.runbookVersions.map((version) =>
        version.id === "runbook:model-access:v2"
          ? { ...version, expectedEntitlement: "claude-opus" }
          : version
      ),
    };
    run = act(run, { type: "RUN_VERIFICATION", actor: agent });
    expect(run.phase).toBe("REPLAY_FAILED");
    expect(run.activeRunbookVersionId).toBe("runbook:model-access:v1");
    expect(run.learningRecord?.state).toBe("PROPOSED");
    expect(run.escalated).toBe(true);
    expect(run.affectedRunbook).toMatchObject({ state: "REPLAY_FAILED", runbookVersionId: "runbook:model-access:v2" });
  });

  it("denies agent authority and named-human substitutions", () => {
    let run = createGoldenLoopRun();
    run = act(run, { type: "ACCEPT_CHANGE", actor: agent });
    expect(run.phase).toBe("OBSERVED"); expect(run.audit.at(-1)?.reason).toMatch(/human/);
    run = act(run, { type: "ACCEPT_CHANGE", actor: human("maya") });
    expect(run.audit.at(-1)?.reason).toMatch(/named reviewer/);
    run = createGoldenLoopRun();
    run = act(run, { type: "ACCEPT_CHANGE", actor: human("aisha") });
    run = act(run, { type: "CLAIM_WORK", actor: human("maya") });
    run = act(run, { type: "APPROVE_MISSION", actor: human("aisha") });
    expect(run.audit.at(-1)?.reason).toMatch(/mission approver/);

    run = throughFailure();
    const beforeApprovalAttempt = run.runbookVersions;
    run = act(run, { type: "APPROVE_LEARNING", actor: agent });
    expect(run.phase).toBe("FIRST_VERIFICATION_FAILED");
    expect(run.runbookVersions).toBe(beforeApprovalAttempt);
    expect(run.audit.at(-1)).toMatchObject({ outcome: "REJECTED", reason: expect.stringMatching(/human actor/) });
  });

  it.each([
    ["owner", { ownerId: "" }], ["backup", { backupOwnerId: "" }],
    ["handoff", { handoff: { ...GOLDEN_LOOP_CONTRACT.handoff, evidence: [] } }],
    ["separation", { reviewerId: "maya" }],
    ["agent authority", { permittedAgentActions: ["RUN_VERIFICATION", "APPROVE_LEARNING"] as const }],
    ["human decision inventory", { humanRequiredDecisions: ["ACCEPT_CHANGE"] as const }],
  ])("fails closed for invalid %s governance", (_name, patch) => {
    const contract = { ...GOLDEN_LOOP_CONTRACT, ...patch };
    let run = createGoldenLoopRun(contract);
    run = act(run, { type: "ACCEPT_CHANGE", actor: human(contract.reviewerId) });
    expect(run.phase).toBe("OBSERVED");
    expect(run.mission).toBeNull();
    expect(run.workItem).toBeNull();
    expect(run.audit.at(-1)?.outcome).toBe("REJECTED");
  });

  it("is idempotent by action ID, rejects repeated transitions, and resets", () => {
    const initial = createGoldenLoopRun();
    const action: LoopAction = { type: "ACCEPT_CHANGE", actionId: "same", actor: human("aisha"), at: AT };
    const accepted = causalLoopReducer(initial, action);
    const duplicate = causalLoopReducer(accepted, action);
    expect(duplicate.phase).toBe("CHANGE_ACCEPTED");
    expect(duplicate.audit.at(-1)).toMatchObject({ outcome: "REJECTED", reason: expect.stringMatching(/Repeated action ID/) });
    expect(causalLoopReducer(duplicate, action)).toBe(duplicate);
    const repeated = causalLoopReducer(accepted, { ...action, actionId: "different" });
    expect(repeated.audit.at(-1)?.outcome).toBe("REJECTED");
    const reset = act(repeated, { type: "RESET", actor: human("priya") });
    expect(reset).toEqual(createGoldenLoopRun());
  });

  it("returns evidence-backed metrics or an explicit insufficient state", () => {
    expect(firstPassRate([createGoldenLoopRun()])).toBe("Insufficient observations");
    expect(replayRecoveryRate([createGoldenLoopRun()])).toBe("Insufficient observations");
    let run = throughFailure();
    expect(firstPassRate([run])).toBe(0);
    expect(replayRecoveryRate([run])).toBe(0);
    run = act(run, { type: "APPROVE_LEARNING", actor: human("mateo") });
    run = act(run, { type: "RUN_VERIFICATION", actor: agent });
    expect(replayRecoveryRate([run])).toBe(1);
  });

  it("keeps explicit fact boundaries and complete evidence lineage", () => {
    const labels = createGoldenLoopRun().change.evidence.map((item) => item.label);
    expect(labels).toEqual(["OBSERVED", "DERIVED", "INFERRED", "PROPOSED", "SYNTHETIC"]);
    const failed = throughFailure();
    expect(failed.receipts[0].lineage).toMatchObject({ changeId: failed.change.id, reviewDecisionId: failed.reviewDecision?.id, missionId: failed.mission?.id, workItemId: failed.workItem?.id, verificationReceiptId: failed.receipts[0].id, learningRecordId: failed.learningRecord?.id, runbookVersionId: "runbook:model-access:v1" });
    expect(failed.receipts[0].checks.every((check) => Boolean(check.evidence))).toBe(true);
  });
});
