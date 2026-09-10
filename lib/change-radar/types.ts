export const CHANGE_RADAR_CATEGORIES = [
  "Claude Apps",
  "Claude Platform / API",
  "Claude Code",
  "Enterprise Admin",
  "Identity / SSO / SCIM",
  "Models and entitlements",
  "Skills / plugins / connectors",
  "MCP",
  "Safety / governance / compliance",
  "Service health",
  "Partnerships / Claudeforce",
] as const;

export const DOCUMENTATION_CHANGE_STATUSES = [
  "FIRST_SEEN",
  "UNCHANGED",
  "CHANGED",
  "UNAVAILABLE",
] as const;

export const CHANGE_IMPACT_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "REVIEW_REQUIRED",
] as const;

export const CHANGE_REVIEW_STATES = [
  "DETECTED",
  "TRIAGED",
  "IMPACT_ASSESSED",
  "ACCEPTED_FOR_LAB_UPDATE",
  "DISMISSED",
] as const;

export type ChangeRadarCategory = (typeof CHANGE_RADAR_CATEGORIES)[number];
export type DocumentationChangeStatus =
  (typeof DOCUMENTATION_CHANGE_STATUSES)[number];
export type ChangeImpactLevel = (typeof CHANGE_IMPACT_LEVELS)[number];
export type ChangeReviewState = (typeof CHANGE_REVIEW_STATES)[number];
export type DocumentationSourceFormat = "HTML" | "MARKDOWN" | "ATOM" | "RSS";
export type ChangeRadarSourceLifecycle = "DISCOVERY_INDEX" | "APPROVED_MONITOR" | "CANDIDATE" | "REFERENCE_ONLY" | "RETIRED";
export type ChangeRadarSourceKind = "DOCUMENTATION" | "RELEASE_NOTES" | "STATUS" | "NEWS" | "PARTNERSHIP";
export type ChangeRadarTrustLevel = "OFFICIAL_PRIMARY" | "OFFICIAL_PARTNER";
export interface ChangeRadarSource { id: string; title: string; canonicalUrl: string; lifecycle: ChangeRadarSourceLifecycle; sourceKind: ChangeRadarSourceKind; expectedContentType: DocumentationSourceFormat; exactHosts: readonly string[]; allowedPathPrefixes: readonly string[]; productSurface: string; operationalDomains: readonly string[]; priority: 1 | 2 | 3; maxResponseBytes: number; expectedOwner: string; trustLevel: ChangeRadarTrustLevel; purpose: string; }
export interface ChangeRadarSourceRegistry { schemaVersion: 3; description: string; sources: readonly ChangeRadarSource[]; }
export type RadarHealthStage = "HEALTHY" | "TRANSPORT_ERROR" | "PARSING_ERROR" | "SEMANTIC_ERROR";
export interface RadarSourceHealth { sourceId: string; checkedAt: string; stage: RadarHealthStage; reason: string | null; statusCode: number | null; }
export interface RadarComparisonSection { headingPath: readonly string[]; occurrence: number; order: number; hash: string; excerpt: string | null; }
export interface RadarComparisonSource { sourceId: string; currentHash: string; etag: string | null; lastModified: string | null; sections: readonly RadarComparisonSection[]; }
export interface RadarComparisonArtifact { schemaVersion: 3; generatedAt: string; sources: readonly RadarComparisonSource[]; }

export interface PublicChangeEvent {
  id: string;
  sourceId: string;
  sourceTitle: string;
  canonicalUrl: string;
  sourceKind: "DOCUMENTATION" | "RELEASE_NOTES" | "STATUS" | "NEWS" | "PARTNERSHIP";
  officialHost: string;
  productSurface: string;
  fetchedAt: string;
  publishedAt: string | null;
  detectedAt: string;
  previousHash: string | null;
  currentHash: string;
  etag: string | null;
  lastModified: string | null;
  changeType: "FIRST_SEEN" | "ADDED_SECTION" | "MODIFIED_SECTION" | "REMOVED_SECTION" | "MOVED_SECTION" | "SOURCE_UNAVAILABLE";
  headingPath: readonly string[];
  headingOccurrence: number;
  excerptBefore: string | null;
  excerptAfter: string | null;
  observedFacts: readonly string[];
  inferredImpactDomains: readonly string[];
  affectedSyntheticAssets: readonly string[];
  impactLevel: ChangeImpactLevel;
  classificationConfidence: number;
  reviewState: "DETECTED" | "VERIFIED" | "TRIAGED" | "IMPACT_ASSESSED" | "ACCEPTED" | "DISMISSED";
  ownerId: string | null;
  reviewerIds: readonly string[];
  proposedActions: readonly string[];
  evidenceReceiptId: string;
}

export interface HeadingDigest {
  heading: string;
  occurrence: number;
  hash: string;
}

export interface DocumentationHttpMetadata {
  etag: string | null;
  lastModified: string | null;
  finalUrl: string | null;
  statusCode: number | null;
  redirectCount: number;
}

export interface DocumentationChange {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  category: ChangeRadarCategory;
  categories: readonly ChangeRadarCategory[];
  checkedAt: string;
  changedAt: string | null;
  status: DocumentationChangeStatus;
  previousHash: string | null;
  currentHash: string | null;
  lastKnownHash: string | null;
  changedHeadings: readonly string[];
  excerpt: string | null;
  detectedImpactDomains: readonly string[];
  impactLevel: ChangeImpactLevel;
  confidence: number;
  requiresHumanReview: true;
  officialSource: true;
  contextNote: string | null;
  lastSuccessfulScanAt: string | null;
  observedHeadings: readonly string[];
  headingDigests: readonly HeadingDigest[];
  availabilityReason: string | null;
  httpMetadata: DocumentationHttpMetadata;
}

export interface ChangeRadarSummary {
  totalSources: number;
  successfulSources: number;
  firstSeen: number;
  unchanged: number;
  changed: number;
  unavailable: number;
  requiresImpactReview: number;
}

export interface ChangeRadarArtifact {
  schemaVersion: 1;
  sourceRegistryVersion: number;
  framing: string;
  generatedAt: string | null;
  summary: ChangeRadarSummary;
  changes: readonly DocumentationChange[];
}

export interface ChangeReviewAuditEntry {
  from: ChangeReviewState;
  to: ChangeReviewState;
  actorId: string;
  actorType: "HUMAN";
  rationale: string;
  at: string;
}

export interface ChangeReviewRecord {
  changeId: string;
  state: ChangeReviewState;
  impactLevel: ChangeImpactLevel | null;
  impactedDomains: readonly string[];
  auditTrail: readonly ChangeReviewAuditEntry[];
}
