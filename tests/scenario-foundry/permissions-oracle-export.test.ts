import { describe, expect, it, vi } from "vitest";
import {
  allPermissionChecks,
  buildScenarioExport,
  canPersonaAct,
  canonicalStringify,
  createFoundryAction,
  createInitialFoundryState,
  createVerifiedPhaseThreeCapabilityChange,
  DEFAULT_SAFE_DEMO_SIGNALS,
  evaluateOracleSuite,
  personaView,
  qualityChecks,
  scenarioMeasurements,
  scenarioProvenance,
  resetReceiptIsValid,
  serializeScenarioExport,
  stableId,
  teardownReceiptIsValid,
  type ScenarioPersonaId,
} from "../../features/scenario-foundry";
import { reduce, throughActive, throughReady } from "./helpers";

const PERSONAS: readonly ScenarioPersonaId[] = [
  "demoops-admin", "requesting-se", "seller-owner", "executive-viewer", "restricted-viewer", "privacy-reviewer",
];

describe("fictional persona permissions and known-answer oracle", () => {
  it("gives every persona a positive view and a concrete negative boundary", () => {
    const world = throughActive().world!;
    for (const personaId of PERSONAS) {
      const view = personaView(world, personaId);
      expect(view.persona.personaId).toBe(personaId);
      expect(Object.values(view.records).some((records) => records.length > 0)).toBe(true);
      expect(view.blockedActions.length).toBeGreaterThan(0);
    }
    expect(allPermissionChecks(world).every((check) => check.outcome === "PASS")).toBe(true);
  });

  it("redacts fields and scopes records instead of returning full typed records", () => {
    const world = throughActive().world!;
    const requester = personaView(world, "requesting-se");
    expect(requester.records.contacts.some((record) => record.restricted === true)).toBe(false);
    expect(requester.records.cases.some((record) => record.restricted === true)).toBe(false);
    expect(requester.records.opportunities.every((record) => !("securityRisk" in record) && !("restrictedFields" in record))).toBe(true);
    expect(requester.records.activities.every((record) => record.restricted !== true && record.summaryCode !== "SECURITY_FOLLOWUP_OVERDUE")).toBe(true);

    const seller = personaView(world, "seller-owner");
    const sellerAccountIds = new Set(world.records.accounts.filter((account) => account.ownerUserId === "seller-user-01").map((account) => account.id));
    expect(seller.records.contacts.every((record) => !("email" in record))).toBe(true);
    expect(seller.records.opportunities.every((record) => !("securityRisk" in record) && !("restrictedFields" in record))).toBe(true);
    expect([...seller.records.contacts, ...seller.records.opportunities, ...seller.records.cases, ...seller.records.activities]
      .every((record) => typeof record.accountId !== "string" || sellerAccountIds.has(record.accountId))).toBe(true);
    expect(seller.records.activities.every((record) => record.restricted !== true && record.summaryCode !== "SECURITY_FOLLOWUP_OVERDUE")).toBe(true);

    const privacyReviewer = personaView(world, "privacy-reviewer");
    expect(privacyReviewer.records.activities.some((record) => record.restricted === true && record.summaryCode === "SECURITY_FOLLOWUP_OVERDUE")).toBe(true);

    const executive = personaView(world, "executive-viewer");
    expect(executive.records.accounts).toHaveLength(1);
    expect(executive.records.accounts.every((record) => !("id" in record) && !("name" in record))).toBe(true);
    expect(executive.records.opportunities.every((record) => !("id" in record) && !("accountId" in record))).toBe(true);
    expect(executive.records.contacts).toEqual([]);
    expect(executive.records.cases).toEqual([]);

    const restricted = personaView(world, "restricted-viewer");
    expect(restricted.records.accounts).toHaveLength(1);
    expect(restricted.records.accounts[0]?.id).toBe(world.records.accounts[1]?.id);
    expect(restricted.records.accounts.every((record) => !("renewalValueBand" in record) && !("openPipelineValueBand" in record))).toBe(true);
    expect(restricted.records.activities.every((record) => !("summaryCode" in record))).toBe(true);
    expect(restricted.records.contacts).toEqual([]);
    expect(restricted.records.opportunities).toEqual([]);
    expect(restricted.records.cases).toEqual([]);
  });

  it("allows the fictional seller update and blocks it for the restricted persona", () => {
    const world = throughActive().world!;
    expect(canPersonaAct(world, "seller-owner", "UPDATE_NEXT_STEP")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(canPersonaAct(world, "restricted-viewer", "UPDATE_NEXT_STEP")).toMatchObject({ allowed: false });
    expect(canPersonaAct(world, "requesting-se", "APPROVE_PACK")).toMatchObject({ allowed: false });
  });

  it("uses the permission model embedded in the generated world as the only evaluation authority", () => {
    const world = throughActive().world!;
    const permissions = world.permissions.map((permission) => permission.personaId === "requesting-se"
      ? { ...permission, allowedActions: [...permission.allowedActions, "APPROVE_PACK" as const] }
      : permission);
    const forgedWorld = { ...world, permissions };
    expect(canPersonaAct(forgedWorld, "requesting-se", "APPROVE_PACK")).toMatchObject({ allowed: true });
    expect(allPermissionChecks(forgedWorld).some((check) => check.outcome === "FAIL")).toBe(true);
    expect(evaluateOracleSuite(forgedWorld, throughActive().contract!).outcome).toBe("FAIL");
    expect(qualityChecks(forgedWorld, throughActive().contract!).find((check) => check.id === "quality:permission-positive-negative")?.outcome).toBe("FAIL");
  });

  it("evaluates all four skill categories against facts, evidence IDs, and authority rather than prose", () => {
    const world = throughActive().world!;
    const evaluated = evaluateOracleSuite(world, throughActive().contract!);
    expect(evaluated.outcome).toBe("PASS");
    expect(evaluated.results).toHaveLength(4);
    expect(world.oracle.assertions.map((item) => item.evaluation)).toEqual([
      "MEETING_PREPARATION", "DEAL_HEALTH_REVIEW", "PIPELINE_REVIEW", "GOVERNED_UPDATE",
    ]);
    const recordIds = new Set([
      ...world.records.accounts.map((item) => item.id), ...world.records.contacts.map((item) => item.id),
      ...world.records.opportunities.map((item) => item.id), ...world.records.cases.map((item) => item.id),
      ...world.records.activities.map((item) => item.id),
    ]);
    for (const result of evaluated.results) {
      expect(result.outcome).toBe("PASS");
      expect(result.evidenceRecordIds.length).toBeGreaterThan(0);
      expect(result.evidenceRecordIds.every((id) => recordIds.has(id))).toBe(true);
      expect(result.disclosedProhibitedFactCodes).toEqual([]);
      expect(result.explanation).toContain("SIMULATED EVALUATION");
      expect(result.explanation).not.toContain("Claude output");
      expect(result.explanation).not.toContain("live result");
      expect(result.stateTransitionSatisfied).toBe(true);
    }
    for (const assertion of world.oracle.assertions) {
      expect(assertion.factEvidence.map((binding) => binding.factCode)).toEqual(assertion.expectedFactCodes);
      expect(assertion.factEvidence.every((binding) => binding.evidenceRecordIds.length > 0 && binding.evidenceRecordIds.every((id) => recordIds.has(id)))).toBe(true);
    }
    const governed = evaluated.results.find((result) => result.assertionId === "oracle:governed-update");
    expect(governed?.simulatedTransitionReceipt).toMatchObject({ label: "SIMULATED", personaId: "seller-owner", field: "nextStep", before: null, after: "APPROVED_SYNTHETIC_NEXT_STEP", authorized: true, appliedToCopyOnly: true });
    expect(world.records.opportunities.find((item) => item.kind === "RENEWAL")?.nextStep).toBeNull();
    expect(governed?.actionDecisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ personaId: "seller-owner", action: "UPDATE_NEXT_STEP", expectedAllowed: true, allowed: true }),
      expect.objectContaining({ personaId: "requesting-se", action: "UPDATE_NEXT_STEP", expectedAllowed: false, allowed: false }),
      expect.objectContaining({ personaId: "restricted-viewer", action: "UPDATE_NEXT_STEP", expectedAllowed: false, allowed: false }),
    ]));
  });

  it("emits one clearly simulated, fully bound report with all four results", () => {
    let state = throughReady();
    const report = state.oracleReports[0];
    expect(report).toMatchObject({ label: "SIMULATED EVALUATION", outcome: "PASS", requestId: state.requestId, packId: state.packId, generationRunId: state.world?.generationRunId });
    expect(report?.results).toHaveLength(4);
    expect(report?.evaluatedPersonaIds).toEqual(["requesting-se", "seller-owner", "executive-viewer"]);
  });
});

describe("allowlisted deterministic export and memory-only boundary", () => {
  it("exports only the safe contract, synthetic records, oracle, summaries, provenance, and receipt lineage", () => {
    let state = throughActive();
    state = reduce(state, createFoundryAction(state, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));
    expect(state.exportStatus).toBe("NOT_EXPORTED");
    const exported = buildScenarioExport(state);
    expect(Object.keys(exported).sort()).toEqual(["contract", "groundTruthOracle", "provenanceManifest", "receiptLineage", "schemaVersion", "syntheticRecords", "validationSummaries"]);
    expect(exported.provenanceManifest).toMatchObject({ noSalesforceConnection: true, exportClassification: "SYNTHETIC" });
    expect(exported.receiptLineage.oracleReportIds).toEqual([state.oracleReports[0]?.id]);
    expect(exported.receiptLineage.activationReceiptIds).toEqual(state.activationReceipts.map((receipt) => receipt.id));
    const serialized = serializeScenarioExport(state);
    expect(serialized).toBe(canonicalStringify(exported));
    expect(serializeScenarioExport(structuredClone(state))).toBe(serialized);
    expect(serialized).not.toContain('"audit"');
    expect(serialized).not.toContain('"draft"');
    expect(serialized).not.toContain('"contextReceipt"');
    expect(serialized).not.toContain('"processedEventIds"');
    expect(state.exportStatus).toBe("NOT_EXPORTED");
    state = reduce(state, createFoundryAction(state, "MARK_EXPORTED", "sofia", "HUMAN"));
    expect(state.exportStatus).toBe("USER_EXPORTED");
  });

  it("keeps canonical bytes stable for identical bound state while distinguishing different lifecycle lineage", () => {
    const first = throughReady();
    let second = createInitialFoundryState();
    second = reduce(second, createFoundryAction(second, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"));
    second = reduce(second, createFoundryAction(second, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS }));
    second = reduce(second, createFoundryAction(second, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"));
    second = reduce(second, createFoundryAction(second, "GENERATE_WORLD", "agent-demo-preflight", "AGENT"));
    second = reduce(second, createFoundryAction(second, "RUN_PRIVACY_VALIDATION", "agent-demo-preflight", "AGENT"));
    second = reduce(second, createFoundryAction(second, "RUN_QUALITY_VALIDATION", "agent-demo-preflight", "AGENT"));
    second = reduce(second, createFoundryAction(second, "SUBMIT_FOR_REVIEW", "sofia", "HUMAN"));
    second = reduce(second, createFoundryAction(second, "APPROVE_PACK", "aisha", "HUMAN"));
    second = reduce(second, createFoundryAction(second, "ACTIVATE_PACK", "maya", "HUMAN"));
    second = reduce(second, createFoundryAction(second, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));

    expect(first.contextReceipt?.acceptedProfileHash).toBe(second.contextReceipt?.acceptedProfileHash);
    expect(first.contract?.contractHash).not.toBe(second.contract?.contractHash);
    expect(serializeScenarioExport(first)).toBe(serializeScenarioExport(structuredClone(first)));
    expect(serializeScenarioExport(second)).toBe(serializeScenarioExport(structuredClone(second)));
    expect(serializeScenarioExport(first)).not.toBe(serializeScenarioExport(second));
  });

  it("does not access browser persistence and never exports automatically", () => {
    const localStorageWrite = vi.spyOn(Storage.prototype, "setItem");
    const indexedDbOpen = vi.fn();
    vi.stubGlobal("indexedDB", { open: indexedDbOpen });
    const state = throughActive();
    expect(localStorageWrite).not.toHaveBeenCalled();
    expect(indexedDbOpen).not.toHaveBeenCalled();
    expect(state.exportStatus).toBe("NOT_EXPORTED");
    localStorageWrite.mockRestore();
    vi.unstubAllGlobals();
  });

  it("denies export before current bound readiness, while stale, and after teardown", () => {
    expect(() => buildScenarioExport(throughActive())).toThrow("APPROVED_SYNTHETIC_PACK_REQUIRED");
    expect(() => buildScenarioExport(throughReady())).not.toThrow();
    expect(() => buildScenarioExport({ ...throughActive(), activationReceipts: [] })).toThrow("APPROVED_SYNTHETIC_PACK_REQUIRED");
    let approved = throughActive();
    approved = { ...approved, phase: "APPROVED", activationReceipts: [] };
    approved = reduce(approved, createFoundryAction(approved, "MARK_EXPORTED", "sofia", "HUMAN"));
    expect(approved.exportStatus).toBe("NOT_EXPORTED");
    let state = throughReady();
    state = reduce(state, createFoundryAction(state, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change: createVerifiedPhaseThreeCapabilityChange() }));
    expect(() => buildScenarioExport(state)).toThrow("APPROVED_SYNTHETIC_PACK_REQUIRED");
    state = throughReady();
    state = reduce(state, createFoundryAction(state, "TEARDOWN_WORLD", "maya", "HUMAN"));
    expect(state.world).toBeNull();
    expect(() => buildScenarioExport(state)).toThrow("APPROVED_SYNTHETIC_PACK_REQUIRED");
  });

  it("recomputes nested export evidence and rejects unknown or stale-hash runtime fields", () => {
    const ready = throughReady();
    const secret = "raw-rejected-value-must-never-export";
    const forgeries = [
      { ...ready, contract: { ...ready.contract!, secret } },
      { ...ready, world: { ...ready.world!, records: { ...ready.world!.records, accounts: [{ ...ready.world!.records.accounts[0], secret }, ...ready.world!.records.accounts.slice(1)] } } },
      { ...ready, world: { ...ready.world!, oracle: { ...ready.world!.oracle, assertions: [{ ...ready.world!.oracle.assertions[0], secret }, ...ready.world!.oracle.assertions.slice(1)] } } },
      { ...ready, privacyReport: { ...ready.privacyReport!, actor: { ...ready.privacyReport!.actor, secret } } },
      { ...ready, oracleReports: [{ ...ready.oracleReports[0]!, id: secret }] },
    ];
    for (const forged of forgeries) {
      let message = "";
      try { buildScenarioExport(forged as typeof ready); } catch (error) { message = error instanceof Error ? error.message : String(error); }
      expect(message).toBe("APPROVED_SYNTHETIC_PACK_REQUIRED");
      expect(message).not.toContain(secret);
    }
  });

  it("keeps an activated pack not ready until a current bound oracle passes", () => {
    const active = throughActive();
    expect(scenarioMeasurements(active).readiness).toBe("NOT_READY");
    expect(() => buildScenarioExport(active)).toThrow("APPROVED_SYNTHETIC_PACK_REQUIRED");
    const ready = throughReady();
    const failedReport = { ...ready.oracleReports[0]!, outcome: "FAIL" as const };
    const failed = { ...ready, oracleReports: [failedReport] };
    expect(scenarioMeasurements(failed).readiness).toBe("NOT_READY");
    expect(() => buildScenarioExport(failed)).toThrow("APPROVED_SYNTHETIC_PACK_REQUIRED");
  });

  it("keeps feedback inactive and leaves the trusted template and generated world unchanged", () => {
    let state = throughActive();
    state = reduce(state, createFoundryAction(state, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));
    const beforeContract = state.contract;
    const beforeWorld = state.world;
    state = reduce(state, createFoundryAction(state, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "EDGE_CASE_COVERAGE" }));
    expect(state.feedbackCandidate).toMatchObject({ status: "PROPOSED_INACTIVE", category: "EDGE_CASE_COVERAGE" });
    expect(state.contract).toBe(beforeContract);
    expect(state.world).toBe(beforeWorld);

    let destroyed = throughReady();
    destroyed = reduce(destroyed, createFoundryAction(destroyed, "TEARDOWN_WORLD", "maya", "HUMAN"));
    const teardownReceiptId = destroyed.teardownReceipt?.id;
    destroyed = reduce(destroyed, createFoundryAction(destroyed, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "STORY_CLARITY" }));
    expect(destroyed.phase).toBe("DESTROYED");
    expect(destroyed.world).toBeNull();
    expect(destroyed.feedbackCandidate).toMatchObject({ status: "PROPOSED_INACTIVE", sourceReceiptId: teardownReceiptId });
  });

  it("requires passing post-demo evaluation evidence and rejects unknown feedback categories", () => {
    let state = throughActive();
    state = reduce(state, createFoundryAction(state, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "STORY_CLARITY" }));
    expect(state.feedbackCandidate).toBeNull();
    expect(state.audit.at(-1)?.reasonCode).toBe("POST_DEMO_EVALUATION_EVIDENCE_REQUIRED");
    state = reduce(state, createFoundryAction(state, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));
    const invalidAction = { ...createFoundryAction(state, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "STORY_CLARITY" }), category: "CUSTOMER_COPY" } as unknown as Parameters<typeof reduce>[1];
    state = reduce(state, invalidAction);
    expect(state.feedbackCandidate).toBeNull();
    expect(state.audit.at(-1)?.reasonCode).toBe("INVALID_IMPROVEMENT_CATEGORY");
  });

  it("derives only evidence-backed local measurements and provenance", () => {
    const draft = throughActive();
    const measurements = scenarioMeasurements(draft);
    expect(measurements).toMatchObject({ privacyGate: "PASS", referentialIntegrity: "PASS", permissionBoundary: "PASS", deterministicReplay: "PASS", scenarioFreshness: "NOT_READY", readiness: "NOT_READY", resetOrTeardown: "Insufficient observations", validatedOracleAssertions: "Insufficient observations" });
    expect(scenarioMeasurements(throughReady())).toMatchObject({ readiness: "READY", validatedOracleAssertions: 4 });
    const provenance = scenarioProvenance(draft);
    expect(provenance).toMatchObject({ noSalesforceConnectionOrProductionData: true, owner: "maya", reviewer: "aisha", exportStatus: "NOT_EXPORTED" });
    let destroyed = throughReady();
    const createdAt = destroyed.world?.generatedAt;
    destroyed = reduce(destroyed, createFoundryAction(destroyed, "TEARDOWN_WORLD", "maya", "HUMAN"));
    expect(scenarioProvenance(destroyed).createdAt).toBe(createdAt);
    expect(destroyed.teardownReceipt?.generatedAt).toBe(createdAt);
    expect(JSON.stringify({ measurements, provenance })).not.toMatch(/revenue influence|win rate|time saved|productivity/i);
  });

  it("reports reset and teardown only when their complete receipts remain internally consistent", () => {
    let reset = throughReady();
    reset = reduce(reset, createFoundryAction(reset, "RESET_WORLD", "maya", "HUMAN"));
    expect(scenarioMeasurements(reset).resetOrTeardown).toBe("RESET_VERIFIED");
    expect(() => buildScenarioExport(reset)).not.toThrow();
    const forgedReset = {
      ...reset,
      resetReceipts: [{ ...reset.resetReceipts[0]!, restoredOutputHash: "0".repeat(64) }],
    };
    expect(scenarioMeasurements(forgedReset).resetOrTeardown).toBe("Insufficient observations");
    expect(() => buildScenarioExport(forgedReset)).toThrow("APPROVED_SYNTHETIC_PACK_REQUIRED");
    const { id: _resetId, ...resetCore } = reset.resetReceipts[0]!;
    const resetWithForgedPinsCore = {
      ...resetCore,
      capabilityPins: resetCore.capabilityPins.map((pin) => pin.kind === "RUNBOOK" ? { ...pin, version: "runbook:model-access:v999" } : pin),
    };
    const resetWithForgedPins = {
      ...reset,
      resetReceipts: [{ id: stableId("reset-receipt", resetWithForgedPinsCore), ...resetWithForgedPinsCore }],
    };
    expect(resetReceiptIsValid(resetWithForgedPins, resetWithForgedPins.resetReceipts[0]!)).toBe(false);

    let destroyed = throughReady();
    destroyed = reduce(destroyed, createFoundryAction(destroyed, "TEARDOWN_WORLD", "maya", "HUMAN"));
    expect(scenarioMeasurements(destroyed).resetOrTeardown).toBe("DESTROYED_VERIFIED");
    const forgedTeardown = {
      ...destroyed,
      teardownReceipt: { ...destroyed.teardownReceipt!, destroyedOutputHash: "0".repeat(64) },
    };
    expect(scenarioMeasurements(forgedTeardown).resetOrTeardown).toBe("Insufficient observations");
    expect(scenarioProvenance(forgedTeardown).resetOrTeardownStatus).toBe("NOT_RUN");

    const { id: _teardownId, ...teardownCore } = destroyed.teardownReceipt!;
    const forgedOracleCore = {
      ...teardownCore,
      oracleReportId: stableId("oracle-report", { forged: true }),
      oracleOutcome: "PASS" as const,
    };
    const forgedOracleState = {
      ...destroyed,
      teardownReceipt: { id: stableId("teardown-receipt", forgedOracleCore), ...forgedOracleCore },
    };
    expect(teardownReceiptIsValid(forgedOracleState)).toBe(false);
    const feedbackDenied = reduce(forgedOracleState, createFoundryAction(forgedOracleState, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "STORY_CLARITY" }));
    expect(feedbackDenied.feedbackCandidate).toBeNull();
    expect(feedbackDenied.audit.at(-1)?.reasonCode).toBe("POST_DEMO_EVALUATION_EVIDENCE_REQUIRED");
  });
});
