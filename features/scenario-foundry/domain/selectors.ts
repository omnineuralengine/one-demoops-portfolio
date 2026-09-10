import { FOUNDRY_UTC_ANCHOR } from "../fixture";
import { isVerifiedPhaseThreeCapabilityChange } from "./capability";
import { canonicalStringify, stableHash, stableId } from "./canonical";
import { compileSyntheticDataContract } from "./contract";
import { evaluateContextFirewall } from "./firewall";
import { generateSyntheticWorld } from "./generator";
import { evaluateOracleSuite } from "./oracle";
import { createPrivacyReport, createQualityReport, privacyChecks, qualityChecks } from "./validators";
import type {
  CapabilityPin,
  FoundryActor,
  FoundryPhase,
  FullEvidenceBinding,
  OracleEvaluationReport,
  ResetReceipt,
  ScenarioFoundryState,
  ScenarioReadiness,
  TeardownReceipt,
  ValidationCheck,
} from "./types";

interface IntegrityResult {
  readonly baseEvidenceValid: boolean;
  readonly initialOracleReportValid: boolean;
  readonly revalidationChainValid: boolean;
  readonly activationValid: boolean;
  readonly validatedOracleAssertions: number | "Insufficient observations";
}

export function scenarioReadiness(state: ScenarioFoundryState, evaluatedAt = state.audit.at(-1)?.at ?? FOUNDRY_UTC_ANCHOR): ScenarioReadiness {
  const integrity = inspectCurrentIntegrity(state);
  const validatedOracleAssertions = integrity.validatedOracleAssertions;
  if (state.phase === "DESTROYED") return {
    ready: false,
    state: "DESTROYED",
    reason: teardownReceiptIsValid(state)
      ? "Verified teardown removed the generated world; old receipts cannot reactivate it."
      : "The generated world is absent, but the teardown evidence does not validate; old receipts cannot reactivate it.",
    validatedOracleAssertions,
  };
  if (state.phase === "EXPIRED") return { ready: false, state: "EXPIRED", reason: "The pack TTL expired and readiness was revoked.", validatedOracleAssertions };
  if (state.phase === "QUARANTINED") return { ready: false, state: "QUARANTINED", reason: "A safety or integrity gate failed; no activation is usable.", validatedOracleAssertions };
  if (state.phase === "STALE_REVALIDATION_REQUIRED" || state.phase === "REVALIDATED") return { ready: false, state: "STALE", reason: state.phase === "REVALIDATED" ? "New evidence passed, but separate approval and reactivation are still required." : "A verified capability change revoked readiness immediately.", validatedOracleAssertions };
  const expiresAt = state.contract?.expirationPolicy.expiresAt;
  const requiredEvaluationValid = state.stalenessReceipt ? integrity.revalidationChainValid : integrity.initialOracleReportValid;
  if (state.phase === "ACTIVE" && integrity.baseEvidenceValid && integrity.activationValid && requiredEvaluationValid
    && expiresAt && Number.isFinite(Date.parse(evaluatedAt)) && Date.parse(evaluatedAt) < Date.parse(expiresAt)) {
    return { ready: true, state: "READY", reason: "Current hashes, simulated oracle evidence, human approval, capability pins, and activation evidence agree for this browser-memory session.", validatedOracleAssertions };
  }
  return { ready: false, state: "NOT_READY", reason: "No currently usable activation receipt is bound to passing simulated evaluation evidence and every required approval.", validatedOracleAssertions };
}

export function currentScenarioEvidenceIsValid(state: ScenarioFoundryState): boolean {
  const integrity = inspectCurrentIntegrity(state);
  return integrity.baseEvidenceValid && integrity.activationValid
    && (state.stalenessReceipt ? integrity.revalidationChainValid : integrity.initialOracleReportValid);
}

export function currentScenarioBaseEvidenceIsValid(state: ScenarioFoundryState): boolean {
  return inspectCurrentIntegrity(state).baseEvidenceValid;
}

function inspectCurrentIntegrity(state: ScenarioFoundryState): IntegrityResult {
  try {
    const context = state.contextReceipt;
    const contract = state.contract;
    const world = state.world;
    const privacy = state.privacyReport;
    const quality = state.qualityReport;
    const review = state.reviewDecision;
    const activation = state.activationReceipts.at(-1);
    if (!context || !contract || !world || !privacy || !quality || !review || !activation) return invalidIntegrity();

    const expectedContext = evaluateContextFirewall(state.draft, {
      requestId: state.requestId,
      packId: state.packId,
      requestingActorId: "sofia",
      at: context.at,
      policyVersion: state.buildConfig.policyVersion,
    });
    const expectedContract = compileSyntheticDataContract(expectedContext, state.buildConfig, contract.compiledAt);
    const expectedWorld = generateSyntheticWorld(expectedContract);
    const expectedPrivacy = createPrivacyReport(expectedWorld, expectedContract, { id: "agent-demo-preflight", kind: "AGENT" }, privacy.at, privacy.priorEventId);
    const expectedQuality = createQualityReport(expectedWorld, expectedContract, { id: "agent-demo-preflight", kind: "AGENT" }, quality.at, quality.priorEventId);
    const baseEvidenceValid = context.validationOutcome === "ACCEPTED"
      && exactlyEqual(context, expectedContext)
      && exactlyEqual(contract, expectedContract)
      && exactlyEqual(world, expectedWorld)
      && exactlyEqual(privacy, expectedPrivacy)
      && exactlyEqual(quality, expectedQuality)
      && auditHas(state, privacy.priorEventId, "GENERATE_WORLD")
      && auditHas(state, quality.priorEventId, "RUN_PRIVACY_VALIDATION");
    if (!baseEvidenceValid) return invalidIntegrity();

    const reviewBinding = fullBinding(state, { id: "aisha", kind: "HUMAN" }, review.at, review.priorEventId, contract.requiredCapabilityPins);
    const reviewCore = reviewBinding ? { ...reviewBinding, outcome: "APPROVED" as const, reviewerId: "aisha" as const } : null;
    const expectedReview = reviewCore ? { id: stableId("pack-review", reviewCore), ...reviewCore } : null;
    const reviewValid = Boolean(expectedReview && exactlyEqual(review, expectedReview) && auditHas(state, review.priorEventId, "SUBMIT_FOR_REVIEW"));
    if (!reviewValid) return invalidIntegrity();

    const initialOracleReportValid = validOracleReport(state, state.oracleReports.at(-1), contract.requiredCapabilityPins);
    const revalidationChainValid = state.stalenessReceipt ? validRevalidationChain(state) : false;
    const expectedPins = state.stalenessReceipt ? state.revalidationMission?.requiredCapabilityPins ?? [] : contract.requiredCapabilityPins;
    const expectedRevalidationApprovalId = state.stalenessReceipt ? state.revalidationApproval?.id ?? null : null;
    const activationBinding = fullBinding(state, { id: "maya", kind: "HUMAN" }, activation.at, activation.priorEventId, expectedPins);
    const activationCore = activationBinding ? {
      ...activationBinding,
      reviewDecisionId: review.id,
      revalidationApprovalId: expectedRevalidationApprovalId,
      state: "ACTIVE" as const,
    } : null;
    const expectedActivation = activationCore ? { id: stableId("activation-receipt", activationCore), ...activationCore } : null;
    const expectedActivationPrior = state.stalenessReceipt ? "APPROVE_REVALIDATION" : "APPROVE_PACK";
    const activationValid = Boolean(expectedActivation && exactlyEqual(activation, expectedActivation)
      && auditHas(state, activation.priorEventId, expectedActivationPrior));
    const validEvaluation = state.stalenessReceipt ? revalidationChainValid : initialOracleReportValid;
    const validatedOracleAssertions = validEvaluation
      ? state.stalenessReceipt
        ? state.oracleReports.find((report) => report.id === state.revalidationReport?.oracleReportId)?.results.filter((result) => result.outcome === "PASS").length ?? 0
        : state.oracleReports.at(-1)?.results.filter((result) => result.outcome === "PASS").length ?? 0
      : "Insufficient observations" as const;
    return { baseEvidenceValid, initialOracleReportValid, revalidationChainValid, activationValid, validatedOracleAssertions };
  } catch {
    return invalidIntegrity();
  }
}

function validOracleReport(state: ScenarioFoundryState, report: OracleEvaluationReport | undefined, pins: readonly CapabilityPin[], mustFollowLatestActivation = true): boolean {
  if (!report || !state.world || !state.contract) return false;
  const actorAllowed = report.actor.id === "agent-demo-preflight" && report.actor.kind === "AGENT"
    || report.actor.id === "sofia" && report.actor.kind === "HUMAN";
  if (!actorAllowed) return false;
  const binding = fullBinding(state, { id: report.actor.id, kind: report.actor.kind }, report.at, report.priorEventId, pins);
  const evaluated = evaluateOracleSuite(state.world, state.contract);
  if (!binding) return false;
  const core = {
    ...binding,
    label: "SIMULATED EVALUATION" as const,
    evaluatedPersonaIds: evaluated.evaluatedPersonaIds,
    outcome: evaluated.outcome,
    results: evaluated.results,
  };
  const expected = { id: stableId("oracle-report", core), ...core };
  const priorIndex = state.audit.findIndex((event) => event.eventId === report.priorEventId && event.outcome === "ACCEPTED");
  const activationIndex = lastMatchingIndex(state.audit, (event) => (event.type === "ACTIVATE_PACK" || event.type === "REACTIVATE_PACK") && event.outcome === "ACCEPTED");
  return evaluated.outcome === "PASS" && exactlyEqual(report, expected) && priorIndex >= 0 && activationIndex >= 0
    && (!mustFollowLatestActivation || priorIndex >= activationIndex);
}

function validRevalidationChain(state: ScenarioFoundryState): boolean {
  const stale = state.stalenessReceipt;
  const mission = state.revalidationMission;
  const report = state.revalidationReport;
  const approval = state.revalidationApproval;
  const contract = state.contract;
  const priorActivation = state.activationReceipts.find((receipt) => receipt.id === stale?.priorActivationReceiptId);
  if (!stale || !mission || !report || !approval || !contract || !priorActivation || !state.world
    || !isVerifiedPhaseThreeCapabilityChange(stale.capabilityChange)) return false;
  const previousPin = contract.requiredCapabilityPins.find((pin) => pin.id === stale.capabilityChange.capabilityId);
  const expectedPins = contract.requiredCapabilityPins.map((pin) => pin.id === stale.capabilityChange.capabilityId
    ? { id: pin.id, version: stale.capabilityChange.nextVersion, kind: pin.kind }
    : { id: pin.id, version: pin.version, kind: pin.kind });
  if (!previousPin || previousPin.version !== stale.capabilityChange.previousVersion
    || stale.capabilityChange.nextVersion === stale.capabilityChange.previousVersion) return false;
  const staleBinding = fullBinding(state, { id: "scenario-foundry-system", kind: "SYSTEM" }, stale.at, stale.priorEventId, expectedPins);
  const staleCore = staleBinding ? {
    ...staleBinding,
    capabilityChange: stale.capabilityChange,
    priorActivationReceiptId: priorActivation.id,
    readinessRevoked: true as const,
  } : null;
  const expectedStale = staleCore ? { id: stableId("staleness-receipt", staleCore), ...staleCore } : null;
  const expectedMission = expectedStale ? {
    id: stableId("revalidation-mission", { packId: state.packId, stalenessReceiptId: expectedStale.id }),
    packId: state.packId,
    stalenessReceiptId: expectedStale.id,
    requiredCapabilityPins: expectedPins,
    state: "DRAFT" as const,
    ownerId: "maya" as const,
    reviewerId: "aisha" as const,
  } : null;
  if (!expectedStale || !expectedMission || !exactlyEqual(stale, expectedStale) || !exactlyEqual(mission, expectedMission)
    || !auditAccepted(state, stale.priorEventId)) return false;

  const oracleReport = state.oracleReports.find((candidate) => candidate.id === report.oracleReportId);
  const reportBinding = fullBinding(state, { id: "agent-demo-preflight", kind: "AGENT" }, report.at, report.priorEventId, expectedPins);
  const checks = expectedRevalidationChecks(state, expectedPins);
  if (!reportBinding || !checks || !validOracleReport(state, oracleReport, expectedPins, false)) return false;
  const reportCore = {
    ...reportBinding,
    missionId: mission.id,
    oracleReportId: oracleReport!.id,
    outcome: checks.every((check) => check.outcome === "PASS") ? "PASS" as const : "FAIL" as const,
    checks,
  };
  const expectedReport = { id: stableId("revalidation-report", reportCore), ...reportCore, reportHash: stableHash(reportCore) };
  if (expectedReport.outcome !== "PASS" || !exactlyEqual(report, expectedReport) || !auditHas(state, report.priorEventId, "APPLY_VERIFIED_CAPABILITY_CHANGE")) return false;

  const approvalBinding = fullBinding(state, { id: "aisha", kind: "HUMAN" }, approval.at, approval.priorEventId, expectedPins);
  if (!approvalBinding) return false;
  const approvalCore = {
    ...approvalBinding,
    reportId: report.id,
    reportHash: report.reportHash,
    stalenessReceiptId: stale.id,
    approvedBy: "aisha" as const,
    outcome: "APPROVED" as const,
  };
  const expectedApproval = { id: stableId("revalidation-approval", approvalCore), ...approvalCore };
  return exactlyEqual(approval, expectedApproval) && auditHas(state, approval.priorEventId, "RUN_REVALIDATION");
}

function expectedRevalidationChecks(state: ScenarioFoundryState, expectedPins: readonly CapabilityPin[]): readonly ValidationCheck[] | null {
  if (!state.world || !state.contract) return null;
  const oracle = evaluateOracleSuite(state.world, state.contract);
  const capabilityChanged = expectedPins.some((pin) => pin.version !== state.contract?.requiredCapabilityPins.find((old) => old.id === pin.id)?.version);
  return [
    ...privacyChecks(state.world, state.contract),
    ...qualityChecks(state.world, state.contract),
    ...oracle.results.map((result) => ({
      id: `revalidation:${result.assertionId}`,
      outcome: result.outcome,
      evidence: `${result.evidenceRecordIds.length} synthetic evidence record(s) bound; prohibited disclosures: ${result.disclosedProhibitedFactCodes.length}.`,
    })),
    { id: "revalidation:capability-pin", outcome: capabilityChanged ? "PASS" as const : "FAIL" as const, evidence: "The report binds the reviewed replacement capability/runbook pin." },
  ];
}

function fullBinding(state: ScenarioFoundryState, actor: FoundryActor, at: string, priorEventId: string, pins: readonly CapabilityPin[]): FullEvidenceBinding | null {
  if (!state.contextReceipt?.acceptedProfileHash || !state.contract || !state.world || !state.privacyReport || !state.qualityReport) return null;
  return {
    requestId: state.requestId,
    packId: state.packId,
    generationRunId: state.world.generationRunId,
    acceptedProfileHash: state.contextReceipt.acceptedProfileHash,
    contractHash: state.contract.contractHash,
    templateVersion: state.contract.templateVersion,
    generatorVersion: state.contract.generatorVersion,
    seed: state.contract.deterministicSeed,
    outputHash: state.world.outputHash,
    privacyReportHash: state.privacyReport.reportHash,
    qualityReportHash: state.qualityReport.reportHash,
    capabilityPins: pins.map((pin) => ({ id: pin.id, version: pin.version, kind: pin.kind })),
    actor: { id: actor.id, kind: actor.kind },
    at,
    priorEventId,
  };
}

function auditHas(state: ScenarioFoundryState, eventId: string, type: string): boolean {
  return state.audit.some((event) => event.eventId === eventId && event.type === type && event.outcome === "ACCEPTED");
}

function auditAccepted(state: ScenarioFoundryState, eventId: string): boolean {
  return state.audit.some((event) => event.eventId === eventId && event.outcome === "ACCEPTED");
}

function exactlyEqual(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

function invalidIntegrity(): IntegrityResult {
  return {
    baseEvidenceValid: false,
    initialOracleReportValid: false,
    revalidationChainValid: false,
    activationValid: false,
    validatedOracleAssertions: "Insufficient observations",
  };
}

function lastMatchingIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}

export function scenarioMeasurements(state: ScenarioFoundryState) {
  const readiness = scenarioReadiness(state);
  const evidenceValid = currentScenarioBaseEvidenceIsValid(state);
  return {
    privacyGate: evidenceValid ? state.privacyReport?.outcome ?? "Insufficient observations" : "Insufficient observations",
    referentialIntegrity: evidenceValid ? state.qualityReport?.checks.find((check) => check.id === "quality:referential-integrity")?.outcome ?? "Insufficient observations" : "Insufficient observations",
    permissionBoundary: evidenceValid ? state.qualityReport?.checks.find((check) => check.id === "quality:permission-positive-negative")?.outcome ?? "Insufficient observations" : "Insufficient observations",
    deterministicReplay: evidenceValid ? state.qualityReport?.checks.find((check) => check.id === "quality:deterministic-replay")?.outcome ?? "Insufficient observations" : "Insufficient observations",
    scenarioFreshness: readiness.state,
    readiness: readiness.ready ? "READY" : "NOT_READY",
    resetOrTeardown: teardownReceiptIsValid(state) ? "DESTROYED_VERIFIED" : state.resetReceipts.some((receipt) => resetReceiptIsValid(state, receipt)) ? "RESET_VERIFIED" : "Insufficient observations",
    validatedOracleAssertions: readiness.validatedOracleAssertions,
  } as const;
}

export function scenarioProvenance(state: ScenarioFoundryState) {
  const world = state.world;
  return {
    sourceMode: state.contextReceipt?.acceptedProfile?.sourceMode ?? state.draft.sourceMode,
    noSalesforceConnectionOrProductionData: true as const,
    acceptedSignalCategories: state.contextReceipt?.decisions.filter((item) => item.disposition === "ACCEPTED_UNCHANGED" || item.disposition === "COARSENED_INTO_APPROVED_BAND").map((item) => item.field) ?? [],
    contractVersion: state.contract?.version ?? null,
    generatorVersion: state.contract?.generatorVersion ?? state.buildConfig.generatorVersion,
    templateVersion: state.contract?.templateVersion ?? state.buildConfig.templateVersion,
    seed: state.contract?.deterministicSeed ?? state.draft.seed,
    utcAnchor: state.contract?.timelineAnchor ?? FOUNDRY_UTC_ANCHOR,
    entityCounts: world ? {
      accounts: world.records.accounts.length, contacts: world.records.contacts.length,
      opportunities: world.records.opportunities.length, cases: world.records.cases.length,
      activities: world.records.activities.length,
    } : null,
    capabilityPins: state.revalidationMission?.requiredCapabilityPins ?? state.contract?.requiredCapabilityPins ?? state.buildConfig.capabilityPins,
    privacyOutcome: state.privacyReport?.outcome ?? "Insufficient observations",
    qualityOutcome: state.qualityReport?.outcome ?? "Insufficient observations",
    createdAt: world?.generatedAt ?? state.teardownReceipt?.generatedAt ?? null,
    expiresAt: state.contract?.expirationPolicy.expiresAt ?? null,
    owner: "maya",
    reviewer: state.reviewDecision?.reviewerId ?? "aisha",
    knownLimitations: ["One browser-memory pack", "No Salesforce connection", "No model call", "Fictional role model only"],
    exportStatus: state.exportStatus,
    resetOrTeardownStatus: teardownReceiptIsValid(state) ? "DESTROYED_VERIFIED" : state.resetReceipts.some((receipt) => resetReceiptIsValid(state, receipt)) ? "RESET_VERIFIED" : "NOT_RUN",
  };
}

export function resetReceiptIsValid(state: ScenarioFoundryState, receipt: ResetReceipt): boolean {
  if (!state.world || !state.contract || receipt.actor.id !== "maya" || receipt.actor.kind !== "HUMAN") return false;
  try {
    const expectedWorld = generateSyntheticWorld(state.contract);
    const activation = state.activationReceipts.find((candidate) => candidate.id === receipt.activationReceiptId);
    if (!activation || !exactlyEqual(state.world, expectedWorld) || !currentScenarioEvidenceIsValid(state)) return false;
    const { id: activationId, ...activationCore } = activation;
    if (activationId !== stableId("activation-receipt", activationCore)
      || activation.actor.id !== "maya" || activation.actor.kind !== "HUMAN") return false;
    const binding = fullBinding(state, receipt.actor, receipt.at, receipt.priorEventId, activation.capabilityPins);
    if (!binding) return false;
    const core = { ...binding, activationReceiptId: activation.id, restoredOutputHash: expectedWorld.outputHash, outcome: "PASS" as const };
    const expected = { id: stableId("reset-receipt", core), ...core };
    return exactlyEqual(receipt, expected) && auditAccepted(state, receipt.priorEventId)
      && state.audit.some((event) => event.type === "RESET_WORLD" && event.outcome === "ACCEPTED"
        && event.at === receipt.at && event.actor.id === "maya");
  } catch {
    return false;
  }
}

export function teardownReceiptIsValid(state: ScenarioFoundryState, receipt: TeardownReceipt | null = state.teardownReceipt): boolean {
  if (!receipt || state.phase !== "DESTROYED" || state.world !== null || receipt.actor.id !== "maya" || receipt.actor.kind !== "HUMAN") return false;
  try {
    const priorState = replayStateBeforeTeardown(state, receipt);
    if (!priorState || priorState.phase !== receipt.priorPhase) return false;
    const contract = state.contract;
    const expectedWorld = priorState.worldPresent && contract ? generateSyntheticWorld(contract) : null;
    if (priorState.worldPresent !== Boolean(expectedWorld)) return false;
    const activation = state.activationReceipts.at(-1);
    const expectedPins = state.revalidationMission?.requiredCapabilityPins ?? contract?.requiredCapabilityPins ?? state.buildConfig.capabilityPins;
    const oracleReport = state.oracleReports.at(-1);
    const historicalPins = oracleReport && state.revalidationReport?.oracleReportId === oracleReport.id
      ? state.revalidationMission?.requiredCapabilityPins ?? []
      : contract?.requiredCapabilityPins ?? [];
    const evidenceState = expectedWorld ? { ...state, phase: receipt.priorPhase, world: expectedWorld } : null;
    const oracleEvidenceValid = state.oracleReports.length === 0
      ? oracleReport === undefined
      : Boolean(oracleReport && evidenceState && historicalOracleReportIsValid(evidenceState, oracleReport, historicalPins));
    const expectedCore = {
      requestId: state.requestId,
      packId: state.packId,
      priorPhase: priorState.phase,
      destroyedGenerationRunId: expectedWorld?.generationRunId ?? null,
      generatedAt: expectedWorld?.generatedAt ?? null,
      acceptedProfileHash: state.contextReceipt?.acceptedProfileHash ?? null,
      contractHash: contract?.contractHash ?? null,
      templateVersion: contract?.templateVersion ?? null,
      generatorVersion: contract?.generatorVersion ?? null,
      seed: contract?.deterministicSeed ?? null,
      destroyedOutputHash: expectedWorld?.outputHash ?? null,
      privacyReportHash: state.privacyReport?.reportHash ?? null,
      qualityReportHash: state.qualityReport?.reportHash ?? null,
      capabilityPins: expectedPins.map((pin) => ({ id: pin.id, version: pin.version, kind: pin.kind })),
      activationReceiptId: activation?.id ?? null,
      oracleReportId: oracleReport?.id ?? null,
      oracleOutcome: oracleReport?.outcome ?? null,
      revalidationApprovalId: state.revalidationApproval?.id ?? null,
      finalState: "DESTROYED" as const,
      actor: { id: "maya", kind: "HUMAN" as const },
      at: receipt.at,
      priorEventId: receipt.priorEventId,
    };
    return oracleEvidenceValid && (receipt.priorEventId === null || auditAccepted(state, receipt.priorEventId))
      && receipt.id === stableId("teardown-receipt", expectedCore) && exactlyEqual(receipt, { id: receipt.id, ...expectedCore })
      && state.audit.some((event) => event.type === "TEARDOWN_WORLD" && event.outcome === "ACCEPTED"
        && event.at === receipt.at && event.actor.id === "maya");
  } catch {
    return false;
  }
}

function historicalOracleReportIsValid(
  state: ScenarioFoundryState,
  report: OracleEvaluationReport,
  pins: readonly CapabilityPin[],
): boolean {
  if (report.outcome === "PASS") return validOracleReport(state, report, pins, false);
  if (report.outcome !== "FAIL" || !state.world || !state.contract || pins.length === 0) return false;
  const actorAllowed = report.actor.id === "agent-demo-preflight" && report.actor.kind === "AGENT"
    || report.actor.id === "sofia" && report.actor.kind === "HUMAN";
  const knownAssertionIds = new Set(state.world.oracle.assertions.map((assertion) => assertion.id));
  const reportedAssertionIds = report.results.map((result) => result.assertionId);
  const boundedFailure = report.results.length <= state.world.oracle.assertions.length
    && report.evaluatedPersonaIds.length <= 6
    && new Set(reportedAssertionIds).size === reportedAssertionIds.length
    && reportedAssertionIds.every((id) => knownAssertionIds.has(id))
    && (report.results.length !== state.world.oracle.assertions.length || report.results.some((result) => result.outcome === "FAIL"));
  const binding = fullBinding(state, report.actor, report.at, report.priorEventId, pins);
  if (!actorAllowed || !boundedFailure || !binding) return false;
  const core = {
    ...binding,
    label: "SIMULATED EVALUATION" as const,
    evaluatedPersonaIds: report.evaluatedPersonaIds,
    outcome: "FAIL" as const,
    results: report.results,
  };
  const priorIndex = state.audit.findIndex((event) => event.eventId === report.priorEventId && event.outcome === "ACCEPTED");
  const activationIndex = lastMatchingIndex(state.audit, (event) => (event.type === "ACTIVATE_PACK" || event.type === "REACTIVATE_PACK") && event.outcome === "ACCEPTED");
  return report.id === stableId("oracle-report", core) && exactlyEqual(report, { id: report.id, ...core })
    && priorIndex >= activationIndex && activationIndex >= 0;
}

interface ReplayedTeardownState {
  readonly phase: Exclude<FoundryPhase, "DESTROYED">;
  readonly worldPresent: boolean;
}

function replayStateBeforeTeardown(state: ScenarioFoundryState, receipt: TeardownReceipt): ReplayedTeardownState | null {
  let replayed: ReplayedTeardownState = { phase: "DRAFT", worldPresent: false };
  for (const event of state.audit) {
    if (event.requestId !== state.requestId || event.packId !== state.packId || event.outcome !== "ACCEPTED") continue;
    if (event.type === "TEARDOWN_WORLD") {
      return event.at === receipt.at && event.actor.id === "maya" ? replayed : null;
    }
    switch (event.reasonCode) {
      case "DESCENDANTS_INVALIDATED":
      case "NEW_SINGLE_PACK_LIFECYCLE_STARTED":
        replayed = { phase: "DRAFT", worldPresent: false };
        break;
      case "SAFE_CONTEXT_ACCEPTED": replayed = { phase: "INTAKE_ACCEPTED", worldPresent: false }; break;
      case "CONTEXT_QUARANTINED_BY_POLICY": replayed = { phase: "QUARANTINED", worldPresent: false }; break;
      case "CONTRACT_COMPILED": replayed = { phase: "BLUEPRINTED", worldPresent: false }; break;
      case "SYNTHETIC_WORLD_GENERATED": replayed = { phase: "GENERATED", worldPresent: true }; break;
      case "PRIVACY_VALIDATED": replayed = { phase: "PRIVACY_VALIDATED", worldPresent: true }; break;
      case "PRIVACY_QUARANTINED": replayed = { phase: "QUARANTINED", worldPresent: true }; break;
      case "PRIVACY_QUARANTINED_INVALID_WORLD_SCHEMA": replayed = { phase: "QUARANTINED", worldPresent: false }; break;
      case "QUALITY_VALIDATED": replayed = { phase: "QUALITY_VALIDATED", worldPresent: true }; break;
      case "QUALITY_QUARANTINED": replayed = { phase: "QUARANTINED", worldPresent: true }; break;
      case "QUALITY_QUARANTINED_INVALID_WORLD_SCHEMA": replayed = { phase: "QUARANTINED", worldPresent: false }; break;
      case "HUMAN_REVIEW_REQUESTED": replayed = { phase: "REVIEW_REQUIRED", worldPresent: true }; break;
      case "PACK_APPROVED_FOR_ACTIVATION": replayed = { phase: "APPROVED", worldPresent: true }; break;
      case "PACK_ACTIVATED_FOR_ONE_SIMULATED_SESSION":
      case "SIMULATED_EVALUATION_PASSED":
      case "READINESS_RESTORED_WITH_NEW_EVIDENCE":
        replayed = { phase: "ACTIVE", worldPresent: true };
        break;
      case "SIMULATED_EVALUATION_QUARANTINED":
      case "REVALIDATION_QUARANTINED":
        replayed = { phase: "QUARANTINED", worldPresent: true };
        break;
      case "READINESS_REVOKED_CAPABILITY_CHANGED": replayed = { phase: "STALE_REVALIDATION_REQUIRED", worldPresent: true }; break;
      case "REVALIDATION_EVIDENCE_PASSED": replayed = { phase: "REVALIDATED", worldPresent: true }; break;
      case "PACK_EXPIRED_READINESS_REVOKED": replayed = { phase: "EXPIRED", worldPresent: true }; break;
      case "REVALIDATION_EVIDENCE_APPROVED":
      case "WORLD_RESET_VERIFIED":
      case "INACTIVE_IMPROVEMENT_CANDIDATE_CREATED":
      case "ALLOWLISTED_JSON_EXPORTED_BY_USER":
        break;
      default:
        return null;
    }
  }
  return null;
}
