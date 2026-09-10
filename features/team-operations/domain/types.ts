export const WORK_ITEM_STATES = [
  "NEW", "TRIAGED", "OWNED", "INVESTIGATING", "PROPOSED_ACTION",
  "AWAITING_REVIEW", "AWAITING_APPROVAL", "EXECUTING", "VERIFYING",
  "RESOLVED", "LEARNING_CAPTURED", "BLOCKED", "HANDED_OFF", "DISMISSED",
] as const;

export type WorkItemState = (typeof WORK_ITEM_STATES)[number];
export type TeamStatus = "AVAILABLE" | "FOCUSED" | "ON_CALL" | "HANDING_OFF" | "OFFLINE";
export type AgentAuthority =
  | "OBSERVE_ONLY"
  | "RECOMMEND_ONLY"
  | "DRAFT_ONLY"
  | "EXECUTE_REVERSIBLE_LOW_RISK"
  | "HUMAN_REVIEW_REQUIRED"
  | "HUMAN_APPROVAL_REQUIRED"
  | "PROHIBITED";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  responsibilities: readonly string[];
  domainStrengths: readonly string[];
  approvalScope: readonly string[];
  timezone: string;
  coverage: string;
  capacityPercent: number;
  status: TeamStatus;
  primaryFor: readonly string[];
  backupIds: readonly string[];
  accessLevel: string;
  escalationPath: string;
}

export interface WorkItemAuditEntry {
  from: WorkItemState;
  to: WorkItemState;
  actorId: string;
  rationale: string;
  at: string;
}

export interface WorkItem {
  id: string;
  title: string;
  state: WorkItemState;
  ownerId: string | null;
  watcherIds: readonly string[];
  reviewerIds: readonly string[];
  approverId: string | null;
  blockedReason: string | null;
  evidence: readonly string[];
  decisionRationale: string | null;
  auditTrail: readonly WorkItemAuditEntry[];
}

export interface HandoffPacket {
  id: string;
  situationSummary: string;
  impact: string;
  currentOwnerId: string;
  receivingOwnerId: string;
  hypothesis: string;
  confidence: number;
  evidenceGathered: readonly string[];
  evidenceMissing: readonly string[];
  actionsTaken: readonly string[];
  actionsNotTaken: readonly string[];
  pendingApproval: string | null;
  nextAction: string;
  rollbackConsiderations: string;
  deadline: string;
  links: readonly string[];
  acknowledgedAt: string | null;
}

export interface CoverageWindow {
  region: "AMERICAS" | "EMEA" | "APAC";
  startUtc: number;
  endUtc: number;
  qualifiedOwnerIds: readonly string[];
}

export interface AgentContract {
  id: string;
  name: string;
  className: string;
  accountableHumanId: string;
  purpose: string;
  domain: string;
  inputs: readonly string[];
  outputs: readonly string[];
  confidence: number;
  evidence: readonly string[];
  permittedAction: AgentAuthority;
  deniedActions: readonly string[];
  escalationCondition: string;
  fallback: string;
  lastHumanReview: string;
}

export interface RunbookFreshness {
  id: string;
  title: string;
  ownerId: string;
  lastReviewed: string;
  sourceDependencies: readonly string[];
  latestRelevantChangeId: string | null;
  status: "CURRENT" | "AT_RISK" | "STALE_REVIEW_REQUIRED";
  requiredReviewerId: string;
  nextReviewDate: string;
  linkedMissions: readonly string[];
  linkedTests: readonly string[];
}

export interface ChangeDrivenMissionDraft {
  id: string;
  state: "PROPOSED" | "ACCEPTED";
  sourceChangeId: string;
  personaId: string;
  affectedLayer: string;
  initialEvidence: readonly string[];
  hiddenFacts: readonly string[];
  diagnosticCommands: readonly string[];
  remediationOptions: readonly string[];
  approvalBoundary: string;
  verificationChecklist: readonly string[];
  preventionOptions: readonly string[];
}
