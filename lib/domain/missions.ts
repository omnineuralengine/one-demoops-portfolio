import {
  ACTION_PHASE,
  EVIDENCE_QUALITY,
  MISSION_STATUS,
  RISK_LEVEL,
} from "./enums";
import type {
  DebriefDimension,
  MissionDebrief,
  MissionDefinition,
  MissionCausalBaseline,
  MissionMode,
  MissionRun,
} from "./types";
import { clamp } from "../utils/numbers";

export const MISSION_TIME_COST = {
  HYPOTHESIS_COMMIT: 1,
  REMEDIATION_PROPOSE: 1,
  APPROVAL: 2,
  VERIFICATION: 2,
} as const;

const proactivePreventions = new Set([
  "PREFLIGHT",
  "CONFIG_VALIDATION",
  "DRIFT_DETECTION",
  "SCHEDULED_SCAN",
  "AUTO_REMEDIATE_LOW_RISK",
]);

export function createMissionRun(
  id: string,
  mission: MissionDefinition,
  mode: MissionMode,
  causalBaseline: MissionCausalBaseline | null = null,
): MissionRun {
  return {
    id,
    missionId: mission.id,
    mode,
    status: MISSION_STATUS.ACTIVE,
    elapsedMinutes: 0,
    commandsUsed: [],
    hypothesis: {
      layer: null,
      confidence: 50,
      nextTest: "",
      committed: false,
    },
    rationales: {},
    diagnosisRevealed: false,
    chosenRemediationId: null,
    remediationApprovalId: null,
    remediationApproved: false,
    remediationExecuted: false,
    verified: false,
    preventionChoice: null,
    timeline: [],
    causalBaseline,
  };
}

export interface RationaleScore {
  pass: boolean;
  reasons: string[];
  length: number;
}

export function scoreRationaleClarity(text: string | undefined): RationaleScore {
  const normalized = text?.trim() ?? "";
  if (!normalized) return { pass: false, reasons: ["empty"], length: 0 };

  const reasons: string[] = [];
  if (normalized.length >= 25) reasons.push("sufficient detail");
  if (/\b(because|since|so that|which means|therefore)\b/i.test(normalized)) {
    reasons.push("causal reasoning");
  }
  if (/\b(identity|scim|seat|role|policy|connector|environment|data|model)\b/i.test(normalized)) {
    reasons.push("specific system layer");
  }

  return {
    pass: reasons.length >= 2,
    reasons,
    length: normalized.length,
  };
}

export function scoreMissionDebrief(
  id: string,
  completedAt: string,
  mission: MissionDefinition,
  run: MissionRun,
): MissionDebrief {
  const remediation = mission.remediation.find(
    (option) => option.id === run.chosenRemediationId,
  );
  const commands = run.commandsUsed
    .map((commandId) => mission.commands.find((command) => command.id === commandId))
    .filter((command): command is NonNullable<typeof command> => Boolean(command));
  const decisiveCount = commands.filter(
    (command) => command.quality === EVIDENCE_QUALITY.DECISIVE,
  ).length;
  const distractionCount = commands.filter(
    (command) => command.quality === EVIDENCE_QUALITY.DISTRACTION,
  ).length;
  const finishedOnTime =
    run.status === MISSION_STATUS.SUCCEEDED &&
    run.elapsedMinutes <= mission.deadlineMinutes;
  const margin = mission.deadlineMinutes - run.elapsedMinutes;
  const clearRationales = Object.values(run.rationales).filter(
    (rationale) => scoreRationaleClarity(rationale).pass,
  ).length;
  const rationaleCount = Object.keys(run.rationales).length;

  const dimensions: DebriefDimension[] = [
    dimension(
      "TIME_TO_RESTORE",
      "Time to Restore",
      finishedOnTime ? clamp(70 + margin * 2, 70, 100) : 0,
      finishedOnTime
        ? `Resolved with ${margin} simulated minute(s) remaining.`
        : `The run ended at ${run.elapsedMinutes}/${mission.deadlineMinutes} simulated minutes.`,
      "Run role history first to reach the decisive clue in one command.",
    ),
    dimension(
      "DIAGNOSTIC_RIGOR",
      "Diagnostic Rigor",
      clamp(decisiveCount * 45 + Math.min(commands.length, 2) * 10 - distractionCount * 12, 0, 100),
      `${decisiveCount} decisive and ${distractionCount} distraction-quality command(s) were used.`,
      "A methodical elimination path is defensible, but should state why each test changes the hypothesis.",
    ),
    dimension(
      "LEAST_PRIVILEGE",
      "Least Privilege",
      !remediation
        ? 0
        : remediation.id === "r4" || remediation.risk === RISK_LEVEL.CRITICAL
          ? 10
          : remediation.requiresApproval
            ? 82
            : 100,
      remediation
        ? `Chosen remediation: ${remediation.label}.`
        : "No remediation was completed.",
      "A pre-approved presenter handoff changes no standing policy.",
    ),
    dimension(
      "BLAST_RADIUS",
      "Blast-Radius Control",
      !remediation
        ? 0
        : remediation.risk === RISK_LEVEL.LOW
          ? 100
          : remediation.risk === RISK_LEVEL.HIGH
            ? 70
            : 10,
      remediation?.blastRadius ?? "No blast radius was evaluated.",
      "Match the changed layer and population to the demonstrated failure scope.",
    ),
    dimension(
      "VERIFICATION",
      "Verification Completeness",
      run.verified ? 100 : 0,
      run.verified
        ? "The deterministic verification checklist ran after execution."
        : "The mission ended without verification.",
      "Recheck every identity affected by a shared role change, not only the reporting presenter.",
    ),
    dimension(
      "AUDITABILITY",
      "Auditability",
      rationaleCount === 0
        ? 0
        : clamp((clearRationales / rationaleCount) * 100, 20, 100),
      `${rationaleCount} rationale record(s) were captured; ${clearRationales} passed the explicit clarity rubric.`,
      "Capture a short causal rationale at every consequential gate, even outside Interview mode.",
    ),
    dimension(
      "CUSTOMER_IMPACT",
      "Customer Impact",
      finishedOnTime && remediation?.correct
        ? remediation.risk === RISK_LEVEL.CRITICAL
          ? 45
          : 100
        : 0,
      remediation?.customerImpact ?? "No remediation was completed before the deadline.",
      "Valid paths avoid rescheduling; compare their downstream impact on other presenters.",
    ),
    dimension(
      "RECURRENCE_PREVENTION",
      "Recurrence Prevention",
      !run.preventionChoice
        ? 0
        : proactivePreventions.has(run.preventionChoice)
          ? 100
          : 60,
      run.preventionChoice
        ? `Selected prevention: ${run.preventionChoice}.`
        : "No prevention mechanism was selected.",
      "Write-time policy validation can prevent unapproved entitlement edits instead of only detecting them later.",
    ),
  ];

  return {
    id,
    missionRunId: run.id,
    missionId: mission.id,
    completedAt,
    status: run.status,
    dimensions,
    timeline: run.timeline.map((entry) => ({ ...entry })),
  };
}

function dimension(
  key: DebriefDimension["key"],
  label: string,
  score: number,
  explanation: string,
  alternativePath: string,
): DebriefDimension {
  const rounded = Math.round(clamp(score, 0, 100));
  return {
    key,
    label,
    score: rounded,
    rating:
      rounded >= 90
        ? "STRONG"
        : rounded >= 70
          ? "SOUND"
          : rounded >= 45
            ? "DEVELOPING"
            : "NEEDS_ATTENTION",
    explanation,
    alternativePath,
  };
}

export function missionTimelineEntry(
  id: string,
  atMinute: number,
  phase: (typeof ACTION_PHASE)[keyof typeof ACTION_PHASE],
  label: string,
  detail: string,
) {
  return { id, atMinute, phase, label, detail };
}
