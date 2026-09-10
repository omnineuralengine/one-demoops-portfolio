import { DEFAULT_FOUNDRY_BUILD_CONFIG, DEFAULT_SAFE_DEMO_SIGNALS, FOUNDRY_PACK_ID, FOUNDRY_REQUEST_ID, FOUNDRY_UTC_ANCHOR } from "../fixture";
import { expectedFoundryEventId } from "./actions";
import { isVerifiedPhaseThreeCapabilityChange } from "./capability";
import { stableHash, stableId } from "./canonical";
import { compileSyntheticDataContract } from "./contract";
import { evaluateContextFirewall } from "./firewall";
import { generateSyntheticWorld } from "./generator";
import { evaluateOracleSuite } from "./oracle";
import { hasExactKeys, isExactUtcIso, isPlainRecord } from "./schema";
import { scenarioReadiness, teardownReceiptIsValid } from "./selectors";
import { createPrivacyReport, createQualityReport, privacyChecks, qualityChecks } from "./validators";
import type {
  ActivationReceipt,
  CapabilityPin,
  FoundryAction,
  FoundryActionType,
  FoundryActor,
  FoundryBuildConfig,
  FullEvidenceBinding,
  OracleEvaluationReport,
  RevalidationReport,
  SafeDemoSignalInput,
  SafeDemoSignalProfile,
  ScenarioFoundryState,
} from "./types";

export const FOUNDRY_ACTORS = Object.freeze({
  requester: "sofia",
  reviewer: "aisha",
  administrator: "maya",
  productLiaison: "kenji",
  executionAgent: "agent-demo-preflight",
  capabilitySystem: "scenario-foundry-system",
});

export interface ScenarioFoundryRuntime {
  readonly evaluateOracleSuite: typeof evaluateOracleSuite;
}

const DEFAULT_FOUNDRY_RUNTIME: ScenarioFoundryRuntime = Object.freeze({ evaluateOracleSuite });

export function createInitialFoundryState(
  draft: SafeDemoSignalInput = DEFAULT_SAFE_DEMO_SIGNALS,
  buildConfig: FoundryBuildConfig = DEFAULT_FOUNDRY_BUILD_CONFIG,
  identity: { requestId: string; packId: string } = { requestId: FOUNDRY_REQUEST_ID, packId: FOUNDRY_PACK_ID },
): ScenarioFoundryState {
  const projectedBuildConfig = validBuildConfig(buildConfig) ? safeBuildConfig(buildConfig) : null;
  if (!projectedBuildConfig || !validInitialIdentity(identity)) throw new Error("INVALID_FOUNDRY_INITIAL_STATE");
  const initialProjection = evaluateContextFirewall(draft, {
    requestId: identity.requestId,
    packId: identity.packId,
    requestingActorId: "sofia",
    at: FOUNDRY_UTC_ANCHOR,
    policyVersion: projectedBuildConfig.policyVersion,
  });
  if (initialProjection.validationOutcome !== "ACCEPTED" || !initialProjection.acceptedProfile) throw new Error("INVALID_FOUNDRY_INITIAL_STATE");
  return {
    schemaVersion: 1,
    phase: "DRAFT",
    revision: 0,
    requestId: identity.requestId,
    packId: identity.packId,
    buildConfig: projectedBuildConfig,
    draft: safeDraftFromAcceptedProfile(initialProjection.acceptedProfile),
    contextReceipt: null,
    contract: null,
    world: null,
    privacyReport: null,
    qualityReport: null,
    reviewDecision: null,
    activationReceipts: [],
    oracleReports: [],
    stalenessReceipt: null,
    revalidationMission: null,
    revalidationReport: null,
    revalidationApproval: null,
    resetReceipts: [],
    teardownReceipt: null,
    feedbackCandidate: null,
    exportStatus: "NOT_EXPORTED",
    audit: [],
    processedEventIds: [],
  };
}

export function scenarioFoundryReducer(state: ScenarioFoundryState, action: FoundryAction): ScenarioFoundryState {
  return reduceScenarioFoundry(state, action, DEFAULT_FOUNDRY_RUNTIME);
}

export function scenarioFoundryReducerWithRuntime(
  state: ScenarioFoundryState,
  action: FoundryAction,
  runtime: ScenarioFoundryRuntime,
): ScenarioFoundryState {
  return reduceScenarioFoundry(state, action, runtime);
}

function reduceScenarioFoundry(
  state: ScenarioFoundryState,
  action: FoundryAction,
  runtime: ScenarioFoundryRuntime,
): ScenarioFoundryState {
  if (!safeActionShape(action)) return malformedActionAudit(state);
  if (state.processedEventIds.includes(action.eventId)) return state;
  const envelopeError = validateEnvelope(state, action);
  if (envelopeError) return rejected(state, action, envelopeError);
  const authorityError = validateAuthority(state, action);
  if (authorityError) return rejected(state, action, authorityError);
  const transitionError = validateTransition(state, action);
  if (transitionError) return rejected(state, action, transitionError);

  switch (action.type) {
    case "EDIT_SAFE_DRAFT": {
      const evaluated = evaluateContextFirewall(action.draft, firewallOptions(state, action));
      if (evaluated.validationOutcome !== "ACCEPTED" || !evaluated.acceptedProfile) return rejected(state, action, "DRAFT_REJECTED_BY_CONTEXT_FIREWALL");
      return accepted(invalidateDescendants({ ...state, draft: safeDraftFromAcceptedProfile(evaluated.acceptedProfile) }), action, "DESCENDANTS_INVALIDATED");
    }
    case "EDIT_CONFIGURATION": {
      if (!validBuildConfig(action.buildConfig)) return rejected(state, action, "CONFIGURATION_REJECTED_BY_POLICY");
      const projectedBuildConfig = safeBuildConfig(action.buildConfig);
      if (!projectedBuildConfig) return rejected(state, action, "CONFIGURATION_REJECTED_BY_POLICY");
      return accepted(invalidateDescendants({ ...state, buildConfig: projectedBuildConfig }), action, "DESCENDANTS_INVALIDATED");
    }
    case "ACCEPT_CONTEXT": {
      const receipt = evaluateContextFirewall(action.input, firewallOptions(state, action));
      if (receipt.validationOutcome !== "ACCEPTED") return accepted({ ...invalidateDescendants(state), phase: "QUARANTINED", contextReceipt: receipt }, action, "CONTEXT_QUARANTINED_BY_POLICY");
      return accepted({ ...invalidateDescendants(state), phase: "INTAKE_ACCEPTED", contextReceipt: receipt }, action, "SAFE_CONTEXT_ACCEPTED");
    }
    case "COMPILE_CONTRACT": {
      const context = state.contextReceipt;
      if (!context) return rejected(state, action, "CONTEXT_RECEIPT_REQUIRED");
      const contract = compileSyntheticDataContract(context, state.buildConfig, action.at);
      return accepted({ ...state, phase: "BLUEPRINTED", contract }, action, "CONTRACT_COMPILED");
    }
    case "GENERATE_WORLD": {
      if (!state.contract) return rejected(state, action, "CONTRACT_REQUIRED");
      const world = generateSyntheticWorld(state.contract);
      return accepted({ ...state, phase: "GENERATED", world }, action, "SYNTHETIC_WORLD_GENERATED");
    }
    case "RUN_PRIVACY_VALIDATION": {
      if (!state.world || !state.contract) return rejected(state, action, "WORLD_AND_CONTRACT_REQUIRED");
      if (privacyChecks(state.world, state.contract).some((check) => check.id === "privacy:runtime-schema" && check.outcome === "FAIL")) {
        return accepted(quarantineInvalidWorld(state), action, "PRIVACY_QUARANTINED_INVALID_WORLD_SCHEMA");
      }
      const privacyReport = createPrivacyReport(state.world, state.contract, action.actor, action.at, lastAcceptedEventId(state) ?? "genesis");
      return accepted({ ...state, phase: privacyReport.outcome === "PASS" ? "PRIVACY_VALIDATED" : "QUARANTINED", privacyReport }, action, privacyReport.outcome === "PASS" ? "PRIVACY_VALIDATED" : "PRIVACY_QUARANTINED");
    }
    case "RUN_QUALITY_VALIDATION": {
      if (!state.world || !state.contract) return rejected(state, action, "WORLD_AND_CONTRACT_REQUIRED");
      if (qualityChecks(state.world, state.contract).some((check) => check.id === "quality:runtime-schema" && check.outcome === "FAIL")) {
        return accepted(quarantineInvalidWorld(state), action, "QUALITY_QUARANTINED_INVALID_WORLD_SCHEMA");
      }
      const qualityReport = createQualityReport(state.world, state.contract, action.actor, action.at, lastAcceptedEventId(state) ?? "genesis");
      return accepted({ ...state, phase: qualityReport.outcome === "PASS" ? "QUALITY_VALIDATED" : "QUARANTINED", qualityReport }, action, qualityReport.outcome === "PASS" ? "QUALITY_VALIDATED" : "QUALITY_QUARANTINED");
    }
    case "SUBMIT_FOR_REVIEW":
      return accepted({ ...state, phase: "REVIEW_REQUIRED" }, action, "HUMAN_REVIEW_REQUESTED");
    case "APPROVE_PACK": {
      if (!state.world || !state.privacyReport || !state.qualityReport) return rejected(state, action, "BOUND_VALIDATION_EVIDENCE_REQUIRED");
      const binding = fullBinding(state, action.actor, action.at, state.contract?.requiredCapabilityPins ?? []);
      if (!binding) return rejected(state, action, "BOUND_VALIDATION_EVIDENCE_REQUIRED");
      const decisionCore = { ...binding, outcome: "APPROVED" as const, reviewerId: "aisha" as const };
      return accepted({ ...state, phase: "APPROVED", reviewDecision: { id: stableId("pack-review", decisionCore), ...decisionCore } }, action, "PACK_APPROVED_FOR_ACTIVATION");
    }
    case "ACTIVATE_PACK": {
      if (!validPackReviewDecision(state)) return rejected(state, action, "CURRENT_PACK_REVIEW_BINDING_REQUIRED");
      const receipt = buildActivationReceipt(state, action.actor, action.at, state.reviewDecision?.id ?? "", null);
      if (!receipt) return rejected(state, action, "COMPLETE_EVIDENCE_BINDING_REQUIRED");
      return accepted({ ...state, phase: "ACTIVE", activationReceipts: [...state.activationReceipts, receipt] }, action, "PACK_ACTIVATED_FOR_ONE_SIMULATED_SESSION");
    }
    case "RUN_ORACLE_EVALUATIONS": {
      const report = buildOracleReport(state, action.actor, action.at, runtime.evaluateOracleSuite);
      if (!report) return rejected(state, action, "ACTIVE_BOUND_WORLD_REQUIRED");
      return accepted({ ...state, phase: report.outcome === "PASS" ? "ACTIVE" : "QUARANTINED", oracleReports: [...state.oracleReports, report] }, action, report.outcome === "PASS" ? "SIMULATED_EVALUATION_PASSED" : "SIMULATED_EVALUATION_QUARANTINED");
    }
    case "APPLY_VERIFIED_CAPABILITY_CHANGE": {
      if (!validCapabilityChange(state, action.change)) return rejected(state, action, "VERIFIED_CAPABILITY_LINEAGE_REQUIRED");
      if (!validCurrentOracleReport(state)) return rejected(state, action, "PASSING_BOUND_ORACLE_REPORT_REQUIRED");
      const binding = fullBinding(state, action.actor, action.at, updatedPins(state, action.change));
      const priorActivationReceipt = state.activationReceipts.at(-1);
      if (!binding || !priorActivationReceipt) return rejected(state, action, "ACTIVE_BOUND_WORLD_REQUIRED");
      const receiptCore = { ...binding, capabilityChange: action.change, priorActivationReceiptId: priorActivationReceipt.id, readinessRevoked: true as const };
      const stalenessReceipt = { id: stableId("staleness-receipt", receiptCore), ...receiptCore };
      const revalidationMission = {
        id: stableId("revalidation-mission", { packId: state.packId, stalenessReceiptId: stalenessReceipt.id }),
        packId: state.packId, stalenessReceiptId: stalenessReceipt.id, requiredCapabilityPins: binding.capabilityPins,
        state: "DRAFT" as const, ownerId: "maya" as const, reviewerId: "aisha" as const,
      };
      return accepted({ ...state, phase: "STALE_REVALIDATION_REQUIRED", stalenessReceipt, revalidationMission }, action, "READINESS_REVOKED_CAPABILITY_CHANGED");
    }
    case "RUN_REVALIDATION": {
      const oracleReport = buildOracleReport(state, action.actor, action.at, runtime.evaluateOracleSuite);
      const report = oracleReport ? buildRevalidationReport(state, action.actor, action.at, oracleReport) : null;
      if (!report || !oracleReport) return rejected(state, action, "REVALIDATION_MISSION_REQUIRED");
      return accepted({
        ...state,
        phase: report.outcome === "PASS" ? "REVALIDATED" : "QUARANTINED",
        oracleReports: [...state.oracleReports, oracleReport],
        revalidationReport: report,
        revalidationApproval: null,
      }, action, report.outcome === "PASS" ? "REVALIDATION_EVIDENCE_PASSED" : "REVALIDATION_QUARANTINED");
    }
    case "APPROVE_REVALIDATION": {
      const report = state.revalidationReport;
      if (!report || report.outcome !== "PASS" || !validRevalidationReport(state)) return rejected(state, action, "PASSING_REVALIDATION_REPORT_REQUIRED");
      if (state.revalidationApproval) return rejected(state, action, "REVALIDATION_ALREADY_APPROVED");
      const binding = fullBinding(state, action.actor, action.at, state.revalidationMission?.requiredCapabilityPins ?? []);
      if (!binding || !state.stalenessReceipt) return rejected(state, action, "COMPLETE_REVALIDATION_BINDING_REQUIRED");
      const core = { ...binding, reportId: report.id, reportHash: report.reportHash, stalenessReceiptId: state.stalenessReceipt.id, approvedBy: "aisha" as const, outcome: "APPROVED" as const };
      return accepted({ ...state, revalidationApproval: { id: stableId("revalidation-approval", core), ...core } }, action, "REVALIDATION_EVIDENCE_APPROVED");
    }
    case "REACTIVATE_PACK": {
      if (!validRevalidationApproval(state)) return rejected(state, action, "REVALIDATION_APPROVAL_REQUIRED");
      const receipt = buildActivationReceipt(state, action.actor, action.at, state.reviewDecision?.id ?? "", state.revalidationApproval!.id, state.revalidationMission?.requiredCapabilityPins);
      if (!receipt) return rejected(state, action, "COMPLETE_REVALIDATION_BINDING_REQUIRED");
      return accepted({ ...state, phase: "ACTIVE", activationReceipts: [...state.activationReceipts, receipt] }, action, "READINESS_RESTORED_WITH_NEW_EVIDENCE");
    }
    case "RESET_WORLD": {
      const activation = state.activationReceipts.at(-1);
      if (activation && state.resetReceipts.some((receipt) => receipt.activationReceiptId === activation.id)) return state;
      const binding = fullBinding(state, action.actor, action.at, currentPins(state));
      if (!binding || !state.world || !state.contract || !activation) return rejected(state, action, "ACTIVE_BOUND_WORLD_REQUIRED");
      const restored = generateSyntheticWorld(state.contract);
      if (restored.outputHash !== state.world.outputHash) return rejected(state, action, "RESET_BASELINE_MISMATCH");
      const core = { ...binding, activationReceiptId: activation.id, restoredOutputHash: restored.outputHash, outcome: "PASS" as const };
      const receipt = { id: stableId("reset-receipt", core), ...core };
      return accepted({ ...state, world: restored, resetReceipts: [...state.resetReceipts, receipt] }, action, "WORLD_RESET_VERIFIED");
    }
    case "TEARDOWN_WORLD": {
      if (state.phase === "DESTROYED") return state;
      const latest = lastAcceptedEventId(state);
      const core = {
        requestId: state.requestId, packId: state.packId, priorPhase: state.phase,
        destroyedGenerationRunId: state.world?.generationRunId ?? null,
        generatedAt: state.world?.generatedAt ?? null,
        acceptedProfileHash: state.contextReceipt?.acceptedProfileHash ?? null,
        contractHash: state.contract?.contractHash ?? null,
        templateVersion: state.contract?.templateVersion ?? null,
        generatorVersion: state.contract?.generatorVersion ?? null,
        seed: state.contract?.deterministicSeed ?? null,
        destroyedOutputHash: state.world?.outputHash ?? null,
        privacyReportHash: state.privacyReport?.reportHash ?? null,
        qualityReportHash: state.qualityReport?.reportHash ?? null,
        capabilityPins: currentPins(state).map((pin) => ({ id: pin.id, version: pin.version, kind: pin.kind })),
        activationReceiptId: state.activationReceipts.at(-1)?.id ?? null,
        oracleReportId: state.oracleReports.at(-1)?.id ?? null,
        oracleOutcome: state.oracleReports.at(-1)?.outcome ?? null,
        revalidationApprovalId: state.revalidationApproval?.id ?? null,
        finalState: "DESTROYED" as const,
        actor: { id: action.actor.id, kind: action.actor.kind },
        at: action.at, priorEventId: latest,
      };
      const teardownReceipt = { id: stableId("teardown-receipt", core), ...core };
      return accepted({ ...state, phase: "DESTROYED", world: null, teardownReceipt }, action, "WORLD_DESTROYED_AND_VERIFIED");
    }
    case "EXPIRE_PACK":
      return state.contract && Date.parse(action.at) >= Date.parse(state.contract.expirationPolicy.expiresAt)
        ? accepted({ ...state, phase: "EXPIRED" }, action, "PACK_EXPIRED_READINESS_REVOKED")
        : rejected(state, action, "PACK_TTL_BOUNDARY_NOT_REACHED");
    case "PROPOSE_TEMPLATE_IMPROVEMENT": {
      if (action.category !== "STORY_CLARITY" && action.category !== "EDGE_CASE_COVERAGE") return rejected(state, action, "INVALID_IMPROVEMENT_CATEGORY");
      const oracleReport = state.oracleReports.at(-1);
      const postTeardownEvidence = state.phase === "DESTROYED" && teardownReceiptIsValid(state)
        && state.teardownReceipt?.oracleOutcome === "PASS" && Boolean(state.teardownReceipt.oracleReportId);
      const sourceReceiptId = postTeardownEvidence ? state.teardownReceipt!.id : oracleReport?.id ?? "";
      if (!sourceReceiptId || !(postTeardownEvidence || oracleReport?.outcome === "PASS" && scenarioReadiness(state, action.at).ready)) return rejected(state, action, "POST_DEMO_EVALUATION_EVIDENCE_REQUIRED");
      const core = { packId: state.packId, sourceReceiptId, status: "PROPOSED_INACTIVE" as const, category: action.category, proposedBy: action.actor.id, at: action.at };
      return accepted({ ...state, feedbackCandidate: { id: stableId("template-candidate", core), ...core } }, action, "INACTIVE_IMPROVEMENT_CANDIDATE_CREATED");
    }
    case "MARK_EXPORTED":
      return scenarioReadiness(state, action.at).ready
        ? accepted({ ...state, exportStatus: "USER_EXPORTED" }, action, "ALLOWLISTED_JSON_EXPORTED_BY_USER")
        : rejected(state, action, "CURRENT_BOUND_READINESS_REQUIRED");
    case "RESTART": {
      const currentIndex = Number(state.packId.split(":").at(-1)) || 1;
      const nextIndex = currentIndex + 1;
      const fresh = createInitialFoundryState(state.draft, state.buildConfig, {
        requestId: `request:revenue-world:${String(nextIndex).padStart(3, "0")}`,
        packId: `pack:revenue-world:${String(nextIndex).padStart(3, "0")}`,
      });
      const auditedPriorLifecycle = accepted(state, action, "NEW_SINGLE_PACK_LIFECYCLE_STARTED");
      return { ...fresh, audit: auditedPriorLifecycle.audit, processedEventIds: auditedPriorLifecycle.processedEventIds };
    }
  }
}

function validateEnvelope(state: ScenarioFoundryState, action: FoundryAction): string | null {
  const candidate = action as Partial<FoundryAction>;
  const actor = candidate.actor as Partial<FoundryActor> | undefined;
  if (typeof candidate.type !== "string" || !KNOWN_ACTIONS.has(candidate.type as FoundryActionType)) return "UNKNOWN_ACTION_TYPE";
  if (typeof candidate.eventId !== "string" || !candidate.eventId.trim() || candidate.eventId.length > 200
    || !actor || typeof actor.id !== "string" || !actor.id.trim() || actor.id.length > 100
    || !(["HUMAN", "AGENT", "SYSTEM"] as const).includes(actor.kind as FoundryActor["kind"]) || !isExactUtcIso(candidate.at)
    || !Number.isSafeInteger(candidate.expectedRevision) || (candidate.expectedRevision ?? -1) < 0
    || !(candidate.priorEventId === null || typeof candidate.priorEventId === "string" && candidate.priorEventId.length <= 200)) return "INVALID_ACTION_ENVELOPE";
  if (action.eventId !== expectedFoundryEventId(state, action.type)) return "INVALID_ACTION_EVENT_ID";
  if (action.requestId !== state.requestId || action.packId !== state.packId) return "MISMATCHED_REQUEST_OR_PACK_ID";
  if (action.expectedRevision !== state.revision) return "STALE_STATE_REVISION";
  if (action.priorEventId !== (state.audit.at(-1)?.eventId ?? null)) return "MISMATCHED_PRIOR_EVENT_LINEAGE";
  const previousAt = state.audit.at(-1)?.at ?? FOUNDRY_UTC_ANCHOR;
  if (Date.parse(action.at) <= Date.parse(previousAt)) return "NON_MONOTONIC_ACTION_TIME";
  return null;
}

function validateAuthority(state: ScenarioFoundryState, action: FoundryAction): string | null {
  const human = action.actor.kind === "HUMAN";
  const executionAgent = action.actor.kind === "AGENT" && action.actor.id === FOUNDRY_ACTORS.executionAgent;
  const requesterActions: readonly FoundryActionType[] = ["EDIT_SAFE_DRAFT", "ACCEPT_CONTEXT", "SUBMIT_FOR_REVIEW", "PROPOSE_TEMPLATE_IMPROVEMENT", "MARK_EXPORTED"];
  const administratorActions: readonly FoundryActionType[] = ["ACTIVATE_PACK", "REACTIVATE_PACK", "RESET_WORLD", "TEARDOWN_WORLD", "EXPIRE_PACK", "RESTART"];
  const agentActions: readonly FoundryActionType[] = ["COMPILE_CONTRACT", "GENERATE_WORLD", "RUN_PRIVACY_VALIDATION", "RUN_QUALITY_VALIDATION", "RUN_ORACLE_EVALUATIONS", "RUN_REVALIDATION"];
  if (action.type === "EDIT_CONFIGURATION") {
    if (!validBuildConfig(action.buildConfig)) return null;
    const policyChanged = action.buildConfig.policyVersion !== state.buildConfig.policyVersion;
    const productConfigurationChanged = action.buildConfig.templateVersion !== state.buildConfig.templateVersion
      || action.buildConfig.generatorVersion !== state.buildConfig.generatorVersion
      || !samePins(action.buildConfig.capabilityPins, state.buildConfig.capabilityPins);
    if (policyChanged && productConfigurationChanged) return "SEPARATE_CONFIGURATION_APPROVALS_REQUIRED";
    if (policyChanged) return human && action.actor.id === FOUNDRY_ACTORS.reviewer ? null : "PRIVACY_POLICY_OWNER_REQUIRED";
    return human && action.actor.id === FOUNDRY_ACTORS.productLiaison ? null : "PRODUCT_CONFIGURATION_OWNER_REQUIRED";
  }
  if (action.type === "APPLY_VERIFIED_CAPABILITY_CHANGE") return action.actor.kind === "SYSTEM" && action.actor.id === FOUNDRY_ACTORS.capabilitySystem ? null : "CAPABILITY_SYSTEM_AUTHORITY_REQUIRED";
  if (action.type === "APPROVE_PACK" || action.type === "APPROVE_REVALIDATION") return human && action.actor.id === FOUNDRY_ACTORS.reviewer ? null : "INDEPENDENT_REVIEWER_REQUIRED";
  if (agentActions.includes(action.type)) return executionAgent || (action.type === "RUN_ORACLE_EVALUATIONS" && human && action.actor.id === FOUNDRY_ACTORS.requester) ? null : "BOUNDED_EXECUTION_AGENT_REQUIRED";
  if (requesterActions.includes(action.type)) return human && action.actor.id === FOUNDRY_ACTORS.requester ? null : "REQUESTING_SE_AUTHORITY_REQUIRED";
  if (administratorActions.includes(action.type)) return human && action.actor.id === FOUNDRY_ACTORS.administrator ? null : "DEMOOPS_ADMINISTRATOR_REQUIRED";
  return "AUTHORITY_DENIED";
}

function validateTransition(state: ScenarioFoundryState, action: FoundryAction): string | null {
  if (state.phase === "DESTROYED") return action.type === "TEARDOWN_WORLD" ? "IDEMPOTENT_NO_CHANGE" : action.type === "RESTART" || action.type === "PROPOSE_TEMPLATE_IMPROVEMENT" ? null : "DESTROYED_PACK_IS_TERMINAL";
  if (action.type === "EDIT_SAFE_DRAFT" || action.type === "EDIT_CONFIGURATION") return null;
  const expected: Partial<Record<FoundryActionType, readonly ScenarioFoundryState["phase"][]>> = {
    ACCEPT_CONTEXT: ["DRAFT"], COMPILE_CONTRACT: ["INTAKE_ACCEPTED"], GENERATE_WORLD: ["BLUEPRINTED"],
    RUN_PRIVACY_VALIDATION: ["GENERATED"], RUN_QUALITY_VALIDATION: ["PRIVACY_VALIDATED"],
    SUBMIT_FOR_REVIEW: ["QUALITY_VALIDATED"], APPROVE_PACK: ["REVIEW_REQUIRED"], ACTIVATE_PACK: ["APPROVED"],
    RUN_ORACLE_EVALUATIONS: ["ACTIVE"], APPLY_VERIFIED_CAPABILITY_CHANGE: ["ACTIVE"],
    RUN_REVALIDATION: ["STALE_REVALIDATION_REQUIRED"], APPROVE_REVALIDATION: ["REVALIDATED"], REACTIVATE_PACK: ["REVALIDATED"],
    RESET_WORLD: ["ACTIVE"], EXPIRE_PACK: ["ACTIVE"], MARK_EXPORTED: ["ACTIVE"],
    PROPOSE_TEMPLATE_IMPROVEMENT: ["ACTIVE"], TEARDOWN_WORLD: ["DRAFT", "INTAKE_ACCEPTED", "BLUEPRINTED", "GENERATED", "PRIVACY_VALIDATED", "QUALITY_VALIDATED", "REVIEW_REQUIRED", "APPROVED", "ACTIVE", "STALE_REVALIDATION_REQUIRED", "REVALIDATED", "QUARANTINED", "EXPIRED"],
    RESTART: ["EXPIRED", "QUARANTINED"],
  };
  return expected[action.type]?.includes(state.phase) ? null : `${action.type}_INVALID_FROM_${state.phase}`;
}

function invalidateDescendants(state: ScenarioFoundryState): ScenarioFoundryState {
  return {
    ...state, phase: "DRAFT", contextReceipt: null, contract: null, world: null, privacyReport: null,
    qualityReport: null, reviewDecision: null, activationReceipts: [], oracleReports: [], stalenessReceipt: null,
    revalidationMission: null, revalidationReport: null, revalidationApproval: null, resetReceipts: [], teardownReceipt: null,
    feedbackCandidate: null, exportStatus: "NOT_EXPORTED",
  };
}

function quarantineInvalidWorld(state: ScenarioFoundryState): ScenarioFoundryState {
  return {
    ...state,
    phase: "QUARANTINED",
    world: null,
    privacyReport: null,
    qualityReport: null,
    reviewDecision: null,
    activationReceipts: [],
    oracleReports: [],
    stalenessReceipt: null,
    revalidationMission: null,
    revalidationReport: null,
    revalidationApproval: null,
    resetReceipts: [],
    exportStatus: "NOT_EXPORTED",
  };
}

function fullBinding(state: ScenarioFoundryState, actor: FoundryActor, at: string, capabilityPins: readonly CapabilityPin[]): FullEvidenceBinding | null {
  const world = state.world; const context = state.contextReceipt; const contract = state.contract;
  const privacy = state.privacyReport; const quality = state.qualityReport;
  if (!world || !context?.acceptedProfileHash || !contract || !privacy || !quality || privacy.outcome !== "PASS" || quality.outcome !== "PASS"
    || !reportMatchesCurrentEvidence(state, privacy, "privacy-report") || !reportMatchesCurrentEvidence(state, quality, "quality-report")) return null;
  return {
    requestId: state.requestId, packId: state.packId, generationRunId: world.generationRunId,
    acceptedProfileHash: context.acceptedProfileHash, contractHash: contract.contractHash,
    templateVersion: contract.templateVersion, generatorVersion: contract.generatorVersion, seed: contract.deterministicSeed,
    outputHash: world.outputHash, privacyReportHash: privacy.reportHash, qualityReportHash: quality.reportHash,
    capabilityPins: capabilityPins.map((pin) => ({ id: pin.id, version: pin.version, kind: pin.kind })),
    actor: { id: actor.id, kind: actor.kind }, at, priorEventId: lastAcceptedEventId(state) ?? "genesis",
  };
}

function reportMatchesCurrentEvidence(state: ScenarioFoundryState, report: ScenarioFoundryState["privacyReport"] | ScenarioFoundryState["qualityReport"], idPrefix: "privacy-report" | "quality-report"): boolean {
  const world = state.world; const context = state.contextReceipt; const contract = state.contract;
  if (!report || !world || !context?.acceptedProfileHash || !contract) return false;
  const { id, reportHash, ...core } = report;
  const expectedChecks = idPrefix === "privacy-report" ? privacyChecks(world, contract) : qualityChecks(world, contract);
  return reportHash === stableHash(core) && id === stableId(idPrefix, core)
    && stableHash(report.checks) === stableHash(expectedChecks)
    && report.outcome === (report.checks.every((check) => check.outcome === "PASS") ? "PASS" : "FAIL")
    && report.requestId === state.requestId && report.packId === state.packId && report.generationRunId === world.generationRunId
    && report.acceptedProfileHash === context.acceptedProfileHash && report.contractHash === contract.contractHash
    && report.templateVersion === contract.templateVersion && report.generatorVersion === contract.generatorVersion
    && report.seed === contract.deterministicSeed && report.outputHash === world.outputHash
    && report.capabilityPins.length === contract.requiredCapabilityPins.length
    && report.capabilityPins.every((pin, index) => pin.id === contract.requiredCapabilityPins[index]?.id && pin.version === contract.requiredCapabilityPins[index]?.version && pin.kind === contract.requiredCapabilityPins[index]?.kind)
    && report.actor.kind === "AGENT" && report.actor.id === FOUNDRY_ACTORS.executionAgent
    && state.audit.some((event) => event.eventId === report.priorEventId && event.outcome === "ACCEPTED");
}

function validPackReviewDecision(state: ScenarioFoundryState): boolean {
  const review = state.reviewDecision; const world = state.world; const context = state.contextReceipt; const contract = state.contract;
  const privacy = state.privacyReport; const quality = state.qualityReport;
  if (!review || !world || !context?.acceptedProfileHash || !contract || !privacy || !quality) return false;
  const { id, ...core } = review;
  const prior = state.audit.find((event) => event.eventId === review.priorEventId);
  return id === stableId("pack-review", core) && review.outcome === "APPROVED" && review.reviewerId === FOUNDRY_ACTORS.reviewer
    && review.actor.kind === "HUMAN" && review.actor.id === FOUNDRY_ACTORS.reviewer
    && review.requestId === state.requestId && review.packId === state.packId && review.generationRunId === world.generationRunId
    && review.acceptedProfileHash === context.acceptedProfileHash && review.contractHash === contract.contractHash
    && review.templateVersion === contract.templateVersion && review.generatorVersion === contract.generatorVersion
    && review.seed === contract.deterministicSeed && review.outputHash === world.outputHash
    && review.privacyReportHash === privacy.reportHash && review.qualityReportHash === quality.reportHash
    && review.capabilityPins.length === contract.requiredCapabilityPins.length
    && review.capabilityPins.every((pin, index) => pin.id === contract.requiredCapabilityPins[index]?.id && pin.version === contract.requiredCapabilityPins[index]?.version && pin.kind === contract.requiredCapabilityPins[index]?.kind)
    && prior?.type === "SUBMIT_FOR_REVIEW" && prior.outcome === "ACCEPTED";
}

function buildActivationReceipt(state: ScenarioFoundryState, actor: FoundryActor, at: string, reviewDecisionId: string, revalidationApprovalId: string | null, pins = currentPins(state)): ActivationReceipt | null {
  if (!reviewDecisionId) return null;
  const binding = fullBinding(state, actor, at, pins);
  if (!binding) return null;
  const core = { ...binding, reviewDecisionId, revalidationApprovalId, state: "ACTIVE" as const };
  return { id: stableId("activation-receipt", core), ...core };
}

function buildOracleReport(
  state: ScenarioFoundryState,
  actor: FoundryActor,
  at: string,
  evaluate: typeof evaluateOracleSuite,
): OracleEvaluationReport | null {
  if (!state.world || !state.contract) return null;
  const binding = fullBinding(state, actor, at, currentPins(state));
  if (!binding) return null;
  const evaluated = evaluate(state.world, state.contract);
  const core = { ...binding, label: "SIMULATED EVALUATION" as const, evaluatedPersonaIds: evaluated.evaluatedPersonaIds, outcome: evaluated.outcome, results: evaluated.results };
  return { id: stableId("oracle-report", core), ...core };
}

function validCurrentOracleReport(state: ScenarioFoundryState): boolean {
  const report = state.oracleReports.at(-1);
  const world = state.world;
  const context = state.contextReceipt;
  const contract = state.contract;
  const privacy = state.privacyReport;
  const quality = state.qualityReport;
  const activation = state.activationReceipts.at(-1);
  if (!report || !world || !context?.acceptedProfileHash || !contract || !privacy || !quality || !activation
    || report.label !== "SIMULATED EVALUATION" || report.outcome !== "PASS" || !scenarioReadiness(state, report.at).ready) return false;
  const expected = evaluateOracleSuite(world, contract);
  const { id, ...core } = report;
  const priorIndex = state.audit.findIndex((event) => event.eventId === report.priorEventId);
  const activationIndex = lastMatchingIndex(state.audit, (event) => (event.type === "ACTIVATE_PACK" || event.type === "REACTIVATE_PACK") && event.outcome === "ACCEPTED");
  const authorizedActor = (report.actor.kind === "AGENT" && report.actor.id === FOUNDRY_ACTORS.executionAgent)
    || (report.actor.kind === "HUMAN" && report.actor.id === FOUNDRY_ACTORS.requester);
  return id === stableId("oracle-report", core)
    && stableHash(report.results) === stableHash(expected.results)
    && stableHash(report.evaluatedPersonaIds) === stableHash(expected.evaluatedPersonaIds)
    && report.requestId === state.requestId && report.packId === state.packId
    && report.generationRunId === world.generationRunId && report.acceptedProfileHash === context.acceptedProfileHash
    && report.contractHash === contract.contractHash && report.templateVersion === contract.templateVersion
    && report.generatorVersion === contract.generatorVersion && report.seed === contract.deterministicSeed
    && report.outputHash === world.outputHash && report.privacyReportHash === privacy.reportHash
    && report.qualityReportHash === quality.reportHash && samePins(report.capabilityPins, currentPins(state))
    && authorizedActor && priorIndex >= activationIndex && activationIndex >= 0;
}

function buildRevalidationReport(state: ScenarioFoundryState, actor: FoundryActor, at: string, oracleReport: OracleEvaluationReport): RevalidationReport | null {
  if (!state.world || !state.contract || !state.revalidationMission) return null;
  const binding = fullBinding(state, actor, at, state.revalidationMission.requiredCapabilityPins);
  if (!binding) return null;
  const checks = revalidationChecks(state, oracleReport);
  if (!checks) return null;
  const core = { ...binding, missionId: state.revalidationMission.id, oracleReportId: oracleReport.id, outcome: checks.every((item) => item.outcome === "PASS") ? "PASS" as const : "FAIL" as const, checks };
  return { id: stableId("revalidation-report", core), ...core, reportHash: stableHash(core) };
}

function revalidationChecks(state: ScenarioFoundryState, oracleReport = state.oracleReports.at(-1)) {
  if (!state.world || !state.contract || !state.revalidationMission) return null;
  if (!oracleReport || oracleReport.outcome !== "PASS" || !samePins(oracleReport.capabilityPins, state.revalidationMission.requiredCapabilityPins)) return null;
  return [
    ...privacyChecks(state.world, state.contract),
    ...qualityChecks(state.world, state.contract),
    ...oracleReport.results.map((result) => ({ id: `revalidation:${result.assertionId}`, outcome: result.outcome, evidence: `${result.evidenceRecordIds.length} synthetic evidence record(s) bound; prohibited disclosures: ${result.disclosedProhibitedFactCodes.length}.` })),
    { id: "revalidation:capability-pin", outcome: state.revalidationMission.requiredCapabilityPins.some((pin) => pin.version !== state.contract?.requiredCapabilityPins.find((old) => old.id === pin.id)?.version) ? "PASS" as const : "FAIL" as const, evidence: "The report binds the reviewed replacement capability/runbook pin." },
  ];
}

function validCapabilityChange(state: ScenarioFoundryState, change: unknown): boolean {
  if (!isPlainRecord(change) || !hasExactDataKeys(change, ["id", "sourceLoopId", "changeId", "reviewDecisionId", "learningRecordId", "activationReceiptId", "capabilityId", "previousVersion", "nextVersion", "verifiedAt", "approvedBy", "humanDecisionActorId"])) return false;
  const candidate = change as unknown as Extract<FoundryAction, { type: "APPLY_VERIFIED_CAPABILITY_CHANGE" }>["change"];
  const pin = currentPins(state).find((current) => current.id === candidate.capabilityId);
  return Boolean(pin && pin.version === candidate.previousVersion && candidate.nextVersion !== candidate.previousVersion && isVerifiedPhaseThreeCapabilityChange(candidate));
}

function currentPins(state: ScenarioFoundryState): readonly CapabilityPin[] {
  return state.revalidationMission?.requiredCapabilityPins ?? state.contract?.requiredCapabilityPins ?? state.buildConfig.capabilityPins;
}

function updatedPins(state: ScenarioFoundryState, change: Extract<FoundryAction, { type: "APPLY_VERIFIED_CAPABILITY_CHANGE" }>["change"]): readonly CapabilityPin[] {
  return currentPins(state).map((pin) => pin.id === change.capabilityId ? { ...pin, version: change.nextVersion } : pin);
}

function validBuildConfig(value: unknown): value is FoundryBuildConfig {
  try {
    if (!isPlainRecord(value) || !hasExactDataKeys(value, ["policyVersion", "templateVersion", "generatorVersion", "capabilityPins"])) return false;
    const policy = typeof value.policyVersion === "string" && ["context-firewall:v1", "context-firewall:v1-reviewed"].includes(value.policyVersion);
    const template = typeof value.templateVersion === "string" && ["revenue-renewal:v1", "revenue-renewal:v1-reviewed"].includes(value.templateVersion);
    const generator = typeof value.generatorVersion === "string" && ["scenario-generator:v1", "scenario-generator:v1-reviewed"].includes(value.generatorVersion);
    const pins = Array.isArray(value.capabilityPins) && value.capabilityPins.length === 2
      && value.capabilityPins.every((candidate) => isPlainRecord(candidate) && hasExactDataKeys(candidate, ["id", "version", "kind"])
        && ((candidate.id === "claudeforce-public-skill-contract" && candidate.version === "2026-08-26-public" && candidate.kind === "CAPABILITY")
          || (candidate.id === "runbook:model-access" && typeof candidate.version === "string" && ["runbook:model-access:v1", "runbook:model-access:v2"].includes(candidate.version) && candidate.kind === "RUNBOOK")))
      && new Set(value.capabilityPins.map((pin) => isPlainRecord(pin) ? pin.id : null)).size === value.capabilityPins.length;
    return policy && template && generator && pins;
  } catch {
    return false;
  }
}

function validInitialIdentity(value: unknown): value is { requestId: string; packId: string } {
  return isPlainRecord(value) && hasExactDataKeys(value, ["requestId", "packId"])
    && typeof value.requestId === "string" && /^request:[a-z0-9:-]{1,120}$/.test(value.requestId)
    && typeof value.packId === "string" && /^pack:[a-z0-9:-]{1,120}$/.test(value.packId);
}

function safeActionShape(value: unknown): value is FoundryAction {
  if (!isPlainRecord(value)) return false;
  let descriptors: Record<string, PropertyDescriptor>;
  try { descriptors = Object.getOwnPropertyDescriptors(value); }
  catch { return false; }
  if (Object.values(descriptors).some((descriptor) => descriptor.get || descriptor.set || !("value" in descriptor))) return false;
  const type = descriptors.type?.value;
  const actor = descriptors.actor?.value;
  if (actor !== undefined && (!isPlainRecord(actor) || !hasExactDataKeys(actor, ["id", "kind"]))) return false;
  const payloadKeys: Partial<Record<FoundryActionType, readonly string[]>> = {
    ACCEPT_CONTEXT: ["input"],
    APPLY_VERIFIED_CAPABILITY_CHANGE: ["change"],
    PROPOSE_TEMPLATE_IMPROVEMENT: ["category"],
    EDIT_SAFE_DRAFT: ["draft"],
    EDIT_CONFIGURATION: ["buildConfig"],
  };
  if (typeof type !== "string" || !KNOWN_ACTIONS.has(type as FoundryActionType)) return true;
  return hasExactKeys(value, [...ACTION_BASE_KEYS, ...(payloadKeys[type as FoundryActionType] ?? [])]);
}

function hasExactDataKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  if (!hasExactKeys(value, keys)) return false;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.values(descriptors).every((descriptor) => !descriptor.get && !descriptor.set && "value" in descriptor);
  } catch {
    return false;
  }
}

function samePins(left: readonly CapabilityPin[], right: readonly CapabilityPin[]): boolean {
  return left.length === right.length
    && left.every((pin, index) => pin.id === right[index]?.id && pin.version === right[index]?.version && pin.kind === right[index]?.kind);
}

function lastMatchingIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}

function lastAcceptedEventId(state: ScenarioFoundryState): string | null {
  for (let index = state.audit.length - 1; index >= 0; index -= 1) {
    if (state.audit[index]?.outcome === "ACCEPTED") return state.audit[index]!.eventId;
  }
  return null;
}

function safeAuditTimestamp(state: ScenarioFoundryState, candidate: unknown): string {
  const previous = state.audit.at(-1)?.at ?? FOUNDRY_UTC_ANCHOR;
  if (isExactUtcIso(candidate) && Date.parse(candidate) > Date.parse(previous)) return candidate;
  return new Date(Date.parse(previous) + 1).toISOString();
}

function firewallOptions(state: ScenarioFoundryState, action: FoundryAction) {
  return { requestId: state.requestId, packId: state.packId, requestingActorId: "sofia" as const, at: action.at, policyVersion: state.buildConfig.policyVersion };
}

function safeDraftFromAcceptedProfile(profile: SafeDemoSignalProfile): SafeDemoSignalInput {
  return {
    sourceMode: profile.sourceMode,
    industryArchetype: profile.industryArchetype,
    organizationSizeBand: profile.organizationSizeBand,
    geographicRegion: profile.geographicRegion === "AMERICAS" ? "NORTH_AMERICA" : "EUROPE",
    locale: profile.locale,
    timeZone: profile.timeZone,
    salesMotion: profile.salesMotion,
    demoAudience: profile.demoAudience,
    useCaseTags: [...profile.useCaseTags],
    objectFamilies: [...profile.objectFamilies],
    recordVolumeBand: profile.recordVolumeBand === "COMPACT" ? "SMALL" : "MEDIUM",
    salesCycleBand: profile.salesCycleBand,
    valueBand: profile.valueBand,
    lifecycleStages: [...profile.lifecycleStages],
    scenarioGoals: [...profile.scenarioGoals],
    edgeCases: [...profile.edgeCases],
    packOwnerId: profile.packOwnerId,
    ttlHours: profile.ttlHours,
    seed: profile.seed,
  };
}

function safeBuildConfig(value: FoundryBuildConfig): FoundryBuildConfig | null {
  try {
    return {
      policyVersion: value.policyVersion,
      templateVersion: value.templateVersion,
      generatorVersion: value.generatorVersion,
      capabilityPins: value.capabilityPins.map((pin) => ({ id: pin.id, version: pin.version, kind: pin.kind })),
    };
  } catch {
    return null;
  }
}

function rejected(state: ScenarioFoundryState, action: FoundryAction, reasonCode: string) {
  if (reasonCode === "IDEMPOTENT_NO_CHANGE") return state;
  return withAudit(state, action, "REJECTED", reasonCode);
}
function accepted(state: ScenarioFoundryState, action: FoundryAction, reasonCode: string) { return withAudit(state, action, "ACCEPTED", reasonCode); }
function withAudit(state: ScenarioFoundryState, action: FoundryAction, outcome: "ACCEPTED" | "REJECTED", reasonCode: string): ScenarioFoundryState {
  const knownType = typeof action.type === "string" && KNOWN_ACTIONS.has(action.type as FoundryActionType) ? action.type as FoundryActionType : "UNKNOWN";
  const eventId = knownType === "UNKNOWN" ? `invalid-event:${state.processedEventIds.length + 1}` : expectedFoundryEventId(state, knownType);
  const actor = safeAuditActor(action.actor);
  const at = safeAuditTimestamp(state, action.at);
  return {
    ...state,
    revision: state.revision + 1,
    processedEventIds: [...state.processedEventIds, eventId],
    audit: [...state.audit, { eventId, type: knownType, requestId: state.requestId, packId: state.packId, actor, at, outcome, reasonCode, priorEventId: state.audit.at(-1)?.eventId ?? null }],
  };
}

function safeAuditActor(actor: FoundryActor | undefined): FoundryActor {
  const expectedKinds: Readonly<Record<string, FoundryActor["kind"]>> = {
    [FOUNDRY_ACTORS.requester]: "HUMAN",
    [FOUNDRY_ACTORS.reviewer]: "HUMAN",
    [FOUNDRY_ACTORS.administrator]: "HUMAN",
    [FOUNDRY_ACTORS.productLiaison]: "HUMAN",
    [FOUNDRY_ACTORS.executionAgent]: "AGENT",
    [FOUNDRY_ACTORS.capabilitySystem]: "SYSTEM",
  };
  return actor && expectedKinds[actor.id] === actor.kind
    ? { id: actor.id, kind: actor.kind }
    : { id: "unknown-actor", kind: "SYSTEM" };
}

function malformedActionAudit(state: ScenarioFoundryState): ScenarioFoundryState {
  const eventId = `invalid-event:${state.processedEventIds.length + 1}`;
  return {
    ...state,
    revision: state.revision + 1,
    processedEventIds: [...state.processedEventIds, eventId],
    audit: [...state.audit, {
      eventId,
      type: "UNKNOWN",
      requestId: state.requestId,
      packId: state.packId,
      actor: { id: "unknown-actor", kind: "SYSTEM" },
      at: safeAuditTimestamp(state, undefined),
      outcome: "REJECTED",
      reasonCode: "INVALID_ACTION_ENVELOPE",
      priorEventId: state.audit.at(-1)?.eventId ?? null,
    }],
  };
}

const KNOWN_ACTIONS = new Set<FoundryActionType>([
  "ACCEPT_CONTEXT", "COMPILE_CONTRACT", "GENERATE_WORLD", "RUN_PRIVACY_VALIDATION", "RUN_QUALITY_VALIDATION",
  "SUBMIT_FOR_REVIEW", "APPROVE_PACK", "ACTIVATE_PACK", "RUN_ORACLE_EVALUATIONS",
  "APPLY_VERIFIED_CAPABILITY_CHANGE", "RUN_REVALIDATION", "APPROVE_REVALIDATION", "REACTIVATE_PACK",
  "RESET_WORLD", "TEARDOWN_WORLD", "EXPIRE_PACK", "PROPOSE_TEMPLATE_IMPROVEMENT", "MARK_EXPORTED",
  "EDIT_SAFE_DRAFT", "EDIT_CONFIGURATION", "RESTART",
]);

const ACTION_BASE_KEYS = ["type", "eventId", "requestId", "packId", "expectedRevision", "actor", "at", "priorEventId"] as const;

function validRevalidationReport(state: ScenarioFoundryState): boolean {
  const report = state.revalidationReport;
  const mission = state.revalidationMission;
  const oracleReport = state.oracleReports.find((candidate) => candidate.id === report?.oracleReportId);
  const world = state.world;
  const context = state.contextReceipt;
  const contract = state.contract;
  const privacy = state.privacyReport;
  const quality = state.qualityReport;
  const expectedOracle = world && contract ? evaluateOracleSuite(world, contract) : null;
  const expectedChecks = revalidationChecks(state, oracleReport);
  if (!report || !mission || !oracleReport || !world || !context?.acceptedProfileHash || !contract || !privacy || !quality || !expectedOracle || !expectedChecks) return false;
  const { id: reportId, reportHash, ...reportCore } = report;
  const { id: oracleReportId, ...oracleCore } = oracleReport;
  const prior = state.audit.find((event) => event.eventId === report.priorEventId);
  return report.outcome === "PASS" && reportHash === stableHash(reportCore) && reportId === stableId("revalidation-report", reportCore)
    && stableHash(report.checks) === stableHash(expectedChecks) && report.missionId === mission.id
    && report.oracleReportId === oracleReport.id && report.actor.kind === "AGENT" && report.actor.id === FOUNDRY_ACTORS.executionAgent
    && report.requestId === state.requestId && report.packId === state.packId && report.generationRunId === world.generationRunId
    && report.acceptedProfileHash === context.acceptedProfileHash && report.contractHash === contract.contractHash
    && report.templateVersion === contract.templateVersion && report.generatorVersion === contract.generatorVersion
    && report.seed === contract.deterministicSeed && report.outputHash === world.outputHash
    && report.privacyReportHash === privacy.reportHash && report.qualityReportHash === quality.reportHash
    && samePins(report.capabilityPins, mission.requiredCapabilityPins)
    && prior?.type === "APPLY_VERIFIED_CAPABILITY_CHANGE" && prior.outcome === "ACCEPTED"
    && oracleReportId === stableId("oracle-report", oracleCore) && oracleReport.outcome === "PASS"
    && stableHash(oracleReport.results) === stableHash(expectedOracle.results)
    && stableHash(oracleReport.evaluatedPersonaIds) === stableHash(expectedOracle.evaluatedPersonaIds)
    && oracleReport.actor.kind === "AGENT" && oracleReport.actor.id === FOUNDRY_ACTORS.executionAgent
    && oracleReport.requestId === report.requestId && oracleReport.packId === report.packId
    && oracleReport.generationRunId === report.generationRunId && oracleReport.acceptedProfileHash === report.acceptedProfileHash
    && oracleReport.contractHash === report.contractHash && oracleReport.templateVersion === report.templateVersion
    && oracleReport.generatorVersion === report.generatorVersion && oracleReport.seed === report.seed
    && oracleReport.outputHash === report.outputHash && oracleReport.privacyReportHash === report.privacyReportHash
    && oracleReport.qualityReportHash === report.qualityReportHash && samePins(oracleReport.capabilityPins, mission.requiredCapabilityPins)
    && oracleReport.at === report.at && oracleReport.priorEventId === report.priorEventId;
}

function validRevalidationApproval(state: ScenarioFoundryState) {
  const approval = state.revalidationApproval; const report = state.revalidationReport; const stale = state.stalenessReceipt;
  const world = state.world; const context = state.contextReceipt; const contract = state.contract; const privacy = state.privacyReport; const quality = state.qualityReport;
  const oracleReport = state.oracleReports.find((candidate) => candidate.id === report?.oracleReportId);
  const expectedOracle = world && contract ? evaluateOracleSuite(world, contract) : null;
  const expectedChecks = revalidationChecks(state, oracleReport);
  if (!approval || !report || !stale || !state.revalidationMission || !world || !context?.acceptedProfileHash || !contract || !privacy || !quality || !oracleReport || !expectedOracle || !expectedChecks || report.outcome !== "PASS" || !validRevalidationReport(state)) return false;
  const { id: reportId, reportHash, ...reportCore } = report;
  const { id: oracleReportId, ...oracleCore } = oracleReport;
  const { id: approvalId, ...approvalCore } = approval;
  const { id: staleId, ...staleCore } = stale;
  const reportPrior = state.audit.find((event) => event.eventId === report.priorEventId);
  const approvalPrior = state.audit.find((event) => event.eventId === approval.priorEventId);
  const stalenessPrior = state.activationReceipts.find((receipt) => receipt.id === stale.priorActivationReceiptId);
  return oracleReportId === stableId("oracle-report", oracleCore) && oracleReport.outcome === "PASS"
    && stableHash(oracleReport.results) === stableHash(expectedOracle.results)
    && stableHash(oracleReport.evaluatedPersonaIds) === stableHash(expectedOracle.evaluatedPersonaIds)
    && oracleReport.actor.kind === "AGENT" && oracleReport.actor.id === FOUNDRY_ACTORS.executionAgent
    && samePins(oracleReport.capabilityPins, state.revalidationMission.requiredCapabilityPins)
    && oracleReport.requestId === state.requestId && oracleReport.packId === state.packId
    && oracleReport.generationRunId === world.generationRunId && oracleReport.acceptedProfileHash === context.acceptedProfileHash
    && oracleReport.contractHash === contract.contractHash && oracleReport.outputHash === world.outputHash
    && oracleReport.privacyReportHash === privacy.reportHash && oracleReport.qualityReportHash === quality.reportHash
    && reportPrior?.type === "APPLY_VERIFIED_CAPABILITY_CHANGE"
    && report.oracleReportId === oracleReport.id
    && reportHash === stableHash(reportCore) && reportId === stableId("revalidation-report", reportCore)
    && stableHash(report.checks) === stableHash(expectedChecks) && report.missionId === state.revalidationMission.id
    && report.actor.kind === "AGENT" && report.actor.id === FOUNDRY_ACTORS.executionAgent
    && reportPrior?.type === "APPLY_VERIFIED_CAPABILITY_CHANGE" && reportPrior.outcome === "ACCEPTED"
    && approvalId === stableId("revalidation-approval", approvalCore)
    && staleId === stableId("staleness-receipt", staleCore) && Boolean(stalenessPrior)
    && isVerifiedPhaseThreeCapabilityChange(stale.capabilityChange)
    && approval.reportId === report.id && approval.reportHash === report.reportHash && approval.stalenessReceiptId === stale.id
    && approval.requestId === state.requestId && approval.packId === state.packId && approval.generationRunId === state.world?.generationRunId
    && approval.acceptedProfileHash === context.acceptedProfileHash && approval.contractHash === contract.contractHash
    && approval.templateVersion === contract.templateVersion && approval.generatorVersion === contract.generatorVersion
    && approval.seed === contract.deterministicSeed && approval.outputHash === world.outputHash
    && approval.privacyReportHash === privacy.reportHash && approval.qualityReportHash === quality.reportHash
    && approval.capabilityPins.length === state.revalidationMission.requiredCapabilityPins.length
    && approval.capabilityPins.every((pin, index) => pin.id === state.revalidationMission?.requiredCapabilityPins[index]?.id && pin.version === state.revalidationMission?.requiredCapabilityPins[index]?.version && pin.kind === state.revalidationMission?.requiredCapabilityPins[index]?.kind)
    && approval.actor.kind === "HUMAN" && approval.actor.id === FOUNDRY_ACTORS.reviewer && approval.approvedBy === FOUNDRY_ACTORS.reviewer
    && approvalPrior?.type === "RUN_REVALIDATION" && approvalPrior.outcome === "ACCEPTED";
}
