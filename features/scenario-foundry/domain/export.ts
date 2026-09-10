import { canonicalStringify, stableId } from "./canonical";
import { currentScenarioEvidenceIsValid, resetReceiptIsValid, scenarioReadiness } from "./selectors";
import type { ScenarioExport, ScenarioFoundryState } from "./types";

export function buildScenarioExport(state: ScenarioFoundryState): ScenarioExport {
  const context = state.contextReceipt;
  const contract = state.contract;
  const world = state.world;
  const privacy = state.privacyReport;
  const quality = state.qualityReport;
  const review = state.reviewDecision;
  const activation = state.activationReceipts.at(-1);
  if (!context?.acceptedProfileHash || !contract || !world || !privacy || !quality || !review || !activation
    || !scenarioReadiness(state).ready || !currentScenarioEvidenceIsValid(state) || !lineageIsValid(state)) {
    throw new Error("APPROVED_SYNTHETIC_PACK_REQUIRED");
  }
  return canonicalClone({
    schemaVersion: 1,
    contract,
    syntheticRecords: world.records,
    groundTruthOracle: world.oracle,
    validationSummaries: { privacy, quality, revalidation: state.revalidationReport },
    provenanceManifest: {
      requestId: state.requestId, packId: state.packId, generationRunId: world.generationRunId,
      acceptedProfileHash: context.acceptedProfileHash, contractHash: contract.contractHash,
      templateVersion: contract.templateVersion, generatorVersion: contract.generatorVersion,
      seed: contract.deterministicSeed, outputHash: world.outputHash,
      privacyReportHash: privacy.reportHash, qualityReportHash: quality.reportHash,
      capabilityPins: activation.capabilityPins,
      actor: activation.actor, at: activation.at, priorEventId: activation.priorEventId,
      sourceMode: contract.sourceMode, noSalesforceConnection: true, exportClassification: "SYNTHETIC",
    },
    receiptLineage: {
      contextReceiptId: context.id, reviewDecisionId: review.id,
      activationReceiptIds: state.activationReceipts.map((receipt) => receipt.id),
      oracleReportIds: state.oracleReports.map((report) => report.id),
      stalenessReceiptId: state.stalenessReceipt?.id ?? null,
      revalidationMissionId: state.revalidationMission?.id ?? null,
      revalidationReportId: state.revalidationReport?.id ?? null,
      revalidationApprovalId: state.revalidationApproval?.id ?? null,
      resetReceiptIds: state.resetReceipts.map((receipt) => receipt.id),
    },
  });
}

export function serializeScenarioExport(state: ScenarioFoundryState): string {
  return canonicalStringify(buildScenarioExport(state));
}

function lineageIsValid(state: ScenarioFoundryState): boolean {
  const ids = [
    state.contextReceipt?.id,
    state.reviewDecision?.id,
    ...state.activationReceipts.map((receipt) => receipt.id),
    ...state.oracleReports.map((report) => report.id),
    state.stalenessReceipt?.id,
    state.revalidationMission?.id,
    state.revalidationReport?.id,
    state.revalidationApproval?.id,
    ...state.resetReceipts.map((receipt) => receipt.id),
  ].filter((value): value is string => Boolean(value));
  if (ids.some((id) => !/^[a-z][a-z-]*:[a-f0-9]{32}$/.test(id))) return false;
  if (state.activationReceipts.length > 2 || state.oracleReports.length > 20 || state.resetReceipts.length > 2) return false;
  const activationIds = new Set(state.activationReceipts.map((receipt) => receipt.id));
  return state.activationReceipts.every((receipt) => hasConsistentStableId("activation-receipt", receipt)
      && receipt.requestId === state.requestId && receipt.packId === state.packId
      && receipt.actor.id === "maya" && receipt.actor.kind === "HUMAN")
    && state.oracleReports.every((report) => hasConsistentStableId("oracle-report", report)
      && report.requestId === state.requestId && report.packId === state.packId
      && (report.actor.id === "agent-demo-preflight" && report.actor.kind === "AGENT" || report.actor.id === "sofia" && report.actor.kind === "HUMAN"))
    && state.resetReceipts.every((receipt) => resetReceiptIsValid(state, receipt)
      && activationIds.has(receipt.activationReceiptId));
}

// This is deterministic content-addressed self-consistency, not actor or origin authentication.
function hasConsistentStableId(prefix: string, value: { readonly id: string }): boolean {
  try {
    const { id, ...core } = value;
    return id === stableId(prefix, core);
  } catch {
    return false;
  }
}

function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}
