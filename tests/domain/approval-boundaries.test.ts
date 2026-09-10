import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import {
  APPROVAL_STATUS,
  INCIDENT_STATUS,
} from "../../lib/domain/enums";
import { demoOpsReducer } from "../../lib/domain/reducer";
import {
  computeEffectiveModelAccess,
  evaluateDemoAccess,
} from "../../lib/selectors/effective-access";

describe("human approval boundaries", () => {
  it("does not let consequential remediation jump from proposal to execution", () => {
    let state = createSyntheticState();
    state = demoOpsReducer(state, {
      type: "INCIDENT_INJECT",
      scenarioKey: "SSO_FAILURE",
      at: "2026-09-02T14:01:00.000Z",
    });
    const incidentId = state.incidents[0].id;
    state = demoOpsReducer(state, {
      type: "INCIDENT_INVESTIGATE",
      incidentId,
      optionId: "i1",
      at: "2026-09-02T14:02:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "INCIDENT_DIAGNOSE",
      incidentId,
      at: "2026-09-02T14:03:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "INCIDENT_REMEDIATION_PROPOSE",
      incidentId,
      remediationId: "r1",
      rationale: "Identity audit evidence proves the credential is the blocking layer.",
      at: "2026-09-02T14:04:00.000Z",
    });

    expect(state.incidents[0].status).toBe(INCIDENT_STATUS.AWAITING_APPROVAL);
    expect(state.approvals[0].status).toBe(APPROVAL_STATUS.PENDING);

    const skippedBoundary = demoOpsReducer(state, {
      type: "INCIDENT_REMEDIATION_EXECUTE",
      incidentId,
      at: "2026-09-02T14:05:00.000Z",
    });
    expect(skippedBoundary).toBe(state);

    const blankApproval = demoOpsReducer(state, {
      type: "INCIDENT_REMEDIATION_APPROVE",
      incidentId,
      approverId: "human-admin",
      rationale: "",
      at: "2026-09-02T14:05:00.000Z",
    });
    expect(blankApproval).toBe(state);

    state = demoOpsReducer(state, {
      type: "INCIDENT_REMEDIATION_APPROVE",
      incidentId,
      approverId: "human-admin",
      rationale: "Approve the scoped app-secret rotation because audit evidence is decisive.",
      at: "2026-09-02T14:05:00.000Z",
    });
    expect(state.incidents[0].status).toBe(INCIDENT_STATUS.APPROVED);

    state = demoOpsReducer(state, {
      type: "INCIDENT_REMEDIATION_EXECUTE",
      incidentId,
      at: "2026-09-02T14:06:00.000Z",
    });
    expect(state.incidents[0].status).toBe(INCIDENT_STATUS.REMEDIATED);
    expect(state.approvals[0].status).toBe(APPROVAL_STATUS.CONSUMED);
  });

  it("requires approval before processing a role access request", () => {
    let state = createSyntheticState();
    state = demoOpsReducer(state, {
      type: "ACCESS_REQUEST_SUBMIT",
      requestId: "ar4",
      at: "2026-09-02T14:01:00.000Z",
    });
    const beforeExecution = state;
    state = demoOpsReducer(state, {
      type: "ACCESS_REQUEST_EXECUTE",
      requestId: "ar4",
      at: "2026-09-02T14:02:00.000Z",
    });
    expect(state).toBe(beforeExecution);
  });

  it("allows an inspected low-risk request to process without inventing an approval", () => {
    let state = createSyntheticState();
    expect(evaluateDemoAccess(state, "umbrella")).toMatchObject({ workspaceAllowed: false, ready: false });
    state = demoOpsReducer(state, {
      type: "ACCESS_REQUEST_INSPECT",
      requestId: "ar2",
      at: "2026-09-02T14:01:00.000Z",
    });
    state = demoOpsReducer(state, {
      type: "ACCESS_REQUEST_EXECUTE",
      requestId: "ar2",
      at: "2026-09-02T14:02:00.000Z",
    });

    expect(state.accessRequests.find((request) => request.id === "ar2")?.status).toBe("PROCESSED");
    expect(state.approvals).toHaveLength(0);
    expect(state.events[0].message).toContain("inspected low-risk boundary");
    expect(state.users.find((user) => user.id === "u_chen")?.workspaces).toContain("Umbrella Corp Demo");
    expect(evaluateDemoAccess(state, "umbrella")).toMatchObject({ workspaceAllowed: true, ready: true });
  });

  it("applies approved connector, role, and time-bounded elevation effects to shared state", () => {
    const connector = processApprovedRequest(createSyntheticState(), "ar3");
    const role = processApprovedRequest(createSyntheticState(), "ar4");
    const elevation = processApprovedRequest(createSyntheticState(), "ar5");

    expect(connector.integrations.find((integration) => integration.id === "data_cloud")?.status).toBe("GREEN");
    expect(role.users.find((user) => user.id === "u_priya")?.roleId).toBe("role_se");
    expect(elevation.users.find((user) => user.id === "u_dana")).toMatchObject({
      temporaryRoleId: "role_admin",
      temporaryRoleExpiresAt: "2026-09-03T14:03:00.000Z",
    });
    expect(computeEffectiveModelAccess(elevation, "u_dana").roleId).toBe("role_admin");
    expect(elevation.approvals[0].status).toBe(APPROVAL_STATUS.CONSUMED);

    const afterExpiration = demoOpsReducer(elevation, {
      type: "PREFLIGHT_RUN",
      demoId: "massive",
      at: "2026-09-03T14:03:00.000Z",
    });
    expect(afterExpiration.syntheticAsOf).toBe("2026-09-03T14:03:00.000Z");
    expect(computeEffectiveModelAccess(afterExpiration, "u_dana").roleId).toBe(
      elevation.users.find((user) => user.id === "u_dana")?.roleId,
    );
  });
});

function processApprovedRequest(
  initial: ReturnType<typeof createSyntheticState>,
  requestId: string,
) {
  let state = demoOpsReducer(initial, { type: "ACCESS_REQUEST_INSPECT", requestId, at: "2026-09-02T14:00:00.000Z" });
  state = demoOpsReducer(state, { type: "ACCESS_REQUEST_SUBMIT", requestId, at: "2026-09-02T14:01:00.000Z" });
  state = demoOpsReducer(state, { type: "ACCESS_REQUEST_APPROVE", requestId, approverId: "human-reviewer", rationale: "Approve this exact synthetic target after reviewing scope, risk, and rollback.", at: "2026-09-02T14:02:00.000Z" });
  return demoOpsReducer(state, { type: "ACCESS_REQUEST_EXECUTE", requestId, at: "2026-09-02T14:03:00.000Z" });
}
