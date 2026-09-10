import {
  causalLoopReducer,
  createDeterministicLoopAction,
  createGoldenLoopRun,
  type ActorKind,
  type LoopAction,
} from "@/features/causal-loop";
import { canonicalStringify, stableId } from "./canonical";
import type { VerifiedCapabilityChange } from "./types";

const REHEARSAL_SEQUENCE: readonly { type: LoopAction["type"]; actorId: string; kind: ActorKind }[] = [
  { type: "ACCEPT_CHANGE", actorId: "aisha", kind: "HUMAN" },
  { type: "CLAIM_WORK", actorId: "maya", kind: "HUMAN" },
  { type: "APPROVE_MISSION", actorId: "mateo", kind: "HUMAN" },
  { type: "APPROVE_VERIFICATION_PLAN", actorId: "aisha", kind: "HUMAN" },
  { type: "RUN_VERIFICATION", actorId: "verification-agent", kind: "AGENT" },
  { type: "APPROVE_LEARNING", actorId: "mateo", kind: "HUMAN" },
  { type: "RUN_VERIFICATION", actorId: "verification-agent", kind: "AGENT" },
];

/** Replays Phase 3A's existing guarded reducer; no lineage value is hand-authored here. */
export function createVerifiedPhaseThreeCapabilityChange(): VerifiedCapabilityChange {
  let loop = createGoldenLoopRun();
  const previousVersion = loop.activeRunbookVersionId;
  for (const step of REHEARSAL_SEQUENCE) {
    loop = causalLoopReducer(loop, createDeterministicLoopAction(loop, step.type, step.actorId, step.kind));
  }
  const learning = loop.learningRecord;
  const receipt = loop.receipts.at(-1);
  const decision = loop.reviewDecision;
  const version = loop.runbookVersions.find((candidate) => candidate.id === loop.activeRunbookVersionId);
  if (loop.phase !== "REPLAY_PASSED" || !learning || learning.state !== "ACTIVE" || !receipt || receipt.outcome !== "PASS"
    || learning.activationReceiptId !== receipt.id || !decision || !version?.approvedBy || !learning.humanDecision) {
    throw new Error("PHASE_THREE_VERIFIED_CAPABILITY_CHANGE_UNAVAILABLE");
  }
  const core = {
    sourceLoopId: loop.id,
    changeId: loop.change.id,
    reviewDecisionId: decision.id,
    learningRecordId: learning.id,
    activationReceiptId: receipt.id,
    capabilityId: "runbook:model-access",
    previousVersion,
    nextVersion: loop.activeRunbookVersionId,
    verifiedAt: receipt.at,
    approvedBy: version.approvedBy,
    humanDecisionActorId: learning.humanDecision.actorId,
  };
  return { id: stableId("capability-change", core), ...core };
}

export function isVerifiedPhaseThreeCapabilityChange(value: VerifiedCapabilityChange): boolean {
  try {
    return canonicalStringify(value) === canonicalStringify(createVerifiedPhaseThreeCapabilityChange());
  } catch {
    return false;
  }
}
