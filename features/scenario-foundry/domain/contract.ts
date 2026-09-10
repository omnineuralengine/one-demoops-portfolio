import { stableHash, stableId } from "./canonical";
import { SCENARIO_PERMISSIONS } from "./permissions";
import { isExactUtcIso } from "./schema";
import type { ContextReceipt, ContractElementKey, ContractElementOrigin, FoundryBuildConfig, SyntheticDataContract } from "./types";

const ELEMENT_ORIGINS: Readonly<Record<ContractElementKey, ContractElementOrigin>> = {
  id: "CALCULATED_CONSTRAINT",
  version: "AUTHORED_FICTIONAL_TEMPLATE",
  requestId: "CALCULATED_CONSTRAINT",
  packId: "CALCULATED_CONSTRAINT",
  contextReceiptId: "CALCULATED_CONSTRAINT",
  acceptedProfileHash: "CALCULATED_CONSTRAINT",
  compiledAt: "CALCULATED_CONSTRAINT",
  contractHash: "CALCULATED_CONSTRAINT",
  sourceMode: "USER_PROVIDED_SAFE_SIGNAL",
  industryArchetype: "AUTHORED_FICTIONAL_TEMPLATE",
  organizationSizeBand: "USER_PROVIDED_SAFE_SIGNAL",
  geographicRegion: "POLICY_COARSENED_SIGNAL",
  locale: "USER_PROVIDED_SAFE_SIGNAL",
  timeZone: "USER_PROVIDED_SAFE_SIGNAL",
  salesMotion: "AUTHORED_FICTIONAL_TEMPLATE",
  demoAudience: "USER_PROVIDED_SAFE_SIGNAL",
  useCaseTags: "USER_PROVIDED_SAFE_SIGNAL",
  objectFamilies: "AUTHORED_FICTIONAL_TEMPLATE",
  recordVolumeBand: "POLICY_COARSENED_SIGNAL",
  salesCycleBand: "USER_PROVIDED_SAFE_SIGNAL",
  valueBand: "USER_PROVIDED_SAFE_SIGNAL",
  lifecycleStages: "AUTHORED_FICTIONAL_TEMPLATE",
  scenarioGoals: "AUTHORED_FICTIONAL_TEMPLATE",
  edgeCases: "AUTHORED_FICTIONAL_TEMPLATE",
  packOwnerId: "AUTHORED_FICTIONAL_TEMPLATE",
  ttlHours: "USER_PROVIDED_SAFE_SIGNAL",
  policyVersion: "CALCULATED_CONSTRAINT",
  templateVersion: "AUTHORED_FICTIONAL_TEMPLATE",
  objectGraph: "DETERMINISTICALLY_DERIVED_BLUEPRINT",
  entityCountBounds: "CALCULATED_CONSTRAINT",
  requiredRelationships: "CALCULATED_CONSTRAINT",
  picklists: "AUTHORED_FICTIONAL_TEMPLATE",
  businessConstraints: "CALCULATED_CONSTRAINT",
  timelineAnchor: "CALCULATED_CONSTRAINT",
  distributionTargets: "DETERMINISTICALLY_DERIVED_BLUEPRINT",
  personaPermissionModel: "AUTHORED_FICTIONAL_TEMPLATE",
  storyBeats: "AUTHORED_FICTIONAL_TEMPLATE",
  intendedDemoMoments: "USER_PROVIDED_SAFE_SIGNAL",
  knownEdgeCases: "USER_PROVIDED_SAFE_SIGNAL",
  requiredCapabilityPins: "CALCULATED_CONSTRAINT",
  generatorVersion: "CALCULATED_CONSTRAINT",
  deterministicSeed: "USER_PROVIDED_SAFE_SIGNAL",
  expirationPolicy: "CALCULATED_CONSTRAINT",
  forbiddenContent: "AUTHORED_FICTIONAL_TEMPLATE",
  expectedValidationGates: "AUTHORED_FICTIONAL_TEMPLATE",
};

const ENTITY_COUNTS = {
  COMPACT: { ACCOUNTS: 2, CONTACTS: 5, OPPORTUNITIES: 3, CASES: 2, ACTIVITIES: 7 },
  STANDARD: { ACCOUNTS: 3, CONTACTS: 8, OPPORTUNITIES: 5, CASES: 3, ACTIVITIES: 11 },
} as const;

export function compileSyntheticDataContract(receipt: ContextReceipt, config: FoundryBuildConfig, at: string): SyntheticDataContract {
  if (receipt.validationOutcome !== "ACCEPTED" || !receipt.acceptedProfile || !receipt.acceptedProfileHash) throw new Error("CONTEXT_NOT_ACCEPTED");
  const { id: receiptId, ...receiptCore } = receipt;
  if (receiptId !== stableId("context-receipt", receiptCore) || receipt.acceptedProfileHash !== stableHash(receipt.acceptedProfile) || !isExactUtcIso(at)) {
    throw new Error("INVALID_CONTEXT_RECEIPT");
  }
  if (receipt.policyVersion !== config.policyVersion) throw new Error("POLICY_VERSION_MISMATCH");
  const profile = receipt.acceptedProfile;
  const expiresAt = new Date(Date.parse(at) + profile.ttlHours * 3_600_000).toISOString();
  const counts = ENTITY_COUNTS[profile.recordVolumeBand];
  const core = {
    version: 1 as const,
    requestId: receipt.requestId,
    packId: receipt.packId,
    contextReceiptId: receipt.id,
    acceptedProfileHash: receipt.acceptedProfileHash,
    policyVersion: receipt.policyVersion,
    sourceMode: profile.sourceMode,
    industryArchetype: profile.industryArchetype,
    organizationSizeBand: profile.organizationSizeBand,
    geographicRegion: profile.geographicRegion,
    locale: profile.locale,
    timeZone: profile.timeZone,
    salesMotion: profile.salesMotion,
    demoAudience: profile.demoAudience,
    useCaseTags: [...profile.useCaseTags],
    objectFamilies: [...profile.objectFamilies],
    recordVolumeBand: profile.recordVolumeBand,
    salesCycleBand: profile.salesCycleBand,
    valueBand: profile.valueBand,
    lifecycleStages: [...profile.lifecycleStages],
    scenarioGoals: [...profile.scenarioGoals],
    edgeCases: [...profile.edgeCases],
    packOwnerId: profile.packOwnerId,
    ttlHours: profile.ttlHours,
    objectGraph: [...profile.objectFamilies],
    entityCountBounds: profile.objectFamilies.map((object) => ({ object, minimum: counts[object], maximum: counts[object] })),
    requiredRelationships: [
      { child: "CONTACTS" as const, parent: "ACCOUNTS" as const, foreignKey: "accountId" },
      { child: "OPPORTUNITIES" as const, parent: "ACCOUNTS" as const, foreignKey: "accountId" },
      { child: "CASES" as const, parent: "ACCOUNTS" as const, foreignKey: "accountId" },
      { child: "ACTIVITIES" as const, parent: "ACCOUNTS" as const, foreignKey: "accountId" },
    ],
    picklists: {
      opportunityStage: ["DISCOVERY", "VALIDATION", "NEGOTIATION"],
      caseStatus: ["OPEN", "RESOLVED"],
      activitySignal: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
    },
    businessConstraints: [
      "Renewal and expansion follow the original customer relationship.",
      "Stage, probability, value band, and close date agree.",
      "Activities and cases never predate their parent records.",
      "Account rollups equal underlying open opportunities.",
      `The primary renewal uses the accepted ${profile.valueBand} value band.`,
      `The ${profile.salesCycleBand} sales-cycle band determines bounded opportunity close-date windows.`,
      `The policy-coarsened ${profile.recordVolumeBand} volume band compiles to ${counts.ACCOUNTS} accounts, ${counts.CONTACTS} contacts, ${counts.OPPORTUNITIES} opportunities, ${counts.CASES} cases, and ${counts.ACTIVITIES} activities.`,
    ],
    timelineAnchor: "2026-09-15T14:00:00.000Z" as const,
    distributionTargets: [
      "One deteriorating renewal",
      "One plausible expansion",
      "One open restricted security concern",
      "One recent-activity gap",
      `Primary renewal value band: ${profile.valueBand}`,
      `Record-volume profile: ${profile.recordVolumeBand}`,
    ],
    personaPermissionModel: SCENARIO_PERMISSIONS.map((permission) => ({
      ...permission,
      objectAccess: [...permission.objectAccess],
      hiddenFields: [...permission.hiddenFields],
      allowedActions: [...permission.allowedActions],
      approvalRequiredActions: [...permission.approvalRequiredActions],
      prohibitedDisclosures: [...permission.prohibitedDisclosures],
    })),
    storyBeats: [
      "Prepare for a fictional renewal meeting.",
      "Explain deteriorating health alongside a plausible expansion.",
      "Respect a restricted unresolved security concern.",
      "Permit only the seller-owner persona to update the opportunity next step.",
    ],
    intendedDemoMoments: [...profile.useCaseTags],
    knownEdgeCases: [...profile.edgeCases],
    requiredCapabilityPins: [...config.capabilityPins].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    templateVersion: config.templateVersion,
    generatorVersion: config.generatorVersion,
    deterministicSeed: profile.seed,
    expirationPolicy: { ttlHours: profile.ttlHours, expiresAt },
    forbiddenContent: ["customer records", "real identities", "routable contacts", "credentials", "free text", "Salesforce identifiers"],
    expectedValidationGates: ["privacy", "referential integrity", "chronology", "rollups", "permissions", "determinism", "oracle evidence"],
    elementOrigins: ELEMENT_ORIGINS,
    compiledAt: at,
  };
  const contractHash = stableHash(core);
  return { id: stableId("contract", core), ...core, contractHash };
}
