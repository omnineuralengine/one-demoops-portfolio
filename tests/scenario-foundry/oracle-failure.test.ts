import { describe, expect, it } from "vitest";

import { createFoundryAction } from "../../features/scenario-foundry/domain/actions";
import { scenarioFoundryReducer, scenarioFoundryReducerWithRuntime } from "../../features/scenario-foundry/domain/reducer";
import { scenarioReadiness, teardownReceiptIsValid } from "../../features/scenario-foundry/domain/selectors";
import { throughActive } from "./helpers";

describe("failed simulated oracle evidence", () => {
  it("quarantines the active pack while retaining the independently produced failure report", () => {
    const active = throughActive();
    expect(active.phase).toBe("ACTIVE");
    expect(active.world).not.toBeNull();

    const action = createFoundryAction(active, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT");
    const quarantined = scenarioFoundryReducerWithRuntime(active, action, {
      evaluateOracleSuite: () => ({ outcome: "FAIL", results: [], evaluatedPersonaIds: [] }),
    });

    expect(quarantined.phase).toBe("QUARANTINED");
    expect(quarantined.oracleReports.at(-1)?.outcome).toBe("FAIL");
    expect(quarantined.audit.at(-1)?.reasonCode).toBe("SIMULATED_EVALUATION_QUARANTINED");

    const teardownAction = createFoundryAction(quarantined, "TEARDOWN_WORLD", "maya", "HUMAN");
    let destroyed = scenarioFoundryReducer(quarantined, teardownAction);
    expect(destroyed).toMatchObject({ phase: "DESTROYED", world: null, teardownReceipt: { priorPhase: "QUARANTINED", oracleOutcome: "FAIL" } });
    expect(teardownReceiptIsValid(destroyed)).toBe(true);
    expect(scenarioReadiness(destroyed).ready).toBe(false);

    destroyed = scenarioFoundryReducer(destroyed, createFoundryAction(destroyed, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "STORY_CLARITY" }));
    expect(destroyed.feedbackCandidate).toBeNull();
    expect(destroyed.audit.at(-1)?.reasonCode).toBe("POST_DEMO_EVALUATION_EVIDENCE_REQUIRED");
  });
});
