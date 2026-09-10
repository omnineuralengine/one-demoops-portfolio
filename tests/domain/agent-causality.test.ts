import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import {
  causalLoopReducer,
  createDeterministicLoopAction,
  createGoldenLoopRun,
} from "../../features/causal-loop";
import { computeCausalAgents } from "../../lib/selectors/agents";

describe("causal agent derivation", () => {
  it("connects documentation agents to emitted event ids and human-review state", () => {
    let loop = createGoldenLoopRun();
    const state = createSyntheticState();

    let agents = computeCausalAgents(state, { publicChanges: [loop.change], loop });
    const sentinel = agents.find((agent) => agent.id === "agent-documentation-sentinel")!;
    let analyst = agents.find((agent) => agent.id === "agent-change-impact")!;

    expect(sentinel).toMatchObject({ status: "ATTENTION" });
    expect(sentinel.linkedDocumentationChangeIds).toContain(loop.change.id);
    expect(analyst).toMatchObject({ status: "WAITING_FOR_HUMAN" });
    expect(analyst.mostRecentFinding).toContain("await human acknowledgement");

    loop = causalLoopReducer(loop, createDeterministicLoopAction(loop, "ACCEPT_CHANGE", "aisha", "HUMAN"));
    agents = computeCausalAgents(state, { publicChanges: [loop.change], loop });
    const acknowledgedSentinel = agents.find(
      (agent) => agent.id === "agent-documentation-sentinel",
    )!;
    analyst = agents.find((agent) => agent.id === "agent-change-impact")!;

    expect(acknowledgedSentinel).toMatchObject({ status: "WATCHING" });
    expect(acknowledgedSentinel.mostRecentFinding).toContain(
      "emitted public-source observation",
    );
    expect(analyst).toMatchObject({ status: "WAITING_FOR_HUMAN" });
    expect(analyst.mostRecentFinding).toContain("accepted rehearsal change");
  });

  it("derives the policy agent from effective demo access and gateway outcomes", () => {
    const state = createSyntheticState();
    const policyAgent = computeCausalAgents(state).find(
      (agent) => agent.id === "agent-policy-model-access",
    )!;

    expect(policyAgent.status).toBe("ATTENTION");
    expect(policyAgent.mostRecentFinding).toContain("gateway decision(s) were denied");
    expect(policyAgent.linkedDemoIds).toContain("wayne");
    expect(policyAgent.linkedPolicyIds).toContain("policy-sensitive-data-tier");
  });
});
