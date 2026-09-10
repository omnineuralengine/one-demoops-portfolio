import {
  DEMO_READINESS,
  SYSTEM_STATUS,
} from "./enums";
import type { DemoOpsState, PreflightCheck, PreflightResult } from "./types";
import { evaluateDemoAccess } from "../selectors/effective-access";

const baseChecks: Array<{ id: string; label: string; systemId: PreflightCheck["systemId"] }> = [
  { id: "identity", label: "Presenter identity is healthy", systemId: "identity" },
  { id: "provisioning", label: "Provisioning is in sync", systemId: "scim" },
  { id: "seat", label: "Seat is active", systemId: "seats" },
  { id: "role", label: "Role is valid", systemId: "roles" },
  { id: "connectors", label: "Required integrations are healthy", systemId: "connectors" },
  { id: "features", label: "Features match the runbook", systemId: "feature_config" },
  { id: "environment", label: "Environment matches its template", systemId: "environment" },
  { id: "data", label: "Demo data is current", systemId: "demo_data" },
];

export function buildPreflightResult(
  state: DemoOpsState,
  demoId: string,
  checkedAt: string,
): PreflightResult | null {
  const demo = state.demos.find((candidate) => candidate.id === demoId);
  if (!demo) return null;

  const checks: PreflightCheck[] = baseChecks.map((definition) => {
    const system = state.systems.find(
      (candidate) => candidate.id === definition.systemId,
    );
    let status = system?.status ?? SYSTEM_STATUS.RED;
    let explanation = system?.note ?? "System record is missing.";

    if (definition.systemId === "connectors") {
      const required = demo.integrationIds.map((integrationId) =>
        state.integrations.find((integration) => integration.id === integrationId),
      );
      if (required.some((integration) => !integration || integration.status === SYSTEM_STATUS.RED)) {
        status = SYSTEM_STATUS.RED;
        explanation = "At least one required integration is unavailable.";
      } else if (required.some((integration) => integration?.status === SYSTEM_STATUS.YELLOW)) {
        status = SYSTEM_STATUS.YELLOW;
        explanation = "At least one required integration has a warning.";
      } else {
        status = SYSTEM_STATUS.GREEN;
        explanation = "Every integration required by this demo is healthy.";
      }
    }

    return {
      ...definition,
      result:
        status === SYSTEM_STATUS.GREEN
          ? "PASS"
          : status === SYSTEM_STATUS.YELLOW
            ? "WARN"
            : "FAIL",
      explanation,
    };
  });

  const access = evaluateDemoAccess(state, demoId);
  checks.push({
    id: "model-access",
    label: "Required model, effort, and workspace are available",
    systemId: "model_governance",
    result: access?.modelAllowed && access.effortAllowed && access.workspaceAllowed ? "PASS" : "FAIL",
    explanation:
      access?.blockingLayers.join(" · ") || "Effective access is compatible.",
  });

  // Recompute from live dependencies. `demo.atRisk` may contain the previous
  // preflight receipt, so treating it as an input would make a repaired demo
  // permanently fail its own next check.
  const hasFailure = checks.some((check) => check.result === "FAIL");
  const hasWarning = checks.some((check) => check.result === "WARN");

  return {
    checkedAt,
    overall: hasFailure
      ? DEMO_READINESS.NOT_READY
      : hasWarning
        ? DEMO_READINESS.AT_RISK
        : DEMO_READINESS.READY,
    checks,
  };
}
