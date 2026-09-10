import { canonicalStringify, stableHash, stableId } from "./canonical";
import { generateSyntheticWorld } from "./generator";
import { allPermissionChecks } from "./permissions";
import { oracleContainsAllSkillCategories } from "./oracle";
import { isBoundedPlainData } from "./schema";
import type {
  FoundryActor,
  GenerationEvidenceBinding,
  GeneratedScenarioWorld,
  PrivacyReport,
  QualityReport,
  ScenarioRecords,
  SyntheticDataContract,
  ValidationCheck,
} from "./types";

const GENERATED_WORLD_LIMITS = Object.freeze({ maxDepth: 10, maxNodes: 2_000, maxArrayItems: 20, maxObjectKeys: 40, maxStringCharacters: 240 });

export function privacyChecks(world: GeneratedScenarioWorld, contract: SyntheticDataContract): readonly ValidationCheck[] {
  if (!generatedWorldSchemaIsValid(world, contract)) {
    return [check("privacy:runtime-schema", false, "The generated artifact is not bounded, accessor-free data matching the strict generated-world schema.")];
  }
  const serialized = canonicalStringify(world);
  const contactsSafe = world.records.contacts.every((contact) => contact.email.endsWith(".invalid") && contact.phone === "NOT_PROVIDED");
  const noRoutableUrls = !/(?:https?:\/\/|www\.)/i.test(serialized);
  const noCredentials = !/(?:Bearer\s+|sk-[A-Za-z0-9]|password\s*[=:]|BEGIN [A-Z ]*PRIVATE KEY)/i.test(serialized);
  const allIds = [
    ...world.records.accounts.map((record) => record.id),
    ...world.records.contacts.map((record) => record.id),
    ...world.records.opportunities.map((record) => record.id),
    ...world.records.cases.map((record) => record.id),
    ...world.records.activities.map((record) => record.id),
  ];
  const noSalesforceIds = allIds.every((id) => id.startsWith("syn-") && !/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(id));
  const noExecutableOrPromptContent = !/<\/?(?:script|iframe|object|embed|style|img)\b|javascript:|ignore (?:all|previous) instructions|system prompt/i.test(serialized);
  const syntheticWatermark = world.watermark === "SYNTHETIC REVENUE WORLD · NO SALESFORCE CONNECTION OR CUSTOMER DATA";
  return [
    check("privacy:runtime-schema", true, "The generated artifact is bounded, accessor-free data matching the strict generated-world schema."),
    check("privacy:non-routable-identities", contactsSafe, "Every synthetic email uses .invalid and phone is NOT_PROVIDED."),
    check("privacy:no-routable-urls", noRoutableUrls, "No generated record contains a routable URL or webhook."),
    check("privacy:no-credentials", noCredentials, "No credential-shaped value is present in the generated world."),
    check("privacy:no-salesforce-identifiers", noSalesforceIds, "Generated IDs use the explicit syn-* namespace, not Salesforce ID shapes."),
    check("privacy:inert-content", noExecutableOrPromptContent, "Generated template content contains no executable markup or instruction-shaped text."),
    check("privacy:synthetic-watermark", syntheticWatermark, "The generated world carries a persistent synthetic/no-connection watermark."),
  ];
}

export function qualityChecks(world: GeneratedScenarioWorld, contract: SyntheticDataContract): readonly ValidationCheck[] {
  if (!generatedWorldSchemaIsValid(world, contract)) {
    return [check("quality:runtime-schema", false, "The generated artifact is not bounded, accessor-free data matching the strict generated-world schema.")];
  }
  const records = world.records;
  const accountIds = new Set(records.accounts.map((item) => item.id));
  const opportunitiesById = new Map(records.opportunities.map((item) => [item.id, item]));
  const contactsById = new Map(records.contacts.map((item) => [item.id, item]));
  const allRecordIds = [
    ...records.accounts.map((item) => item.id), ...records.contacts.map((item) => item.id),
    ...records.opportunities.map((item) => item.id), ...records.cases.map((item) => item.id),
    ...records.activities.map((item) => item.id),
  ];
  const globallyUniqueIds = new Set(allRecordIds).size === allRecordIds.length;
  const referential = globallyUniqueIds
    && records.contacts.every((item) => accountIds.has(item.accountId))
    && records.opportunities.every((item) => accountIds.has(item.accountId))
    && records.cases.every((item) => {
      const opportunity = item.opportunityId === null ? null : opportunitiesById.get(item.opportunityId);
      return accountIds.has(item.accountId) && (item.opportunityId === null || opportunity?.accountId === item.accountId);
    })
    && records.activities.every((item) => {
      const opportunity = item.opportunityId === null ? null : opportunitiesById.get(item.opportunityId);
      const contact = item.contactId === null ? null : contactsById.get(item.contactId);
      return accountIds.has(item.accountId)
        && (item.opportunityId === null || opportunity?.accountId === item.accountId)
        && (item.contactId === null || contact?.accountId === item.accountId);
    });
  const chronology = chronologyHolds(records);
  const rollups = records.accounts.every((account) => {
    const opportunities = records.opportunities.filter((item) => item.accountId === account.id);
    const expectedValueBand = opportunities.some((item) => item.valueBand === "STRATEGIC") ? "STRATEGIC" : "MID_VALUE";
    return account.openOpportunityCount === opportunities.length && account.openPipelineValueBand === expectedValueBand;
  });
  const opportunityRules = records.opportunities.every((item) => stageRules(item.stage, item.probabilityPercent) && Date.parse(item.closeDate) > Date.parse(item.createdAt));
  const primaryRenewal = records.opportunities.find((item) => item.kind === "RENEWAL");
  const primaryRenewalAccount = records.accounts.find((item) => item.id === primaryRenewal?.accountId);
  const closeOffsetsInDays = records.opportunities.map((item) => (Date.parse(item.closeDate) - Date.parse(contract.timelineAnchor)) / 86_400_000);
  const salesCycleAligned = contract.salesCycleBand === "QUARTER"
    ? closeOffsetsInDays.every((offset) => offset > 0 && offset <= 90)
    : closeOffsetsInDays.every((offset) => offset > 0 && offset <= 180) && closeOffsetsInDays.some((offset) => offset > 90);
  const profileBandsAligned = primaryRenewal?.valueBand === contract.valueBand
    && primaryRenewalAccount?.renewalValueBand === contract.valueBand
    && salesCycleAligned;
  const caseRules = records.cases.every((item) => item.status === "OPEN" ? item.resolvedAt === null : Boolean(item.resolvedAt && Date.parse(item.resolvedAt) >= Date.parse(item.openedAt)));
  const bounds = contract.entityCountBounds.every((bound) => {
    const count = recordCount(records, bound.object);
    return count >= bound.minimum && count <= bound.maximum;
  });
  const permissionResults = allPermissionChecks(world);
  const permissionModelBound = canonicalStringify(world.permissions) === canonicalStringify(contract.personaPermissionModel);
  const deterministic = generateSyntheticWorld(contract).outputHash === world.outputHash
    && canonicalStringify(generateSyntheticWorld(contract)) === canonicalStringify(world);
  const supportedRegionalTuple = contract.geographicRegion === "AMERICAS" && contract.locale === "en-US" && contract.timeZone === "America/New_York" && world.currency === "USD"
    || contract.geographicRegion === "EMEA" && contract.locale === "en-GB" && contract.timeZone === "Europe/London" && world.currency === "GBP";
  const regional = supportedRegionalTuple && world.locale === contract.locale && world.timeZone === contract.timeZone
    && records.accounts.every((account) => account.region === contract.geographicRegion);
  const activityDensity = records.opportunities.every((opportunity) => {
    const count = records.activities.filter((activity) => activity.opportunityId === opportunity.id).length;
    return opportunity.stage === "NEGOTIATION" ? count >= 3 : opportunity.stage === "VALIDATION" ? count >= 2 : count >= 1;
  });
  const lastActivityRollups = records.opportunities.every((opportunity) => {
    const timestamps = records.activities.filter((activity) => activity.opportunityId === opportunity.id).map((activity) => activity.occurredAt);
    const latest = timestamps.length === 0 ? null : timestamps.reduce((current, candidate) => Date.parse(candidate) > Date.parse(current) ? candidate : current);
    return opportunity.lastActivityAt === latest;
  });
  const payloadBounded = records.accounts.length + records.contacts.length + records.opportunities.length + records.cases.length + records.activities.length <= 40
    && canonicalStringify(world).length <= 80_000
    && stringsIn(world).every((value) => value.length <= 240);
  return [
    check("quality:runtime-schema", true, "The generated artifact is bounded, accessor-free data matching the strict generated-world schema."),
    check("quality:referential-integrity", referential, "Every record ID is globally unique and every child points to a same-account synthetic parent."),
    check("quality:chronology", chronology, "No activity, case, contact, or opportunity predates its relevant parent."),
    check("quality:rollups", rollups, "Account open-opportunity counts reconcile to generated opportunities."),
    check("quality:opportunity-rules", opportunityRules, "Stage, probability, and close chronology agree."),
    check("quality:profile-band-constraints", profileBandsAligned, "The accepted value and sales-cycle bands deterministically constrain the primary renewal and close-date windows."),
    check("quality:case-rules", caseRules, "Open and resolved cases have coherent timelines."),
    check("quality:entity-bounds", bounds, "Generated entity counts remain within the canonical contract."),
    check("quality:permission-positive-negative", permissionModelBound && permissionResults.every((item) => item.outcome === "PASS"), "The contract-bound permission model governs every persona projection, with positive access and an explicit negative boundary."),
    check("quality:deterministic-replay", deterministic, "The same contract, seed, generator version, and UTC anchor reproduce byte-identical output."),
    check("quality:locale-time-zone", regional, "Locale, currency, time zone, and broad region are internally consistent."),
    check("quality:activity-density", activityDensity, "Activity density follows the maturity of each opportunity stage."),
    check("quality:last-activity-rollup", lastActivityRollups, "Every opportunity last-activity field reconciles to its latest underlying synthetic activity."),
    check("quality:payload-bounds", payloadBounded, "Entity, payload, and generated-string sizes remain bounded."),
    check("quality:oracle-categories", oracleContainsAllSkillCategories(world.oracle), "The oracle covers all four simulated public skill categories."),
  ];
}

export function createPrivacyReport(world: GeneratedScenarioWorld, contract: SyntheticDataContract, actor: FoundryActor, at: string, priorEventId: string): PrivacyReport {
  const checks = privacyChecks(world, contract);
  const core = { ...generationBinding(world, contract, actor, at, priorEventId), outcome: checks.every((item) => item.outcome === "PASS") ? "PASS" as const : "FAIL" as const, checks };
  return { id: stableId("privacy-report", core), ...core, reportHash: stableHash(core) };
}

export function createQualityReport(world: GeneratedScenarioWorld, contract: SyntheticDataContract, actor: FoundryActor, at: string, priorEventId: string): QualityReport {
  const checks = qualityChecks(world, contract);
  const core = { ...generationBinding(world, contract, actor, at, priorEventId), outcome: checks.every((item) => item.outcome === "PASS") ? "PASS" as const : "FAIL" as const, checks };
  return { id: stableId("quality-report", core), ...core, reportHash: stableHash(core) };
}

function generationBinding(world: GeneratedScenarioWorld, contract: SyntheticDataContract, actor: FoundryActor, at: string, priorEventId: string): GenerationEvidenceBinding {
  if (world.requestId !== contract.requestId || world.packId !== contract.packId || world.acceptedProfileHash !== contract.acceptedProfileHash
    || world.contractHash !== contract.contractHash || world.templateVersion !== contract.templateVersion
    || world.generatorVersion !== contract.generatorVersion || world.seed !== contract.deterministicSeed) {
    throw new Error("WORLD_CONTRACT_BINDING_MISMATCH");
  }
  return {
    requestId: world.requestId,
    packId: world.packId,
    generationRunId: world.generationRunId,
    acceptedProfileHash: world.acceptedProfileHash,
    contractHash: world.contractHash,
    templateVersion: world.templateVersion,
    generatorVersion: world.generatorVersion,
    seed: world.seed,
    outputHash: world.outputHash,
    capabilityPins: contract.requiredCapabilityPins.map((pin) => ({ id: pin.id, version: pin.version, kind: pin.kind })),
    actor: { id: actor.id, kind: actor.kind },
    at,
    priorEventId,
  };
}

function check(id: string, pass: boolean, evidence: string): ValidationCheck {
  return { id, outcome: pass ? "PASS" : "FAIL", evidence };
}

function chronologyHolds(records: ScenarioRecords) {
  const accounts = new Map(records.accounts.map((item) => [item.id, item]));
  const opportunities = new Map(records.opportunities.map((item) => [item.id, item]));
  const contacts = new Map(records.contacts.map((item) => [item.id, item]));
  return records.accounts.every((item) => validDate(item.createdAt) && validDate(item.customerSince) && Date.parse(item.customerSince) >= Date.parse(item.createdAt))
    && records.contacts.every((item) => {
      const account = accounts.get(item.accountId);
      return Boolean(account && validDate(item.createdAt) && Date.parse(item.createdAt) >= Date.parse(account.createdAt));
    })
    && records.opportunities.every((item) => {
      const account = accounts.get(item.accountId);
      return Boolean(account && validDate(item.createdAt) && Date.parse(item.createdAt) >= Date.parse(account.customerSince));
    })
    && records.cases.every((item) => {
      const account = accounts.get(item.accountId);
      const opportunity = item.opportunityId === null ? null : opportunities.get(item.opportunityId);
      return Boolean(account && validDate(item.openedAt) && Date.parse(item.openedAt) >= Date.parse(account.customerSince)
        && (item.opportunityId === null || (opportunity && Date.parse(item.openedAt) >= Date.parse(opportunity.createdAt))));
    })
    && records.activities.every((item) => {
      const account = accounts.get(item.accountId);
      const opportunity = item.opportunityId === null ? null : opportunities.get(item.opportunityId);
      const contact = item.contactId === null ? null : contacts.get(item.contactId);
      return Boolean(account && validDate(item.occurredAt) && Date.parse(item.occurredAt) >= Date.parse(account.customerSince)
        && (item.opportunityId === null || (opportunity && Date.parse(item.occurredAt) >= Date.parse(opportunity.createdAt)))
        && (item.contactId === null || (contact && Date.parse(item.occurredAt) >= Date.parse(contact.createdAt))));
    });
}

function validDate(value: string) { return Number.isFinite(Date.parse(value)); }

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap(stringsIn);
}

function stageRules(stage: string, probability: number) {
  return (stage === "DISCOVERY" && probability === 25)
    || (stage === "VALIDATION" && probability === 55)
    || (stage === "NEGOTIATION" && probability === 75);
}

function recordCount(records: ScenarioRecords, object: string) {
  if (object === "ACCOUNTS") return records.accounts.length;
  if (object === "CONTACTS") return records.contacts.length;
  if (object === "OPPORTUNITIES") return records.opportunities.length;
  if (object === "CASES") return records.cases.length;
  return records.activities.length;
}

export function generatedWorldSchemaIsValid(world: unknown, contract: SyntheticDataContract): world is GeneratedScenarioWorld {
  if (!isBoundedPlainData(world, GENERATED_WORLD_LIMITS)) return false;
  try {
    return sameDataShape(world, generateSyntheticWorld(contract));
  } catch {
    return false;
  }
}

function sameDataShape(candidate: unknown, exemplar: unknown): boolean {
  if (candidate === null || exemplar === null) return candidate === null && exemplar === null;
  if (typeof candidate !== "object" || typeof exemplar !== "object") return typeof candidate === typeof exemplar;
  const candidateArray = Array.isArray(candidate);
  const exemplarArray = Array.isArray(exemplar);
  if (candidateArray !== exemplarArray) return false;
  const candidateDescriptors = Object.getOwnPropertyDescriptors(candidate);
  const exemplarDescriptors = Object.getOwnPropertyDescriptors(exemplar);
  if (candidateArray && exemplarArray) {
    const candidateKeys = Object.keys(candidateDescriptors).filter((key) => key !== "length");
    const exemplarKeys = Object.keys(exemplarDescriptors).filter((key) => key !== "length");
    if (candidateKeys.length === 0 || exemplarKeys.length === 0) return true;
    return candidateKeys.every((key) => exemplarKeys.some((exemplarKey) => sameDataShape(candidateDescriptors[key]?.value, exemplarDescriptors[exemplarKey]?.value)));
  }
  const candidateKeys = Object.keys(candidateDescriptors).sort();
  const exemplarKeys = Object.keys(exemplarDescriptors).sort();
  return candidateKeys.length === exemplarKeys.length
    && candidateKeys.every((key, index) => key === exemplarKeys[index] && sameDataShape(candidateDescriptors[key]?.value, exemplarDescriptors[key]?.value));
}
