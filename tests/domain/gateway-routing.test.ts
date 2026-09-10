import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import { demoOpsReducer } from "../../lib/domain/reducer";
import type { GatewayRouteInput } from "../../lib/domain/types";
import { evaluateGatewayRoute } from "../../lib/gateway/routing";

const baseInput: GatewayRouteInput = {
  requesterUserId: "u_alexm",
  demoId: "massive",
  capability: "DEEP_ANALYSIS",
  sensitivity: "SYNTHETIC",
  latencyTargetMs: 5_000,
  maximumCostBand: "HIGH",
};

describe("explainable gateway routing", () => {
  it("selects the environment-compatible model when every policy layer permits it", () => {
    const decision = evaluateGatewayRoute(createSyntheticState(), baseInput);

    expect(decision).toMatchObject({
      outcome: "ELIGIBLE",
      selectedModel: "opus",
      selectedCostBand: "HIGH",
      estimatedLatencyMs: 3_500,
    });
    expect(decision.reasons.join(" ")).toContain("Alex Morgan");
    expect(decision.reasons.join(" ")).toContain("Massive Dynamic Executive Sandbox");
  });

  it("uses only a fallback that independently passes capability, cost, latency, access, and environment policy", () => {
    const decision = evaluateGatewayRoute(createSyntheticState(), {
      ...baseInput,
      requesterUserId: "u_jordan",
      demoId: "acme",
      latencyTargetMs: 1_800,
      maximumCostBand: "MEDIUM",
    });

    expect(decision.outcome).toBe("ELIGIBLE");
    expect(decision.selectedModel).toBe("sonnet");
    expect(decision.candidates.find((candidate) => candidate.model === "opus")?.eligible).toBe(false);
    expect(decision.reasons.join(" ")).toContain("Opus was rejected");
  });

  it("denies rather than naming an invalid low-latency fallback", () => {
    const decision = evaluateGatewayRoute(createSyntheticState(), {
      ...baseInput,
      requesterUserId: "u_jordan",
      demoId: "acme",
      latencyTargetMs: 700,
    });

    expect(decision).toMatchObject({
      outcome: "DENIED",
      selectedModel: null,
      fallbackModel: null,
    });
    expect(decision.candidates.every((candidate) => !candidate.eligible)).toBe(true);
  });

  it("denies internal-lab data and under-entitled presenters at the policy intersection", () => {
    const internal = evaluateGatewayRoute(createSyntheticState(), {
      ...baseInput,
      sensitivity: "INTERNAL_LAB",
    });
    const wayne = evaluateGatewayRoute(createSyntheticState(), {
      ...baseInput,
      requesterUserId: "u_alexr",
      demoId: "wayne",
      capability: "BALANCED_REASONING",
    });

    expect(internal.outcome).toBe("DENIED");
    expect(internal.reasons.join(" ")).toContain("only synthetic data is permitted");
    expect(wayne.outcome).toBe("DENIED");
    expect(wayne.reasons.join(" ")).toContain("effective role allowlist");
  });

  it("records an owner, exact request scope, result, and domain event in reducer state", () => {
    const state = demoOpsReducer(createSyntheticState(), {
      type: "GATEWAY_ROUTE_EVALUATE",
      input: baseInput,
      at: "2026-09-02T16:00:00.000Z",
      actorId: baseInput.requesterUserId,
    });

    expect(state.gateway.routeAudits[0]).toMatchObject({
      ownerUserId: "u_alexm",
      demoId: "massive",
      outcome: "ELIGIBLE",
      selectedModel: "opus",
      evaluatedAt: "2026-09-02T16:00:00.000Z",
    });
    expect(state.events[0].type).toBe("GATEWAY_DECISION_EVALUATED");
  });
});
