export type EvidenceClassification = "OBSERVED" | "DERIVED" | "INFERRED" | "PROPOSED" | "SYNTHETIC";
export type ActorKind = "HUMAN" | "AGENT";
export type LoopPhase = "OBSERVED" | "CHANGE_ACCEPTED" | "WORK_CLAIMED" | "MISSION_APPROVED" | "PLAN_APPROVED" | "FIRST_VERIFICATION_FAILED" | "RUNBOOK_APPROVED" | "REPLAY_FAILED" | "REPLAY_PASSED" | "CLOSED";

export interface ClassifiedEvidence { label: EvidenceClassification; value: string; sourceId?: string }
export interface LoopActor { id: string; kind: ActorKind }
export interface AuditRecord { actionId: string; action: LoopAction["type"]; actorId: string; at: string; outcome: "ACCEPTED" | "REJECTED"; reason: string }

export interface LoopContract {
  id: string;
  version: number;
  goal: string;
  trigger: string;
  accountableHuman: string;
  ownerId: string;
  backupOwnerId: string;
  reviewerId: string;
  approverId: string;
  verificationPlanApproverId: string;
  runbookApproverId: string;
  closureApproverId: string;
  verificationAgentId: string;
  handoff: { situation: string; impact: string; nextAction: string; rollback: string; evidence: readonly string[] };
  permittedAgentActions: readonly LoopAction["type"][];
  humanRequiredDecisions: readonly LoopAction["type"][];
  evidenceRequirements: readonly string[];
  verificationChecks: readonly string[];
  maximumAttempts: number;
  executionBudgetMs: number;
  timeBudgetMinutes: number;
  stopConditions: readonly string[];
  escalationConditions: readonly string[];
  rollback: string;
  safeFallback: string;
  learningOutputPolicy: string;
}

export interface LoopHandoffPacket {
  situation: string;
  impact: string;
  currentOwnerId: string;
  receivingOwnerId: string;
  hypothesis: string;
  evidenceGathered: readonly string[];
  evidenceMissing: readonly string[];
  actionsTaken: readonly string[];
  actionsNotTaken: readonly string[];
  pendingApproval: string;
  nextAction: string;
  rollback: string;
  deadline: string;
}

export interface CausalPublicChange extends PublicChangeEvent {
  title: string;
  scenario: "DETERMINISTIC_REHEARSAL";
  evidence: readonly ClassifiedEvidence[];
}

export interface ReviewDecision { id: string; changeId: string; acceptedBy: string; at: string; classification: "DERIVED" }
export interface Mission { id: string; reviewDecisionId: string; state: "DRAFT" | "APPROVED"; approvedBy: string | null; classification: "PROPOSED" }
export interface WorkItem { id: string; missionId: string; state: "HANDED_OFF" | "OWNED" | "CLOSED"; proposedOwnerId: string; ownerId: string | null; backupOwnerId: string; reviewerId: string; approverId: string; claimedBy: string | null; claimedAt: string | null; closedAt: string | null; handoff: LoopHandoffPacket }
export interface VerificationPlan { id: string; workItemId: string; approvedBy: string; mode: "LOCAL_DETERMINISTIC_SYNTHETIC"; reversible: true; checks: readonly string[]; classification: "PROPOSED" }
export interface CausalLineage { changeId: string; reviewDecisionId: string; missionId: string; workItemId: string; verificationReceiptId: string; learningRecordId: string | null; runbookVersionId: string }
export interface VerificationReceipt { id: string; lineage: CausalLineage; workItemId: string; planId: string; runbookVersionId: string; outcome: "PASS" | "FAIL"; actor: LoopActor; checks: readonly { name: string; outcome: "PASS" | "FAIL"; evidence: string }[]; observedEntitlement: string; durationMs: number; reversible: true; at: string; classification: "DERIVED" }
export interface LearningRecord { id: string; verificationReceiptId: string; activationReceiptId: string | null; state: "PROPOSED" | "ACTIVE" | "REJECTED" | "SUPERSEDED"; originalPrediction: string; supportingEvidence: readonly string[]; humanDecision: { outcome: "ACCEPTED" | "CORRECTED" | "REJECTED"; actorId: string; at: string } | null; verificationResult: "PASS" | "FAIL"; approvedOperationalLesson: string | null; runbookVersionId: string | null; actor: LoopActor; at: string; lineage: CausalLineage; classification: "PROPOSED" | "DERIVED" }
export interface RunbookVersion { readonly id: string; readonly previousVersionId: string | null; readonly version: number; readonly immutable: true; readonly approvedBy: string | null; readonly approvedAt: string | null; readonly learningRecordId: string | null; readonly expectedEntitlement: string }
export interface AffectedRunbookState { changeId: string; runbookVersionId: string; state: "STALE_REVIEW_REQUIRED" | "LEARNING_PROPOSED" | "UPDATED_AWAITING_REPLAY" | "REPLAY_FAILED" | "VERIFIED_CURRENT"; reason: string }

export interface LoopRun {
  id: string;
  phase: LoopPhase;
  contract: LoopContract;
  change: CausalPublicChange;
  reviewDecision: ReviewDecision | null;
  mission: Mission | null;
  workItem: WorkItem | null;
  verificationPlan: VerificationPlan | null;
  receipts: readonly VerificationReceipt[];
  learningRecord: LearningRecord | null;
  runbookVersions: readonly RunbookVersion[];
  affectedRunbook: AffectedRunbookState | null;
  closedBy: string | null;
  activeRunbookVersionId: string;
  currentAttempt: number;
  escalated: boolean;
  stopReason: string | null;
  escalationReason: string | null;
  audit: readonly AuditRecord[];
  processedActionIds: readonly string[];
}

interface ActionBase { actionId: string; actor: LoopActor; at: string }
export type LoopAction =
  | (ActionBase & { type: "ACCEPT_CHANGE" })
  | (ActionBase & { type: "CLAIM_WORK" })
  | (ActionBase & { type: "APPROVE_MISSION" })
  | (ActionBase & { type: "APPROVE_VERIFICATION_PLAN" })
  | (ActionBase & { type: "RUN_VERIFICATION" })
  | (ActionBase & { type: "APPROVE_LEARNING" })
  | (ActionBase & { type: "CLOSE_LOOP" })
  | (ActionBase & { type: "RESET" });

export type MetricValue = number | "Insufficient observations";
import type { PublicChangeEvent } from "@/lib/change-radar/types";
