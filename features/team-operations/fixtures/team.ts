import type { AgentContract, CoverageWindow, HandoffPacket, RunbookFreshness, TeamMember, WorkItem } from "../domain/types";

export const TEAM_MEMBERS: readonly TeamMember[] = [
  { id: "maya", name: "Maya Chen", role: "DemoOps Administrator · primary operator", responsibilities: ["fleet readiness", "incident command"], domainStrengths: ["preflight", "model governance"], approvalScope: ["reversible lab changes"], timezone: "America/New_York", coverage: "13:00–22:00 UTC", capacityPercent: 68, status: "ON_CALL", primaryFor: ["Americas fleet"], backupIds: ["leila"], accessLevel: "Synthetic operator", escalationPath: "Governance approver" },
  { id: "leila", name: "Leila Haddad", role: "DemoOps Administrator · follow-the-sun", responsibilities: ["regional coverage", "handoff continuity"], domainStrengths: ["identity", "incident triage"], approvalScope: ["regional reversible actions"], timezone: "Europe/London", coverage: "07:00–16:00 UTC", capacityPercent: 54, status: "HANDING_OFF", primaryFor: ["EMEA fleet"], backupIds: ["maya", "kenji"], accessLevel: "Synthetic operator", escalationPath: "Fleet owner" },
  { id: "sofia", name: "Sofia Reyes", role: "Solutions Engineer / Presenter", responsibilities: ["demo delivery", "customer-safe communication"], domainStrengths: ["presentations", "scenario validation"], approvalScope: ["demo content"], timezone: "America/Los_Angeles", coverage: "16:00–01:00 UTC", capacityPercent: 76, status: "FOCUSED", primaryFor: ["presenter readiness"], backupIds: ["noah"], accessLevel: "Synthetic presenter", escalationPath: "DemoOps administrator" },
  { id: "noah", name: "Noah Williams", role: "Demo Engineer", responsibilities: ["environment reliability", "test fixtures"], domainStrengths: ["connectors", "gateway"], approvalScope: ["synthetic test changes"], timezone: "America/Chicago", coverage: "14:00–23:00 UTC", capacityPercent: 61, status: "AVAILABLE", primaryFor: ["demo environments"], backupIds: ["sofia"], accessLevel: "Synthetic engineer", escalationPath: "Security approver" },
  { id: "aisha", name: "Aisha Okafor", role: "Identity & Access Reviewer", responsibilities: ["least privilege", "access review"], domainStrengths: ["SSO", "SCIM", "WIF"], approvalScope: ["identity proposals"], timezone: "Europe/Paris", coverage: "08:00–17:00 UTC", capacityPercent: 47, status: "AVAILABLE", primaryFor: ["identity governance"], backupIds: ["mateo"], accessLevel: "Synthetic specialist reviewer", escalationPath: "Security approver" },
  { id: "mateo", name: "Mateo Silva", role: "Security / Governance Approver", responsibilities: ["policy approval", "blast-radius review"], domainStrengths: ["security", "compliance"], approvalScope: ["high-impact proposals"], timezone: "America/Sao_Paulo", coverage: "12:00–21:00 UTC", capacityPercent: 83, status: "FOCUSED", primaryFor: ["governance approvals"], backupIds: [], accessLevel: "Synthetic approver", escalationPath: "Fleet owner" },
  { id: "kenji", name: "Kenji Sato", role: "Product / Release Liaison", responsibilities: ["source verification", "release context"], domainStrengths: ["change intelligence", "product surfaces"], approvalScope: ["observed-fact verification"], timezone: "Asia/Tokyo", coverage: "00:00–09:00 UTC", capacityPercent: 42, status: "AVAILABLE", primaryFor: ["APAC change watch"], backupIds: ["leila"], accessLevel: "Synthetic read-only liaison", escalationPath: "Program manager" },
  { id: "priya", name: "Priya Raman", role: "Program Manager / Demo Fleet Owner", responsibilities: ["portfolio risk", "coverage design"], domainStrengths: ["program operations", "capacity"], approvalScope: ["fleet priorities"], timezone: "America/New_York", coverage: "13:00–22:00 UTC", capacityPercent: 71, status: "ON_CALL", primaryFor: ["global demo fleet"], backupIds: ["maya"], accessLevel: "Synthetic fleet owner", escalationPath: "Executive sponsor (modeled)" },
];

export const TEAM_WORK_ITEMS: readonly WorkItem[] = [
  { id: "wi-change-17", title: "Assess model entitlement documentation change", state: "AWAITING_REVIEW", ownerId: "maya", watcherIds: ["kenji"], reviewerIds: ["aisha"], approverId: "mateo", blockedReason: null, evidence: ["Official section hash and bounded excerpt"], decisionRationale: null, auditTrail: [] },
  { id: "wi-handoff-4", title: "EMEA → Americas connector readiness handoff", state: "HANDED_OFF", ownerId: "leila", watcherIds: ["noah"], reviewerIds: [], approverId: null, blockedReason: null, evidence: ["Synthetic preflight receipt PF-204"], decisionRationale: null, auditTrail: [] },
];

export const ACTIVE_HANDOFF: HandoffPacket = { id: "handoff-4", situationSummary: "Connector reauthorization warning before the Acme workshop.", impact: "Synthetic demo may lose read-only CRM context.", currentOwnerId: "leila", receivingOwnerId: "maya", hypothesis: "The lab credential fixture crossed its rotation window.", confidence: 0.82, evidenceGathered: ["Preflight PF-204", "Connector health snapshot"], evidenceMissing: ["Presenter confirmation"], actionsTaken: ["Ran read-only diagnostic"], actionsNotTaken: ["Did not rotate credentials; human approval required"], pendingApproval: "Connector reauthorization", nextAction: "Confirm presenter scope, then run isolated connector test.", rollbackConsiderations: "Restore the previous synthetic credential fixture.", deadline: "2026-09-02T20:30:00.000Z", links: ["runbook:connector-readiness", "change:connector-permissions"], acknowledgedAt: null };

export const COVERAGE_WINDOWS: readonly CoverageWindow[] = [
  { region: "APAC", startUtc: 0, endUtc: 9, qualifiedOwnerIds: ["kenji"] },
  { region: "EMEA", startUtc: 7, endUtc: 16, qualifiedOwnerIds: ["leila", "aisha"] },
  { region: "AMERICAS", startUtc: 13, endUtc: 22, qualifiedOwnerIds: ["maya", "noah"] },
];

const NEVER = [
  "approve their own proposals",
  "accept public changes",
  "approve missions or runbook revisions",
  "silently close consequential work or incidents",
  "change roles, permissions, users, or organization policy",
  "change model entitlements, credentials, or write grants",
  "provision privileged access or expand their own authority",
  "promote sources",
  "merge or deploy code",
];
export const AGENT_CONTRACTS: readonly AgentContract[] = [
  ["signal", "Documentation Sentinel", "Signal Scout", "kenji", "public source changes", "OBSERVE_ONLY"],
  ["correlation", "Correlation Agent", "Correlation Agent", "maya", "cross-system signals", "RECOMMEND_ONLY"],
  ["triage", "Triage Coordinator", "Triage Coordinator", "priya", "ownership routing", "RECOMMEND_ONLY"],
  ["preflight", "Preflight Agent", "Preflight Agent", "maya", "demo readiness", "EXECUTE_REVERSIBLE_LOW_RISK"],
  ["impact", "Change Impact Analyst", "Change Impact Analyst", "kenji", "change mapping", "DRAFT_ONLY"],
  ["runbook", "Runbook Curator", "Runbook Curator", "noah", "knowledge freshness", "DRAFT_ONLY"],
  ["simulation", "Simulation Agent", "Simulation Agent", "noah", "synthetic tests", "EXECUTE_REVERSIBLE_LOW_RISK"],
  ["policy", "Policy Reviewer", "Policy Reviewer", "mateo", "authority boundaries", "HUMAN_REVIEW_REQUIRED"],
  ["verification", "Verification Agent", "Verification Agent", "aisha", "success criteria", "EXECUTE_REVERSIBLE_LOW_RISK"],
  ["scribe", "Postmortem Scribe", "Postmortem Scribe", "priya", "learning records", "DRAFT_ONLY"],
].map(([id, name, className, accountableHumanId, domain, permittedAction]) => ({ id, name, className, accountableHumanId, purpose: `Support ${domain} with bounded, inspectable evidence for a named human decision.`, domain, inputs: ["typed synthetic state", "evidence receipts"], outputs: ["bounded operational message", "reviewable receipt"], confidence: 0.86, evidence: ["Deterministic selector output"], permittedAction: permittedAction as AgentContract["permittedAction"], deniedActions: NEVER, escalationCondition: "Low confidence, missing owner, or consequential action", fallback: "Queue for accountable human; preserve last known evidence", lastHumanReview: "2026-09-01" }));

export const RUNBOOKS: readonly RunbookFreshness[] = [
  { id: "rb-model-access", title: "Effective model access preflight", ownerId: "aisha", lastReviewed: "2026-08-25", sourceDependencies: ["change:model-entitlement"], latestRelevantChangeId: "change:model-entitlement", status: "STALE_REVIEW_REQUIRED", requiredReviewerId: "mateo", nextReviewDate: "2026-09-05", linkedMissions: ["model-governance-drift"], linkedTests: ["effective-access.test.ts"] },
  { id: "rb-connector", title: "Connector readiness", ownerId: "noah", lastReviewed: "2026-08-30", sourceDependencies: ["change:connector-permissions"], latestRelevantChangeId: null, status: "CURRENT", requiredReviewerId: "aisha", nextReviewDate: "2026-09-30", linkedMissions: ["connector-expiry"], linkedTests: ["readiness.test.ts"] },
];
