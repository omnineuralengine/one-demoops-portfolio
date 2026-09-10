import { stableHash, stableId } from "./canonical";
import { createSeededRandom, shuffled } from "./prng";
import { buildGroundTruthOracle } from "./oracle";
import type {
  GeneratedScenarioWorld,
  ScenarioRecords,
  SyntheticAccount,
  SyntheticActivity,
  SyntheticCase,
  SyntheticContact,
  SyntheticDataContract,
  SyntheticOpportunity,
} from "./types";

const ORGANIZATION_ROOTS = ["Cinder Vale", "Juniper Atlas", "Lumen Prairie", "Silver Kestrel", "Verdant Quill", "Nimbus Forge"] as const;
const GIVEN_NAMES = ["Avery", "Casey", "Devon", "Emery", "Harper", "Morgan", "Quinn", "Riley"] as const;
const FAMILY_NAMES = ["Arden", "Briar", "Ellis", "Hollis", "Marlow", "Reese", "Rowan", "Vale"] as const;
const CONTACT_ROLES = ["Revenue Operations Lead", "Security Director", "Procurement Partner", "Business Sponsor", "Technical Champion"] as const;

const day = 86_400_000;
const atOffset = (anchor: string, days: number) => new Date(Date.parse(anchor) + days * day).toISOString();
const contactCreatedOffset = (index: number) => index < 4 ? -310 + index : [-190, -160, -150, -120][index - 4];

export function generateSyntheticWorld(contract: SyntheticDataContract): GeneratedScenarioWorld {
  const { id: contractId, contractHash, ...contractCore } = contract;
  if (contractHash !== stableHash(contractCore) || contractId !== stableId("contract", contractCore)) throw new Error("INVALID_SYNTHETIC_DATA_CONTRACT");
  const random = createSeededRandom(contract.deterministicSeed);
  const standardVolume = contract.recordVolumeBand === "STANDARD";
  const accountCount = standardVolume ? 3 : 2;
  const contactCount = standardVolume ? 8 : 5;
  const opportunityCount = standardVolume ? 5 : 3;
  const caseCount = standardVolume ? 3 : 2;
  const organizations = shuffled(ORGANIZATION_ROOTS, random).slice(0, accountCount).map((root) => `${root} Systems (Fictional)`);
  const given = shuffled(GIVEN_NAMES, random).slice(0, contactCount);
  const family = shuffled(FAMILY_NAMES, random).slice(0, contactCount);
  const suffix = stableHash({ packId: contract.packId, contractHash: contract.contractHash, seed: contract.deterministicSeed, generatorVersion: contract.generatorVersion }).slice(0, 8);
  const accountIds = Array.from({ length: accountCount }, (_, index) => `syn-account-${suffix}-${String(index + 1).padStart(2, "0")}`);
  const opportunityIds = Array.from({ length: opportunityCount }, (_, index) => `syn-opportunity-${suffix}-${String(index + 1).padStart(2, "0")}`);
  const contactIds = Array.from({ length: contactCount }, (_, index) => `syn-contact-${suffix}-${String(index + 1).padStart(2, "0")}`);
  const caseIds = Array.from({ length: caseCount }, (_, index) => `syn-case-${suffix}-${String(index + 1).padStart(2, "0")}`);
  const closeOffsets = contract.salesCycleBand === "QUARTER" ? [21, 45, 75, 60, 85] : [30, 70, 100, 90, 130];

  const accounts: SyntheticAccount[] = [
    {
      id: accountIds[0], name: organizations[0], region: contract.geographicRegion,
      createdAt: atOffset(contract.timelineAnchor, -420), customerSince: atOffset(contract.timelineAnchor, -330),
      ownerUserId: "seller-user-01", territory: `SYNTHETIC-${contract.geographicRegion}-01`, renewalValueBand: contract.valueBand,
      openPipelineValueBand: contract.valueBand, openOpportunityCount: 2,
    },
    {
      id: accountIds[1], name: organizations[1], region: contract.geographicRegion,
      createdAt: atOffset(contract.timelineAnchor, -300), customerSince: atOffset(contract.timelineAnchor, -220),
      ownerUserId: "seller-user-02", territory: `SYNTHETIC-${contract.geographicRegion}-02`, renewalValueBand: "MID_VALUE",
      openPipelineValueBand: "MID_VALUE", openOpportunityCount: standardVolume ? 2 : 1,
    },
  ];
  if (standardVolume) {
    accounts.push({
      id: accountIds[2], name: organizations[2], region: contract.geographicRegion,
      createdAt: atOffset(contract.timelineAnchor, -250), customerSince: atOffset(contract.timelineAnchor, -180),
      ownerUserId: "seller-user-03", territory: `SYNTHETIC-${contract.geographicRegion}-03`, renewalValueBand: "MID_VALUE",
      openPipelineValueBand: "MID_VALUE", openOpportunityCount: 1,
    });
  }
  const contacts: SyntheticContact[] = contactIds.map((id, index) => ({
    id,
    accountId: index < 4 ? accountIds[0] : standardVolume && index >= 6 ? accountIds[2] : accountIds[1],
    fullName: `${given[index]} ${family[index]} (Fictional)`,
    role: CONTACT_ROLES[index % CONTACT_ROLES.length],
    email: `person-${suffix}-${index + 1}@example.invalid`,
    phone: "NOT_PROVIDED",
    createdAt: atOffset(contract.timelineAnchor, contactCreatedOffset(index)),
    restricted: index === 1,
  }));
  const opportunities: SyntheticOpportunity[] = [
    {
      id: opportunityIds[0], accountId: accountIds[0], ownerUserId: "seller-user-01", kind: "RENEWAL",
      stage: "NEGOTIATION", probabilityPercent: 75, valueBand: contract.valueBand,
      createdAt: atOffset(contract.timelineAnchor, -180), closeDate: atOffset(contract.timelineAnchor, closeOffsets[0]),
      nextStep: null, lastActivityAt: atOffset(contract.timelineAnchor, -28), securityRisk: "OPEN_REVIEW",
      restrictedFields: ["securityRisk"],
    },
    {
      id: opportunityIds[1], accountId: accountIds[0], ownerUserId: "seller-user-01", kind: "EXPANSION",
      stage: "VALIDATION", probabilityPercent: 55, valueBand: "MID_VALUE",
      createdAt: atOffset(contract.timelineAnchor, -90), closeDate: atOffset(contract.timelineAnchor, closeOffsets[1]),
      nextStep: "Confirm fictional evaluation agenda", lastActivityAt: atOffset(contract.timelineAnchor, -5), securityRisk: "NONE",
      restrictedFields: [],
    },
    {
      id: opportunityIds[2], accountId: accountIds[1], ownerUserId: "seller-user-02", kind: "EXPANSION",
      stage: "DISCOVERY", probabilityPercent: 25, valueBand: "MID_VALUE",
      createdAt: atOffset(contract.timelineAnchor, -60), closeDate: atOffset(contract.timelineAnchor, closeOffsets[2]),
      nextStep: "Schedule fictional discovery workshop", lastActivityAt: atOffset(contract.timelineAnchor, -20), securityRisk: "NONE",
      restrictedFields: [],
    },
  ];
  if (standardVolume) {
    opportunities.push(
      {
        id: opportunityIds[3], accountId: accountIds[1], ownerUserId: "seller-user-02", kind: "EXPANSION",
        stage: "VALIDATION", probabilityPercent: 55, valueBand: "MID_VALUE",
        createdAt: atOffset(contract.timelineAnchor, -75), closeDate: atOffset(contract.timelineAnchor, closeOffsets[3]),
        nextStep: "Complete fictional stakeholder validation", lastActivityAt: atOffset(contract.timelineAnchor, -12), securityRisk: "NONE",
        restrictedFields: [],
      },
      {
        id: opportunityIds[4], accountId: accountIds[2], ownerUserId: "seller-user-03", kind: "EXPANSION",
        stage: "DISCOVERY", probabilityPercent: 25, valueBand: "MID_VALUE",
        createdAt: atOffset(contract.timelineAnchor, -45), closeDate: atOffset(contract.timelineAnchor, closeOffsets[4]),
        nextStep: "Confirm fictional discovery participants", lastActivityAt: atOffset(contract.timelineAnchor, -8), securityRisk: "NONE",
        restrictedFields: [],
      },
    );
  }
  const cases: SyntheticCase[] = [
    {
      id: caseIds[0], accountId: accountIds[0], opportunityId: opportunityIds[0], kind: "SECURITY", status: "OPEN", severity: "HIGH",
      openedAt: atOffset(contract.timelineAnchor, -45), resolvedAt: null, restricted: true,
    },
    {
      id: caseIds[1], accountId: accountIds[0], opportunityId: opportunityIds[1], kind: "SUPPORT", status: "RESOLVED", severity: "MEDIUM",
      openedAt: atOffset(contract.timelineAnchor, -80), resolvedAt: atOffset(contract.timelineAnchor, -70), restricted: false,
    },
  ];
  if (standardVolume) {
    cases.push({
      id: caseIds[2], accountId: accountIds[1], opportunityId: opportunityIds[3], kind: "SUPPORT", status: "RESOLVED", severity: "MEDIUM",
      openedAt: atOffset(contract.timelineAnchor, -50), resolvedAt: atOffset(contract.timelineAnchor, -42), restricted: false,
    });
  }
  const activitySeeds: readonly (readonly [number, number, number | null, "MEETING" | "EMAIL_SUMMARY" | "TASK", number, "POSITIVE" | "NEUTRAL" | "NEGATIVE", string, boolean])[] = [
    [0, 0, 0, "MEETING", -150, "POSITIVE", "RENEWAL_KICKOFF", false],
    [0, 0, 1, "EMAIL_SUMMARY", -80, "NEGATIVE", "PROCUREMENT_DELAY_SIGNAL", false],
    [0, 0, 1, "TASK", -28, "NEGATIVE", "SECURITY_FOLLOWUP_OVERDUE", true],
    [0, 1, 2, "MEETING", -60, "POSITIVE", "EXPANSION_DISCOVERY", false],
    [0, 1, 3, "EMAIL_SUMMARY", -15, "POSITIVE", "CHAMPION_CONFIRMED", false],
    [0, 1, 3, "TASK", -5, "POSITIVE", "AGENDA_CONFIRMED", false],
    [1, 2, 4, "MEETING", -20, "NEUTRAL", "EARLY_DISCOVERY", false],
    ...(standardVolume ? [
      [1, 3, 5, "MEETING", -45, "NEUTRAL", "STAKEHOLDER_VALIDATION", false],
      [1, 3, 5, "TASK", -12, "POSITIVE", "VALIDATION_COMPLETE", false],
      [2, 4, 6, "MEETING", -10, "NEUTRAL", "DISCOVERY_PARTICIPANTS", false],
      [2, 4, 7, "EMAIL_SUMMARY", -8, "POSITIVE", "DISCOVERY_CONFIRMATION", false],
    ] as const : []),
  ];
  const activities: SyntheticActivity[] = activitySeeds.map(([accountIndex, opportunityIndex, contactIndex, kind, days, signal, summaryCode, restricted], index) => ({
    id: `syn-activity-${suffix}-${String(index + 1).padStart(2, "0")}`,
    accountId: accountIds[accountIndex], opportunityId: opportunityIds[opportunityIndex],
    contactId: contactIndex === null ? null : contactIds[contactIndex], kind,
    occurredAt: atOffset(contract.timelineAnchor, days), signal, summaryCode, restricted,
  }));
  const records: ScenarioRecords = { accounts, contacts, opportunities, cases, activities };
  const oracle = buildGroundTruthOracle(records, contract);
  const core = {
    generationRunId: stableId("generation", { contractHash: contract.contractHash, seed: contract.deterministicSeed, generatorVersion: contract.generatorVersion }),
    requestId: contract.requestId,
    packId: contract.packId,
    acceptedProfileHash: contract.acceptedProfileHash,
    contractHash: contract.contractHash,
    templateVersion: contract.templateVersion,
    generatorVersion: contract.generatorVersion,
    seed: contract.deterministicSeed,
    utcAnchor: contract.timelineAnchor,
    generatedAt: contract.compiledAt,
    locale: contract.locale,
    timeZone: contract.timeZone,
    currency: contract.locale === "en-GB" ? "GBP" as const : "USD" as const,
    watermark: "SYNTHETIC REVENUE WORLD · NO SALESFORCE CONNECTION OR CUSTOMER DATA" as const,
    records,
    permissions: contract.personaPermissionModel.map((permission) => ({
      ...permission,
      objectAccess: [...permission.objectAccess],
      hiddenFields: [...permission.hiddenFields],
      allowedActions: [...permission.allowedActions],
      approvalRequiredActions: [...permission.approvalRequiredActions],
      prohibitedDisclosures: [...permission.prohibitedDisclosures],
    })),
    oracle,
  };
  const outputHash = stableHash(core);
  return { id: stableId("world", core), ...core, outputHash };
}
