import type { FoundryBuildConfig, SafeDemoSignalInput } from "./domain/types";

export const FOUNDRY_UTC_ANCHOR = "2026-09-15T14:00:00.000Z" as const;
export const FOUNDRY_REQUEST_ID = "request:revenue-world:001" as const;
export const FOUNDRY_PACK_ID = "pack:revenue-world:001" as const;

export const DEFAULT_FOUNDRY_BUILD_CONFIG = Object.freeze({
  policyVersion: "context-firewall:v1",
  templateVersion: "revenue-renewal:v1",
  generatorVersion: "scenario-generator:v1",
  capabilityPins: Object.freeze([
    { id: "claudeforce-public-skill-contract", version: "2026-08-26-public", kind: "CAPABILITY" as const },
    { id: "runbook:model-access", version: "runbook:model-access:v1", kind: "RUNBOOK" as const },
  ]),
}) satisfies FoundryBuildConfig;

export const DEFAULT_SAFE_DEMO_SIGNALS = Object.freeze({
  sourceMode: "TEMPLATE_FIRST",
  industryArchetype: "B2B_SOFTWARE",
  organizationSizeBand: "ENTERPRISE",
  geographicRegion: "NORTH_AMERICA",
  locale: "en-US",
  timeZone: "America/New_York",
  salesMotion: "RENEWAL_AND_EXPANSION",
  demoAudience: "ACCOUNT_TEAM",
  useCaseTags: Object.freeze(["MEETING_PREPARATION", "DEAL_HEALTH_REVIEW", "PIPELINE_REVIEW", "GOVERNED_UPDATE"] as const),
  objectFamilies: Object.freeze(["ACCOUNTS", "CONTACTS", "OPPORTUNITIES", "CASES", "ACTIVITIES"] as const),
  recordVolumeBand: "SMALL",
  salesCycleBand: "HALF_YEAR",
  valueBand: "STRATEGIC",
  lifecycleStages: Object.freeze(["CUSTOMER", "RENEWAL", "EXPANSION"] as const),
  scenarioGoals: Object.freeze(["PREPARE_RENEWAL_MEETING", "EXPLAIN_DEAL_HEALTH", "REVIEW_PIPELINE", "GOVERN_ACCOUNT_UPDATE"] as const),
  edgeCases: Object.freeze(["STALE_FIELD", "CONFLICTING_SIGNAL", "ACTIVITY_GAP", "RESTRICTED_FIELD"] as const),
  packOwnerId: "maya",
  ttlHours: 4,
  seed: 731_204,
}) satisfies SafeDemoSignalInput;
