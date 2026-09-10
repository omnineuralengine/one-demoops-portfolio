import type { AgentAuthority, ChangeDrivenMissionDraft, CoverageWindow, HandoffPacket, RunbookFreshness, TeamMember, WorkItem, WorkItemState } from "./types";

const ALLOWED: Readonly<Record<WorkItemState, readonly WorkItemState[]>> = {
  NEW: ["TRIAGED", "DISMISSED"], TRIAGED: ["OWNED", "BLOCKED", "DISMISSED"],
  OWNED: ["INVESTIGATING", "HANDED_OFF", "BLOCKED"], INVESTIGATING: ["PROPOSED_ACTION", "HANDED_OFF", "BLOCKED", "DISMISSED"],
  PROPOSED_ACTION: ["AWAITING_REVIEW", "AWAITING_APPROVAL", "DISMISSED"], AWAITING_REVIEW: ["AWAITING_APPROVAL", "EXECUTING", "BLOCKED", "DISMISSED"],
  AWAITING_APPROVAL: ["EXECUTING", "BLOCKED", "DISMISSED"], EXECUTING: ["VERIFYING", "BLOCKED"], VERIFYING: ["RESOLVED", "INVESTIGATING", "BLOCKED"],
  RESOLVED: ["LEARNING_CAPTURED"], LEARNING_CAPTURED: [], BLOCKED: ["TRIAGED", "OWNED", "INVESTIGATING", "DISMISSED"],
  HANDED_OFF: ["OWNED", "BLOCKED"], DISMISSED: [],
};

export function transitionWorkItem(item: WorkItem, to: WorkItemState, actorId: string, rationale: string, at: string): WorkItem {
  if (!ALLOWED[item.state].includes(to)) throw new Error(`Cannot transition work item from ${item.state} to ${to}.`);
  if (!actorId.trim() || !rationale.trim() || !Number.isFinite(new Date(at).valueOf())) throw new Error("An explainable work-item transition requires actor, rationale, and timestamp.");
  return { ...item, state: to, blockedReason: to === "BLOCKED" ? rationale.trim() : item.blockedReason, auditTrail: [...item.auditTrail, { from: item.state, to, actorId, rationale: rationale.trim(), at: new Date(at).toISOString() }] };
}

export function assignWorkItem(item: WorkItem, ownerId: string, actorId: string, at: string): WorkItem {
  if (!ownerId.trim()) throw new Error("An owner is required.");
  if (item.reviewerIds.includes(ownerId) || item.approverId === ownerId) throw new Error("Owner, reviewer, and approver responsibilities must remain separated.");
  const owned = item.state === "TRIAGED" || item.state === "HANDED_OFF" ? transitionWorkItem(item, "OWNED", actorId, `Assigned accountable owner ${ownerId}.`, at) : item;
  return { ...owned, ownerId };
}

export function hasReviewSeparation(item: WorkItem): boolean {
  return Boolean(item.ownerId) && !item.reviewerIds.includes(item.ownerId!) && item.approverId !== item.ownerId && (!item.approverId || !item.reviewerIds.includes(item.approverId));
}

const HANDOFF_FIELDS: readonly (keyof HandoffPacket)[] = ["situationSummary", "impact", "currentOwnerId", "receivingOwnerId", "hypothesis", "confidence", "evidenceGathered", "evidenceMissing", "actionsTaken", "actionsNotTaken", "nextAction", "rollbackConsiderations", "deadline", "links"];

export function scoreHandoff(packet: HandoffPacket) {
  const complete = HANDOFF_FIELDS.filter((field) => { const value = packet[field]; return Array.isArray(value) ? value.length > 0 : typeof value === "number" ? value >= 0 && value <= 1 : Boolean(value); });
  return { complete: complete.length, total: HANDOFF_FIELDS.length, missing: HANDOFF_FIELDS.filter((field) => !complete.includes(field)), ready: complete.length === HANDOFF_FIELDS.length };
}

export function acceptHandoff(packet: HandoffPacket, receiverId: string, at: string): HandoffPacket {
  if (packet.receivingOwnerId !== receiverId) throw new Error("Only the named receiving owner may acknowledge this handoff.");
  if (!scoreHandoff(packet).ready) throw new Error("The handoff packet is incomplete.");
  return { ...packet, acknowledgedAt: new Date(at).toISOString() };
}

export function findCoverageGaps(windows: readonly CoverageWindow[]): string[] {
  return windows.filter((window) => window.qualifiedOwnerIds.length === 0).map((window) => `${window.region} ${window.startUtc}:00–${window.endUtc}:00 UTC`);
}

export function findOverloadedOwners(members: readonly TeamMember[], thresholdPercent = 80): string[] {
  return members.filter((member) => member.capacityPercent >= thresholdPercent).map((member) => member.id);
}

const ALWAYS_HUMAN = new Set(["ROLE_CHANGE", "MODEL_ENTITLEMENT_CHANGE", "USER_DEPROVISION", "CREDENTIAL_ROTATION", "CONNECTOR_REAUTHORIZE", "WRITE_TOOL_GRANT", "ORG_CONFIGURATION", "ACCEPT_POLICY_CHANGE", "MERGE_HIGH_IMPACT"]);
export function canAgentExecute(authority: AgentAuthority, operation: string): boolean {
  return authority === "EXECUTE_REVERSIBLE_LOW_RISK" && !ALWAYS_HUMAN.has(operation);
}

export function updateRunbookFreshness(runbook: RunbookFreshness, change: { id: string; impactLevel: string; acceptedForAssessment: boolean }): RunbookFreshness {
  if (!runbook.sourceDependencies.includes(change.id)) return runbook;
  if (change.acceptedForAssessment && ["HIGH", "REVIEW_REQUIRED"].includes(change.impactLevel)) return { ...runbook, latestRelevantChangeId: change.id, status: "STALE_REVIEW_REQUIRED" };
  return { ...runbook, latestRelevantChangeId: change.id, status: runbook.status === "CURRENT" ? "AT_RISK" : runbook.status };
}

export function draftMissionFromChange(input: Omit<ChangeDrivenMissionDraft, "id" | "state">): ChangeDrivenMissionDraft {
  return { ...input, id: `mission-draft:${input.sourceChangeId}`, state: "PROPOSED" };
}
