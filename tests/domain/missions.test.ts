import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import {
  MISSION_MODE,
  MISSION_STATUS,
  MODEL_ID,
} from "../../lib/domain/enums";
import { scoreMissionDebrief } from "../../lib/domain/missions";
import { demoOpsReducer } from "../../lib/domain/reducer";

describe("deterministic mission scoring", () => {
  it("produces the same explainable eight-dimension debrief for the same run", () => {
    let state = createSyntheticState();
    state = demoOpsReducer(state, {
      type: "MISSION_START",
      missionId: "massive_dynamic_opus",
      mode: MISSION_MODE.OPERATOR,
      at: "2026-09-02T14:00:00.000Z",
    });
    expect(state.roles.find((role) => role.id === "role_enterprise_se")?.modelPolicy).not.toContain(MODEL_ID.OPUS);
    expect(state.demos.find((demo) => demo.id === "massive")?.atRisk).toBe(true);
    state = demoOpsReducer(state, {
      type: "MISSION_COMMAND_RUN",
      commandId: "role_history",
      at: "2026-09-02T14:01:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "MISSION_HYPOTHESIS_UPDATE",
      layer: "Custom Role Policy",
      confidence: 95,
      nextTest: "Recompute effective access.",
      at: "2026-09-02T14:02:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "MISSION_HYPOTHESIS_COMMIT",
      at: "2026-09-02T14:03:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "MISSION_REMEDIATION_PROPOSE",
      remediationId: "r1",
      rationale: "Use Sonnet because the custom role policy blocks Opus right now.",
      expectedResult: "The synthetic briefing can proceed before the deadline.",
      rollback: "Restore the runbook model requirement after the session.",
      verification: "Re-run effective access and the demo preflight.",
      at: "2026-09-02T14:04:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "MISSION_REMEDIATION_EXECUTE",
      at: "2026-09-02T14:05:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "MISSION_VERIFY",
      at: "2026-09-02T14:06:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "MISSION_PREVENTION_SELECT",
      preventionId: "CONFIG_VALIDATION",
      at: "2026-09-02T14:07:00.000Z",
    });

    const run = state.activeMission!;
    const mission = state.missionCatalog[0];
    expect(run.status).toBe(MISSION_STATUS.SUCCEEDED);
    expect(run.elapsedMinutes).toBe(7);
    expect(state.demos.find((demo) => demo.id === "massive")).toMatchObject({
      requiredModel: MODEL_ID.SONNET,
      atRisk: false,
    });

    const first = scoreMissionDebrief(
      "debrief-fixed",
      "2026-09-02T14:08:00.000Z",
      mission,
      run,
    );
    const second = scoreMissionDebrief(
      "debrief-fixed",
      "2026-09-02T14:08:00.000Z",
      mission,
      JSON.parse(JSON.stringify(run)),
    );

    expect(second).toEqual(first);
    expect(first.dimensions).toHaveLength(8);
    expect(first.dimensions.every((dimension) => Number.isInteger(dimension.score))).toBe(true);
    expect(first.dimensions.find((dimension) => dimension.key === "DIAGNOSTIC_RIGOR"))
      .toMatchObject({ score: 55, rating: "DEVELOPING" });
  });

  it("exits the active catalog run without deleting filed history", () => {
    let state = createSyntheticState();
    const roleBefore = state.roles.find((role) => role.id === "role_enterprise_se");
    const demoBefore = state.demos.find((demo) => demo.id === "massive");
    const governanceBefore = state.systems.find((system) => system.id === "model_governance");
    state = demoOpsReducer(state, {
      type: "MISSION_START",
      missionId: "massive_dynamic_opus",
      mode: MISSION_MODE.GUIDED,
      at: "2026-09-02T14:00:00.000Z",
    });
    const events = state.events;
    const debriefs = state.debriefs;

    state = demoOpsReducer(state, {
      type: "MISSION_EXIT",
      at: "2026-09-02T14:01:00.000Z",
    });

    expect(state.activeMission).toBeNull();
    expect(state.events).toBe(events);
    expect(state.debriefs).toBe(debriefs);
    expect(state.roles.find((role) => role.id === "role_enterprise_se")).toEqual(roleBefore);
    expect(state.demos.find((demo) => demo.id === "massive")).toEqual(demoBefore);
    expect(state.systems.find((system) => system.id === "model_governance")).toEqual(governanceBefore);
  });

  it("restores shared role policy only after the exact mission approval is consumed and verified", () => {
    let state = createSyntheticState();
    state = demoOpsReducer(state, { type: "MISSION_START", missionId: "massive_dynamic_opus", mode: MISSION_MODE.INTERVIEW, at: "2026-09-02T14:00:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_COMMAND_RUN", commandId: "role_history", rationale: "Role history is the narrowest causal check because identity and connectors already passed.", at: "2026-09-02T14:01:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_HYPOTHESIS_UPDATE", layer: "Custom Role Policy", confidence: 96, nextTest: "Compare Enterprise SE with organization policy.", at: "2026-09-02T14:02:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_HYPOTHESIS_COMMIT", rationale: "The custom role is the failing layer because organization policy still permits Opus while the role history records its removal.", at: "2026-09-02T14:03:00.000Z" });
    state = demoOpsReducer(state, {
      type: "MISSION_REMEDIATION_PROPOSE",
      remediationId: "r2",
      rationale: "Restore Opus because the role diff is the proven failing layer.",
      expectedResult: "Enterprise SE access again intersects with the organization Opus allowlist.",
      rollback: "Remove only the restored Opus role entry if verification fails.",
      verification: "Recompute effective access and run the executive demo governance check.",
      at: "2026-09-02T14:04:00.000Z",
    });
    state = demoOpsReducer(state, { type: "MISSION_REMEDIATION_APPROVE", approverId: "human-reviewer", rationale: "Approve this exact role/model scope because the evidence and rollback are complete.", at: "2026-09-02T14:05:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_REMEDIATION_EXECUTE", at: "2026-09-02T14:06:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_VERIFY", rationale: "Effective access and the demo policy check now pass for the intended role.", at: "2026-09-02T14:07:00.000Z" });

    expect(state.activeMission?.status).toBe(MISSION_STATUS.SUCCEEDED);
    expect(state.roles.find((role) => role.id === "role_enterprise_se")?.modelPolicy).toContain(MODEL_ID.OPUS);
    expect(state.systems.find((system) => system.id === "model_governance")).toMatchObject({
      status: "YELLOW",
      note: expect.stringContaining("Wayne Enterprises"),
    });
    expect(state.approvals[0]).toMatchObject({ status: "CONSUMED", targetType: "MISSION_REMEDIATION" });
  });

  it("does not award mission success when the committed diagnosis names the wrong layer", () => {
    let state = createSyntheticState();
    state = demoOpsReducer(state, { type: "MISSION_START", missionId: "massive_dynamic_opus", mode: MISSION_MODE.OPERATOR, at: "2026-09-02T14:00:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_COMMAND_RUN", commandId: "role_history", at: "2026-09-02T14:01:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_HYPOTHESIS_UPDATE", layer: "Identity Provider", confidence: 90, nextTest: "Recheck identity logs.", at: "2026-09-02T14:02:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_HYPOTHESIS_COMMIT", at: "2026-09-02T14:03:00.000Z" });
    state = demoOpsReducer(state, {
      type: "MISSION_REMEDIATION_PROPOSE",
      remediationId: "r1",
      rationale: "Use a bounded model fallback because the briefing deadline is close.",
      expectedResult: "The narrative remains deliverable.",
      rollback: "Restore the original model requirement.",
      verification: "Run access and policy checks.",
      at: "2026-09-02T14:04:00.000Z",
    });
    state = demoOpsReducer(state, { type: "MISSION_REMEDIATION_EXECUTE", at: "2026-09-02T14:05:00.000Z" });
    state = demoOpsReducer(state, { type: "MISSION_VERIFY", at: "2026-09-02T14:06:00.000Z" });

    expect(state.activeMission?.status).toBe(MISSION_STATUS.FAILED);
    expect(state.demos.find((demo) => demo.id === "massive")?.requiredModel).toBe(MODEL_ID.OPUS);
  });
});
