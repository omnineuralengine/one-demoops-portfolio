import { canPersonaAct, personaView } from "./permissions";
import { canonicalStringify, stableId } from "./canonical";
import type {
  GeneratedScenarioWorld,
  GroundTruthOracle,
  OracleAssertion,
  OracleEvaluationResult,
  PersonaView,
  ScenarioAction,
  ScenarioPersonaId,
  ScenarioRecords,
  SyntheticDataContract,
} from "./types";

export function buildGroundTruthOracle(records: ScenarioRecords, contract: SyntheticDataContract): GroundTruthOracle {
  const renewal = records.opportunities.find((item) => item.kind === "RENEWAL")!;
  const expansion = records.opportunities.find((item) => item.kind === "EXPANSION" && item.accountId === renewal.accountId)!;
  const securityCase = records.cases.find((item) => item.kind === "SECURITY")!;
  const negativeActivity = records.activities.find((item) => item.opportunityId === renewal.id && item.signal === "NEGATIVE")!;
  const positiveExpansion = records.activities.find((item) => item.opportunityId === expansion.id && item.signal === "POSITIVE")!;
  const meetingFacts = [
    fact("RENEWAL_DETERIORATING", [renewal.id, negativeActivity.id]),
    fact("RECENT_ACTIVITY_GAP", [renewal.id]),
    fact("NEXT_STEP_MISSING", [renewal.id]),
  ];
  const dealHealthFacts = [
    fact("RENEWAL_DETERIORATING", [renewal.id, negativeActivity.id]),
    fact("EXPANSION_PLAUSIBLE", [expansion.id, positiveExpansion.id]),
    fact("CONFLICTING_SIGNALS", [renewal.id, expansion.id, negativeActivity.id, positiveExpansion.id]),
  ];
  const expectedOpportunityCount = contract.entityCountBounds.find((bound) => bound.object === "OPPORTUNITIES")?.minimum;
  if (!expectedOpportunityCount) throw new Error("ORACLE_REQUIRES_CONTRACTED_OPPORTUNITY_COUNT");
  const highestValueBand = contract.valueBand;
  const pipelineFacts = [
    fact(`OPEN_OPPORTUNITY_COUNT_${expectedOpportunityCount}`, records.opportunities.map((item) => item.id)),
    fact(`HIGHEST_OPEN_PIPELINE_VALUE_BAND_${highestValueBand}`, records.opportunities.map((item) => item.id)),
  ];
  const governedUpdateFacts = [fact("NEXT_STEP_MISSING", [renewal.id])];

  const assertions: OracleAssertion[] = [
    {
      id: "oracle:meeting-preparation", evaluation: "MEETING_PREPARATION", activePersonaId: "requesting-se",
      expectedFactCodes: meetingFacts.map((item) => item.factCode), factEvidence: meetingFacts,
      evidenceRecordIds: evidenceIds(meetingFacts), prohibitedFactCodes: ["RESTRICTED_SECURITY_CASE_DETAIL"],
      allowedActions: ["VIEW"], blockedActions: ["UPDATE_NEXT_STEP", "APPROVE_PACK"], requiredStateTransition: null,
      authorityChecks: authorityCases("requesting-se", ["VIEW"], ["UPDATE_NEXT_STEP", "APPROVE_PACK"]),
      conflictBehavior: "Surface the positive expansion separately; do not let it erase renewal risk.",
    },
    {
      id: "oracle:deal-health", evaluation: "DEAL_HEALTH_REVIEW", activePersonaId: "seller-owner",
      expectedFactCodes: dealHealthFacts.map((item) => item.factCode), factEvidence: dealHealthFacts,
      evidenceRecordIds: evidenceIds(dealHealthFacts), prohibitedFactCodes: ["RESTRICTED_SECURITY_CASE_DETAIL", "CONTACT_EMAIL"],
      allowedActions: ["VIEW", "UPDATE_NEXT_STEP"], blockedActions: ["APPROVE_PACK", "ACTIVATE_PACK"], requiredStateTransition: null,
      authorityChecks: authorityCases("seller-owner", ["VIEW", "UPDATE_NEXT_STEP"], ["APPROVE_PACK", "ACTIVATE_PACK"]),
      conflictBehavior: "Report both negative renewal evidence and positive expansion evidence.",
    },
    {
      id: "oracle:pipeline-review", evaluation: "PIPELINE_REVIEW", activePersonaId: "executive-viewer",
      expectedFactCodes: pipelineFacts.map((item) => item.factCode), factEvidence: pipelineFacts,
      evidenceRecordIds: evidenceIds(pipelineFacts), prohibitedFactCodes: ["CONTACT_DETAIL", "CASE_DETAIL", "NEXT_STEP_DETAIL"],
      allowedActions: ["VIEW"], blockedActions: ["UPDATE_NEXT_STEP", "APPROVE_PACK"], requiredStateTransition: null,
      authorityChecks: authorityCases("executive-viewer", ["VIEW"], ["UPDATE_NEXT_STEP", "APPROVE_PACK"]),
      conflictBehavior: "Use aggregate facts only and label the renewal risk without restricted detail.",
    },
    {
      id: "oracle:governed-update", evaluation: "GOVERNED_UPDATE", activePersonaId: "seller-owner",
      expectedFactCodes: governedUpdateFacts.map((item) => item.factCode), factEvidence: governedUpdateFacts,
      evidenceRecordIds: evidenceIds(governedUpdateFacts), prohibitedFactCodes: ["RESTRICTED_SECURITY_CASE_DETAIL"],
      allowedActions: ["UPDATE_NEXT_STEP"], blockedActions: ["APPROVE_PACK", "ACTIVATE_PACK"],
      authorityChecks: [
        ...authorityCases("seller-owner", ["UPDATE_NEXT_STEP"], ["APPROVE_PACK", "ACTIVATE_PACK"]),
        { personaId: "requesting-se", action: "UPDATE_NEXT_STEP", expectedAllowed: false },
        { personaId: "restricted-viewer", action: "UPDATE_NEXT_STEP", expectedAllowed: false },
      ],
      requiredStateTransition: `${renewal.id}:nextStep:null→APPROVED_SYNTHETIC_NEXT_STEP`,
      conflictBehavior: "Allow only the scoped fictional seller update; block restricted personas.",
    },
  ];
  // Ensure the restricted case remains deliberately represented in the oracle without exposing its contents.
  if (!securityCase.restricted) throw new Error("ORACLE_REQUIRES_RESTRICTED_CASE");
  return { version: 1, assertions };
}

export function evaluateOracle(world: GeneratedScenarioWorld, personaId: ScenarioPersonaId, contract: SyntheticDataContract): { outcome: "PASS" | "FAIL"; results: readonly OracleEvaluationResult[] } {
  const oracleValid = oracleMatchesContract(world, contract);
  const applicable = world.oracle.assertions.filter((assertion) => assertion.activePersonaId === personaId);
  if (applicable.length === 0) return { outcome: "FAIL", results: [] };
  const ids = allRecordIds(world.records);
  const view = personaView(world, personaId);

  const results = applicable.map((assertion) => evaluateAssertion(assertion, ids, view, world, world.utcAnchor));
  return { outcome: oracleValid && results.every((result) => result.outcome === "PASS") ? "PASS" : "FAIL", results };
}

export function evaluateOracleSuite(world: GeneratedScenarioWorld, contract: SyntheticDataContract): { outcome: "PASS" | "FAIL"; results: readonly OracleEvaluationResult[]; evaluatedPersonaIds: readonly ScenarioPersonaId[] } {
  const oracleValid = oracleMatchesContract(world, contract);
  const ids = allRecordIds(world.records);
  const results = world.oracle.assertions.map((assertion) => {
    const view = personaView(world, assertion.activePersonaId);
    return evaluateAssertion(assertion, ids, view, world, world.utcAnchor);
  });
  return {
    outcome: oracleValid && results.length === 4 && results.every((result) => result.outcome === "PASS") ? "PASS" : "FAIL",
    results,
    evaluatedPersonaIds: [...new Set(world.oracle.assertions.map((assertion) => assertion.activePersonaId))],
  };
}

function evaluateAssertion(assertion: OracleAssertion, recordIds: ReadonlySet<string>, view: PersonaView, world: GeneratedScenarioWorld, utcAnchor: string): OracleEvaluationResult {
  const facts = deriveAuthorizedFactEvidence(world.records, view, utcAnchor);
  const discoveredFactCodes = assertion.expectedFactCodes.filter((factCode) => facts.has(factCode));
  const actionDecisions = assertion.authorityChecks.map((item) => ({ ...item, allowed: canPersonaAct(world, item.personaId, item.action).allowed }));
  const actionPass = actionDecisions.every((item) => item.allowed === item.expectedAllowed)
    && assertion.allowedActions.every((action) => assertion.authorityChecks.some((item) => item.personaId === assertion.activePersonaId && item.action === action && item.expectedAllowed))
    && assertion.blockedActions.every((action) => assertion.authorityChecks.some((item) => item.personaId === assertion.activePersonaId && item.action === action && !item.expectedAllowed));
  const assertedFactEvidence = new Map(assertion.factEvidence.map((binding) => [binding.factCode, binding.evidenceRecordIds]));
  const factPass = new Set(assertion.expectedFactCodes).size === assertion.expectedFactCodes.length
    && assertion.factEvidence.length === assertion.expectedFactCodes.length
    && assertion.expectedFactCodes.every((factCode) => {
      const expectedEvidence = assertedFactEvidence.get(factCode);
      const derivedEvidence = facts.get(factCode);
      return Boolean(expectedEvidence?.length && derivedEvidence?.length && sameStringSet(expectedEvidence, derivedEvidence));
    });
  const boundEvidenceIds = evidenceIds(assertion.factEvidence);
  const evidencePass = boundEvidenceIds.length > 0
    && boundEvidenceIds.every((id) => recordIds.has(id))
    && sameStringSet(boundEvidenceIds, assertion.evidenceRecordIds);
  const disclosedProhibitedFactCodes = assertion.prohibitedFactCodes.filter((factCode) => prohibitedFactIsVisible(factCode, view));
  const disclosurePass = disclosedProhibitedFactCodes.length === 0;
  const transition = simulateRequiredTransition(assertion, world);
  const stateTransitionSatisfied = transition.satisfied;
  const outcome = factPass && evidencePass && actionPass && disclosurePass && stateTransitionSatisfied ? "PASS" as const : "FAIL" as const;
  return {
    assertionId: assertion.id,
    outcome,
    discoveredFactCodes,
    disclosedProhibitedFactCodes,
    actionDecisions,
    evidenceRecordIds: [...assertion.evidenceRecordIds],
    requiredStateTransition: assertion.requiredStateTransition,
    simulatedTransitionReceipt: transition.receipt,
    stateTransitionSatisfied,
    explanation: outcome === "PASS"
      ? "SIMULATED EVALUATION passed against fact codes, evidence IDs, and fictional authority boundaries; wording was not scored."
      : "SIMULATED EVALUATION failed one or more fact, evidence, or authority assertions; no external model was called.",
  };
}

function prohibitedFactIsVisible(factCode: string, view: PersonaView): boolean {
  if (factCode === "RESTRICTED_SECURITY_CASE_DETAIL") return view.records.cases.some((record) => record.kind === "SECURITY")
    || view.records.activities.some((record) => record.restricted === true || record.summaryCode === "SECURITY_FOLLOWUP_OVERDUE");
  if (factCode === "CONTACT_EMAIL") return view.records.contacts.some((record) => "email" in record);
  if (factCode === "CONTACT_DETAIL") return view.records.contacts.length > 0;
  if (factCode === "CASE_DETAIL") return view.records.cases.length > 0;
  if (factCode === "NEXT_STEP_DETAIL") return view.records.opportunities.some((record) => "nextStep" in record);
  return true;
}

function simulateRequiredTransition(assertion: OracleAssertion, world: GeneratedScenarioWorld) {
  if (assertion.requiredStateTransition === null) return { satisfied: true, receipt: null } as const;
  const renewal = world.records.opportunities.find((item) => item.kind === "RENEWAL");
  const expectedTransition = renewal ? `${renewal.id}:nextStep:null→APPROVED_SYNTHETIC_NEXT_STEP` : null;
  if (!renewal || renewal.nextStep !== null || assertion.evaluation !== "GOVERNED_UPDATE"
    || assertion.requiredStateTransition !== expectedTransition || !canPersonaAct(world, assertion.activePersonaId, "UPDATE_NEXT_STEP").allowed) {
    return { satisfied: false, receipt: null } as const;
  }
  const updatedCopy = { ...renewal, nextStep: "APPROVED_SYNTHETIC_NEXT_STEP" as const };
  const receiptCore = {
    label: "SIMULATED" as const,
    personaId: assertion.activePersonaId,
    recordId: renewal.id,
    field: "nextStep" as const,
    before: null,
    after: updatedCopy.nextStep,
    authorized: true as const,
    appliedToCopyOnly: true as const,
  };
  return { satisfied: updatedCopy.nextStep === "APPROVED_SYNTHETIC_NEXT_STEP" && renewal.nextStep === null, receipt: { id: stableId("simulated-transition", receiptCore), ...receiptCore } } as const;
}

function deriveAuthorizedFactEvidence(records: ScenarioRecords, view: PersonaView, utcAnchor: string) {
  const facts = new Map<string, readonly string[]>();
  const renewal = view.records.opportunities.find((item) => item.kind === "RENEWAL" && typeof item.id === "string");
  const renewalId = typeof renewal?.id === "string" ? renewal.id : null;
  const negativeActivity = renewalId === null ? undefined : view.records.activities.find((item) => item.opportunityId === renewalId && item.signal === "NEGATIVE" && typeof item.id === "string");
  const negativeActivityId = typeof negativeActivity?.id === "string" ? negativeActivity.id : null;
  const staleThreshold = Date.parse(utcAnchor) - 28 * 86_400_000;
  const recentActivityIsStale = typeof renewal?.lastActivityAt === "string"
    && Number.isFinite(Date.parse(renewal.lastActivityAt))
    && Date.parse(renewal.lastActivityAt) <= staleThreshold;

  if (renewalId && negativeActivityId && recentActivityIsStale) facts.set("RENEWAL_DETERIORATING", [renewalId, negativeActivityId]);
  if (renewalId && recentActivityIsStale) facts.set("RECENT_ACTIVITY_GAP", [renewalId]);
  if (renewalId && renewal?.nextStep === null) facts.set("NEXT_STEP_MISSING", [renewalId]);

  const expansion = renewalId === null ? undefined : view.records.opportunities.find((item) => item.kind === "EXPANSION" && item.accountId === renewal?.accountId && typeof item.id === "string");
  const expansionId = typeof expansion?.id === "string" ? expansion.id : null;
  const positiveExpansion = expansionId === null ? undefined : view.records.activities.find((item) => item.opportunityId === expansionId && item.signal === "POSITIVE" && typeof item.id === "string");
  const positiveExpansionId = typeof positiveExpansion?.id === "string" ? positiveExpansion.id : null;
  if (expansionId && positiveExpansionId && typeof expansion?.probabilityPercent === "number" && expansion.probabilityPercent >= 55) {
    facts.set("EXPANSION_PLAUSIBLE", [expansionId, positiveExpansionId]);
  }
  const deterioratingEvidence = facts.get("RENEWAL_DETERIORATING");
  const expansionEvidence = facts.get("EXPANSION_PLAUSIBLE");
  if (deterioratingEvidence && expansionEvidence) facts.set("CONFLICTING_SIGNALS", [...deterioratingEvidence, ...expansionEvidence]);

  const aggregate = view.records.accounts.find((item) => item.scope === "ALL_SYNTHETIC");
  if (typeof aggregate?.openOpportunityCount === "number") {
    facts.set(`OPEN_OPPORTUNITY_COUNT_${aggregate.openOpportunityCount}`, records.opportunities.map((item) => item.id));
  }
  if (aggregate?.highestOpenPipelineValueBand === "STRATEGIC" || aggregate?.highestOpenPipelineValueBand === "MID_VALUE") {
    facts.set(`HIGHEST_OPEN_PIPELINE_VALUE_BAND_${aggregate.highestOpenPipelineValueBand}`, records.opportunities.map((item) => item.id));
  }
  return facts;
}

function fact(factCode: string, evidenceRecordIds: readonly string[]) {
  return { factCode, evidenceRecordIds: [...evidenceRecordIds] } as const;
}

function authorityCases(personaId: ScenarioPersonaId, allowed: readonly ScenarioAction[], blocked: readonly ScenarioAction[]) {
  return [
    ...allowed.map((action) => ({ personaId, action, expectedAllowed: true as const })),
    ...blocked.map((action) => ({ personaId, action, expectedAllowed: false as const })),
  ];
}

function oracleMatchesContract(world: GeneratedScenarioWorld, contract: SyntheticDataContract): boolean {
  try {
    return world.contractHash === contract.contractHash
      && canonicalStringify(world.oracle) === canonicalStringify(buildGroundTruthOracle(world.records, contract));
  } catch {
    return false;
  }
}

function evidenceIds(bindings: readonly { readonly evidenceRecordIds: readonly string[] }[]) {
  return [...new Set(bindings.flatMap((binding) => binding.evidenceRecordIds))];
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function allRecordIds(records: ScenarioRecords) {
  return new Set([
    ...records.accounts.map((item) => item.id), ...records.contacts.map((item) => item.id),
    ...records.opportunities.map((item) => item.id), ...records.cases.map((item) => item.id),
    ...records.activities.map((item) => item.id),
  ]);
}

export function oracleContainsAllSkillCategories(oracle: GroundTruthOracle) {
  const categories = new Set(oracle.assertions.map((assertion) => assertion.evaluation));
  return (["MEETING_PREPARATION", "DEAL_HEALTH_REVIEW", "PIPELINE_REVIEW", "GOVERNED_UPDATE"] as const).every((category) => categories.has(category));
}
