import { describe, expect, it } from "vitest";
import generatedChangeRadar from "../../data/change-radar/generated.json";
import {
  changeReviewSessionReducer,
  createChangeReviewSession,
} from "../../lib/change-radar/session";
import type {
  ChangeRadarArtifact,
  DocumentationChange,
} from "../../lib/change-radar/types";

const AT = "2026-09-02T16:00:00.000Z";
const artifact = generatedChangeRadar as ChangeRadarArtifact;

describe("Change Radar session governance", () => {
  it("keeps unchanged observations read-only at the reducer boundary", () => {
    const unchanged = artifact.changes.find((change) => change.status === "UNCHANGED")!;
    const session = createChangeReviewSession([unchanged]);

    expect(session.records[unchanged.id]).toBeUndefined();

    const attempted = changeReviewSessionReducer(session, {
      changeId: unchanged.id,
      event: {
        type: "TRIAGE",
        actorId: "human-reviewer",
        actorType: "HUMAN",
        rationale: "Attempted to acknowledge an unchanged source.",
        at: AT,
      },
    });

    expect(attempted).toBe(session);
  });

  it("persists the governed review record for actionable observations", () => {
    const changed: DocumentationChange = {
      ...artifact.changes[0],
      status: "CHANGED",
      changedAt: AT,
      changedHeadings: ["Governed update"],
    };
    const session = createChangeReviewSession([changed]);
    const triaged = changeReviewSessionReducer(session, {
      changeId: changed.id,
      event: {
        type: "TRIAGE",
        actorId: "human-reviewer",
        actorType: "HUMAN",
        rationale: "The public-source change needs bounded impact analysis.",
        at: AT,
      },
    });

    expect(triaged.records[changed.id]).toMatchObject({
      state: "TRIAGED",
      changeId: changed.id,
    });
    expect(triaged.records[changed.id].auditTrail).toHaveLength(1);
    expect(session.records[changed.id].state).toBe("DETECTED");
  });
});
