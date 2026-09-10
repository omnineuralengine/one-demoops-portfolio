export const FOUNDRY_PHASES = [
  "DRAFT",
  "INTAKE_ACCEPTED",
  "BLUEPRINTED",
  "GENERATED",
  "PRIVACY_VALIDATED",
  "QUALITY_VALIDATED",
  "REVIEW_REQUIRED",
  "APPROVED",
  "ACTIVE",
  "STALE_REVALIDATION_REQUIRED",
  "REVALIDATED",
  "QUARANTINED",
  "EXPIRED",
  "DESTROYED",
] as const;

export type FoundryPhase = (typeof FOUNDRY_PHASES)[number];
export type FoundryActorKind = "HUMAN" | "AGENT" | "SYSTEM";
export interface FoundryActor { readonly id: string; readonly kind: FoundryActorKind }

export type SourceMode = "TEMPLATE_FIRST" | "SAFE_PATTERN_ASSISTED";
export type IndustryArchetype = "B2B_SOFTWARE";
export type OrganizationSizeBand = "MID_MARKET" | "ENTERPRISE";
export type GeographicRegionInput = "NORTH_AMERICA" | "EUROPE";
export type GeographicRegion = "AMERICAS" | "EMEA";
export type Locale = "en-US" | "en-GB";
export type TimeZone = "America/New_York" | "Europe/London";
export type SalesMotion = "RENEWAL_AND_EXPANSION";
export type DemoAudience = "ACCOUNT_TEAM" | "EXECUTIVE_REVIEW";
export type UseCaseTag = "MEETING_PREPARATION" | "DEAL_HEALTH_REVIEW" | "PIPELINE_REVIEW" | "GOVERNED_UPDATE";
export type ObjectFamily = "ACCOUNTS" | "CONTACTS" | "OPPORTUNITIES" | "CASES" | "ACTIVITIES";
export type RecordVolumeInput = "SMALL" | "MEDIUM";
export type RecordVolumeBand = "COMPACT" | "STANDARD";
export type SalesCycleBand = "QUARTER" | "HALF_YEAR";
export type ValueBand = "MID_VALUE" | "STRATEGIC";
export type LifecycleStage = "CUSTOMER" | "RENEWAL" | "EXPANSION";
export type ScenarioGoal = "PREPARE_RENEWAL_MEETING" | "EXPLAIN_DEAL_HEALTH" | "REVIEW_PIPELINE" | "GOVERN_ACCOUNT_UPDATE";
export type EdgeCase = "STALE_FIELD" | "CONFLICTING_SIGNAL" | "ACTIVITY_GAP" | "RESTRICTED_FIELD";

export interface SafeDemoSignalInput {
  readonly sourceMode: SourceMode;
  readonly industryArchetype: IndustryArchetype;
  readonly organizationSizeBand: OrganizationSizeBand;
  readonly geographicRegion: GeographicRegionInput;
  readonly locale: Locale;
  readonly timeZone: TimeZone;
  readonly salesMotion: SalesMotion;
  readonly demoAudience: DemoAudience;
  readonly useCaseTags: readonly UseCaseTag[];
  readonly objectFamilies: readonly ObjectFamily[];
  readonly recordVolumeBand: RecordVolumeInput;
  readonly salesCycleBand: SalesCycleBand;
  readonly valueBand: ValueBand;
  readonly lifecycleStages: readonly LifecycleStage[];
  readonly scenarioGoals: readonly ScenarioGoal[];
  readonly edgeCases: readonly EdgeCase[];
  readonly packOwnerId: "maya";
  readonly ttlHours: 4 | 8;
  readonly seed: number;
}

export interface SafeDemoSignalProfile extends Omit<SafeDemoSignalInput, "geographicRegion" | "recordVolumeBand"> {
  readonly geographicRegion: GeographicRegion;
  readonly recordVolumeBand: RecordVolumeBand;
}

export type ContextDisposition = "ACCEPTED_UNCHANGED" | "COARSENED_INTO_APPROVED_BAND" | "REJECTED_BY_POLICY" | "NOT_SUPPLIED";
export type RejectionCategory =
  | "ADDRESS"
  | "CREDENTIAL_OR_CONNECTION"
  | "CUSTOMER_METADATA"
  | "EXACT_COMMERCIAL_VALUE"
  | "FILE_UPLOAD"
  | "FREE_TEXT_OR_INSTRUCTION"
  | "IDENTIFIER"
  | "PERSON_OR_COMPANY_NAME"
  | "PHONE_OR_EMAIL"
  | "PROTOTYPE_OR_EXOTIC_OBJECT"
  | "STRUCTURE_LIMIT"
  | "UNRECOGNIZED_STRUCTURE"
  | "UNSUPPORTED_OR_RARE_CATEGORY";

export interface ContextFieldDecision {
  readonly field: keyof SafeDemoSignalInput | "UNRECOGNIZED_INPUT";
  readonly disposition: ContextDisposition;
  readonly safeValue?: string | number | readonly string[];
  readonly rejectionCategory?: RejectionCategory;
}

export interface ContextReceipt {
  readonly id: string;
  readonly requestId: string;
  readonly packId: string;
  readonly policyVersion: FoundryBuildConfig["policyVersion"];
  readonly requestingActorId: "sofia";
  readonly purpose: "FICTIONAL_REVENUE_DEMO_REHEARSAL";
  readonly packTtlHours: 4 | 8 | null;
  readonly validationOutcome: "ACCEPTED" | "REJECTED";
  readonly acceptedProfile: SafeDemoSignalProfile | null;
  readonly acceptedProfileHash: string | null;
  readonly decisions: readonly ContextFieldDecision[];
  readonly at: string;
}

export type ContractElementOrigin =
  | "USER_PROVIDED_SAFE_SIGNAL"
  | "POLICY_COARSENED_SIGNAL"
  | "DETERMINISTICALLY_DERIVED_BLUEPRINT"
  | "AUTHORED_FICTIONAL_TEMPLATE"
  | "CALCULATED_CONSTRAINT";

export type ContractElementKey =
  | "id" | "version" | "requestId" | "packId" | "contextReceiptId" | "acceptedProfileHash" | "compiledAt" | "contractHash"
  | "sourceMode" | "industryArchetype" | "organizationSizeBand" | "geographicRegion" | "locale" | "timeZone"
  | "salesMotion" | "demoAudience" | "useCaseTags" | "objectFamilies" | "recordVolumeBand" | "salesCycleBand"
  | "valueBand" | "lifecycleStages" | "scenarioGoals" | "edgeCases" | "packOwnerId" | "ttlHours"
  | "policyVersion" | "templateVersion"
  | "objectGraph" | "entityCountBounds" | "requiredRelationships"
  | "picklists" | "businessConstraints" | "timelineAnchor" | "distributionTargets"
  | "personaPermissionModel" | "storyBeats" | "intendedDemoMoments" | "knownEdgeCases"
  | "requiredCapabilityPins" | "generatorVersion" | "deterministicSeed" | "expirationPolicy"
  | "forbiddenContent" | "expectedValidationGates";

export interface CapabilityPin { readonly id: string; readonly version: string; readonly kind: "CAPABILITY" | "RUNBOOK" }
export interface FoundryBuildConfig {
  readonly policyVersion: "context-firewall:v1" | "context-firewall:v1-reviewed";
  readonly templateVersion: "revenue-renewal:v1" | "revenue-renewal:v1-reviewed";
  readonly generatorVersion: "scenario-generator:v1" | "scenario-generator:v1-reviewed";
  readonly capabilityPins: readonly CapabilityPin[];
}
export interface EntityCountBound { readonly object: ObjectFamily; readonly minimum: number; readonly maximum: number }
export interface ObjectRelationship { readonly child: ObjectFamily; readonly parent: ObjectFamily; readonly foreignKey: string }

export interface SyntheticDataContract {
  readonly id: string;
  readonly version: 1;
  readonly requestId: string;
  readonly packId: string;
  readonly contextReceiptId: string;
  readonly acceptedProfileHash: string;
  readonly policyVersion: FoundryBuildConfig["policyVersion"];
  readonly sourceMode: SourceMode;
  readonly industryArchetype: IndustryArchetype;
  readonly organizationSizeBand: OrganizationSizeBand;
  readonly geographicRegion: GeographicRegion;
  readonly locale: Locale;
  readonly timeZone: TimeZone;
  readonly salesMotion: SalesMotion;
  readonly demoAudience: DemoAudience;
  readonly useCaseTags: readonly UseCaseTag[];
  readonly objectFamilies: readonly ObjectFamily[];
  readonly recordVolumeBand: RecordVolumeBand;
  readonly salesCycleBand: SalesCycleBand;
  readonly valueBand: ValueBand;
  readonly lifecycleStages: readonly LifecycleStage[];
  readonly scenarioGoals: readonly ScenarioGoal[];
  readonly edgeCases: readonly EdgeCase[];
  readonly packOwnerId: "maya";
  readonly ttlHours: 4 | 8;
  readonly objectGraph: readonly ObjectFamily[];
  readonly entityCountBounds: readonly EntityCountBound[];
  readonly requiredRelationships: readonly ObjectRelationship[];
  readonly picklists: Readonly<Record<string, readonly string[]>>;
  readonly businessConstraints: readonly string[];
  readonly timelineAnchor: "2026-09-15T14:00:00.000Z";
  readonly distributionTargets: readonly string[];
  readonly personaPermissionModel: readonly ScenarioPersonaPermission[];
  readonly storyBeats: readonly string[];
  readonly intendedDemoMoments: readonly UseCaseTag[];
  readonly knownEdgeCases: readonly EdgeCase[];
  readonly requiredCapabilityPins: readonly CapabilityPin[];
  readonly templateVersion: FoundryBuildConfig["templateVersion"];
  readonly generatorVersion: FoundryBuildConfig["generatorVersion"];
  readonly deterministicSeed: number;
  readonly expirationPolicy: { readonly ttlHours: 4 | 8; readonly expiresAt: string };
  readonly forbiddenContent: readonly string[];
  readonly expectedValidationGates: readonly string[];
  readonly elementOrigins: Readonly<Record<ContractElementKey, ContractElementOrigin>>;
  readonly compiledAt: string;
  readonly contractHash: string;
}

export type ScenarioPersonaId = "demoops-admin" | "requesting-se" | "seller-owner" | "executive-viewer" | "restricted-viewer" | "privacy-reviewer";
export type ScenarioObject = "ACCOUNT" | "CONTACT" | "OPPORTUNITY" | "CASE" | "ACTIVITY";
export type ScenarioAction = "VIEW" | "UPDATE_NEXT_STEP" | "ACTIVATE_PACK" | "APPROVE_PACK" | "TEARDOWN_PACK";

export interface ScenarioPersonaPermission {
  readonly personaId: ScenarioPersonaId;
  readonly label: string;
  readonly objectAccess: readonly ScenarioObject[];
  readonly hiddenFields: readonly string[];
  readonly recordScope: "ALL_SYNTHETIC" | "OWNED_TERRITORY" | "AGGREGATES_ONLY" | "PUBLIC_ACCOUNT_ONLY" | "VALIDATION_ONLY";
  readonly allowedActions: readonly ScenarioAction[];
  readonly approvalRequiredActions: readonly ScenarioAction[];
  readonly prohibitedDisclosures: readonly string[];
}

export interface SyntheticAccount { readonly id: string; readonly name: string; readonly region: GeographicRegion; readonly createdAt: string; readonly customerSince: string; readonly ownerUserId: string; readonly territory: string; readonly renewalValueBand: ValueBand; readonly openPipelineValueBand: ValueBand; readonly openOpportunityCount: number }
export interface SyntheticContact { readonly id: string; readonly accountId: string; readonly fullName: string; readonly role: string; readonly email: string; readonly phone: "NOT_PROVIDED"; readonly createdAt: string; readonly restricted: boolean }
export interface SyntheticOpportunity { readonly id: string; readonly accountId: string; readonly ownerUserId: string; readonly kind: "RENEWAL" | "EXPANSION"; readonly stage: "DISCOVERY" | "VALIDATION" | "NEGOTIATION"; readonly probabilityPercent: 25 | 55 | 75; readonly valueBand: ValueBand; readonly createdAt: string; readonly closeDate: string; readonly nextStep: string | null; readonly lastActivityAt: string | null; readonly securityRisk: "NONE" | "OPEN_REVIEW"; readonly restrictedFields: readonly string[] }
export interface SyntheticCase { readonly id: string; readonly accountId: string; readonly opportunityId: string | null; readonly kind: "SUPPORT" | "SECURITY"; readonly status: "OPEN" | "RESOLVED"; readonly severity: "MEDIUM" | "HIGH"; readonly openedAt: string; readonly resolvedAt: string | null; readonly restricted: boolean }
export interface SyntheticActivity { readonly id: string; readonly accountId: string; readonly opportunityId: string | null; readonly contactId: string | null; readonly kind: "MEETING" | "EMAIL_SUMMARY" | "TASK"; readonly occurredAt: string; readonly signal: "POSITIVE" | "NEUTRAL" | "NEGATIVE"; readonly summaryCode: string; readonly restricted: boolean }

export interface ScenarioRecords {
  readonly accounts: readonly SyntheticAccount[];
  readonly contacts: readonly SyntheticContact[];
  readonly opportunities: readonly SyntheticOpportunity[];
  readonly cases: readonly SyntheticCase[];
  readonly activities: readonly SyntheticActivity[];
}

export interface OracleAssertion {
  readonly id: string;
  readonly evaluation: "MEETING_PREPARATION" | "DEAL_HEALTH_REVIEW" | "PIPELINE_REVIEW" | "GOVERNED_UPDATE";
  readonly activePersonaId: ScenarioPersonaId;
  readonly expectedFactCodes: readonly string[];
  readonly factEvidence: readonly { readonly factCode: string; readonly evidenceRecordIds: readonly string[] }[];
  readonly evidenceRecordIds: readonly string[];
  readonly prohibitedFactCodes: readonly string[];
  readonly allowedActions: readonly ScenarioAction[];
  readonly blockedActions: readonly ScenarioAction[];
  readonly authorityChecks: readonly { readonly personaId: ScenarioPersonaId; readonly action: ScenarioAction; readonly expectedAllowed: boolean }[];
  readonly requiredStateTransition: string | null;
  readonly conflictBehavior: string;
}

export interface GroundTruthOracle { readonly version: 1; readonly assertions: readonly OracleAssertion[] }
export interface GeneratedScenarioWorld {
  readonly id: string;
  readonly generationRunId: string;
  readonly requestId: string;
  readonly packId: string;
  readonly acceptedProfileHash: string;
  readonly contractHash: string;
  readonly templateVersion: string;
  readonly generatorVersion: string;
  readonly seed: number;
  readonly utcAnchor: string;
  readonly generatedAt: string;
  readonly locale: Locale;
  readonly timeZone: TimeZone;
  readonly currency: "USD" | "GBP";
  readonly watermark: "SYNTHETIC REVENUE WORLD · NO SALESFORCE CONNECTION OR CUSTOMER DATA";
  readonly records: ScenarioRecords;
  readonly permissions: readonly ScenarioPersonaPermission[];
  readonly oracle: GroundTruthOracle;
  readonly outputHash: string;
}

export interface ValidationCheck { readonly id: string; readonly outcome: "PASS" | "FAIL"; readonly evidence: string }
export interface GenerationEvidenceBinding {
  readonly requestId: string; readonly packId: string; readonly generationRunId: string;
  readonly acceptedProfileHash: string; readonly contractHash: string; readonly templateVersion: string;
  readonly generatorVersion: string; readonly seed: number; readonly outputHash: string;
  readonly capabilityPins: readonly CapabilityPin[]; readonly actor: FoundryActor;
  readonly at: string; readonly priorEventId: string;
}
export interface PrivacyReport extends GenerationEvidenceBinding { readonly id: string; readonly outcome: "PASS" | "FAIL"; readonly checks: readonly ValidationCheck[]; readonly reportHash: string }
export interface QualityReport extends GenerationEvidenceBinding { readonly id: string; readonly outcome: "PASS" | "FAIL"; readonly checks: readonly ValidationCheck[]; readonly reportHash: string }
export interface FullEvidenceBinding extends GenerationEvidenceBinding { readonly privacyReportHash: string; readonly qualityReportHash: string }
export interface PackReviewDecision extends FullEvidenceBinding { readonly id: string; readonly outcome: "APPROVED"; readonly reviewerId: "aisha" }

export interface ActivationReceipt extends FullEvidenceBinding { readonly id: string; readonly reviewDecisionId: string; readonly revalidationApprovalId: string | null; readonly state: "ACTIVE" }
export interface SimulatedTransitionReceipt { readonly id: string; readonly label: "SIMULATED"; readonly personaId: ScenarioPersonaId; readonly recordId: string; readonly field: "nextStep"; readonly before: null; readonly after: "APPROVED_SYNTHETIC_NEXT_STEP"; readonly authorized: true; readonly appliedToCopyOnly: true }
export interface OracleEvaluationResult { readonly assertionId: string; readonly outcome: "PASS" | "FAIL"; readonly discoveredFactCodes: readonly string[]; readonly disclosedProhibitedFactCodes: readonly string[]; readonly actionDecisions: readonly { personaId: ScenarioPersonaId; action: ScenarioAction; expectedAllowed: boolean; allowed: boolean }[]; readonly evidenceRecordIds: readonly string[]; readonly requiredStateTransition: string | null; readonly simulatedTransitionReceipt: SimulatedTransitionReceipt | null; readonly stateTransitionSatisfied: boolean; readonly explanation: string }
export interface OracleEvaluationReport extends FullEvidenceBinding { readonly id: string; readonly label: "SIMULATED EVALUATION"; readonly evaluatedPersonaIds: readonly ScenarioPersonaId[]; readonly outcome: "PASS" | "FAIL"; readonly results: readonly OracleEvaluationResult[] }

export interface VerifiedCapabilityChange {
  readonly id: string; readonly sourceLoopId: string; readonly changeId: string;
  readonly reviewDecisionId: string; readonly learningRecordId: string; readonly activationReceiptId: string; readonly capabilityId: string;
  readonly previousVersion: string; readonly nextVersion: string;
  readonly verifiedAt: string; readonly approvedBy: string; readonly humanDecisionActorId: string;
}
export interface StalenessReceipt extends FullEvidenceBinding { readonly id: string; readonly capabilityChange: VerifiedCapabilityChange; readonly priorActivationReceiptId: string; readonly readinessRevoked: true }
export interface RevalidationMission { readonly id: string; readonly packId: string; readonly stalenessReceiptId: string; readonly requiredCapabilityPins: readonly CapabilityPin[]; readonly state: "DRAFT"; readonly ownerId: "maya"; readonly reviewerId: "aisha" }
export interface RevalidationReport extends FullEvidenceBinding { readonly id: string; readonly missionId: string; readonly oracleReportId: string; readonly outcome: "PASS" | "FAIL"; readonly checks: readonly ValidationCheck[]; readonly reportHash: string }
export interface RevalidationApproval extends FullEvidenceBinding { readonly id: string; readonly reportId: string; readonly reportHash: string; readonly stalenessReceiptId: string; readonly approvedBy: "aisha"; readonly outcome: "APPROVED" }
export interface ResetReceipt extends FullEvidenceBinding { readonly id: string; readonly activationReceiptId: string; readonly restoredOutputHash: string; readonly outcome: "PASS" }
export interface TeardownReceipt {
  readonly id: string;
  readonly requestId: string;
  readonly packId: string;
  readonly priorPhase: Exclude<FoundryPhase, "DESTROYED">;
  readonly destroyedGenerationRunId: string | null;
  readonly generatedAt: string | null;
  readonly acceptedProfileHash: string | null;
  readonly contractHash: string | null;
  readonly templateVersion: string | null;
  readonly generatorVersion: string | null;
  readonly seed: number | null;
  readonly destroyedOutputHash: string | null;
  readonly privacyReportHash: string | null;
  readonly qualityReportHash: string | null;
  readonly capabilityPins: readonly CapabilityPin[];
  readonly activationReceiptId: string | null;
  readonly oracleReportId: string | null;
  readonly oracleOutcome: "PASS" | "FAIL" | null;
  readonly revalidationApprovalId: string | null;
  readonly finalState: "DESTROYED";
  readonly actor: FoundryActor;
  readonly at: string;
  readonly priorEventId: string | null;
}
export interface InactiveTemplateCandidate { readonly id: string; readonly packId: string; readonly sourceReceiptId: string; readonly status: "PROPOSED_INACTIVE"; readonly category: "STORY_CLARITY" | "EDGE_CASE_COVERAGE"; readonly proposedBy: string; readonly at: string }

export interface FoundryAuditEvent { readonly eventId: string; readonly type: FoundryAction["type"] | "UNKNOWN"; readonly requestId: string; readonly packId: string; readonly actor: FoundryActor; readonly at: string; readonly outcome: "ACCEPTED" | "REJECTED"; readonly reasonCode: string; readonly priorEventId: string | null }

export interface ScenarioFoundryState {
  readonly schemaVersion: 1;
  readonly phase: FoundryPhase;
  readonly revision: number;
  readonly requestId: string;
  readonly packId: string;
  readonly buildConfig: FoundryBuildConfig;
  readonly draft: SafeDemoSignalInput;
  readonly contextReceipt: ContextReceipt | null;
  readonly contract: SyntheticDataContract | null;
  readonly world: GeneratedScenarioWorld | null;
  readonly privacyReport: PrivacyReport | null;
  readonly qualityReport: QualityReport | null;
  readonly reviewDecision: PackReviewDecision | null;
  readonly activationReceipts: readonly ActivationReceipt[];
  readonly oracleReports: readonly OracleEvaluationReport[];
  readonly stalenessReceipt: StalenessReceipt | null;
  readonly revalidationMission: RevalidationMission | null;
  readonly revalidationReport: RevalidationReport | null;
  readonly revalidationApproval: RevalidationApproval | null;
  readonly resetReceipts: readonly ResetReceipt[];
  readonly teardownReceipt: TeardownReceipt | null;
  readonly feedbackCandidate: InactiveTemplateCandidate | null;
  readonly exportStatus: "NOT_EXPORTED" | "USER_EXPORTED";
  readonly audit: readonly FoundryAuditEvent[];
  readonly processedEventIds: readonly string[];
}

interface ActionBase { readonly eventId: string; readonly requestId: string; readonly packId: string; readonly expectedRevision: number; readonly actor: FoundryActor; readonly at: string; readonly priorEventId: string | null }
export type FoundryAction =
  | (ActionBase & { readonly type: "ACCEPT_CONTEXT"; readonly input: unknown })
  | (ActionBase & { readonly type: "COMPILE_CONTRACT" })
  | (ActionBase & { readonly type: "GENERATE_WORLD" })
  | (ActionBase & { readonly type: "RUN_PRIVACY_VALIDATION" })
  | (ActionBase & { readonly type: "RUN_QUALITY_VALIDATION" })
  | (ActionBase & { readonly type: "SUBMIT_FOR_REVIEW" })
  | (ActionBase & { readonly type: "APPROVE_PACK" })
  | (ActionBase & { readonly type: "ACTIVATE_PACK" })
  | (ActionBase & { readonly type: "RUN_ORACLE_EVALUATIONS" })
  | (ActionBase & { readonly type: "APPLY_VERIFIED_CAPABILITY_CHANGE"; readonly change: VerifiedCapabilityChange })
  | (ActionBase & { readonly type: "RUN_REVALIDATION" })
  | (ActionBase & { readonly type: "APPROVE_REVALIDATION" })
  | (ActionBase & { readonly type: "REACTIVATE_PACK" })
  | (ActionBase & { readonly type: "RESET_WORLD" })
  | (ActionBase & { readonly type: "TEARDOWN_WORLD" })
  | (ActionBase & { readonly type: "EXPIRE_PACK" })
  | (ActionBase & { readonly type: "PROPOSE_TEMPLATE_IMPROVEMENT"; readonly category: InactiveTemplateCandidate["category"] })
  | (ActionBase & { readonly type: "MARK_EXPORTED" })
  | (ActionBase & { readonly type: "EDIT_SAFE_DRAFT"; readonly draft: SafeDemoSignalInput })
  | (ActionBase & { readonly type: "EDIT_CONFIGURATION"; readonly buildConfig: FoundryBuildConfig })
  | (ActionBase & { readonly type: "RESTART" });

export type FoundryActionType = FoundryAction["type"];

export interface PersonaView {
  readonly persona: ScenarioPersonaPermission;
  readonly records: Readonly<Record<"accounts" | "contacts" | "opportunities" | "cases" | "activities", readonly Readonly<Record<string, string | number | boolean | null | readonly string[]>>[]>>;
  readonly hiddenFieldNames: readonly string[];
  readonly allowedActions: readonly ScenarioAction[];
  readonly blockedActions: readonly ScenarioAction[];
}

export interface ScenarioReadiness {
  readonly ready: boolean;
  readonly state: "NOT_READY" | "READY" | "STALE" | "QUARANTINED" | "EXPIRED" | "DESTROYED";
  readonly reason: string;
  readonly validatedOracleAssertions: number | "Insufficient observations";
}

export interface ScenarioExport {
  readonly schemaVersion: 1;
  readonly contract: SyntheticDataContract;
  readonly syntheticRecords: ScenarioRecords;
  readonly groundTruthOracle: GroundTruthOracle;
  readonly validationSummaries: { readonly privacy: PrivacyReport; readonly quality: QualityReport; readonly revalidation: RevalidationReport | null };
  readonly provenanceManifest: FullEvidenceBinding & { readonly sourceMode: SourceMode; readonly noSalesforceConnection: true; readonly exportClassification: "SYNTHETIC" };
  readonly receiptLineage: { readonly contextReceiptId: string; readonly reviewDecisionId: string; readonly activationReceiptIds: readonly string[]; readonly oracleReportIds: readonly string[]; readonly stalenessReceiptId: string | null; readonly revalidationMissionId: string | null; readonly revalidationReportId: string | null; readonly revalidationApprovalId: string | null; readonly resetReceiptIds: readonly string[] };
}
