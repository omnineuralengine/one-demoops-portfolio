import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import { demoOpsReducer } from "../../lib/domain/reducer";
import { MODEL_ID, SYSTEM_STATUS } from "../../lib/domain/enums";
import {
  createReadinessSelector,
  selectReadiness,
} from "../../lib/selectors/readiness";

const AT = "2026-09-02T14:01:00.000Z";

describe("readiness selector", () => {
  it("applies explicit system, incident, and demo deductions", () => {
    const initial = createSyntheticState();
    expect(selectReadiness(initial)).toMatchObject({
      score: 90,
      status: "READY",
      activeIncidentIds: [],
      atRiskDemoIds: [],
    });

    const degraded = demoOpsReducer(initial, {
      type: "INCIDENT_INJECT",
      scenarioKey: "SSO_FAILURE",
      at: AT,
    });
    const summary = selectReadiness(degraded);

    expect(summary.score).toBe(39);
    expect(summary.status).toBe("NOT_READY");
    expect(summary.activeIncidentIds).toHaveLength(1);
    expect(summary.atRiskDemoIds).toHaveLength(initial.demos.length);
    expect(
      summary.deductions.find((deduction) => deduction.sourceId === "identity"),
    ).toMatchObject({ points: 15, source: "SYSTEM" });
    expect(initial.systems.find((system) => system.id === "identity")?.status).toBe(
      SYSTEM_STATUS.GREEN,
    );
  });

  it("is memoizable and preserves state and array order", () => {
    const state = createSyntheticState();
    const selector = createReadinessSelector();
    const first = selector(state);
    const second = selector(state);

    expect(second).toBe(first);
    expect(state.demos.map((demo) => demo.id)).toEqual([
      "massive",
      "acme",
      "globex",
      "initech",
      "umbrella",
      "stark",
      "wayne",
    ]);
  });

  it("turns a failing preflight into shared demo risk and removes only its own stale result on rerun", () => {
    const initial = createSyntheticState();
    const checked = demoOpsReducer(initial, {
      type: "PREFLIGHT_RUN",
      demoId: "wayne",
      at: AT,
    });

    expect(checked.demos.find((demo) => demo.id === "wayne")).toMatchObject({
      atRisk: true,
      lastPreflight: { overall: "NOT_READY" },
      riskReasons: ["Latest preflight: NOT READY"],
    });
    expect(selectReadiness(checked)).toMatchObject({
      score: 86,
      atRiskDemoIds: ["wayne"],
    });

    const repaired = {
      ...checked,
      roles: checked.roles.map((role) =>
        role.id === "role_viewer"
          ? { ...role, modelPolicy: [...role.modelPolicy, MODEL_ID.SONNET] }
          : role,
      ),
    };
    const rerun = demoOpsReducer(repaired, {
      type: "PREFLIGHT_RUN",
      demoId: "wayne",
      at: "2026-09-02T14:02:00.000Z",
    });

    expect(rerun.demos.find((demo) => demo.id === "wayne")).toMatchObject({
      atRisk: false,
      riskReasons: [],
      lastPreflight: { overall: "READY" },
    });
  });
});
