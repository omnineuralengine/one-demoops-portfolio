"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, X } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { resetReceiptIsValid, teardownReceiptIsValid } from "./domain/selectors";
import type { ScenarioFoundryState } from "./domain/types";

export type FoundrySubview = "build" | "validate" | "rehearse" | "governance";

interface FoundryTourStep {
  readonly view: FoundrySubview;
  readonly targetId: string;
  readonly title: string;
  readonly copy: string;
  readonly evidence: string;
  readonly isReady: (state: ScenarioFoundryState) => boolean;
}

const STEPS: readonly FoundryTourStep[] = [
  {
    view: "build",
    targetId: "foundry-demo-brief",
    title: "Start with a bounded brief",
    copy: "Sofia chooses only broad, structured signals. Files, record samples, free text, credentials, and customer identifiers have no intake path.",
    evidence: "The structured brief and prohibited-input boundary are visible.",
    isReady: () => true,
  },
  {
    view: "build",
    targetId: "foundry-context-firewall",
    title: "Issue a safe context receipt",
    copy: "The Context Firewall records accepted and coarsened categories without retaining rejected values. Inspect its policy version and stable safe-projection hash.",
    evidence: "An accepted Context Receipt must exist.",
    isReady: (state) => state.contextReceipt?.validationOutcome === "ACCEPTED",
  },
  {
    view: "build",
    targetId: "foundry-world-blueprint",
    title: "Compile one inspectable contract",
    copy: "The receipt compiles into a versioned Synthetic Data Contract with origins, fixed UTC anchor, bounded entity graph, deterministic seed, capability pins, and forbidden content.",
    evidence: "A contract hash must bind the accepted profile.",
    isReady: (state) => Boolean(state.contract?.contractHash),
  },
  {
    view: "validate",
    targetId: "foundry-generated-world",
    title: "Generate the fictional enterprise",
    copy: "The deterministic generator creates one Salesforce-shaped revenue world. Relationships and chronology—not copied records—supply realism.",
    evidence: "A generated output hash and synthetic record graph must exist.",
    isReady: (state) => Boolean(state.world?.outputHash),
  },
  {
    view: "validate",
    targetId: "foundry-privacy-quality",
    title: "Prove safety and coherence",
    copy: "Independent privacy and quality gates test non-routable identities, prohibited content, permissions, referential integrity, chronology, rollups, and deterministic replay before review.",
    evidence: "Both reports must pass and the pack must be submitted for review.",
    isReady: (state) => state.privacyReport?.outcome === "PASS" && state.qualityReport?.outcome === "PASS" && state.phase === "REVIEW_REQUIRED",
  },
  {
    view: "rehearse",
    targetId: "foundry-activation",
    title: "Separate review from activation",
    copy: "Aisha reviews Sofia's pack; Maya separately activates one simulated session. Generation and validation alone cannot create readiness.",
    evidence: "A human review decision and one-session activation receipt must exist; readiness still awaits oracle evidence.",
    isReady: (state) => Boolean(state.reviewDecision && state.activationReceipts.length > 0 && state.phase === "ACTIVE"),
  },
  {
    view: "rehearse",
    targetId: "foundry-oracle",
    title: "Rehearse against known answers",
    copy: "Four simulated evaluations test facts, evidence, prohibited disclosures, allowed actions, and blocked actions. No model or Salesforce request occurs.",
    evidence: "A passing SIMULATED EVALUATION report must bind the active persona and world.",
    isReady: (state) => state.oracleReports.some((report) => report.outcome === "PASS"),
  },
  {
    view: "rehearse",
    targetId: "foundry-staleness",
    title: "Revoke readiness on capability change",
    copy: "An authorized, deterministic Phase 3A-style capability event impact-maps this pack. The prior readiness receipt remains evidence, but cannot keep the pack ready.",
    evidence: "A staleness receipt must revoke readiness and create a scoped mission.",
    isReady: (state) => Boolean(state.stalenessReceipt?.readinessRevoked && state.revalidationMission),
  },
  {
    view: "rehearse",
    targetId: "foundry-revalidation",
    title: "Restore readiness with new evidence",
    copy: "The bounded agent reruns validation; Aisha approves the new report; Maya restores the session. Old evidence cannot reactivate the pack.",
    evidence: "A passing revalidation report and a newer activation receipt must restore ACTIVE.",
    isReady: (state) => state.revalidationReport?.outcome === "PASS"
      && state.revalidationApproval?.reportId === state.revalidationReport.id
      && state.revalidationApproval.packId === state.packId
      && state.activationReceipts.length > 1
      && state.phase === "ACTIVE",
  },
  {
    view: "rehearse",
    targetId: "foundry-lifecycle-controls",
    title: "Reset without hidden residue",
    copy: "A verified reset restores the deterministic world and records the restored output hash. It does not write to storage or contact another system.",
    evidence: "A passing reset receipt must exist.",
    isReady: (state) => state.resetReceipts.some((receipt) => resetReceiptIsValid(state, receipt)),
  },
  {
    view: "rehearse",
    targetId: "foundry-lifecycle-controls",
    title: "Verify teardown",
    copy: "Teardown is idempotent: it removes the active generated world, revokes readiness, and preserves only bounded causal evidence of the final state.",
    evidence: "A verified DESTROYED receipt must exist.",
    isReady: (state) => teardownReceiptIsValid(state),
  },
  {
    view: "governance",
    targetId: "foundry-provenance",
    title: "Inspect the complete truth boundary",
    copy: "The nutrition label keeps source mode, no-connection status, safe signal categories, versions, seed, UTC anchor, counts, outcomes, owner, reviewer, export state, and teardown state inspectable.",
    evidence: "The destroyed pack's bounded nutrition and provenance label remains visible for human review.",
    isReady: (state) => state.phase === "DESTROYED" && Boolean(state.teardownReceipt),
  },
] as const;

export function FoundryTour({
  state,
  currentView,
  onNavigate,
  onClose,
}: {
  state: ScenarioFoundryState;
  currentView: FoundrySubview;
  onNavigate: (view: FoundrySubview, targetId: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const advanceControlRef = useRef<HTMLSpanElement>(null);
  const handledRevisionRef = useRef(state.revision);
  const step = STEPS[index];
  const evidenceReady = step.isReady(state);
  const destinationVisible = currentView === step.view;
  const canAdvance = evidenceReady && destinationVisible;
  const finished = index === STEPS.length - 1;

  useLayoutEffect(() => {
    if (currentView !== step.view) return;
    const target = document.getElementById(step.targetId);
    if (!target) return;
    const root = document.documentElement;
    const withoutSmoothScroll = (operation: () => void) => {
      const priorInlineScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      try { operation(); }
      finally { root.style.scrollBehavior = priorInlineScrollBehavior; }
    };
    const keepTargetBelowTour = () => {
      if (!target.isConnected) return;
      const banner = document.getElementById("foundry-guided-tour");
      const targetBox = target.getBoundingClientRect();
      const bannerBox = banner?.getBoundingClientRect();
      // Keep a small rounding cushion beyond the tested eight-pixel separation;
      // Chromium scroll positions can round a sub-pixel correction toward zero.
      const minimumTop = Math.min((bannerBox?.bottom ?? 0) + 12, window.innerHeight - 48);
      const maximumTop = window.innerHeight - 24;
      const offset = targetBox.top < minimumTop
        ? targetBox.top - minimumTop
        : targetBox.top >= maximumTop ? targetBox.top - maximumTop : 0;
      if (offset !== 0) withoutSmoothScroll(() => window.scrollBy({ top: offset, behavior: "auto" }));
    };
    withoutSmoothScroll(() => {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "start", behavior: "auto" });
    });
    keepTargetBelowTour();
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      keepTargetBelowTour();
      secondFrame = window.requestAnimationFrame(keepTargetBelowTour);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [currentView, index, step]);

  useEffect(() => {
    if (state.revision === handledRevisionRef.current) return;
    handledRevisionRef.current = state.revision;
    if (!destinationVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const evidenceActionCompleted = evidenceReady
        && activeElement instanceof HTMLButtonElement
        && document.getElementById(step.targetId)?.contains(activeElement);
      if (activeElement && activeElement !== document.body && activeElement.isConnected && !evidenceActionCompleted) return;
      if (evidenceReady) {
        advanceControlRef.current?.querySelector("button")?.focus();
        return;
      }
      document.getElementById(step.targetId)?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [destinationVisible, evidenceReady, state.revision, step.targetId]);

  function advance() {
    if (!canAdvance) return;
    if (finished) {
      onClose();
      return;
    }
    const next = STEPS[index + 1];
    onNavigate(next.view, next.targetId);
    setIndex(index + 1);
  }

  function retreat() {
    if (index === 0) return;
    const previous = STEPS[index - 1];
    onNavigate(previous.view, previous.targetId);
    setIndex(index - 1);
  }

  return (
    <aside
      id="foundry-guided-tour"
      className="tour-banner foundry-tour"
      aria-label="Scenario Foundry guided walkthrough"
      aria-live="polite"
      tabIndex={-1}
    >
      <div className="tour-banner__index">{String(index + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</div>
      <div>
        <strong>{step.title}</strong>
        <p>{step.copy}</p>
        <small className={canAdvance ? "tour-evidence tour-evidence--ready" : "tour-evidence"}>
          {canAdvance ? <CheckCircle2 size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}
          {step.evidence}
        </small>
      </div>
      <div className="tour-banner__actions">
        <ActionButton compact tone="quiet" disabled={index === 0} onClick={retreat}>
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </ActionButton>
        <span ref={advanceControlRef}>
          <ActionButton compact tone="primary" disabled={!canAdvance} onClick={advance}>
            {finished ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
            {finished ? "Finish walkthrough" : canAdvance ? "Next evidence" : "Complete visible action"}
            {!finished && canAdvance ? <ArrowRight size={14} aria-hidden="true" /> : null}
          </ActionButton>
        </span>
        <ActionButton compact tone="quiet" aria-label="Close Scenario Foundry walkthrough" onClick={onClose}>
          <X size={15} aria-hidden="true" />
        </ActionButton>
      </div>
    </aside>
  );
}
