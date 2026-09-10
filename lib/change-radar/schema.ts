import {
  CHANGE_RADAR_SOURCE_REGISTRY,
  isSourceUrlAllowed,
} from "../../data/change-radar/registry.ts";
import {
  CHANGE_IMPACT_LEVELS,
  type PublicChangeEvent,
  type RadarComparisonArtifact,
  type RadarComparisonSection,
  type RadarSourceHealth,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;
const MAX_PUBLIC_STRING_CHARACTERS = 8_192;

const EVENT_KEYS = [
  "id",
  "sourceId",
  "sourceTitle",
  "canonicalUrl",
  "sourceKind",
  "officialHost",
  "productSurface",
  "fetchedAt",
  "publishedAt",
  "detectedAt",
  "previousHash",
  "currentHash",
  "etag",
  "lastModified",
  "changeType",
  "headingPath",
  "headingOccurrence",
  "excerptBefore",
  "excerptAfter",
  "observedFacts",
  "inferredImpactDomains",
  "affectedSyntheticAssets",
  "impactLevel",
  "classificationConfidence",
  "reviewState",
  "ownerId",
  "reviewerIds",
  "proposedActions",
  "evidenceReceiptId",
] as const;
const LATEST_KEYS = ["schemaVersion", "generatedAt", "events"] as const;
const HISTORY_KEYS = ["schemaVersion", "retentionLimit", "events"] as const;
const SOURCE_HEALTH_KEYS = ["sourceId", "checkedAt", "stage", "reason", "statusCode"] as const;
const SOURCE_HEALTH_ARTIFACT_KEYS = ["schemaVersion", "generatedAt", "sources"] as const;
const COMPARISON_SECTION_KEYS = ["headingPath", "occurrence", "order", "hash", "excerpt"] as const;
const COMPARISON_SOURCE_KEYS = ["sourceId", "currentHash", "etag", "lastModified", "sections"] as const;
const COMPARISON_ARTIFACT_KEYS = ["schemaVersion", "generatedAt", "sources"] as const;
const DISCOVERY_CANDIDATE_KEYS = ["url", "discoveredFrom", "enabled"] as const;
const DISCOVERY_COUNT_KEYS = ["discoveredFrom", "discovered", "retained", "truncated"] as const;
const DISCOVERY_V1_KEYS = [
  "schemaVersion",
  "generatedAt",
  "note",
  "addedCount",
  "removedCount",
  "added",
  "removed",
  "candidates",
] as const;
const DISCOVERY_V3_KEYS = [...DISCOVERY_V1_KEYS, "perIndexCounts"] as const;

const eventKinds = new Set([
  "FIRST_SEEN",
  "ADDED_SECTION",
  "MODIFIED_SECTION",
  "REMOVED_SECTION",
  "MOVED_SECTION",
  "SOURCE_UNAVAILABLE",
]);
const sourceKinds = new Set(["DOCUMENTATION", "RELEASE_NOTES", "STATUS", "NEWS", "PARTNERSHIP"]);
const reviewStates = new Set(["DETECTED", "VERIFIED", "TRIAGED", "IMPACT_ASSESSED", "ACCEPTED", "DISMISSED"]);
const healthStages = new Set(["HEALTHY", "TRANSPORT_ERROR", "PARSING_ERROR", "SEMANTIC_ERROR"]);
const approvedMonitors = new Map(
  CHANGE_RADAR_SOURCE_REGISTRY.sources
    .filter((source) => source.lifecycle === "APPROVED_MONITOR")
    .map((source) => [source.id, source]),
);
const discoveryIndexes = new Map(
  CHANGE_RADAR_SOURCE_REGISTRY.sources
    .filter((source) => source.lifecycle === "DISCOVERY_INDEX")
    .map((source) => [source.id, source]),
);
const approvedMonitorUrls = new Set([...approvedMonitors.values()].map((source) => source.canonicalUrl));

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);
const str = (value: unknown): value is string => typeof value === "string";
const iso = (value: unknown): value is string => (
  str(value)
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value))
);
const nullableString = (value: unknown): value is string | null => value === null || str(value);
const stringList = (value: unknown, max = 100): value is string[] => (
  Array.isArray(value)
  && value.length <= max
  && value.every((item) => str(item) && item.length <= 500)
);
const hash = (value: unknown): value is string => str(value) && /^[a-f0-9]{64}$/.test(value);

function assertBoundedStrings(value: unknown, location: string) {
  if (typeof value === "string") {
    if (value.length > MAX_PUBLIC_STRING_CHARACTERS) {
      throw new Error(`${location} exceeds the ${MAX_PUBLIC_STRING_CHARACTERS}-character public-artifact limit.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertBoundedStrings(item, `${location}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      assertBoundedStrings(child, `${location}.${key}`);
    }
  }
}

function assertExactKeys(value: UnknownRecord, allowedKeys: readonly string[], location: string) {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${location} contains unknown field(s): ${unknownKeys.join(", ")}`);
  }
}

function assertUnique(values: readonly string[], location: string) {
  if (new Set(values).size !== values.length) throw new Error(`${location} contains duplicate values.`);
}

function assertApprovedSourceId(sourceId: string, location: string) {
  const source = approvedMonitors.get(sourceId);
  if (!source) throw new Error(`${location} is not bound to an approved monitor: ${sourceId}`);
  return source;
}

function assertEventRegistryBinding(event: PublicChangeEvent) {
  const source = assertApprovedSourceId(event.sourceId, "Public change event sourceId");
  const expected = {
    sourceTitle: source.title,
    canonicalUrl: source.canonicalUrl,
    sourceKind: source.sourceKind,
    officialHost: new URL(source.canonicalUrl).hostname,
    productSurface: source.productSurface,
  } as const;
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (event[field as keyof typeof expected] !== expectedValue) {
      throw new Error(`Public change event ${field} does not match approved monitor ${source.id}.`);
    }
  }
  if (event.ownerId !== source.expectedOwner) {
    throw new Error(`Public change event ownerId does not match approved monitor ${source.id}.`);
  }
  if (
    event.inferredImpactDomains.length !== source.operationalDomains.length
    || event.inferredImpactDomains.some((domain, index) => domain !== source.operationalDomains[index])
  ) {
    throw new Error(`Public change event inferredImpactDomains do not match approved monitor ${source.id}.`);
  }
}

function parseEvent(value: unknown, bindToRegistry: boolean): PublicChangeEvent {
  if (!isRecord(value)) throw new Error("Public change event must be an object.");
  assertBoundedStrings(value, "Public change event");
  assertExactKeys(value, EVENT_KEYS, "Public change event");
  for (const field of [
    "id",
    "sourceId",
    "sourceTitle",
    "canonicalUrl",
    "sourceKind",
    "officialHost",
    "productSurface",
    "fetchedAt",
    "detectedAt",
    "currentHash",
    "changeType",
    "impactLevel",
    "reviewState",
    "evidenceReceiptId",
  ]) {
    if (!str(value[field]) || !value[field]) throw new Error(`Invalid event field: ${field}`);
  }

  let url: URL;
  try {
    url = new URL(value.canonicalUrl as string);
  } catch {
    throw new Error("Invalid canonical URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hostname !== value.officialHost) {
    throw new Error("Canonical URL and official host do not match.");
  }
  if (
    !/^change:[a-f0-9]{32}$/.test(value.id as string)
    || !hash(value.currentHash)
    || !(value.previousHash === null || hash(value.previousHash))
  ) {
    throw new Error("Invalid event hashes.");
  }
  if (!iso(value.fetchedAt) || !iso(value.detectedAt) || !(value.publishedAt === null || iso(value.publishedAt))) {
    throw new Error("Invalid event timestamp.");
  }
  if (!Number.isInteger(value.headingOccurrence) || (value.headingOccurrence as number) < 1) {
    throw new Error("Invalid event heading occurrence.");
  }
  if (
    !sourceKinds.has(value.sourceKind as string)
    || !eventKinds.has(value.changeType as string)
    || !reviewStates.has(value.reviewState as string)
    || !CHANGE_IMPACT_LEVELS.includes(value.impactLevel as never)
  ) {
    throw new Error("Invalid event enum.");
  }
  if (
    typeof value.classificationConfidence !== "number"
    || !Number.isFinite(value.classificationConfidence)
    || value.classificationConfidence < 0
    || value.classificationConfidence > 1
  ) {
    throw new Error("Invalid classification confidence.");
  }
  for (const field of [
    "headingPath",
    "observedFacts",
    "inferredImpactDomains",
    "affectedSyntheticAssets",
    "reviewerIds",
    "proposedActions",
  ]) {
    if (!stringList(value[field])) throw new Error(`Invalid event list: ${field}`);
  }
  if (
    !nullableString(value.etag)
    || !nullableString(value.lastModified)
    || !nullableString(value.ownerId)
    || !nullableString(value.excerptBefore)
    || !nullableString(value.excerptAfter)
    || (str(value.excerptBefore) && value.excerptBefore.length > 280)
    || (str(value.excerptAfter) && value.excerptAfter.length > 280)
  ) {
    throw new Error("Invalid event nullable or excerpt.");
  }

  const event = value as unknown as PublicChangeEvent;
  if (bindToRegistry) assertEventRegistryBinding(event);
  return event;
}

export function parsePublicChangeEvent(value: unknown): PublicChangeEvent {
  return parseEvent(value, true);
}

export function parseLatestArtifact(
  value: unknown,
  options: { bindToRegistry?: boolean } = { bindToRegistry: true },
) {
  if (!isRecord(value)) throw new Error("Invalid latest Change Radar artifact.");
  assertExactKeys(value, LATEST_KEYS, "Latest Change Radar artifact");
  if (value.schemaVersion !== 3 || !iso(value.generatedAt) || !Array.isArray(value.events)) {
    throw new Error("Invalid latest Change Radar artifact.");
  }
  const events = value.events.map((event) => parseEvent(event, options.bindToRegistry ?? true));
  assertUnique(events.map((event) => event.id), "Latest Change Radar events");
  return { schemaVersion: 3 as const, generatedAt: value.generatedAt, events };
}

export function parseHistoryArtifact(
  value: unknown,
  options: { bindToRegistry?: boolean } = { bindToRegistry: true },
) {
  if (!isRecord(value)) throw new Error("Invalid Change Radar history artifact.");
  assertExactKeys(value, HISTORY_KEYS, "Change Radar history artifact");
  if (
    value.schemaVersion !== 3
    || !Number.isInteger(value.retentionLimit)
    || (value.retentionLimit as number) < 1
    || (value.retentionLimit as number) > 1000
    || !Array.isArray(value.events)
    || value.events.length > (value.retentionLimit as number)
  ) {
    throw new Error("Invalid Change Radar history artifact.");
  }
  const events = value.events.map((event) => parseEvent(event, options.bindToRegistry ?? true));
  assertUnique(events.map((event) => event.id), "Change Radar history events");
  return { schemaVersion: 3 as const, retentionLimit: value.retentionLimit as number, events };
}

export function parseSourceHealth(value: unknown): RadarSourceHealth {
  if (!isRecord(value)) throw new Error("Invalid source health record.");
  assertBoundedStrings(value, "Source health record");
  assertExactKeys(value, SOURCE_HEALTH_KEYS, "Source health record");
  if (
    !str(value.sourceId)
    || !iso(value.checkedAt)
    || !healthStages.has(value.stage as string)
    || !nullableString(value.reason)
    || !(
      value.statusCode === null
      || (Number.isInteger(value.statusCode) && (value.statusCode as number) >= 100 && (value.statusCode as number) <= 599)
    )
  ) {
    throw new Error("Invalid source health record.");
  }
  return value as unknown as RadarSourceHealth;
}

export function parseSourceHealthArtifact(
  value: unknown,
  options: { bindToRegistry?: boolean } = { bindToRegistry: true },
) {
  if (!isRecord(value)) throw new Error("Invalid source-health artifact.");
  assertExactKeys(value, SOURCE_HEALTH_ARTIFACT_KEYS, "Source-health artifact");
  if (value.schemaVersion !== 3 || !iso(value.generatedAt) || !Array.isArray(value.sources)) {
    throw new Error("Invalid source-health artifact.");
  }
  const sources = value.sources.map(parseSourceHealth);
  if (options.bindToRegistry ?? true) {
    for (const source of sources) assertApprovedSourceId(source.sourceId, "Source health sourceId");
  }
  assertUnique(sources.map((source) => source.sourceId), "Source-health sources");
  return { schemaVersion: 3 as const, generatedAt: value.generatedAt, sources };
}

function parseHttpsUrl(value: unknown, location: string): string {
  if (!str(value)) throw new Error(`${location} must be a URL string.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${location} must be a valid URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(`${location} requires uncredentialed HTTPS.`);
  }
  if (url.search || url.hash) throw new Error(`${location} must not contain a query or fragment.`);
  return url.toString();
}

function assertDiscoveryUrl(value: unknown, discoveredFrom?: string): string {
  const url = parseHttpsUrl(value, "Discovery URL");
  const indexes = discoveredFrom
    ? [discoveryIndexes.get(discoveredFrom)]
    : [...discoveryIndexes.values()];
  if (!indexes.some((source) => source && isSourceUrlAllowed(source, url))) {
    throw new Error(`Discovery URL is outside its discovery index allowlist: ${url}`);
  }
  return url;
}

function parseDiscoveryMetadata(value: UnknownRecord) {
  if (
    !str(value.note)
    || !value.note.trim()
    || value.note.length > 500
    || !Number.isInteger(value.addedCount)
    || (value.addedCount as number) < 0
    || !Number.isInteger(value.removedCount)
    || (value.removedCount as number) < 0
    || !Array.isArray(value.added)
    || value.added.length > 50
    || !Array.isArray(value.removed)
    || value.removed.length > 50
  ) {
    throw new Error("Invalid discovery change metadata.");
  }
  const added = value.added.map((url) => assertDiscoveryUrl(url));
  const removed = value.removed.map((url) => assertDiscoveryUrl(url));
  assertUnique(added, "Discovery added URLs");
  assertUnique(removed, "Discovery removed URLs");
  if (added.some((url) => removed.includes(url))) throw new Error("Discovery added and removed URLs overlap.");
  if ((value.addedCount as number) < added.length || (value.removedCount as number) < removed.length) {
    throw new Error("Discovery change counts are smaller than their retained URL lists.");
  }
  if (
    added.length !== Math.min(value.addedCount as number, 50)
    || removed.length !== Math.min(value.removedCount as number, 50)
  ) {
    throw new Error("Discovery change metadata does not match its deterministic 50-URL cap.");
  }
  return {
    note: value.note,
    addedCount: value.addedCount as number,
    removedCount: value.removedCount as number,
    added,
    removed,
  };
}

export function parseDiscoveryArtifact(value: unknown) {
  if (!isRecord(value) || ![1, 3].includes(value.schemaVersion as number)) {
    throw new Error("Invalid discovery artifact.");
  }
  assertExactKeys(
    value,
    value.schemaVersion === 3 ? DISCOVERY_V3_KEYS : DISCOVERY_V1_KEYS,
    "Discovery artifact",
  );
  if (!iso(value.generatedAt) || !Array.isArray(value.candidates) || value.candidates.length > 250) {
    throw new Error("Invalid discovery artifact.");
  }
  const metadata = parseDiscoveryMetadata(value);
  const candidates = value.candidates.map((candidate) => {
    if (!isRecord(candidate)) throw new Error("Invalid discovery candidate.");
    assertExactKeys(candidate, DISCOVERY_CANDIDATE_KEYS, "Discovery candidate");
    if (!str(candidate.discoveredFrom) || candidate.enabled !== false) {
      throw new Error("Invalid or enabled discovery candidate.");
    }
    const index = discoveryIndexes.get(candidate.discoveredFrom);
    if (!index) throw new Error(`Unknown discovery index: ${candidate.discoveredFrom}`);
    const url = assertDiscoveryUrl(candidate.url, index.id);
    if (approvedMonitorUrls.has(url)) {
      throw new Error(`Approved monitor cannot also be a discovery candidate: ${url}`);
    }
    return {
      url,
      discoveredFrom: index.id,
      enabled: false as const,
    };
  });
  assertUnique(candidates.map((candidate) => candidate.url), "Discovery candidates");
  const candidateUrls = new Set(candidates.map((candidate) => candidate.url));
  if (metadata.addedCount > candidates.length || metadata.removedCount > 250) {
    throw new Error("Discovery change counts exceed the bounded candidate sets.");
  }
  if (metadata.added.some((url) => !candidateUrls.has(url))) {
    throw new Error("Discovery added URLs must be present in current candidates.");
  }
  if (metadata.removed.some((url) => candidateUrls.has(url))) {
    throw new Error("Discovery removed URLs must not be present in current candidates.");
  }

  if (value.schemaVersion === 1) {
    return {
      schemaVersion: 1 as const,
      generatedAt: value.generatedAt,
      ...metadata,
      candidates,
    };
  }

  if (!Array.isArray(value.perIndexCounts)) throw new Error("Discovery v3 requires per-index counts.");
  const perIndexCounts = value.perIndexCounts.map((count) => {
    if (!isRecord(count)) throw new Error("Invalid discovery counts.");
    assertExactKeys(count, DISCOVERY_COUNT_KEYS, "Discovery per-index count");
    if (
      !str(count.discoveredFrom)
      || !discoveryIndexes.has(count.discoveredFrom)
      || !Number.isInteger(count.discovered)
      || !Number.isInteger(count.retained)
      || !Number.isInteger(count.truncated)
      || (count.discovered as number) < 0
      || (count.retained as number) < 0
      || (count.truncated as number) < 0
      || (count.discovered as number) !== (count.retained as number) + (count.truncated as number)
    ) {
      throw new Error("Invalid discovery counts.");
    }
    return {
      discoveredFrom: count.discoveredFrom,
      discovered: count.discovered as number,
      retained: count.retained as number,
      truncated: count.truncated as number,
    };
  });
  assertUnique(perIndexCounts.map((count) => count.discoveredFrom), "Discovery per-index counts");
  const expectedIndexIds = [...discoveryIndexes.keys()].sort();
  const countedIndexIds = perIndexCounts.map((count) => count.discoveredFrom).sort();
  if (expectedIndexIds.join("\n") !== countedIndexIds.join("\n")) {
    throw new Error("Discovery v3 counts must cover every governed discovery index exactly once.");
  }
  for (const count of perIndexCounts) {
    const retained = candidates.filter((candidate) => candidate.discoveredFrom === count.discoveredFrom).length;
    if (count.retained !== retained) {
      throw new Error(`Discovery retained count does not match candidates for ${count.discoveredFrom}.`);
    }
  }
  return {
    schemaVersion: 3 as const,
    generatedAt: value.generatedAt,
    ...metadata,
    perIndexCounts,
    candidates,
  };
}

function parseSection(value: unknown): RadarComparisonSection {
  if (!isRecord(value)) throw new Error("Invalid comparison section.");
  assertBoundedStrings(value, "Comparison section");
  assertExactKeys(value, COMPARISON_SECTION_KEYS, "Comparison section");
  if (
    !stringList(value.headingPath, 12)
    || !Number.isInteger(value.occurrence)
    || (value.occurrence as number) < 1
    || !Number.isInteger(value.order)
    || (value.order as number) < 0
    || !hash(value.hash)
    || !(value.excerpt === null || (str(value.excerpt) && value.excerpt.length <= 280))
  ) {
    throw new Error("Invalid comparison section.");
  }
  return value as unknown as RadarComparisonSection;
}

export function parseComparisonArtifact(
  value: unknown,
  options: { bindToRegistry?: boolean } = { bindToRegistry: true },
): RadarComparisonArtifact {
  if (!isRecord(value)) throw new Error("Invalid comparison-state artifact.");
  assertExactKeys(value, COMPARISON_ARTIFACT_KEYS, "Comparison-state artifact");
  if (value.schemaVersion !== 3 || !iso(value.generatedAt) || !Array.isArray(value.sources)) {
    throw new Error("Invalid comparison-state artifact.");
  }
  const sources = value.sources.map((source) => {
    if (!isRecord(source)) throw new Error("Invalid comparison source.");
    assertBoundedStrings(source, "Comparison source");
    assertExactKeys(source, COMPARISON_SOURCE_KEYS, "Comparison source");
    if (
      !str(source.sourceId)
      || !hash(source.currentHash)
      || !nullableString(source.etag)
      || !nullableString(source.lastModified)
      || !Array.isArray(source.sections)
      || source.sections.length > 500
    ) {
      throw new Error("Invalid comparison source.");
    }
    if (options.bindToRegistry ?? true) assertApprovedSourceId(source.sourceId, "Comparison sourceId");
    return {
      sourceId: source.sourceId,
      currentHash: source.currentHash,
      etag: source.etag,
      lastModified: source.lastModified,
      sections: source.sections.map(parseSection),
    };
  });
  assertUnique(sources.map((source) => source.sourceId), "Comparison sources");
  return { schemaVersion: 3, generatedAt: value.generatedAt, sources };
}

export function parseGeneratedArtifact(value: unknown, sourcePath: string) {
  const normalizedPath = sourcePath.replaceAll("\\", "/");
  if (normalizedPath === "src/generated/change-radar/latest.json") {
    return parseLatestArtifact(value, { bindToRegistry: true });
  }
  if (normalizedPath === "src/generated/change-radar/history.json") {
    return parseHistoryArtifact(value, { bindToRegistry: true });
  }
  if (normalizedPath === "src/generated/change-radar/source-health.json") {
    return parseSourceHealthArtifact(value, { bindToRegistry: true });
  }
  if (normalizedPath === "src/generated/change-radar/comparison-state.json") {
    return parseComparisonArtifact(value, { bindToRegistry: true });
  }
  if (normalizedPath === "src/generated/change-radar/discovery-candidates.json") {
    return parseDiscoveryArtifact(value);
  }
  throw new Error(`No generated Change Radar schema is registered for: ${sourcePath}`);
}
