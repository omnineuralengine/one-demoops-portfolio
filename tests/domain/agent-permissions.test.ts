import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import {
  AGENT_OPERATION_KIND,
  APPROVAL_STATUS,
} from "../../lib/domain/enums";
import { evaluateAgentAuthorization } from "../../lib/domain/agents";
import type { ApprovalReceipt } from "../../lib/domain/types";
import { demoOpsReducer } from "../../lib/domain/reducer";
import { selectOpenAgentProposal } from "../../lib/selectors/agents";

const EVALUATED_AT = "2026-09-02T14:10:00.000Z";
const PREFLIGHT_AGENT_ID = "agent-demo-preflight";

describe("agent permission enforcement", () => {
  it("keeps observe-only and recommend-only agents outside execution", () => {
    const state = createSyntheticState();
    const observer = state.agents.find(
      (agent) => agent.id === "agent-identity-sentinel",
    )!;
    const decision = evaluateAgentAuthorization(
      observer,
      AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
      "identity",
      null,
      EVALUATED_AT,
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("allowlist");

    const proposed = demoOpsReducer(state, {
      type: "AGENT_ACTION_PROPOSE",
      agentId: "agent-change-impact",
      operation: AGENT_OPERATION_KIND.ACCEPT_DOCUMENTATION_UPDATE,
      targetId: "docs-change-1",
      rationale: "Public documentation changed and may affect the lab model.",
      at: EVALUATED_AT,
    });
    expect(proposed).toBe(state);
  });

  it("requires an exact-scope, current receipt for consequential execution", () => {
    const state = createSyntheticState();
    const agent = state.agents.find(
      (candidate) => candidate.id === "agent-policy-model-access",
    )!;
    const baseReceipt: ApprovalReceipt = {
      id: "approval-test",
      status: APPROVAL_STATUS.APPROVED,
      requestedAt: "2026-09-02T14:00:00.000Z",
      decidedAt: "2026-09-02T14:05:00.000Z",
      expiresAt: "2026-09-02T15:00:00.000Z",
      requestedBy: agent.id,
      approverId: "human-admin",
      rationale: "Roster evidence supports this exact role correction.",
      targetType: "AGENT_ACTION",
      targetId: "u_alexr",
      operation: AGENT_OPERATION_KIND.CHANGE_ROLE,
      agentId: agent.id,
      consumedAt: null,
    };

    expect(
      evaluateAgentAuthorization(
        agent,
        AGENT_OPERATION_KIND.CHANGE_ROLE,
        "u_alexr",
        null,
        EVALUATED_AT,
      ),
    ).toMatchObject({ allowed: false, requiresApproval: true });

    expect(
      evaluateAgentAuthorization(
        agent,
        AGENT_OPERATION_KIND.CHANGE_ROLE,
        "different-user",
        baseReceipt,
        EVALUATED_AT,
      ).allowed,
    ).toBe(false);

    expect(
      evaluateAgentAuthorization(
        agent,
        AGENT_OPERATION_KIND.CHANGE_ROLE,
        "u_alexr",
        baseReceipt,
        EVALUATED_AT,
      ),
    ).toMatchObject({ allowed: true, approvalId: "approval-test" });

    expect(
      evaluateAgentAuthorization(
        agent,
        AGENT_OPERATION_KIND.CHANGE_ROLE,
        "u_alexr",
        { ...baseReceipt, approverId: agent.id },
        EVALUATED_AT,
      ).allowed,
    ).toBe(false);
  });

  it("allows only allowlisted low-risk execution without approval", () => {
    const state = createSyntheticState();
    const agent = state.agents.find(
      (candidate) => candidate.id === PREFLIGHT_AGENT_ID,
    )!;
    expect(
      evaluateAgentAuthorization(
        agent,
        AGENT_OPERATION_KIND.RUN_PREFLIGHT,
        "massive",
        null,
        EVALUATED_AT,
      ).allowed,
    ).toBe(true);
    expect(
      evaluateAgentAuthorization(
        agent,
        AGENT_OPERATION_KIND.CHANGE_ROLE,
        "u_alexm",
        baseNull(),
        EVALUATED_AT,
    ).allowed,
    ).toBe(false);
  });

  it("executes the offered low-risk action against its exact demo target", () => {
    const state = createSyntheticState();
    const proposed = demoOpsReducer(state, {
      type: "AGENT_ACTION_PROPOSE",
      agentId: PREFLIGHT_AGENT_ID,
      operation: AGENT_OPERATION_KIND.RUN_PREFLIGHT,
      targetId: "massive",
      rationale: "Recompute the deterministic readiness checks for this demo.",
      at: EVALUATED_AT,
    });
    const proposal = proposed.agentActionProposals[0];

    expect(proposal).toMatchObject({
      agentId: PREFLIGHT_AGENT_ID,
      operation: AGENT_OPERATION_KIND.RUN_PREFLIGHT,
      targetId: "massive",
      status: "PROPOSED",
    });

    const executed = demoOpsReducer(proposed, {
      type: "AGENT_ACTION_EXECUTE",
      proposalId: proposal.id,
      at: "2026-09-02T14:11:00.000Z",
    });

    expect(
      executed.agentActionProposals.find(
        (candidate) => candidate.id === proposal.id,
      ),
    ).toMatchObject({ status: "EXECUTED" });
    expect(
      executed.demos.find((demo) => demo.id === "massive")?.lastPreflight,
    ).toMatchObject({ checkedAt: "2026-09-02T14:11:00.000Z" });
    expect(
      executed.demos.find((demo) => demo.id !== "massive")?.lastPreflight,
    ).toBeNull();

    const verified = demoOpsReducer(executed, {
      type: "AGENT_ACTION_VERIFY",
      proposalId: proposal.id,
      at: "2026-09-02T14:12:00.000Z",
    });
    expect(
      selectOpenAgentProposal(verified.agentActionProposals, PREFLIGHT_AGENT_ID),
    ).toBeNull();

    const proposedAgain = demoOpsReducer(verified, {
      type: "AGENT_ACTION_PROPOSE",
      agentId: PREFLIGHT_AGENT_ID,
      operation: AGENT_OPERATION_KIND.RUN_PREFLIGHT,
      targetId: "acme",
      rationale: "Run a fresh deterministic preflight for the next exact demo target.",
      at: "2026-09-02T14:13:00.000Z",
    });

    expect(
      selectOpenAgentProposal(proposedAgain.agentActionProposals, PREFLIGHT_AGENT_ID),
    ).toMatchObject({ targetId: "acme", status: "PROPOSED" });
  });

  it("does not consume a receipt or claim execution for an unimplemented consequential operation", () => {
    let state = createSyntheticState();
    state = demoOpsReducer(state, {
      type: "AGENT_ACTION_PROPOSE",
      agentId: "agent-policy-model-access",
      operation: AGENT_OPERATION_KIND.CHANGE_ROLE,
      targetId: "u_alexr",
      rationale: "The synthetic roster and effective-access trace identify this exact user and role boundary.",
      at: "2026-09-02T14:00:00.000Z",
    });
    const proposalId = state.agentActionProposals[0].id;
    state = demoOpsReducer(state, {
      type: "AGENT_ACTION_APPROVE",
      proposalId,
      approverId: "human-reviewer",
      rationale: "Approve only the exact synthetic user target after reviewing the proposed scope.",
      at: "2026-09-02T14:01:00.000Z",
    });
    const approved = state;
    state = demoOpsReducer(state, {
      type: "AGENT_ACTION_EXECUTE",
      proposalId,
      at: "2026-09-02T14:02:00.000Z",
    });

    expect(state).toBe(approved);
    expect(state.agentActionProposals[0].status).toBe("APPROVED");
    expect(state.approvals[0].status).toBe(APPROVAL_STATUS.APPROVED);
  });
});

function baseNull(): null {
  return null;
}
