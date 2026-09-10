import { describe, expect, it } from "vitest";
import {
  createFoundryAction,
  createInitialFoundryState,
  createVerifiedPhaseThreeCapabilityChange,
  DEFAULT_FOUNDRY_BUILD_CONFIG,
  DEFAULT_SAFE_DEMO_SIGNALS,
  scenarioFoundryReducer,
  scenarioReadiness,
  teardownReceiptIsValid,
  type FoundryAction,
  type ScenarioFoundryState,
} from "../../features/scenario-foundry";
import { reduce, throughActive, throughReady, throughReviewRequired } from "./helpers";

function latest(state: ScenarioFoundryState) { return state.audit.at(-1); }

function throughRevalidationApproval() {
  let state = throughActive();
  const change = createVerifiedPhaseThreeCapabilityChange();
  state = reduce(state, createFoundryAction(state, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));
  state = reduce(state, createFoundryAction(state, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change }));
  state = reduce(state, createFoundryAction(state, "RUN_REVALIDATION", "agent-demo-preflight", "AGENT"));
  state = reduce(state, createFoundryAction(state, "APPROVE_REVALIDATION", "aisha", "HUMAN"));
  return state;
}

describe("guarded Scenario Foundry causal lifecycle", () => {
  it("starts with no downstream artifacts and cannot bypass causal phases", () => {
    let state = createInitialFoundryState();
    expect(state).toMatchObject({ phase: "DRAFT", contextReceipt: null, contract: null, world: null, privacyReport: null, qualityReport: null, reviewDecision: null, stalenessReceipt: null, revalidationReport: null, teardownReceipt: null });
    expect(state.activationReceipts).toEqual([]);
    state = reduce(state, createFoundryAction(state, "GENERATE_WORLD", "agent-demo-preflight", "AGENT"));
    expect(state.phase).toBe("DRAFT");
    expect(state.revision).toBe(1);
    expect(latest(state)).toMatchObject({ outcome: "REJECTED", reasonCode: "GENERATE_WORLD_INVALID_FROM_DRAFT" });
    state = reduce(state, createFoundryAction(state, "ACTIVATE_PACK", "maya", "HUMAN"));
    expect(state.revision).toBe(2);
    expect(state.activationReceipts).toHaveLength(0);
    expect(scenarioReadiness(state).ready).toBe(false);
  });

  it("recomputes accepted context and does not trust a caller-supplied profile or hash", () => {
    let state = createInitialFoundryState();
    const hostile = { ...DEFAULT_SAFE_DEMO_SIGNALS, rawRecords: [{ secret: "must-never-enter-state" }] };
    state = reduce(state, createFoundryAction(state, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: hostile }));
    expect(state.phase).toBe("QUARANTINED");
    expect(state.contextReceipt).toMatchObject({ validationOutcome: "REJECTED", acceptedProfile: null, acceptedProfileHash: null });
    expect(JSON.stringify(state)).not.toContain("must-never-enter-state");
    expect(latest(state)?.reasonCode).toBe("CONTEXT_QUARANTINED_BY_POLICY");
  });

  it("projects accepted proxy inputs into fresh allowlisted state without cloning caller objects", () => {
    const initialProxy = new Proxy({ ...DEFAULT_SAFE_DEMO_SIGNALS }, {});
    let state = createInitialFoundryState(initialProxy);
    expect(state.draft).toEqual(DEFAULT_SAFE_DEMO_SIGNALS);
    expect(state.draft).not.toBe(initialProxy);
    expect(Object.getPrototypeOf(state.draft)).toBe(Object.prototype);
    const configProxy = new Proxy({
      ...DEFAULT_FOUNDRY_BUILD_CONFIG,
      capabilityPins: DEFAULT_FOUNDRY_BUILD_CONFIG.capabilityPins.map((pin) => ({ ...pin })),
    }, {});
    const configState = createInitialFoundryState(DEFAULT_SAFE_DEMO_SIGNALS, configProxy);
    expect(configState.buildConfig).toEqual(DEFAULT_FOUNDRY_BUILD_CONFIG);
    expect(configState.buildConfig).not.toBe(configProxy);

    const editedProxy = new Proxy({ ...DEFAULT_SAFE_DEMO_SIGNALS, demoAudience: "EXECUTIVE_REVIEW" as const }, {});
    expect(() => {
      state = reduce(state, createFoundryAction(state, "EDIT_SAFE_DRAFT", "sofia", "HUMAN", { draft: editedProxy }));
    }).not.toThrow();
    expect(state.draft.demoAudience).toBe("EXECUTIVE_REVIEW");
    expect(state.draft).not.toBe(editedProxy);
    expect(JSON.stringify(state)).not.toContain("rawRecords");
  });

  it("enforces requester/reviewer/admin/agent separation and denies self-approval", () => {
    let state = throughReviewRequired();
    const before = state.reviewDecision;
    state = reduce(state, createFoundryAction(state, "APPROVE_PACK", "sofia", "HUMAN"));
    expect(state.reviewDecision).toBe(before);
    expect(latest(state)).toMatchObject({ outcome: "REJECTED", reasonCode: "INDEPENDENT_REVIEWER_REQUIRED" });
    state = reduce(state, createFoundryAction(state, "APPROVE_PACK", "agent-demo-preflight", "AGENT"));
    expect(state.reviewDecision).toBeNull();
    expect(latest(state)?.reasonCode).toBe("INDEPENDENT_REVIEWER_REQUIRED");
    state = reduce(state, createFoundryAction(state, "APPROVE_PACK", "aisha", "HUMAN"));
    expect(state.phase).toBe("APPROVED");
    const denied = reduce(state, createFoundryAction(state, "ACTIVATE_PACK", "aisha", "HUMAN"));
    expect(denied.phase).toBe("APPROVED");
    expect(latest(denied)?.reasonCode).toBe("DEMOOPS_ADMINISTRATOR_REQUIRED");
  });

  it("cryptographically binds validation reports and review decisions to the current generation", () => {
    let state = throughReviewRequired();
    const forgedPrivacy = { ...state.privacyReport!, outputHash: "0".repeat(64) };
    const forgedState = { ...state, privacyReport: forgedPrivacy };
    const rejected = reduce(forgedState, createFoundryAction(forgedState, "APPROVE_PACK", "aisha", "HUMAN"));
    expect(rejected.reviewDecision).toBeNull();
    expect(latest(rejected)?.reasonCode).toBe("BOUND_VALIDATION_EVIDENCE_REQUIRED");

    state = reduce(state, createFoundryAction(state, "APPROVE_PACK", "aisha", "HUMAN"));
    const forgedReview = { ...state.reviewDecision!, outputHash: "f".repeat(64) };
    const activationDenied = reduce({ ...state, reviewDecision: forgedReview }, createFoundryAction({ ...state, reviewDecision: forgedReview }, "ACTIVATE_PACK", "maya", "HUMAN"));
    expect(activationDenied.phase).toBe("APPROVED");
    expect(latest(activationDenied)?.reasonCode).toBe("CURRENT_PACK_REVIEW_BINDING_REQUIRED");
  });

  it("quarantines failed privacy or integrity evidence and creates no review, activation, or readiness", () => {
    let generated = createInitialFoundryState();
    generated = reduce(generated, createFoundryAction(generated, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS }));
    generated = reduce(generated, createFoundryAction(generated, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"));
    generated = reduce(generated, createFoundryAction(generated, "GENERATE_WORLD", "agent-demo-preflight", "AGENT"));
    const unsafeWorld = { ...generated.world!, records: { ...generated.world!.records, contacts: [{ ...generated.world!.records.contacts[0], email: "routable@example.com" }, ...generated.world!.records.contacts.slice(1)] } };
    const unsafeState = { ...generated, world: unsafeWorld };
    const quarantined = reduce(unsafeState, createFoundryAction(unsafeState, "RUN_PRIVACY_VALIDATION", "agent-demo-preflight", "AGENT"));
    expect(quarantined).toMatchObject({ phase: "QUARANTINED", reviewDecision: null });
    expect(quarantined.privacyReport?.outcome).toBe("FAIL");
    expect(quarantined.activationReceipts).toEqual([]);
    expect(scenarioReadiness(quarantined).ready).toBe(false);

    const invalidReferenceWorld = { ...generated.world!, records: { ...generated.world!.records, contacts: [{ ...generated.world!.records.contacts[0], accountId: "syn-account-missing" }, ...generated.world!.records.contacts.slice(1)] } };
    let invalidReferenceState: ScenarioFoundryState = { ...generated, world: invalidReferenceWorld };
    invalidReferenceState = reduce(invalidReferenceState, createFoundryAction(invalidReferenceState, "RUN_PRIVACY_VALIDATION", "agent-demo-preflight", "AGENT"));
    invalidReferenceState = reduce(invalidReferenceState, createFoundryAction(invalidReferenceState, "RUN_QUALITY_VALIDATION", "agent-demo-preflight", "AGENT"));
    expect(invalidReferenceState.phase).toBe("QUARANTINED");
    expect(invalidReferenceState.qualityReport?.outcome).toBe("FAIL");
    expect(invalidReferenceState.reviewDecision).toBeNull();
    expect(invalidReferenceState.activationReceipts).toEqual([]);
  });

  it("fails malformed generated artifacts closed without retaining their values", () => {
    let generated = createInitialFoundryState();
    generated = reduce(generated, createFoundryAction(generated, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS }));
    generated = reduce(generated, createFoundryAction(generated, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"));
    generated = reduce(generated, createFoundryAction(generated, "GENERATE_WORLD", "agent-demo-preflight", "AGENT"));
    const unsafeValue = "malformed-generated-value-must-not-persist";
    const cyclic = { ...generated.world! } as Record<string, unknown>;
    cyclic.cycle = cyclic;
    const exotic = Object.assign(Object.create({ inherited: unsafeValue }), generated.world!) as unknown;
    const malformedWorlds = [
      { ...generated.world!, records: undefined, unexpected: unsafeValue },
      cyclic,
      exotic,
      new Proxy(generated.world!, { ownKeys() { throw new Error(unsafeValue); } }),
    ];
    for (const malformedWorld of malformedWorlds) {
      const malformedState = { ...generated, world: malformedWorld as NonNullable<ScenarioFoundryState["world"]> };
      let quarantined: ScenarioFoundryState = malformedState;
      expect(() => {
        quarantined = reduce(malformedState, createFoundryAction(malformedState, "RUN_PRIVACY_VALIDATION", "agent-demo-preflight", "AGENT"));
      }).not.toThrow();
      expect(quarantined).toMatchObject({ phase: "QUARANTINED", world: null, privacyReport: null, qualityReport: null });
      expect(latest(quarantined)).toMatchObject({ outcome: "ACCEPTED", reasonCode: "PRIVACY_QUARANTINED_INVALID_WORLD_SCHEMA" });
      expect(JSON.stringify(quarantined)).not.toContain(unsafeValue);
      expect(scenarioReadiness(quarantined).ready).toBe(false);
      const destroyed = reduce(quarantined, createFoundryAction(quarantined, "TEARDOWN_WORLD", "maya", "HUMAN"));
      expect(destroyed).toMatchObject({ phase: "DESTROYED", world: null, teardownReceipt: { priorPhase: "QUARANTINED" } });
      expect(teardownReceiptIsValid(destroyed)).toBe(true);
      expect(scenarioReadiness(destroyed).ready).toBe(false);
      const feedbackDenied = reduce(destroyed, createFoundryAction(destroyed, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "STORY_CLARITY" }));
      expect(feedbackDenied.feedbackCandidate).toBeNull();
      expect(latest(feedbackDenied)?.reasonCode).toBe("POST_DEMO_EVALUATION_EVIDENCE_REQUIRED");
    }
  });

  it("fails malformed, unknown, stale, repeated, and mismatched events closed with category-only audits", () => {
    const initial = createInitialFoundryState();
    const malformed = scenarioFoundryReducer(initial, {} as FoundryAction);
    expect(latest(malformed)).toMatchObject({ type: "UNKNOWN", outcome: "REJECTED", reasonCode: "UNKNOWN_ACTION_TYPE" });
    const nullAction = scenarioFoundryReducer(initial, null as unknown as FoundryAction);
    expect(latest(nullAction)).toMatchObject({ type: "UNKNOWN", outcome: "REJECTED", reasonCode: "INVALID_ACTION_ENVELOPE" });

    const valid = createFoundryAction(initial, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS });
    const mismatch = reduce(initial, { ...valid, packId: "pack:wrong" });
    expect(latest(mismatch)?.reasonCode).toBe("MISMATCHED_REQUEST_OR_PACK_ID");
    const accepted = reduce(initial, valid);
    expect(reduce(accepted, valid)).toBe(accepted);
    const stale = reduce(accepted, { ...createFoundryAction(accepted, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"), expectedRevision: 999 });
    expect(latest(stale)?.reasonCode).toBe("STALE_STATE_REVISION");
  });

  it("rejects non-monotonic action times while keeping the sanitized audit clock increasing", () => {
    let state = createInitialFoundryState();
    state = reduce(state, createFoundryAction(state, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS }));
    const previousAt = latest(state)!.at;
    const repeated = { ...createFoundryAction(state, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"), at: previousAt };
    state = reduce(state, repeated);
    expect(latest(state)).toMatchObject({ outcome: "REJECTED", reasonCode: "NON_MONOTONIC_ACTION_TIME" });
    expect(Date.parse(latest(state)!.at)).toBeGreaterThan(Date.parse(previousAt));
    const valid = reduce(state, createFoundryAction(state, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"));
    expect(valid.phase).toBe("BLUEPRINTED");
    expect(valid.audit.every((event, index) => index === 0 || Date.parse(event.at) > Date.parse(valid.audit[index - 1]!.at))).toBe(true);
  });

  it("keeps causal evidence linked to the last accepted transition across rejected attempts", () => {
    let state = throughReviewRequired();
    state = reduce(state, createFoundryAction(state, "APPROVE_PACK", "sofia", "HUMAN"));
    state = reduce(state, createFoundryAction(state, "APPROVE_PACK", "aisha", "HUMAN"));
    expect(state.audit.find((event) => event.eventId === state.reviewDecision?.priorEventId)).toMatchObject({ type: "SUBMIT_FOR_REVIEW", outcome: "ACCEPTED" });

    state = reduce(state, createFoundryAction(state, "ACTIVATE_PACK", "sofia", "HUMAN"));
    state = reduce(state, createFoundryAction(state, "ACTIVATE_PACK", "maya", "HUMAN"));
    expect(state.audit.find((event) => event.eventId === state.activationReceipts.at(-1)?.priorEventId)).toMatchObject({ type: "APPROVE_PACK", outcome: "ACCEPTED" });
    state = reduce(state, createFoundryAction(state, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));

    const change = createVerifiedPhaseThreeCapabilityChange();
    state = reduce(state, createFoundryAction(state, "APPLY_VERIFIED_CAPABILITY_CHANGE", "sofia", "HUMAN", { change }));
    state = reduce(state, createFoundryAction(state, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change }));
    expect(state.audit.find((event) => event.eventId === state.stalenessReceipt?.priorEventId)).toMatchObject({ type: "RUN_ORACLE_EVALUATIONS", outcome: "ACCEPTED" });

    state = reduce(state, createFoundryAction(state, "APPROVE_REVALIDATION", "aisha", "HUMAN"));
    state = reduce(state, createFoundryAction(state, "RUN_REVALIDATION", "agent-demo-preflight", "AGENT"));
    expect(state.audit.find((event) => event.eventId === state.revalidationReport?.priorEventId)).toMatchObject({ type: "APPLY_VERIFIED_CAPABILITY_CHANGE", outcome: "ACCEPTED" });
    state = reduce(state, createFoundryAction(state, "APPROVE_REVALIDATION", "sofia", "HUMAN"));
    state = reduce(state, createFoundryAction(state, "APPROVE_REVALIDATION", "aisha", "HUMAN"));
    expect(state.audit.find((event) => event.eventId === state.revalidationApproval?.priorEventId)).toMatchObject({ type: "RUN_REVALIDATION", outcome: "ACCEPTED" });

    state = reduce(state, createFoundryAction(state, "REACTIVATE_PACK", "sofia", "HUMAN"));
    state = reduce(state, createFoundryAction(state, "REACTIVATE_PACK", "maya", "HUMAN"));
    expect(state.audit.find((event) => event.eventId === state.activationReceipts.at(-1)?.priorEventId)).toMatchObject({ type: "APPROVE_REVALIDATION", outcome: "ACCEPTED" });
    expect(scenarioReadiness(state).ready).toBe(true);
  });

  it("never echoes rejected envelope metadata into state or the audit transcript", () => {
    const initial = createInitialFoundryState();
    const sentinel = "rejected-customer-value-must-never-persist";
    const base = createFoundryAction(initial, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS });
    const hostileActions = [
      { ...base, eventId: sentinel },
      { ...base, priorEventId: sentinel },
      { ...base, actor: { id: "sofia", kind: sentinel } },
      { ...base, actor: { id: sentinel, kind: "HUMAN" } },
    ] as unknown as FoundryAction[];

    for (const action of hostileActions) {
      const rejected = scenarioFoundryReducer(initial, action);
      expect(JSON.stringify(rejected)).not.toContain(sentinel);
      expect(latest(rejected)?.eventId).toBe(base.eventId);
      expect(latest(rejected)?.priorEventId).toBeNull();
    }
    expect(latest(scenarioFoundryReducer(initial, hostileActions[2]!))?.actor).toEqual({ id: "unknown-actor", kind: "SYSTEM" });
  });

  it("never stores actor extras or invokes nested accessors while failing hostile actions closed", () => {
    const initial = createInitialFoundryState();
    const base = createFoundryAction(initial, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS });
    const actorSecret = scenarioFoundryReducer(initial, { ...base, actor: { ...base.actor, secret: "must-not-persist" } } as unknown as FoundryAction);
    expect(latest(actorSecret)?.reasonCode).toBe("INVALID_ACTION_ENVELOPE");
    expect(JSON.stringify(actorSecret)).not.toContain("must-not-persist");

    let getterCalls = 0;
    const verified = createVerifiedPhaseThreeCapabilityChange();
    const hostileChange = Object.defineProperties({}, Object.getOwnPropertyDescriptors(verified));
    Object.defineProperty(hostileChange, "id", { enumerable: true, get() { getterCalls += 1; return verified.id; } });
    const active = throughReady();
    const denied = scenarioFoundryReducer(active, {
      ...createFoundryAction(active, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change: verified }),
      change: hostileChange,
    } as unknown as FoundryAction);
    expect(latest(denied)?.reasonCode).toBe("VERIFIED_CAPABILITY_LINEAGE_REQUIRED");
    expect(getterCalls).toBe(0);
  });

  it("rejects unsafe initial state arguments without copying or echoing them", () => {
    const secret = "unsafe-initial-customer-value";
    expect(() => createInitialFoundryState({ ...DEFAULT_SAFE_DEMO_SIGNALS, rawRecords: [{ secret }] } as unknown as typeof DEFAULT_SAFE_DEMO_SIGNALS)).toThrow("INVALID_FOUNDRY_INITIAL_STATE");
    expect(() => createInitialFoundryState(DEFAULT_SAFE_DEMO_SIGNALS, { ...DEFAULT_FOUNDRY_BUILD_CONFIG, secret } as unknown as typeof DEFAULT_FOUNDRY_BUILD_CONFIG)).toThrow("INVALID_FOUNDRY_INITIAL_STATE");
  });

  it("invalidates descendants only through the named safe-signal, privacy-policy, or product configuration owner", () => {
    const active = throughActive();
    const editedDraft = { ...active.draft, seed: active.draft.seed + 1 };
    let state = reduce(active, createFoundryAction(active, "EDIT_SAFE_DRAFT", "sofia", "HUMAN", { draft: editedDraft }));
    expect(state).toMatchObject({ phase: "DRAFT", contextReceipt: null, contract: null, world: null, reviewDecision: null, exportStatus: "NOT_EXPORTED" });
    expect(state.activationReceipts).toEqual([]);

    const rebuilt = throughActive();
    const config = { ...DEFAULT_FOUNDRY_BUILD_CONFIG, templateVersion: "revenue-renewal:v1-reviewed" as const };
    const mayaDenied = reduce(rebuilt, createFoundryAction(rebuilt, "EDIT_CONFIGURATION", "maya", "HUMAN", { buildConfig: config }));
    expect(latest(mayaDenied)?.reasonCode).toBe("PRODUCT_CONFIGURATION_OWNER_REQUIRED");
    state = reduce(rebuilt, createFoundryAction(rebuilt, "EDIT_CONFIGURATION", "kenji", "HUMAN", { buildConfig: config }));
    expect(state.phase).toBe("DRAFT");
    expect(state.contract).toBeNull();
    const unsafe = { ...config, generatorVersion: "arbitrary-sensitive-version" };
    const rejected = reduce(state, createFoundryAction(state, "EDIT_CONFIGURATION", "kenji", "HUMAN", { buildConfig: unsafe as typeof config }));
    expect(latest(rejected)?.reasonCode).toBe("CONFIGURATION_REJECTED_BY_POLICY");
    const extraKey = { ...config, customerMetadata: "must-not-enter" };
    const extraRejected = reduce(state, createFoundryAction(state, "EDIT_CONFIGURATION", "kenji", "HUMAN", { buildConfig: extraKey as typeof config }));
    expect(latest(extraRejected)?.reasonCode).toBe("CONFIGURATION_REJECTED_BY_POLICY");
    expect(JSON.stringify(extraRejected.buildConfig)).not.toContain("customerMetadata");

    const policyState = throughActive();
    const policyConfig = { ...policyState.buildConfig, policyVersion: "context-firewall:v1-reviewed" as const };
    const productDenied = reduce(policyState, createFoundryAction(policyState, "EDIT_CONFIGURATION", "kenji", "HUMAN", { buildConfig: policyConfig }));
    expect(latest(productDenied)?.reasonCode).toBe("PRIVACY_POLICY_OWNER_REQUIRED");
    const privacyAccepted = reduce(policyState, createFoundryAction(policyState, "EDIT_CONFIGURATION", "aisha", "HUMAN", { buildConfig: policyConfig }));
    expect(privacyAccepted.phase).toBe("DRAFT");

    const generatorState = throughActive();
    const generatorConfig = { ...generatorState.buildConfig, generatorVersion: "scenario-generator:v1-reviewed" as const };
    expect(reduce(generatorState, createFoundryAction(generatorState, "EDIT_CONFIGURATION", "kenji", "HUMAN", { buildConfig: generatorConfig }))).toMatchObject({ phase: "DRAFT", world: null, reviewDecision: null });

    const pinState = throughActive();
    const pinConfig = { ...pinState.buildConfig, capabilityPins: pinState.buildConfig.capabilityPins.map((pin) => pin.id === "runbook:model-access" ? { ...pin, version: "runbook:model-access:v2" } : pin) };
    expect(reduce(pinState, createFoundryAction(pinState, "EDIT_CONFIGURATION", "kenji", "HUMAN", { buildConfig: pinConfig }))).toMatchObject({ phase: "DRAFT", contract: null, activationReceipts: [] });
  });

  it("revokes readiness from real Phase 3A evidence and requires new evidence, separate approval, and reactivation", () => {
    let state = throughActive();
    expect(scenarioReadiness(state).ready).toBe(false);
    const change = createVerifiedPhaseThreeCapabilityChange();
    expect(change).toMatchObject({ capabilityId: "runbook:model-access", previousVersion: "runbook:model-access:v1", nextVersion: "runbook:model-access:v2", approvedBy: "mateo" });
    const premature = reduce(state, createFoundryAction(state, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change }));
    expect(premature.phase).toBe("ACTIVE");
    expect(latest(premature)).toMatchObject({ outcome: "REJECTED", reasonCode: "PASSING_BOUND_ORACLE_REPORT_REQUIRED" });
    state = reduce(state, createFoundryAction(state, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));
    const originalOracleReportId = state.oracleReports.at(-1)?.id;
    expect(scenarioReadiness(state).ready).toBe(true);
    state = reduce(state, createFoundryAction(state, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change }));
    expect(state.phase).toBe("STALE_REVALIDATION_REQUIRED");
    expect(state.stalenessReceipt).toMatchObject({ readinessRevoked: true, capabilityChange: change });
    expect(state.revalidationMission?.requiredCapabilityPins).toContainEqual({ id: "runbook:model-access", version: "runbook:model-access:v2", kind: "RUNBOOK" });
    expect(scenarioReadiness(state)).toMatchObject({ ready: false, state: "STALE" });

    const forged = { ...change, id: "capability-change:forged" };
    const repeated = reduce(state, createFoundryAction(state, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change: forged }));
    expect(repeated.phase).toBe("STALE_REVALIDATION_REQUIRED");
    const activeForMissing = throughActive();
    const missingPayload = scenarioFoundryReducer(activeForMissing, { ...createFoundryAction(activeForMissing, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change }), change: undefined } as unknown as FoundryAction);
    expect(latest(missingPayload)?.reasonCode).toBe("VERIFIED_CAPABILITY_LINEAGE_REQUIRED");

    state = reduce(state, createFoundryAction(state, "RUN_REVALIDATION", "agent-demo-preflight", "AGENT"));
    expect(state.phase).toBe("REVALIDATED");
    expect(state.revalidationReport?.outcome).toBe("PASS");
    expect(state.revalidationReport?.oracleReportId).toBe(state.oracleReports.at(-1)?.id);
    expect(state.oracleReports.at(-1)?.id).not.toBe(originalOracleReportId);
    expect(state.oracleReports.at(-1)?.capabilityPins).toContainEqual({ id: "runbook:model-access", version: "runbook:model-access:v2", kind: "RUNBOOK" });
    expect(state.oracleReports.at(-1)?.results).toHaveLength(4);
    expect(state.revalidationReport?.checks.filter((check) => check.id.startsWith("revalidation:oracle:"))).toHaveLength(4);
    expect(scenarioReadiness(state).ready).toBe(false);

    const forgedReportState = { ...state, revalidationReport: { ...state.revalidationReport!, outputHash: "0".repeat(64) } };
    const forgedApproval = reduce(forgedReportState, createFoundryAction(forgedReportState, "APPROVE_REVALIDATION", "aisha", "HUMAN"));
    expect(forgedApproval.revalidationApproval).toBeNull();
    expect(latest(forgedApproval)?.reasonCode).toBe("PASSING_REVALIDATION_REPORT_REQUIRED");

    state = reduce(state, createFoundryAction(state, "APPROVE_REVALIDATION", "aisha", "HUMAN"));
    expect(state.phase).toBe("REVALIDATED");
    expect(state.revalidationApproval).toMatchObject({ approvedBy: "aisha", reportId: state.revalidationReport?.id, stalenessReceiptId: state.stalenessReceipt?.id });
    expect(scenarioReadiness(state).ready).toBe(false);
    const repeatedApproval = reduce(state, createFoundryAction(state, "APPROVE_REVALIDATION", "aisha", "HUMAN"));
    expect(latest(repeatedApproval)?.outcome).toBe("REJECTED");

    state = reduce(state, createFoundryAction(state, "REACTIVATE_PACK", "maya", "HUMAN"));
    expect(state.phase).toBe("ACTIVE");
    expect(state.activationReceipts.at(-1)?.revalidationApprovalId).toBe(state.revalidationApproval?.id);
    expect(scenarioReadiness(state).ready).toBe(true);
  });

  it("verifies teardown independently from readiness for stale and pre-reactivation states", () => {
    let stale = throughReady();
    const change = createVerifiedPhaseThreeCapabilityChange();
    stale = reduce(stale, createFoundryAction(stale, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change }));
    expect(stale.phase).toBe("STALE_REVALIDATION_REQUIRED");
    let destroyed = reduce(stale, createFoundryAction(stale, "TEARDOWN_WORLD", "maya", "HUMAN"));
    expect(destroyed.teardownReceipt).toMatchObject({ priorPhase: "STALE_REVALIDATION_REQUIRED", oracleOutcome: "PASS" });
    expect(teardownReceiptIsValid(destroyed)).toBe(true);
    expect(scenarioReadiness(destroyed).ready).toBe(false);
    destroyed = reduce(destroyed, createFoundryAction(destroyed, "PROPOSE_TEMPLATE_IMPROVEMENT", "sofia", "HUMAN", { category: "STORY_CLARITY" }));
    expect(destroyed.feedbackCandidate?.sourceReceiptId).toBe(destroyed.teardownReceipt?.id);

    let revalidated = throughReady();
    revalidated = reduce(revalidated, createFoundryAction(revalidated, "APPLY_VERIFIED_CAPABILITY_CHANGE", "scenario-foundry-system", "SYSTEM", { change }));
    revalidated = reduce(revalidated, createFoundryAction(revalidated, "RUN_REVALIDATION", "agent-demo-preflight", "AGENT"));
    expect(revalidated.phase).toBe("REVALIDATED");
    const destroyedBeforeReactivation = reduce(revalidated, createFoundryAction(revalidated, "TEARDOWN_WORLD", "maya", "HUMAN"));
    expect(destroyedBeforeReactivation.teardownReceipt).toMatchObject({ priorPhase: "REVALIDATED", oracleOutcome: "PASS" });
    expect(teardownReceiptIsValid(destroyedBeforeReactivation)).toBe(true);
    expect(scenarioReadiness(destroyedBeforeReactivation).ready).toBe(false);
  });

  it("rejects forged evidence bindings in readiness", () => {
    const state = throughReady();
    const activation = state.activationReceipts[0];
    expect(activation).toBeDefined();
    expect(scenarioReadiness({ ...state, activationReceipts: [{ ...activation!, outputHash: "0".repeat(64) }] }).ready).toBe(false);
    expect(scenarioReadiness({ ...state, reviewDecision: { ...state.reviewDecision!, reviewerId: "sofia" } as unknown as NonNullable<ScenarioFoundryState["reviewDecision"]> }).ready).toBe(false);
  });

  it("resets and tears down idempotently; an old receipt cannot reactivate destroyed state", () => {
    let state = throughRevalidationApproval();
    state = reduce(state, createFoundryAction(state, "REACTIVATE_PACK", "maya", "HUMAN"));
    state = reduce(state, createFoundryAction(state, "RESET_WORLD", "maya", "HUMAN"));
    expect(state.resetReceipts).toHaveLength(1);
    expect(state.resetReceipts[0]).toMatchObject({ outcome: "PASS", restoredOutputHash: state.world?.outputHash });
    const resetAgain = reduce(state, createFoundryAction(state, "RESET_WORLD", "maya", "HUMAN"));
    expect(resetAgain).toBe(state);

    const destroyedOracleReportId = state.oracleReports.at(-1)?.id;
    const destroyedGeneratedAt = state.world?.generatedAt;
    state = reduce(state, createFoundryAction(state, "TEARDOWN_WORLD", "maya", "HUMAN"));
    expect(state).toMatchObject({ phase: "DESTROYED", world: null });
    expect(state.oracleReports.at(-1)?.id).toBe(destroyedOracleReportId);
    expect(state.teardownReceipt).toMatchObject({
      finalState: "DESTROYED",
      generatedAt: destroyedGeneratedAt,
      acceptedProfileHash: state.contextReceipt?.acceptedProfileHash,
      contractHash: state.contract?.contractHash,
      templateVersion: state.contract?.templateVersion,
      generatorVersion: state.contract?.generatorVersion,
      seed: state.contract?.deterministicSeed,
      privacyReportHash: state.privacyReport?.reportHash,
      qualityReportHash: state.qualityReport?.reportHash,
      activationReceiptId: state.activationReceipts.at(-1)?.id,
      oracleReportId: destroyedOracleReportId,
      oracleOutcome: "PASS",
      revalidationApprovalId: state.revalidationApproval?.id,
    });
    expect(state.teardownReceipt?.capabilityPins).toEqual(state.revalidationMission?.requiredCapabilityPins);
    expect(scenarioReadiness(state).state).toBe("DESTROYED");
    const teardownAgain = reduce(state, createFoundryAction(state, "TEARDOWN_WORLD", "maya", "HUMAN"));
    expect(teardownAgain).toBe(state);
    const oldActivate = { ...createFoundryAction(state, "ACTIVATE_PACK", "maya", "HUMAN"), eventId: "old-activation-replay" };
    const denied = reduce(state, oldActivate);
    expect(denied.phase).toBe("DESTROYED");
    expect(denied.world).toBeNull();
  });

  it("supports explicit expiry and bounded restart from terminal or quarantined recovery states", () => {
    let state = throughActive();
    const earlyAction = {
      ...createFoundryAction(state, "EXPIRE_PACK", "maya", "HUMAN"),
      at: "2026-09-15T14:30:00.000Z",
    };
    state = reduce(state, earlyAction);
    expect(state.phase).toBe("ACTIVE");
    expect(latest(state)?.reasonCode).toBe("PACK_TTL_BOUNDARY_NOT_REACHED");
    state = reduce(state, createFoundryAction(state, "EXPIRE_PACK", "maya", "HUMAN"));
    expect(scenarioReadiness(state)).toMatchObject({ ready: false, state: "EXPIRED" });
    const priorPack = state.packId;
    state = reduce(state, createFoundryAction(state, "RESTART", "maya", "HUMAN"));
    expect(state.phase).toBe("DRAFT");
    expect(state.packId).not.toBe(priorPack);
    expect(state.world).toBeNull();
    expect(state.audit.at(-1)).toMatchObject({ requestId: "request:revenue-world:001", packId: priorPack, type: "RESTART" });
  });

  it("revokes readiness at, not after, the exact TTL boundary", () => {
    const state = throughReady();
    const expiresAt = state.contract!.expirationPolicy.expiresAt;
    const before = new Date(Date.parse(expiresAt) - 1).toISOString();
    const after = new Date(Date.parse(expiresAt) + 1).toISOString();
    expect(scenarioReadiness(state, before).ready).toBe(true);
    expect(scenarioReadiness(state, expiresAt).ready).toBe(false);
    expect(scenarioReadiness(state, after).ready).toBe(false);
  });
});
