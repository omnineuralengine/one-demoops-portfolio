import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import {
  INCIDENT_STATUS,
  SYSTEM_STATUS,
} from "../../lib/domain/enums";
import { demoOpsReducer } from "../../lib/domain/reducer";
import { computeEffectiveModelAccess, evaluateDemoAccess } from "../../lib/selectors/effective-access";

const times = {
  inject: "2026-09-02T14:01:00.000Z",
  investigate: "2026-09-02T14:02:00.000Z",
  diagnose: "2026-09-02T14:03:00.000Z",
  propose: "2026-09-02T14:04:00.000Z",
  execute: "2026-09-02T14:05:00.000Z",
  verify: "2026-09-02T14:06:00.000Z",
};

describe("incident state machine", () => {
  it("moves through evidence, diagnosis, remediation, and verified resolution", () => {
    const initial = createSyntheticState();
    let state = demoOpsReducer(initial, {
      type: "INCIDENT_INJECT",
      scenarioKey: "FEATURE_DISABLED",
      at: times.inject,
    });
    const incidentId = state.incidents[0].id;

    expect(state.incidents[0].status).toBe(INCIDENT_STATUS.DETECTED);
    expect(state.demos.find((demo) => demo.id === "initech")?.atRisk).toBe(true);

    const prematureDiagnosis = demoOpsReducer(state, {
      type: "INCIDENT_DIAGNOSE",
      incidentId,
      at: times.diagnose,
    });
    expect(prematureDiagnosis).toBe(state);

    state = demoOpsReducer(state, {
      type: "INCIDENT_INVESTIGATE",
      incidentId,
      optionId: "i1",
      at: times.investigate,
    });
    state = demoOpsReducer(state, {
      type: "INCIDENT_DIAGNOSE",
      incidentId,
      at: times.diagnose,
    });
    state = demoOpsReducer(state, {
      type: "INCIDENT_REMEDIATION_PROPOSE",
      incidentId,
      remediationId: "r1",
      rationale: "The feature configuration is the proven blocking layer.",
      at: times.propose,
    });
    expect(state.incidents[0].status).toBe(
      INCIDENT_STATUS.REMEDIATION_PROPOSED,
    );

    state = demoOpsReducer(state, {
      type: "INCIDENT_REMEDIATION_EXECUTE",
      incidentId,
      at: times.execute,
    });
    state = demoOpsReducer(state, {
      type: "INCIDENT_VERIFY",
      incidentId,
      at: times.verify,
    });

    expect(state.incidents[0]).toMatchObject({
      status: INCIDENT_STATUS.RESOLVED,
      verificationPassed: true,
      resolvedAt: times.verify,
    });
    expect(state.demos.find((demo) => demo.id === "initech")?.atRisk).toBe(false);
    expect(
      state.systems.find((system) => system.id === "feature_config")?.status,
    ).toBe(SYSTEM_STATUS.GREEN);
    expect(initial.incidents).toEqual([]);
  });

  it("applies identity and SCIM failures to the access records they claim to affect", () => {
    const initial = createSyntheticState();
    const sso = demoOpsReducer(initial, { type: "INCIDENT_INJECT", scenarioKey: "SSO_FAILURE", at: times.inject });
    const scim = demoOpsReducer(initial, { type: "INCIDENT_INJECT", scenarioKey: "SCIM_REMOVED_PRESENTER", at: times.inject });

    expect(computeEffectiveModelAccess(sso, "u_alexm")).toMatchObject({
      canAccessOrganization: false,
      effectiveModels: [],
      effectiveToolPermissions: [],
      blockingLayers: expect.arrayContaining(["IDENTITY_SYSTEM"]),
    });
    expect(scim.users.find((user) => user.id === "u_jordan")).toMatchObject({ active: false, orgMember: false });
    expect(evaluateDemoAccess(scim, "acme")).toMatchObject({ ready: false });
  });
});
