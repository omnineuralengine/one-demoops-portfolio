import { describe, expect, it } from "vitest";

import {
  InvalidChangeReviewTransitionError,
  createDetectedChangeReview,
  transitionChangeReview,
} from "../../lib/change-radar/workflow";

const AT = "2026-09-02T12:00:00.000Z";

describe("governed Change Radar workflow", () => {
  it("requires each human review boundary before acceptance", () => {
    const detected = createDetectedChangeReview("documentation:claude-code-changelog");
    const triaged = transitionChangeReview(detected, {
      type: "TRIAGE",
      actorId: "reviewer-1",
      actorType: "HUMAN",
      rationale: "The observed changelog entry is relevant to operator tooling.",
      at: AT,
    });
    const assessed = transitionChangeReview(triaged, {
      type: "ASSESS_IMPACT",
      actorId: "reviewer-1",
      actorType: "HUMAN",
      rationale: "The change affects MCP diagnostics but grants no new authority.",
      at: AT,
      impactLevel: "MEDIUM",
      impactedDomains: ["tool interoperability", "tool interoperability"],
    });
    const accepted = transitionChangeReview(assessed, {
      type: "ACCEPT_FOR_LAB_UPDATE",
      actorId: "approver-2",
      actorType: "HUMAN",
      rationale: "Update the synthetic runbook after a focused implementation review.",
      at: AT,
    });

    expect(detected.state).toBe("DETECTED");
    expect(triaged.state).toBe("TRIAGED");
    expect(assessed.state).toBe("IMPACT_ASSESSED");
    expect(assessed.impactedDomains).toEqual(["tool interoperability"]);
    expect(accepted.state).toBe("ACCEPTED_FOR_LAB_UPDATE");
    expect(accepted.auditTrail.map(({ to }) => to)).toEqual([
      "TRIAGED",
      "IMPACT_ASSESSED",
      "ACCEPTED_FOR_LAB_UPDATE",
    ]);
  });

  it("allows dismissal only after impact assessment", () => {
    const detected = createDetectedChangeReview("documentation:anthropic-news");

    expect(() =>
      transitionChangeReview(detected, {
        type: "DISMISS",
        actorId: "reviewer-1",
        actorType: "HUMAN",
        rationale: "No operational relevance.",
        at: AT,
      }),
    ).toThrow(InvalidChangeReviewTransitionError);
  });

  it("rejects a recommendation-to-execution shortcut", () => {
    const detected = createDetectedChangeReview("documentation:platform-release-notes");

    expect(() =>
      transitionChangeReview(detected, {
        type: "ACCEPT_FOR_LAB_UPDATE",
        actorId: "documentation-sentinel",
        actorType: "HUMAN",
        rationale: "Attempted shortcut.",
        at: AT,
      }),
    ).toThrow("Cannot apply ACCEPT_FOR_LAB_UPDATE while Change Radar review is DETECTED");
  });

  it("requires a named domain for non-low impact", () => {
    const triaged = transitionChangeReview(
      createDetectedChangeReview("documentation:status"),
      {
        type: "TRIAGE",
        actorId: "reviewer-1",
        actorType: "HUMAN",
        rationale: "Service health evidence needs assessment.",
        at: AT,
      },
    );

    expect(() =>
      transitionChangeReview(triaged, {
        type: "ASSESS_IMPACT",
        actorId: "reviewer-1",
        actorType: "HUMAN",
        rationale: "Marked high without an impact scope.",
        at: AT,
        impactLevel: "HIGH",
        impactedDomains: [],
      }),
    ).toThrow("Non-low impact assessments must name an impacted domain");
  });
});
