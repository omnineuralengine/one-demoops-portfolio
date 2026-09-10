import { describe, expect, it } from "vitest";
import { acceptHandoff, assignWorkItem, canAgentExecute, draftMissionFromChange, findCoverageGaps, findOverloadedOwners, hasReviewSeparation, scoreHandoff, transitionWorkItem, updateRunbookFreshness } from "../../features/team-operations/domain/rules";
import { ACTIVE_HANDOFF, AGENT_CONTRACTS, RUNBOOKS, TEAM_MEMBERS, TEAM_WORK_ITEMS } from "../../features/team-operations/fixtures/team";

const AT = "2026-09-02T18:00:00.000Z";

describe("team operations governance", () => {
  it("enforces the work-item state machine and logs explainable transitions", () => {
    const item = { ...TEAM_WORK_ITEMS[0], state: "NEW" as const };
    const triaged = transitionWorkItem(item, "TRIAGED", "maya", "Relevant to the demo fleet.", AT);
    const owned = assignWorkItem(triaged, "maya", "priya", AT);
    expect(owned.state).toBe("OWNED");
    expect(owned.auditTrail).toHaveLength(2);
    expect(() => transitionWorkItem(item, "EXECUTING", "maya", "Shortcut.", AT)).toThrow();
  });

  it("requires a complete handoff and acknowledgement by the named receiver", () => {
    expect(scoreHandoff(ACTIVE_HANDOFF)).toMatchObject({ ready: true, complete: 14, total: 14 });
    expect(acceptHandoff(ACTIVE_HANDOFF, "maya", AT).acknowledgedAt).toBe(AT);
    expect(() => acceptHandoff(ACTIVE_HANDOFF, "noah", AT)).toThrow(/named receiving owner/);
    expect(() => acceptHandoff({ ...ACTIVE_HANDOFF, nextAction: "" }, "maya", AT)).toThrow(/incomplete/);
  });

  it("separates accountable ownership from review and approval", () => {
    expect(hasReviewSeparation(TEAM_WORK_ITEMS[0])).toBe(true);
    expect(hasReviewSeparation({ ...TEAM_WORK_ITEMS[0], reviewerIds: ["maya"] })).toBe(false);
    expect(() => assignWorkItem({ ...TEAM_WORK_ITEMS[0], state: "TRIAGED", ownerId: null }, "aisha", "priya", AT)).toThrow(/separated/);
  });

  it("surfaces unowned coverage windows", () => {
    expect(findCoverageGaps([{ region: "APAC", startUtc: 0, endUtc: 4, qualifiedOwnerIds: [] }])).toEqual(["APAC 0:00–4:00 UTC"]);
    expect(findOverloadedOwners(TEAM_MEMBERS)).toEqual(["mateo"]);
    expect(TEAM_MEMBERS.filter((member) => member.backupIds.length === 0).map((member) => member.id)).toEqual(["mateo"]);
  });

  it("never lets agent authority bypass consequential human actions", () => {
    expect(canAgentExecute("EXECUTE_REVERSIBLE_LOW_RISK", "PREFLIGHT_SCAN")).toBe(true);
    expect(canAgentExecute("EXECUTE_REVERSIBLE_LOW_RISK", "MERGE_HIGH_IMPACT")).toBe(false);
    expect(canAgentExecute("HUMAN_APPROVAL_REQUIRED", "PREFLIGHT_SCAN")).toBe(false);
    expect(AGENT_CONTRACTS).toHaveLength(10);
    expect(AGENT_CONTRACTS.every((agent) => agent.accountableHumanId && agent.purpose && agent.escalationCondition)).toBe(true);
    expect(AGENT_CONTRACTS.every((agent) => agent.deniedActions.includes("approve their own proposals") && agent.deniedActions.includes("merge or deploy code"))).toBe(true);
  });

  it("marks a runbook stale only for an accepted high-impact assessment", () => {
    const runbook = { ...RUNBOOKS[0], status: "CURRENT" as const };
    expect(updateRunbookFreshness(runbook, { id: "change:model-entitlement", impactLevel: "HIGH", acceptedForAssessment: false }).status).toBe("AT_RISK");
    expect(updateRunbookFreshness(runbook, { id: "change:model-entitlement", impactLevel: "HIGH", acceptedForAssessment: true }).status).toBe("STALE_REVIEW_REQUIRED");
  });

  it("keeps deterministic change-driven missions proposed until human acceptance", () => {
    const draft = draftMissionFromChange({ sourceChangeId: "change:model-entitlement", personaId: "maya", affectedLayer: "effective access", initialEvidence: ["hash"], hiddenFacts: ["fixture drift"], diagnosticCommands: ["inspect access"], remediationOptions: ["update fixture"], approvalBoundary: "Human approval", verificationChecklist: ["access test passes"], preventionOptions: ["preflight monitor"] });
    expect(draft).toMatchObject({ state: "PROPOSED", id: "mission-draft:change:model-entitlement" });
  });
});
