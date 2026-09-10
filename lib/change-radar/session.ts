import type {
  ChangeReviewRecord,
  DocumentationChange,
  DocumentationChangeStatus,
} from "./types";
import {
  createDetectedChangeReview,
  transitionChangeReview,
  type ChangeReviewEvent,
} from "./workflow";

export interface ChangeReviewSessionState {
  readonly statusByChangeId: Readonly<Record<string, DocumentationChangeStatus>>;
  readonly records: Readonly<Record<string, ChangeReviewRecord>>;
}

export interface ChangeReviewSessionAction {
  changeId: string;
  event: ChangeReviewEvent;
}

export function isReviewableDocumentationChange(
  change: Pick<DocumentationChange, "status">,
): boolean {
  return change.status !== "UNCHANGED";
}

export function createChangeReviewSession(
  changes: readonly DocumentationChange[],
): ChangeReviewSessionState {
  const statusByChangeId: Record<string, DocumentationChangeStatus> = {};
  const records: Record<string, ChangeReviewRecord> = {};

  for (const change of changes) {
    statusByChangeId[change.id] = change.status;
    if (isReviewableDocumentationChange(change)) {
      records[change.id] = createDetectedChangeReview(change.id);
    }
  }

  return { statusByChangeId, records };
}

export function changeReviewSessionReducer(
  state: ChangeReviewSessionState,
  action: ChangeReviewSessionAction,
): ChangeReviewSessionState {
  const status = state.statusByChangeId[action.changeId];
  if (!status || status === "UNCHANGED") return state;

  const current = state.records[action.changeId];
  if (!current) return state;

  return {
    ...state,
    records: {
      ...state.records,
      [action.changeId]: transitionChangeReview(current, action.event),
    },
  };
}
