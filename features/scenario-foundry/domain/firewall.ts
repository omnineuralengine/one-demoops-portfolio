import { stableHash, stableId } from "./canonical";
import { hasExactKeys, inspectUnknownStructure, isExactUtcIso, isPlainRecord, isUniqueEnumArray } from "./schema";
import type {
  ContextFieldDecision,
  ContextReceipt,
  FoundryBuildConfig,
  RejectionCategory,
  SafeDemoSignalInput,
  SafeDemoSignalProfile,
} from "./types";

const KEYS = [
  "sourceMode", "industryArchetype", "organizationSizeBand", "geographicRegion", "locale", "timeZone",
  "salesMotion", "demoAudience", "useCaseTags", "objectFamilies", "recordVolumeBand", "salesCycleBand",
  "valueBand", "lifecycleStages", "scenarioGoals", "edgeCases", "packOwnerId", "ttlHours", "seed",
] as const satisfies readonly (keyof SafeDemoSignalInput)[];

const VALUES = {
  sourceMode: ["TEMPLATE_FIRST", "SAFE_PATTERN_ASSISTED"],
  industryArchetype: ["B2B_SOFTWARE"],
  organizationSizeBand: ["MID_MARKET", "ENTERPRISE"],
  geographicRegion: ["NORTH_AMERICA", "EUROPE"],
  locale: ["en-US", "en-GB"],
  timeZone: ["America/New_York", "Europe/London"],
  salesMotion: ["RENEWAL_AND_EXPANSION"],
  demoAudience: ["ACCOUNT_TEAM", "EXECUTIVE_REVIEW"],
  useCaseTags: ["MEETING_PREPARATION", "DEAL_HEALTH_REVIEW", "PIPELINE_REVIEW", "GOVERNED_UPDATE"],
  objectFamilies: ["ACCOUNTS", "CONTACTS", "OPPORTUNITIES", "CASES", "ACTIVITIES"],
  recordVolumeBand: ["SMALL", "MEDIUM"],
  salesCycleBand: ["QUARTER", "HALF_YEAR"],
  valueBand: ["MID_VALUE", "STRATEGIC"],
  lifecycleStages: ["CUSTOMER", "RENEWAL", "EXPANSION"],
  scenarioGoals: ["PREPARE_RENEWAL_MEETING", "EXPLAIN_DEAL_HEALTH", "REVIEW_PIPELINE", "GOVERN_ACCOUNT_UPDATE"],
  edgeCases: ["STALE_FIELD", "CONFLICTING_SIGNAL", "ACTIVITY_GAP", "RESTRICTED_FIELD"],
  packOwnerId: ["maya"],
} as const;

export interface ContextFirewallOptions {
  readonly requestId: string;
  readonly packId: string;
  readonly requestingActorId: "sofia";
  readonly at: string;
  readonly policyVersion: FoundryBuildConfig["policyVersion"];
}

export function evaluateContextFirewall(input: unknown, options: ContextFirewallOptions): ContextReceipt {
  const safeOptions = projectFirewallOptions(options);
  if (!safeOptions) return invalidFirewallOptionsReceipt();
  try {
    return evaluateContextFirewallInternal(input, safeOptions);
  } catch {
    const receiptCore = {
      requestId: safeOptions.requestId,
      packId: safeOptions.packId,
      policyVersion: safeOptions.policyVersion,
      requestingActorId: safeOptions.requestingActorId,
      purpose: "FICTIONAL_REVENUE_DEMO_REHEARSAL" as const,
      packTtlHours: null,
      validationOutcome: "REJECTED" as const,
      acceptedProfile: null,
      acceptedProfileHash: null,
      decisions: [{ field: "UNRECOGNIZED_INPUT" as const, disposition: "REJECTED_BY_POLICY" as const, rejectionCategory: "PROTOTYPE_OR_EXOTIC_OBJECT" as const }],
      at: safeOptions.at,
    };
    return { id: stableId("context-receipt", receiptCore), ...receiptCore };
  }
}

function projectFirewallOptions(value: unknown): ContextFirewallOptions | null {
  try {
    const keys = ["requestId", "packId", "requestingActorId", "at", "policyVersion"] as const;
    if (!isPlainRecord(value) || !hasExactKeys(value, keys)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.values(descriptors).some((descriptor) => descriptor.get || descriptor.set || !("value" in descriptor))) return null;
    const requestId = descriptors.requestId?.value;
    const packId = descriptors.packId?.value;
    const requestingActorId = descriptors.requestingActorId?.value;
    const at = descriptors.at?.value;
    const policyVersion = descriptors.policyVersion?.value;
    if (typeof requestId !== "string" || !/^request:[a-z0-9:-]{1,120}$/.test(requestId)
      || typeof packId !== "string" || !/^pack:[a-z0-9:-]{1,120}$/.test(packId)
      || requestingActorId !== "sofia" || !isExactUtcIso(at)
      || !["context-firewall:v1", "context-firewall:v1-reviewed"].includes(policyVersion)) return null;
    return { requestId, packId, requestingActorId, at, policyVersion } as ContextFirewallOptions;
  } catch {
    return null;
  }
}

function invalidFirewallOptionsReceipt(): ContextReceipt {
  const receiptCore = {
    requestId: "request:invalid",
    packId: "pack:invalid",
    policyVersion: "context-firewall:v1" as const,
    requestingActorId: "sofia" as const,
    purpose: "FICTIONAL_REVENUE_DEMO_REHEARSAL" as const,
    packTtlHours: null,
    validationOutcome: "REJECTED" as const,
    acceptedProfile: null,
    acceptedProfileHash: null,
    decisions: [{ field: "UNRECOGNIZED_INPUT" as const, disposition: "REJECTED_BY_POLICY" as const, rejectionCategory: "UNRECOGNIZED_STRUCTURE" as const }],
    at: "1970-01-01T00:00:00.000Z",
  };
  return { id: stableId("context-receipt", receiptCore), ...receiptCore };
}

function evaluateContextFirewallInternal(input: unknown, options: ContextFirewallOptions): ContextReceipt {
  const structuralCategories = new Set<RejectionCategory>(inspectUnknownStructure(input));
  if (structuralCategories.size > 0) return rejectedReceipt(options, structuralCategories, null);
  const record = isPlainRecord(input) ? input : null;
  if (!record || !hasExactKeys(record, KEYS)) structuralCategories.add("UNRECOGNIZED_STRUCTURE");
  if (!isExactUtcIso(options.at)) structuralCategories.add("UNRECOGNIZED_STRUCTURE");
  const descriptors = record ? Object.getOwnPropertyDescriptors(record) : null;

  const decisions: ContextFieldDecision[] = [];
  if (record && descriptors) {
    for (const key of KEYS) {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.get || descriptor.set || !("value" in descriptor)) {
        decisions.push({ field: key, disposition: "NOT_SUPPLIED", rejectionCategory: "UNRECOGNIZED_STRUCTURE" });
        continue;
      }
      const valid = validField(key, descriptor.value);
      if (!valid) {
        decisions.push({ field: key, disposition: "REJECTED_BY_POLICY", rejectionCategory: classifyRejectedField(key) });
        structuralCategories.add(classifyRejectedField(key));
      }
    }
    if (hasExactKeys(record, KEYS) && !validRegionalTuple(descriptors)) {
      structuralCategories.add("UNSUPPORTED_OR_RARE_CATEGORY");
      for (const field of ["geographicRegion", "locale", "timeZone"] as const) {
        decisions.push({ field, disposition: "REJECTED_BY_POLICY", rejectionCategory: "UNSUPPORTED_OR_RARE_CATEGORY" });
      }
    }
  }

  if (structuralCategories.size > 0 || !record || decisions.some((decision) => decision.disposition === "REJECTED_BY_POLICY" || decision.disposition === "NOT_SUPPLIED")) {
    for (const category of [...structuralCategories].sort()) {
      decisions.push({ field: "UNRECOGNIZED_INPUT", disposition: "REJECTED_BY_POLICY", rejectionCategory: category });
    }
    const safeDecisions = dedupeDecisions(decisions);
    const ttl = descriptors?.ttlHours?.value;
    return rejectedReceipt(options, structuralCategories, validTtl(ttl) ? ttl : null, safeDecisions);
  }

  const accepted = rebuildFromDescriptors(descriptors!) as SafeDemoSignalInput;
  const profile: SafeDemoSignalProfile = {
    ...accepted,
    geographicRegion: ({ NORTH_AMERICA: "AMERICAS", EUROPE: "EMEA" } as const)[accepted.geographicRegion],
    recordVolumeBand: ({ SMALL: "COMPACT", MEDIUM: "STANDARD" } as const)[accepted.recordVolumeBand],
  };
  for (const key of KEYS) {
    const coarsened = key === "geographicRegion" || key === "recordVolumeBand";
    const safeValue = key === "geographicRegion" ? profile.geographicRegion
      : key === "recordVolumeBand" ? profile.recordVolumeBand
        : profile[key as keyof SafeDemoSignalProfile];
    decisions.push({ field: key, disposition: coarsened ? "COARSENED_INTO_APPROVED_BAND" : "ACCEPTED_UNCHANGED", safeValue: Array.isArray(safeValue) ? [...safeValue] : safeValue as string | number });
  }
  const acceptedProfileHash = stableHash(profile);
  const receiptCore = {
    requestId: options.requestId,
    packId: options.packId,
    policyVersion: options.policyVersion,
    requestingActorId: options.requestingActorId,
    purpose: "FICTIONAL_REVENUE_DEMO_REHEARSAL" as const,
    packTtlHours: profile.ttlHours,
    validationOutcome: "ACCEPTED" as const,
    acceptedProfile: profile,
    acceptedProfileHash,
    decisions,
    at: options.at,
  };
  return { id: stableId("context-receipt", receiptCore), ...receiptCore };
}

function validField(key: keyof SafeDemoSignalInput, value: unknown) {
  if (key === "ttlHours") return validTtl(value);
  if (key === "seed") return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff;
  if (key === "useCaseTags" || key === "objectFamilies" || key === "lifecycleStages" || key === "scenarioGoals" || key === "edgeCases") {
    const valid = isUniqueEnumArray(value, VALUES[key]);
    if (!valid) return false;
    const requiredGoldenSet = key === "objectFamilies" || key === "lifecycleStages" || key === "scenarioGoals" || key === "edgeCases";
    return !requiredGoldenSet || value.length === VALUES[key].length && VALUES[key].every((item) => value.includes(item));
  }
  return typeof value === "string" && (VALUES[key] as readonly string[]).includes(value);
}

function validTtl(value: unknown): value is 4 | 8 { return value === 4 || value === 8 }

function classifyRejectedField(key: keyof SafeDemoSignalInput): RejectionCategory {
  return key === "seed" || key === "ttlHours" ? "EXACT_COMMERCIAL_VALUE" : "UNSUPPORTED_OR_RARE_CATEGORY";
}

function rebuildFromDescriptors(descriptors: Record<string, PropertyDescriptor>): SafeDemoSignalInput {
  const value = (key: keyof SafeDemoSignalInput) => descriptors[key].value;
  return {
    sourceMode: value("sourceMode") as SafeDemoSignalInput["sourceMode"],
    industryArchetype: value("industryArchetype") as SafeDemoSignalInput["industryArchetype"],
    organizationSizeBand: value("organizationSizeBand") as SafeDemoSignalInput["organizationSizeBand"],
    geographicRegion: value("geographicRegion") as SafeDemoSignalInput["geographicRegion"],
    locale: value("locale") as SafeDemoSignalInput["locale"],
    timeZone: value("timeZone") as SafeDemoSignalInput["timeZone"],
    salesMotion: value("salesMotion") as SafeDemoSignalInput["salesMotion"],
    demoAudience: value("demoAudience") as SafeDemoSignalInput["demoAudience"],
    useCaseTags: orderedEnumValues(value("useCaseTags"), VALUES.useCaseTags),
    objectFamilies: orderedEnumValues(value("objectFamilies"), VALUES.objectFamilies),
    recordVolumeBand: value("recordVolumeBand") as SafeDemoSignalInput["recordVolumeBand"],
    salesCycleBand: value("salesCycleBand") as SafeDemoSignalInput["salesCycleBand"],
    valueBand: value("valueBand") as SafeDemoSignalInput["valueBand"],
    lifecycleStages: orderedEnumValues(value("lifecycleStages"), VALUES.lifecycleStages),
    scenarioGoals: orderedEnumValues(value("scenarioGoals"), VALUES.scenarioGoals),
    edgeCases: orderedEnumValues(value("edgeCases"), VALUES.edgeCases),
    packOwnerId: "maya",
    ttlHours: value("ttlHours") as 4 | 8,
    seed: value("seed") as number,
  };
}

function validRegionalTuple(descriptors: Record<string, PropertyDescriptor>): boolean {
  const region = descriptors.geographicRegion?.value;
  const locale = descriptors.locale?.value;
  const timeZone = descriptors.timeZone?.value;
  return region === "NORTH_AMERICA" && locale === "en-US" && timeZone === "America/New_York"
    || region === "EUROPE" && locale === "en-GB" && timeZone === "Europe/London";
}

function rejectedReceipt(
  options: ContextFirewallOptions,
  categories: ReadonlySet<RejectionCategory>,
  packTtlHours: 4 | 8 | null,
  fieldDecisions: readonly ContextFieldDecision[] = [],
): ContextReceipt {
  const decisions = dedupeDecisions([
    ...fieldDecisions,
    ...[...categories].sort().map((rejectionCategory) => ({
      field: "UNRECOGNIZED_INPUT" as const,
      disposition: "REJECTED_BY_POLICY" as const,
      rejectionCategory,
    })),
  ]);
  const receiptCore = {
    requestId: options.requestId,
    packId: options.packId,
    policyVersion: options.policyVersion,
    requestingActorId: options.requestingActorId,
    purpose: "FICTIONAL_REVENUE_DEMO_REHEARSAL" as const,
    packTtlHours,
    validationOutcome: "REJECTED" as const,
    acceptedProfile: null,
    acceptedProfileHash: null,
    decisions,
    at: isExactUtcIso(options.at) ? options.at : "1970-01-01T00:00:00.000Z",
  };
  return { id: stableId("context-receipt", receiptCore), ...receiptCore };
}

function orderedEnumValues<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  const supplied = value as readonly T[];
  return allowed.filter((item) => supplied.includes(item));
}

function dedupeDecisions(decisions: readonly ContextFieldDecision[]) {
  const seen = new Set<string>();
  return decisions.filter((decision) => {
    const key = `${decision.field}:${decision.disposition}:${decision.rejectionCategory ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
