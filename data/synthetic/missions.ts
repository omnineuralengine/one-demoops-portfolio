import {
  EFFORT_LEVEL,
  EVIDENCE_QUALITY,
  MODEL_ID,
} from "../../lib/domain/enums";
import type { MissionDefinition } from "../../lib/domain/types";
import { incidentScenarios } from "./incidents";

const modelPolicyScenario = incidentScenarios.find(
  (scenario) => scenario.key === "MODEL_POLICY_MISMATCH",
);

if (!modelPolicyScenario) {
  throw new Error("Synthetic model-policy scenario is required by the mission catalog.");
}

export const missionCatalog: MissionDefinition[] = [
  {
    id: "massive_dynamic_opus",
    seed: "MD-24-OPUS-01",
    title: "The 24-Minute Opus Problem",
    role: "Demo System Administrator, on-call",
    customer: "Massive Dynamic — Executive Briefing",
    presenterUserId: "u_alexm",
    deadlineMinutes: 24,
    requiredModel: MODEL_ID.OPUS,
    requiredEffort: EFFORT_LEVEL.HIGH,
    briefing:
      "The executive briefing starts in 24 simulated minutes. Identity, seat, workspace, and connectors are healthy, but the required model is unavailable.",
    objectives: [
      "Identify the blocking access layer.",
      "Restore a deliverable demo before the deadline.",
      "Choose a remediation with proportional blast radius.",
      "Leave an auditable rationale and verification trail.",
    ],
    initialEvidence: [
      "Alex Morgan authenticated successfully.",
      "The seat and workspace membership are active.",
      "Synthetic connector checks pass.",
      "Opus is absent from the presenter's effective model set.",
    ],
    customerImpactConstraints: [
      "Do not disrupt other in-flight sessions.",
      "Do not require the customer to reschedule.",
    ],
    securityConstraints: [
      "Scope policy changes to the failing layer.",
      "Do not grant standing administrator access.",
    ],
    correctLayer: "Custom Role Policy",
    diagnosis: modelPolicyScenario.diagnosis,
    terminalConditions: {
      success:
        "Required capability is restored before the deadline using a proportional remediation.",
      failure:
        "The deadline elapses or an overbroad remediation violates the mission constraints.",
    },
    commands: [
      {
        id: "access_explain",
        label: "access explain",
        description: "Explain the effective-access intersection.",
        timeCostMinutes: 3,
        reveal:
          "Organization policy allows Opus, Sonnet, and Haiku. Enterprise SE allows the same initial catalog set, but incident history shows Opus was removed in the affected state.",
        layer: "Custom Role Policy",
        quality: EVIDENCE_QUALITY.DECISIVE,
      },
      {
        id: "idp_audit",
        label: "idp audit",
        description: "Inspect recent identity-provider events.",
        timeCostMinutes: 3,
        reveal: "Alex authenticated six minutes ago with no identity anomalies.",
        layer: "Identity Provider",
        quality: EVIDENCE_QUALITY.DISTRACTION,
      },
      {
        id: "scim_diff",
        label: "scim diff",
        description: "Inspect recent provisioning changes.",
        timeCostMinutes: 3,
        reveal: "No provisioning, seat, or group change occurred in fourteen days.",
        layer: "SCIM Provisioning",
        quality: EVIDENCE_QUALITY.DISTRACTION,
      },
      {
        id: "connector_test",
        label: "connector test",
        description: "Run a synthetic connector diagnostic.",
        timeCostMinutes: 3,
        reveal: "The Salesforce dependency returns synthetic 200 OK.",
        layer: "Connector / Integration",
        quality: EVIDENCE_QUALITY.DISTRACTION,
      },
      {
        id: "environment_diff",
        label: "environment diff",
        description: "Compare the environment with its golden template.",
        timeCostMinutes: 3,
        reveal: "The environment configuration matches its template.",
        layer: "Environment Configuration",
        quality: EVIDENCE_QUALITY.DISTRACTION,
      },
      {
        id: "role_history",
        label: "role history",
        description: "Inspect the custom-role audit history.",
        timeCostMinutes: 3,
        reveal:
          "Enterprise SE lost Opus three hours ago. The change has no approval receipt and affects three additional role holders.",
        layer: "Custom Role Policy",
        quality: EVIDENCE_QUALITY.DECISIVE,
      },
      {
        id: "demo_dependencies",
        label: "demo dependencies",
        description: "List required capabilities from the runbook.",
        timeCostMinutes: 3,
        reveal:
          "The runbook calls for Opus at high effort; Sonnet can preserve the narrative with reduced analytical depth.",
        layer: "Demo Data",
        quality: EVIDENCE_QUALITY.USEFUL,
      },
    ],
    remediation: modelPolicyScenario.remediation,
    verificationSteps: modelPolicyScenario.verificationSteps,
  },
];
