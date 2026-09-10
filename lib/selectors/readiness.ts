import {
  DEMO_READINESS,
  INCIDENT_STATUS,
  SYSTEM_STATUS,
} from "../domain/enums";
import type { DemoOpsState, ReadinessSummary } from "../domain/types";
import { clamp } from "../utils/numbers";
import { memoizeLast } from "../utils/memoize";

export function computeReadiness(state: DemoOpsState): ReadinessSummary {
  const deductions: ReadinessSummary["deductions"] = [];

  for (const system of state.systems) {
    const points =
      system.status === SYSTEM_STATUS.RED
        ? 15
        : system.status === SYSTEM_STATUS.YELLOW
          ? 5
          : 0;
    if (points > 0) {
      deductions.push({
        key: `system:${system.id}`,
        label: `${system.name} is ${system.status}`,
        points,
        source: "SYSTEM",
        sourceId: system.id,
      });
    }
  }

  const activeIncidents = state.incidents.filter(
    (incident) => incident.status !== INCIDENT_STATUS.RESOLVED,
  );
  for (const incident of activeIncidents) {
    deductions.push({
      key: `incident:${incident.id}`,
      label: `Active incident: ${incident.scenarioKey}`,
      points: 8,
      source: "INCIDENT",
      sourceId: incident.id,
    });
  }

  const atRiskDemos = state.demos.filter((demo) => demo.atRisk);
  for (const demo of atRiskDemos) {
    deductions.push({
      key: `demo:${demo.id}`,
      label: `${demo.customer} is at risk`,
      points: 4,
      source: "DEMO",
      sourceId: demo.id,
    });
  }

  const score = clamp(
    100 - deductions.reduce((total, deduction) => total + deduction.points, 0),
    0,
    100,
  );

  return {
    score,
    status:
      score >= 85
        ? DEMO_READINESS.READY
        : score >= 60
          ? DEMO_READINESS.AT_RISK
          : DEMO_READINESS.NOT_READY,
    deductions,
    atRiskDemoIds: atRiskDemos.map((demo) => demo.id),
    activeIncidentIds: activeIncidents.map((incident) => incident.id),
  };
}

export function createReadinessSelector() {
  return memoizeLast(computeReadiness);
}

export const selectReadiness = createReadinessSelector();

export const selectReadinessScore = (state: DemoOpsState): number =>
  selectReadiness(state).score;

export function selectUpcomingDemos(state: DemoOpsState) {
  return [...state.demos].sort(
    (left, right) => left.minutesUntil - right.minutesUntil,
  );
}
