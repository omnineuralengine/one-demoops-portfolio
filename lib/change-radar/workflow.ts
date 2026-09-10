import type {
  ChangeImpactLevel,
  ChangeReviewRecord,
  ChangeReviewState,
} from "./types";

interface BaseReviewEvent {
  actorId: string;
  actorType: "HUMAN";
  rationale: string;
  at: string;
}

export type ChangeReviewEvent =
  | (BaseReviewEvent & { type: "TRIAGE" })
  | (BaseReviewEvent & {
      type: "ASSESS_IMPACT";
      impactLevel: ChangeImpactLevel;
      impactedDomains: readonly string[];
    })
  | (BaseReviewEvent & { type: "ACCEPT_FOR_LAB_UPDATE" })
  | (BaseReviewEvent & { type: "DISMISS" });

const NEXT_STATE_BY_EVENT: Record<
  ChangeReviewEvent["type"],
  { from: ChangeReviewState; to: ChangeReviewState }
> = {
  TRIAGE: { from: "DETECTED", to: "TRIAGED" },
  ASSESS_IMPACT: { from: "TRIAGED", to: "IMPACT_ASSESSED" },
  ACCEPT_FOR_LAB_UPDATE: {
    from: "IMPACT_ASSESSED",
    to: "ACCEPTED_FOR_LAB_UPDATE",
  },
  DISMISS: { from: "IMPACT_ASSESSED", to: "DISMISSED" },
};

export class InvalidChangeReviewTransitionError extends Error {
  constructor(current: ChangeReviewState, event: ChangeReviewEvent["type"]) {
    super(`Cannot apply ${event} while Change Radar review is ${current}.`);
    this.name = "InvalidChangeReviewTransitionError";
  }
}

export function createDetectedChangeReview(changeId: string): ChangeReviewRecord {
  if (!changeId.trim()) {
    throw new Error("A Change Radar review requires a change id.");
  }

  return {
    changeId: changeId.trim(),
    state: "DETECTED",
    impactLevel: null,
    impactedDomains: [],
    auditTrail: [],
  };
}

export function transitionChangeReview(
  review: ChangeReviewRecord,
  event: ChangeReviewEvent,
): ChangeReviewRecord {
  const transition = NEXT_STATE_BY_EVENT[event.type];

  if (review.state !== transition.from) {
    throw new InvalidChangeReviewTransitionError(review.state, event.type);
  }
  if (event.actorType !== "HUMAN") {
    throw new Error("Only a human actor may advance a Change Radar review.");
  }
  if (!event.actorId.trim()) {
    throw new Error("A Change Radar review transition requires an actor id.");
  }
  if (!event.rationale.trim()) {
    throw new Error("A Change Radar review transition requires a rationale.");
  }
  const parsedTimestamp = new Date(event.at);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(event.at) ||
    !Number.isFinite(parsedTimestamp.valueOf())
  ) {
    throw new Error("A Change Radar review transition requires an ISO timestamp.");
  }
  const assessedDomains = event.type === "ASSESS_IMPACT"
    ? [...new Set(event.impactedDomains.map((domain) => domain.trim()).filter(Boolean))]
    : review.impactedDomains;
  if (
    event.type === "ASSESS_IMPACT" &&
    event.impactLevel !== "LOW" &&
    assessedDomains.length === 0
  ) {
    throw new Error("Non-low impact assessments must name an impacted domain.");
  }

  return {
    ...review,
    state: transition.to,
    ...(event.type === "ASSESS_IMPACT"
      ? {
          impactLevel: event.impactLevel,
          impactedDomains: assessedDomains,
        }
      : {}),
    auditTrail: [
      ...review.auditTrail,
      {
        from: transition.from,
        to: transition.to,
        actorId: event.actorId,
        actorType: "HUMAN",
        rationale: event.rationale.trim(),
        at: parsedTimestamp.toISOString(),
      },
    ],
  };
}
