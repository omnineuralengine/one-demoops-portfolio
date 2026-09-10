import { EVIDENCE_QUALITY, INCIDENT_STATUS } from "./enums";
import type { Incident, IncidentScenario, IncidentStatus } from "./types";

const allowedTransitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  [INCIDENT_STATUS.DETECTED]: [INCIDENT_STATUS.INVESTIGATING],
  [INCIDENT_STATUS.INVESTIGATING]: [INCIDENT_STATUS.DIAGNOSED],
  [INCIDENT_STATUS.DIAGNOSED]: [
    INCIDENT_STATUS.REMEDIATION_PROPOSED,
    INCIDENT_STATUS.AWAITING_APPROVAL,
  ],
  [INCIDENT_STATUS.REMEDIATION_PROPOSED]: [INCIDENT_STATUS.REMEDIATED],
  [INCIDENT_STATUS.AWAITING_APPROVAL]: [
    INCIDENT_STATUS.APPROVED,
    INCIDENT_STATUS.DIAGNOSED,
  ],
  [INCIDENT_STATUS.APPROVED]: [INCIDENT_STATUS.REMEDIATED],
  [INCIDENT_STATUS.REMEDIATED]: [
    INCIDENT_STATUS.RESOLVED,
    INCIDENT_STATUS.DIAGNOSED,
  ],
  [INCIDENT_STATUS.RESOLVED]: [],
};

export function canTransitionIncident(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function canDiagnoseIncident(
  incident: Incident,
  scenario: IncidentScenario,
): boolean {
  const selected = incident.investigationLog
    .map((id) => scenario.investigation.find((option) => option.id === id))
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  return (
    selected.some((option) => option.quality === EVIDENCE_QUALITY.DECISIVE) ||
    selected.length >= 3
  );
}
