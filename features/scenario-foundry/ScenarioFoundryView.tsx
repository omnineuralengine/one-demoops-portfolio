"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  CircleSlash2,
  Clock3,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  Fingerprint,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Network,
  PackageCheck,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { AccessibleTabList } from "@/components/ui/AccessibleTabList";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { serializeScenarioExport } from "./domain/export";
import { createFoundryAction } from "./domain/actions";
import { personaView } from "./domain/permissions";
import {
  resetReceiptIsValid,
  scenarioMeasurements,
  scenarioProvenance,
  scenarioReadiness,
  teardownReceiptIsValid,
} from "./domain/selectors";
import type {
  ContextDisposition,
  ContractElementOrigin,
  EdgeCase,
  FoundryAction,
  FoundryActorKind,
  FoundryBuildConfig,
  FoundryPhase,
  ObjectFamily,
  PrivacyReport,
  QualityReport,
  SafeDemoSignalInput,
  ScenarioFoundryState,
  ScenarioPersonaId,
  UseCaseTag,
  VerifiedCapabilityChange,
} from "./domain/types";
import { FoundryTour, type FoundrySubview } from "./FoundryTour";

const FOUNDRY_TABS = [
  { id: "build", label: "Build", contentId: "foundry-panel-build" },
  { id: "validate", label: "Validate & Preview", contentId: "foundry-panel-validate" },
  { id: "rehearse", label: "Rehearse", contentId: "foundry-panel-rehearse" },
  { id: "governance", label: "Governance", contentId: "foundry-panel-governance" },
] as const;

type RailStageId = Exclude<FoundryPhase, "ACTIVE" | "QUARANTINED" | "EXPIRED"> | "INITIAL_ACTIVE" | "REVALIDATION_APPROVED" | "READINESS_RESTORED";

const RAIL_STAGES: readonly { readonly id: RailStageId; readonly label: string }[] = [
  { id: "DRAFT", label: "Demo brief" },
  { id: "INTAKE_ACCEPTED", label: "Context accepted" },
  { id: "BLUEPRINTED", label: "Blueprinted" },
  { id: "GENERATED", label: "Generated" },
  { id: "PRIVACY_VALIDATED", label: "Privacy validated" },
  { id: "QUALITY_VALIDATED", label: "Quality validated" },
  { id: "REVIEW_REQUIRED", label: "Review required" },
  { id: "APPROVED", label: "Approved" },
  { id: "INITIAL_ACTIVE", label: "Initial activation" },
  { id: "STALE_REVALIDATION_REQUIRED", label: "Capability stale" },
  { id: "REVALIDATED", label: "New evidence produced" },
  { id: "REVALIDATION_APPROVED", label: "Evidence approved" },
  { id: "READINESS_RESTORED", label: "Readiness restored" },
  { id: "DESTROYED", label: "Destroyed" },
];

const PHASE_LABELS: Readonly<Record<FoundryPhase, string>> = {
  DRAFT: "Demo brief",
  INTAKE_ACCEPTED: "Context accepted",
  BLUEPRINTED: "Blueprinted",
  GENERATED: "Generated",
  PRIVACY_VALIDATED: "Privacy validated",
  QUALITY_VALIDATED: "Quality validated",
  REVIEW_REQUIRED: "Review required",
  APPROVED: "Approved",
  ACTIVE: "Active session",
  STALE_REVALIDATION_REQUIRED: "Stale · revalidation required",
  REVALIDATED: "Revalidated",
  QUARANTINED: "Quarantined",
  EXPIRED: "Expired",
  DESTROYED: "Destroyed",
};

const PERSONA_LABELS: Readonly<Record<ScenarioPersonaId, string>> = {
  "demoops-admin": "DemoOps administrator · Maya Chen",
  "requesting-se": "Requesting Solution Engineer · Sofia Reyes",
  "seller-owner": "Seller / account owner · fictional",
  "executive-viewer": "Executive viewer · Priya Raman",
  "restricted-viewer": "Restricted viewer · fictional",
  "privacy-reviewer": "Privacy reviewer · Aisha Okafor",
};

const OBJECT_FAMILY_LABELS: Readonly<Record<ObjectFamily, string>> = {
  ACCOUNTS: "Accounts",
  CONTACTS: "Contacts",
  OPPORTUNITIES: "Opportunities",
  CASES: "Cases",
  ACTIVITIES: "Activities",
};

const EDGE_CASE_LABELS: Readonly<Record<EdgeCase, string>> = {
  STALE_FIELD: "Stale or missing field",
  CONFLICTING_SIGNAL: "Conflicting signal",
  ACTIVITY_GAP: "Recent activity gap",
  RESTRICTED_FIELD: "Permission-restricted field",
};

const USE_CASE_LABELS: Readonly<Record<UseCaseTag, string>> = {
  MEETING_PREPARATION: "Meeting preparation",
  DEAL_HEALTH_REVIEW: "Deal-health review",
  PIPELINE_REVIEW: "Pipeline review",
  GOVERNED_UPDATE: "Governed update",
};

export type FoundryUiCommand =
  | { readonly type: "EDIT_SAFE_DRAFT"; readonly actorId: "sofia"; readonly kind: "HUMAN"; readonly draft: SafeDemoSignalInput }
  | { readonly type: "EDIT_CONFIGURATION"; readonly actorId: "aisha" | "kenji"; readonly kind: "HUMAN"; readonly buildConfig: FoundryBuildConfig }
  | { readonly type: "PROPOSE_TEMPLATE_IMPROVEMENT"; readonly actorId: "sofia"; readonly kind: "HUMAN"; readonly category: "STORY_CLARITY" | "EDGE_CASE_COVERAGE" }
  | { readonly type: "ACCEPT_CONTEXT" | "COMPILE_CONTRACT" | "GENERATE_WORLD" | "RUN_PRIVACY_VALIDATION" | "RUN_QUALITY_VALIDATION" | "SUBMIT_FOR_REVIEW" | "APPROVE_PACK" | "ACTIVATE_PACK" | "RUN_ORACLE_EVALUATIONS" | "APPLY_VERIFIED_CAPABILITY_CHANGE" | "RUN_REVALIDATION" | "APPROVE_REVALIDATION" | "REACTIVATE_PACK" | "RESET_WORLD" | "TEARDOWN_WORLD" | "EXPIRE_PACK" | "MARK_EXPORTED" | "RESTART"; readonly actorId: string; readonly kind: FoundryActorKind };

export type FoundryUiActionHandler = (command: FoundryUiCommand) => void;

export function ScenarioFoundryView({
  state,
  dispatch,
  capabilityChange,
  startTour = false,
  onTourRequestConsumed,
}: {
  state: ScenarioFoundryState;
  dispatch: Dispatch<FoundryAction>;
  capabilityChange?: VerifiedCapabilityChange;
  startTour?: boolean;
  onTourRequestConsumed?: () => void;
}) {
  const [view, setView] = useState<FoundrySubview>("build");
  const [previewPersona, setPreviewPersona] = useState<ScenarioPersonaId>("requesting-se");
  const [tourOpen, setTourOpen] = useState(startTour);
  const [announcement, setAnnouncement] = useState("Build selected");
  const tourOpenerRef = useRef<HTMLSpanElement>(null);
  const observedRevisionRef = useRef(state.revision);
  const pendingFocusTargetRef = useRef<string | null>(null);
  const readiness = scenarioReadiness(state);
  const latestReducerResult = state.audit.at(-1);
  const capabilityChangeApplicable = Boolean(
    capabilityChange
    && state.contract?.requiredCapabilityPins.some(
      (pin) => pin.id === capabilityChange.capabilityId && pin.version === capabilityChange.previousVersion,
    ),
  );

  const onAction: FoundryUiActionHandler = (command) => {
    pendingFocusTargetRef.current = focusTargetForAction(command.type, state.phase);
    if (command.type === "RESTART") {
      setView("build");
      setAnnouncement("Build selected; clean foundry run ready");
    }
    if (command.type === "EDIT_SAFE_DRAFT") {
      dispatch(createFoundryAction(state, command.type, command.actorId, command.kind, { draft: command.draft }));
      return;
    }
    if (command.type === "ACCEPT_CONTEXT") {
      dispatch(createFoundryAction(state, command.type, command.actorId, command.kind, { input: state.draft }));
      return;
    }
    if (command.type === "EDIT_CONFIGURATION") {
      dispatch(createFoundryAction(state, command.type, command.actorId, command.kind, { buildConfig: command.buildConfig }));
      return;
    }
    if (command.type === "PROPOSE_TEMPLATE_IMPROVEMENT") {
      dispatch(createFoundryAction(state, command.type, command.actorId, command.kind, { category: command.category }));
      return;
    }
    if (command.type === "APPLY_VERIFIED_CAPABILITY_CHANGE") {
      if (capabilityChange) dispatch(createFoundryAction(state, command.type, command.actorId, command.kind, { change: capabilityChange }));
      return;
    }
    dispatch(createFoundryAction(state, command.type, command.actorId, command.kind));
  };

  useEffect(() => {
    if (state.revision === observedRevisionRef.current) return;
    observedRevisionRef.current = state.revision;
    const targetId = pendingFocusTargetRef.current;
    pendingFocusTargetRef.current = null;
    if (!targetId || tourOpen) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(targetId)?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [state.revision, tourOpen]);

  const navigate = useCallback((next: FoundrySubview, targetId?: string) => {
    setView(next);
    const label = FOUNDRY_TABS.find((tab) => tab.id === next)?.label ?? next;
    setAnnouncement(`${label} selected${targetId ? `; ${targetId.replace("foundry-", "").replaceAll("-", " ")}` : ""}`);
  }, []);

  const navigateTour = useCallback((next: FoundrySubview, targetId: string) => {
    navigate(next, targetId);
  }, [navigate]);

  function closeTour() {
    setTourOpen(false);
    onTourRequestConsumed?.();
    const url = new URL(window.location.href);
    if (url.searchParams.get("tour") === "foundry") {
      url.searchParams.delete("tour");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    window.requestAnimationFrame(() => tourOpenerRef.current?.querySelector("button")?.focus());
  }

  return (
    <div className="plane-view foundry-view" data-testid="scenario-foundry-view" aria-describedby="foundry-truth-boundary">
      <section className="plane-intro plane-intro--foundry">
        <div>
          <p className="eyebrow">Governed Scenario Foundry · one bounded vertical slice</p>
          <h1>Scenario Foundry <span>Synthetic Revenue Worlds</span></h1>
          <p>Customer-shaped, never customer-copied. Produce, validate, rehearse, reset, and improve one high-fidelity fictional enterprise through a human-governed causal path.</p>
        </div>
        <div className="foundry-hero-mark" aria-label={`${readiness.state}: ${readiness.reason}`}>
          <div><Fingerprint size={24} aria-hidden="true" /><strong>{readiness.state.replaceAll("_", " ")}</strong></div>
          <span>{readiness.reason}</span>
        </div>
      </section>

      <div id="foundry-truth-boundary" className="foundry-boundary" role="note">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Customer-shaped, never customer-copied.</strong>
          <span>No Salesforce connection, production data, model call, upload, background export, or persistent browser storage. Generated content exists only in browser memory until an explicit JSON export.</span>
        </div>
        <div className="foundry-truth-labels" aria-label="Truth labels">
          <StatusPill tone="amethyst">SYNTHETIC</StatusPill>
          <StatusPill tone="info">USER-PROVIDED SAFE SIGNAL</StatusPill>
          <StatusPill tone="neutral">DERIVED</StatusPill>
          <StatusPill tone="neutral">CALCULATED</StatusPill>
          <StatusPill tone="warning">SIMULATED</StatusPill>
          <StatusPill tone="info">PUBLIC REFERENCE</StatusPill>
        </div>
      </div>

      <StageRail state={state} />

      <div className="foundry-toolbar">
        <div>
          <StatusPill tone={readinessTone(readiness.state)}>{readiness.ready ? "READY · EVIDENCE BOUND" : readiness.state.replaceAll("_", " ")}</StatusPill>
          <span>Pack <code>{state.packId}</code> · revision {state.revision} · one local session</span>
        </div>
        <span ref={tourOpenerRef}>
          <ActionButton compact tone="primary" aria-expanded={tourOpen} aria-controls="foundry-guided-tour" onClick={() => {
            if (tourOpen) {
              closeTour();
              return;
            }
            navigate("build", "foundry-demo-brief");
            setTourOpen(true);
          }}>
            <PlayCircle size={14} aria-hidden="true" /> {tourOpen ? "Close walkthrough" : "Open guided walkthrough"}
          </ActionButton>
        </span>
      </div>

      <AccessibleTabList
        ariaLabel="Scenario Foundry views"
        className="team-view-switch foundry-tablist"
        idPrefix="foundry"
        selected={view}
        tabs={FOUNDRY_TABS}
        onSelect={navigate}
      />
      <p className="foundry-scroll-cue">More Foundry views → Swipe horizontally or use arrow keys.</p>

      {tourOpen ? <FoundryTour state={state} currentView={view} onNavigate={navigateTour} onClose={closeTour} /> : null}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <p className="sr-only" role="status" aria-live="polite">{latestReducerResult ? `${humanize(latestReducerResult.type)} ${latestReducerResult.outcome.toLowerCase()}: ${humanize(latestReducerResult.reasonCode)}` : "No governed Scenario Foundry action has run."}</p>

      <section id="foundry-panel-build" role="tabpanel" aria-labelledby="foundry-tab-build" hidden={view !== "build"} tabIndex={view === "build" ? 0 : -1}>
        {view === "build" ? <BuildView state={state} onAction={onAction} /> : null}
      </section>
      <section id="foundry-panel-validate" role="tabpanel" aria-labelledby="foundry-tab-validate" hidden={view !== "validate"} tabIndex={view === "validate" ? 0 : -1}>
        {view === "validate" ? <ValidateView state={state} previewPersona={previewPersona} onPreviewPersona={setPreviewPersona} onAction={onAction} /> : null}
      </section>
      <section id="foundry-panel-rehearse" role="tabpanel" aria-labelledby="foundry-tab-rehearse" hidden={view !== "rehearse"} tabIndex={view === "rehearse" ? 0 : -1}>
        {view === "rehearse" ? <RehearseView state={state} capabilityChangeAvailable={Boolean(capabilityChange)} capabilityChangeApplicable={capabilityChangeApplicable} onAction={onAction} /> : null}
      </section>
      <section id="foundry-panel-governance" role="tabpanel" aria-labelledby="foundry-tab-governance" hidden={view !== "governance"} tabIndex={view === "governance" ? 0 : -1}>
        {view === "governance" ? <GovernanceView state={state} onAction={onAction} /> : null}
      </section>

      <p className="truth-strip"><strong>Synthetic session boundary.</strong> This proposed operating model uses fictional people, roles, records, permissions, and receipts. It neither represents Anthropic&apos;s internal organization nor accesses Salesforce, Slack, Anthropic, or customer systems.</p>
    </div>
  );
}

function StageRail({ state }: { state: ScenarioFoundryState }) {
  const submitted = state.audit.some((event) => event.type === "SUBMIT_FOR_REVIEW" && event.outcome === "ACCEPTED");
  const reached: Readonly<Record<RailStageId, boolean>> = {
    DRAFT: true,
    INTAKE_ACCEPTED: state.contextReceipt?.validationOutcome === "ACCEPTED",
    BLUEPRINTED: Boolean(state.contract),
    GENERATED: Boolean(state.world || state.privacyReport || state.qualityReport || state.reviewDecision || state.teardownReceipt?.destroyedGenerationRunId),
    PRIVACY_VALIDATED: Boolean(state.privacyReport),
    QUALITY_VALIDATED: Boolean(state.qualityReport),
    REVIEW_REQUIRED: submitted || Boolean(state.reviewDecision),
    APPROVED: Boolean(state.reviewDecision),
    INITIAL_ACTIVE: state.activationReceipts.length > 0,
    STALE_REVALIDATION_REQUIRED: Boolean(state.stalenessReceipt),
    REVALIDATED: Boolean(state.revalidationReport),
    REVALIDATION_APPROVED: Boolean(state.revalidationApproval),
    READINESS_RESTORED: Boolean(state.stalenessReceipt && state.activationReceipts.length > 1),
    DESTROYED: Boolean(state.teardownReceipt),
  };
  const currentStage: RailStageId | null = state.phase === "ACTIVE"
    ? reached.READINESS_RESTORED ? "READINESS_RESTORED" : "INITIAL_ACTIVE"
    : state.phase === "REVALIDATED" && reached.REVALIDATION_APPROVED ? "REVALIDATION_APPROVED"
    : state.phase === "QUARANTINED" || state.phase === "EXPIRED" ? null : state.phase;
  const currentLabel = state.phase === "ACTIVE" && reached.READINESS_RESTORED ? "Active · readiness restored" : PHASE_LABELS[state.phase];
  return (
    <nav className="foundry-stage-rail" aria-label="Scenario lifecycle" data-testid="foundry-stage-rail">
      <p><span>Current branch</span><strong>{currentLabel}</strong>{state.phase === "QUARANTINED" ? <small>Safety or integrity failure stopped approval and readiness.</small> : state.phase === "EXPIRED" ? <small>TTL evidence revoked readiness; restart requires a new run.</small> : null}</p>
      <ol tabIndex={0} aria-label="Lifecycle evidence chronology; horizontally scrollable">
        {RAIL_STAGES.map((stage, index) => {
          const status = currentStage === stage.id ? "current" : reached[stage.id] ? "complete" : "upcoming";
          return (
            <li key={stage.id} className={`foundry-stage foundry-stage--${status}`} aria-current={status === "current" ? "step" : undefined}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <strong>{stage.label}</strong>
              <small>{status === "complete" ? "Evidence exists" : status === "current" ? "Current" : "Not created"}</small>
            </li>
          );
        })}
        {state.phase === "QUARANTINED" || state.phase === "EXPIRED" ? <li className="foundry-stage foundry-stage--current foundry-stage--branch" aria-current="step"><span aria-hidden="true">BRANCH</span><strong>{PHASE_LABELS[state.phase]}</strong><small>Current · readiness revoked</small></li> : null}
      </ol>
      <div className="foundry-scroll-cue">More lifecycle evidence → Swipe horizontally or focus this chronology and use arrow keys.</div>
    </nav>
  );
}

function BuildView({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const editable = state.phase === "DRAFT" || state.phase === "INTAKE_ACCEPTED" || state.phase === "BLUEPRINTED" || state.phase === "GENERATED" || state.phase === "PRIVACY_VALIDATED" || state.phase === "QUALITY_VALIDATED" || state.phase === "REVIEW_REQUIRED" || state.phase === "APPROVED" || state.phase === "ACTIVE" || state.phase === "STALE_REVALIDATION_REQUIRED" || state.phase === "REVALIDATED" || state.phase === "QUARANTINED";

  function edit(patch: Partial<SafeDemoSignalInput>) {
    onAction({ type: "EDIT_SAFE_DRAFT", actorId: "sofia", kind: "HUMAN", draft: { ...state.draft, ...patch } });
  }

  function toggleUseCase(useCase: UseCaseTag) {
    const selected = state.draft.useCaseTags.includes(useCase);
    const useCaseTags = selected
      ? state.draft.useCaseTags.filter((candidate) => candidate !== useCase)
      : [...state.draft.useCaseTags, useCase];
    edit({ useCaseTags });
  }

  function editConfig(patch: Partial<FoundryBuildConfig>, actorId: "aisha" | "kenji") {
    onAction({ type: "EDIT_CONFIGURATION", actorId, kind: "HUMAN", buildConfig: { ...state.buildConfig, ...patch } });
  }

  function editCapabilityPin(id: string, version: string) {
    editConfig({ capabilityPins: state.buildConfig.capabilityPins.map((pin) => pin.id === id ? { ...pin, version } : pin) }, "kenji");
  }

  return (
    <div className="foundry-stack">
      <Panel className="foundry-card" id="foundry-demo-brief" role="group" aria-label="Demo Brief" tabIndex={-1}>
        <SectionHeading
          icon={Sparkles}
          eyebrow="01 · Demo Brief"
          title="One fictional renewal-and-expansion story"
          description="Sofia Reyes is the fictional requesting SE. Every control is enumerated; there is no free-text, file, record, or connection input."
          action={<StatusPill tone="amethyst">REQUESTER · SOFIA</StatusPill>}
        />

        <fieldset className="foundry-mode-picker" disabled={!editable}>
          <legend>Safe source mode</legend>
          <label className={state.draft.sourceMode === "TEMPLATE_FIRST" ? "foundry-choice foundry-choice--selected" : "foundry-choice"}>
            <input type="radio" name="foundry-source-mode" value="TEMPLATE_FIRST" checked={state.draft.sourceMode === "TEMPLATE_FIRST"} onChange={() => edit({ sourceMode: "TEMPLATE_FIRST" })} />
            <span><strong>Template-first</strong><small>Use the reviewed fictional revenue template as-is.</small></span>
          </label>
          <label className={state.draft.sourceMode === "SAFE_PATTERN_ASSISTED" ? "foundry-choice foundry-choice--selected" : "foundry-choice"}>
            <input type="radio" name="foundry-source-mode" value="SAFE_PATTERN_ASSISTED" checked={state.draft.sourceMode === "SAFE_PATTERN_ASSISTED"} onChange={() => edit({ sourceMode: "SAFE_PATTERN_ASSISTED" })} />
            <span><strong>Safe-pattern-assisted</strong><small>Use only the same coarse allowlisted fields; no model call occurs.</small></span>
          </label>
        </fieldset>

        <div className="foundry-form-grid">
          <label htmlFor="foundry-audience"><span>Demo audience</span><select id="foundry-audience" value={state.draft.demoAudience} disabled={!editable} onChange={(event) => edit({ demoAudience: event.target.value as SafeDemoSignalInput["demoAudience"] })}><option value="ACCOUNT_TEAM">Account team</option><option value="EXECUTIVE_REVIEW">Executive review</option></select></label>
          <label htmlFor="foundry-size"><span>Broad organization-size band</span><select id="foundry-size" value={state.draft.organizationSizeBand} disabled={!editable} onChange={(event) => edit({ organizationSizeBand: event.target.value as SafeDemoSignalInput["organizationSizeBand"] })}><option value="MID_MARKET">Mid-market</option><option value="ENTERPRISE">Enterprise</option></select></label>
          <label htmlFor="foundry-region"><span>Supported region / locale preset</span><select id="foundry-region" value={state.draft.geographicRegion} disabled={!editable} onChange={(event) => event.target.value === "EUROPE" ? edit({ geographicRegion: "EUROPE", locale: "en-GB", timeZone: "Europe/London" }) : edit({ geographicRegion: "NORTH_AMERICA", locale: "en-US", timeZone: "America/New_York" })}><option value="NORTH_AMERICA">North America → en-US · America/New_York</option><option value="EUROPE">Europe → en-GB · Europe/London</option></select></label>
          <div className="foundry-readonly-field"><span>Locale</span><strong>{state.draft.locale} · bound to supported region preset</strong></div>
          <div className="foundry-readonly-field"><span>Time zone</span><strong>{state.draft.timeZone} · bound to supported region preset</strong></div>
          <label htmlFor="foundry-scale"><span>Broad record-volume band</span><select id="foundry-scale" value={state.draft.recordVolumeBand} disabled={!editable} onChange={(event) => edit({ recordVolumeBand: event.target.value as SafeDemoSignalInput["recordVolumeBand"] })}><option value="SMALL">Small → compact</option><option value="MEDIUM">Medium → standard</option></select></label>
          <label htmlFor="foundry-cycle"><span>Broad sales-cycle band</span><select id="foundry-cycle" value={state.draft.salesCycleBand} disabled={!editable} onChange={(event) => edit({ salesCycleBand: event.target.value as SafeDemoSignalInput["salesCycleBand"] })}><option value="QUARTER">Quarter</option><option value="HALF_YEAR">Half year</option></select></label>
          <label htmlFor="foundry-value"><span>Broad value band</span><select id="foundry-value" value={state.draft.valueBand} disabled={!editable} onChange={(event) => edit({ valueBand: event.target.value as SafeDemoSignalInput["valueBand"] })}><option value="MID_VALUE">Mid value</option><option value="STRATEGIC">Strategic</option></select></label>
          <label htmlFor="foundry-ttl"><span>Pack expiration</span><select id="foundry-ttl" value={state.draft.ttlHours} disabled={!editable} onChange={(event) => edit({ ttlHours: Number(event.target.value) as 4 | 8 })}><option value={4}>4 hours</option><option value={8}>8 hours</option></select></label>
          <label htmlFor="foundry-seed"><span>Deterministic seed</span><select id="foundry-seed" value={state.draft.seed} disabled={!editable} onChange={(event) => edit({ seed: Number(event.target.value) })}><option value={731204}>731204 · default rehearsal</option><option value={271828}>271828 · alternate identities</option></select></label>
          <div className="foundry-readonly-field"><span>Industry archetype</span><strong>B2B software · authored fictional template</strong></div>
        </div>

        <div className="foundry-check-groups">
          <fieldset disabled><legend>Required object families · fixed golden slice</legend>{(Object.keys(OBJECT_FAMILY_LABELS) as ObjectFamily[]).map((family) => <label key={family}><input type="checkbox" checked readOnly /><span>{OBJECT_FAMILY_LABELS[family]}</span></label>)}</fieldset>
          <fieldset disabled={!editable}><legend>Desired demo moments</legend>{(Object.keys(USE_CASE_LABELS) as UseCaseTag[]).map((useCase) => { const selected = state.draft.useCaseTags.includes(useCase); return <label key={useCase}><input type="checkbox" checked={selected} disabled={selected && state.draft.useCaseTags.length === 1} onChange={() => toggleUseCase(useCase)} /><span>{USE_CASE_LABELS[useCase]}</span></label>; })}</fieldset>
          <fieldset disabled><legend>Required edge cases · fixed golden slice</legend>{(Object.keys(EDGE_CASE_LABELS) as EdgeCase[]).map((edgeCase) => <label key={edgeCase}><input type="checkbox" checked readOnly /><span>{EDGE_CASE_LABELS[edgeCase]}</span></label>)}</fieldset>
        </div>

        <div className="foundry-fixed-story" role="note"><BookOpenCheck size={16} aria-hidden="true" /><div><strong>Fixed story and lifecycle · authored fictional template</strong><p>Goals: {state.draft.scenarioGoals.map(humanize).join(" · ")} · stages: {state.draft.lifecycleStages.map(humanize).join(" · ")} · motion: {humanize(state.draft.salesMotion)}. Phase 3B intentionally provides no second industry or free-form narrative generator.</p></div></div>

        <details className="foundry-configuration">
          <summary>Inspect human-owned reviewed versions and pins</summary>
          <div className="foundry-form-grid">
            <label htmlFor="foundry-policy-version"><span>Context policy version · Privacy owner</span><select id="foundry-policy-version" value={state.buildConfig.policyVersion} disabled={!editable} onChange={(event) => editConfig({ policyVersion: event.target.value as FoundryBuildConfig["policyVersion"] }, "aisha")}><option value="context-firewall:v1">context-firewall:v1</option><option value="context-firewall:v1-reviewed">context-firewall:v1-reviewed</option></select></label>
            <label htmlFor="foundry-template-version"><span>Template version · Product liaison</span><select id="foundry-template-version" value={state.buildConfig.templateVersion} disabled={!editable} onChange={(event) => editConfig({ templateVersion: event.target.value as FoundryBuildConfig["templateVersion"] }, "kenji")}><option value="revenue-renewal:v1">revenue-renewal:v1</option><option value="revenue-renewal:v1-reviewed">revenue-renewal:v1-reviewed</option></select></label>
            <label htmlFor="foundry-generator-version"><span>Generator version · Product liaison</span><select id="foundry-generator-version" value={state.buildConfig.generatorVersion} disabled={!editable} onChange={(event) => editConfig({ generatorVersion: event.target.value as FoundryBuildConfig["generatorVersion"] }, "kenji")}><option value="scenario-generator:v1">scenario-generator:v1</option><option value="scenario-generator:v1-reviewed">scenario-generator:v1-reviewed</option></select></label>
            {state.buildConfig.capabilityPins.map((pin) => pin.kind === "CAPABILITY"
              ? <div className="foundry-readonly-field" key={pin.id}><span>Public capability context pin · {pin.id}</span><strong>{pin.version} · fixed public reference</strong></div>
              : <label key={pin.id} htmlFor="foundry-pin-runbook"><span>Reviewed baseline runbook pin · Product liaison</span><select id="foundry-pin-runbook" value={pin.version} disabled={!editable} onChange={(event) => editCapabilityPin(pin.id, event.target.value)}><option value="runbook:model-access:v1">runbook:model-access:v1</option><option value="runbook:model-access:v2">runbook:model-access:v2</option></select></label>)}
          </div>
          <p><ShieldCheck size={14} aria-hidden="true" /> Fictional privacy reviewer Aisha owns policy changes; fictional product liaison Kenji owns reviewed template, generator, and baseline-pin changes. Any edit returns the run to DRAFT and removes all descendant artifacts. Maya cannot alter these controls.</p>
        </details>

        <div className="foundry-authority-row">
          <div><Users size={16} aria-hidden="true" /><span>Requester</span><strong>Sofia Reyes · fictional SE</strong></div>
          <div><ShieldCheck size={16} aria-hidden="true" /><span>Pack owner</span><strong>Maya Chen · fictional DemoOps administrator</strong></div>
          <div><Clock3 size={16} aria-hidden="true" /><span>Expiration</span><strong>{state.draft.ttlHours} hours after fixed creation time</strong></div>
        </div>
        {state.phase !== "DRAFT" ? <p className="foundry-invalidation-note"><RefreshCw size={15} aria-hidden="true" /> Editing any accepted signal invalidates the receipt, contract, generated world, reports, approval, activation, and readiness. The reducer preserves the rejection audit; it never leaves stale descendants in place.</p> : null}
      </Panel>

      <ContextFirewall state={state} onAction={onAction} />
      <WorldBlueprint state={state} onAction={onAction} />
    </div>
  );
}

function ContextFirewall({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const receipt = state.contextReceipt;
  const rejectedCategories = [
    "Salesforce exports, records, row samples, and uploaded files",
    "Names, emails, phone numbers, addresses, Salesforce IDs, and exact commercial values",
    "Notes, descriptions, transcripts, email content, attachments, and all other free text",
    "Customer-specific fields, formulas, labels, metadata, credentials, tokens, URLs, and connection strings",
    "Unknown keys, nested structures, sparse categories, instructions, HTML, and executable content",
  ] as const;

  return (
    <Panel className="foundry-card" id="foundry-context-firewall" role="group" aria-label="Context Firewall" tabIndex={-1}>
      <SectionHeading
        icon={ShieldCheck}
        eyebrow="02 · Context Firewall"
        title="Accept coarse signals; reject customer-derived payloads"
        description="Strict runtime validation closes the schema to known fields. Rejected categories are recorded without values, hashes, excerpts, or copies."
        action={<StatusPill tone={receipt?.validationOutcome === "ACCEPTED" ? "success" : "warning"}>{receipt ? `${receipt.validationOutcome} RECEIPT` : "NO RECEIPT"}</StatusPill>}
      />
      <div className="foundry-firewall-grid">
        <div className="foundry-safe-lane">
          <h3><CheckCircle2 size={15} aria-hidden="true" /> Safe structured projection</h3>
          <ul>
            <li>Broad archetype, size, region, locale, time zone, motion, audience, scale, cycle, and value bands</li>
            <li>Allowlisted use cases, object families, lifecycle stages, goals, edge cases, owner, TTL, and deterministic seed</li>
            <li>Region and volume are visibly coarsened into policy bands before hashing</li>
          </ul>
        </div>
        <div className="foundry-reject-lane">
          <h3><CircleSlash2 size={15} aria-hidden="true" /> No intake path</h3>
          <ul>{rejectedCategories.map((category) => <li key={category}>{category}</li>)}</ul>
        </div>
      </div>
      <div className="foundry-disposition-legend" aria-label="Context Firewall disposition legend">
        <div><StatusPill tone="success">Accepted unchanged</StatusPill><span>Allowlisted structured fields retained as selected.</span></div>
        <div><StatusPill tone="info">Coarsened into approved band</StatusPill><span>Region and scale mapped to broader policy categories.</span></div>
        <div><StatusPill tone="danger">Rejected by policy</StatusPill><span>Unsafe categories have no accepted schema path; attempted values would not be retained.</span></div>
        <div><StatusPill tone="neutral">Not supplied</StatusPill><span>A required safe category was absent; no value is invented and the receipt fails closed.</span></div>
      </div>

      {receipt ? (
        <div className="foundry-receipt" data-testid="foundry-context-receipt">
          <div className="foundry-receipt__header">
            <div><BadgeCheck size={19} aria-hidden="true" /><div><strong>Safe Context Receipt</strong><code>{receipt.id}</code></div></div>
            <StatusPill tone={receipt.validationOutcome === "ACCEPTED" ? "success" : "danger"}>{receipt.validationOutcome}</StatusPill>
          </div>
          <dl className="foundry-facts">
            <div><dt>Safe projection hash</dt><dd><code>{receipt.acceptedProfileHash ?? "Not created"}</code></dd></div>
            <div><dt>Policy</dt><dd>{receipt.policyVersion}</dd></div>
            <div><dt>Requester</dt><dd>Sofia Reyes · fictional SE</dd></div>
            <div><dt>Purpose</dt><dd>{humanize(receipt.purpose)}</dd></div>
            <div><dt>Pack TTL</dt><dd>{receipt.packTtlHours ? `${receipt.packTtlHours} hours` : "Not accepted"}</dd></div>
            <div><dt>Issued</dt><dd><time dateTime={receipt.at}>{formatInstant(receipt.at)}</time></dd></div>
          </dl>
          <div className="foundry-decision-list" aria-label="Context field decisions">
            {receipt.decisions.map((decision, index) => (
              <div key={`${decision.field}-${index}`}>
                <StatusPill tone={dispositionTone(decision.disposition)}>{humanize(decision.disposition)}</StatusPill>
                <strong>{humanize(decision.field)}</strong>
                <span>{decision.safeValue === undefined ? decision.rejectionCategory ? `Category: ${humanize(decision.rejectionCategory)}` : "No value retained" : formatSafeValue(decision.safeValue)}</span>
              </div>
            ))}
          </div>
          <p className="foundry-receipt-note"><LockKeyhole size={14} aria-hidden="true" /> Receipt contents are limited to the accepted safe projection. Raw rejected values never enter state, messages, hashes, audit reasons, or exports.</p>
        </div>
      ) : (
        <EmptyCausalState icon={Fingerprint} title="No Context Receipt exists" copy="The contract, generated records, reports, approval, activation, and readiness cannot exist before a human issues an accepted safe projection." />
      )}

      <div className="button-row">
        {state.phase === "DRAFT" ? <ActionButton tone="primary" onClick={() => onAction({ type: "ACCEPT_CONTEXT", actorId: "sofia", kind: "HUMAN" })}><ShieldCheck size={15} aria-hidden="true" /> Issue safe Context Receipt</ActionButton> : null}
        {state.phase === "QUARANTINED" ? <ActionButton tone="primary" onClick={() => onAction({ type: "EDIT_SAFE_DRAFT", actorId: "sofia", kind: "HUMAN", draft: state.draft })}><RefreshCw size={15} aria-hidden="true" /> Return to safe structured draft</ActionButton> : null}
      </div>
    </Panel>
  );
}

function WorldBlueprint({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const contract = state.contract;
  return (
    <Panel className="foundry-card" id="foundry-world-blueprint" role="group" aria-label="World Blueprint" tabIndex={-1}>
      <SectionHeading
        icon={GitBranch}
        eyebrow="03 · World Blueprint"
        title="Versioned Synthetic Data Contract"
        description="Every element names its origin. None is customer truth. Canonical serialization gives the complete contract—including its bound lifecycle time—a stable hash."
        action={<StatusPill tone={contract ? "success" : "neutral"}>{contract ? `CONTRACT V${contract.version}` : "NOT CREATED"}</StatusPill>}
      />

      {!contract ? (
        <EmptyCausalState icon={GitBranch} title="No blueprint exists" copy="Compile becomes available only after an accepted Context Receipt. It drafts a bounded contract; it does not generate or validate records." />
      ) : (
        <>
          <div className="foundry-contract-header" data-testid="foundry-contract">
            <div><span>Contract ID</span><code>{contract.id}</code></div>
            <div><span>Contract hash</span><code>{contract.contractHash}</code></div>
            <div><span>Fixed UTC anchor</span><strong>{contract.timelineAnchor}</strong></div>
            <div><span>Generator / template</span><strong>{contract.generatorVersion} · {contract.templateVersion}</strong></div>
          </div>
          <div className="foundry-blueprint-grid">
            <article>
              <h3><Network size={15} aria-hidden="true" /> Entity graph and bounds</h3>
              <div className="foundry-entity-graph" aria-label="Synthetic entity relationship graph">
                {contract.entityCountBounds.map((bound) => <div key={bound.object}><strong>{OBJECT_FAMILY_LABELS[bound.object]}</strong><span>{bound.minimum}–{bound.maximum} records</span></div>)}
              </div>
              <ul>{contract.requiredRelationships.map((relationship) => <li key={`${relationship.child}-${relationship.parent}`}>{OBJECT_FAMILY_LABELS[relationship.child]} → {OBJECT_FAMILY_LABELS[relationship.parent]} through <code>{relationship.foreignKey}</code></li>)}</ul>
            </article>
            <article>
              <h3><BookOpenCheck size={15} aria-hidden="true" /> Story constraints</h3>
              <ul>{contract.storyBeats.map((beat) => <li key={beat}>{beat}</li>)}</ul>
              <p><strong>Edge cases:</strong> {contract.knownEdgeCases.map((edgeCase) => EDGE_CASE_LABELS[edgeCase]).join(" · ")}</p>
            </article>
            <article>
              <h3><Clock3 size={15} aria-hidden="true" /> Timeline and correlations</h3>
              <p><strong>UTC anchor:</strong> <time dateTime={contract.timelineAnchor}>{formatInstant(contract.timelineAnchor)}</time></p>
              <ul>{contract.distributionTargets.map((target) => <li key={target}>{target}</li>)}</ul>
            </article>
            <article>
              <h3><Users size={15} aria-hidden="true" /> Fictional personas in the contract</h3>
              <ul>{contract.personaPermissionModel.map((permission) => <li key={permission.personaId}><strong>{permission.label}</strong> · {humanize(permission.recordScope)} · {permission.allowedActions.map(humanize).join(" / ")}</li>)}</ul>
            </article>
            <article>
              <h3><KeyRound size={15} aria-hidden="true" /> Capability and runbook pins</h3>
              <ul>{contract.requiredCapabilityPins.map((pin) => <li key={pin.id}><StatusPill tone="info">{pin.kind}</StatusPill> <code>{pin.id}@{pin.version}</code></li>)}</ul>
              <p>Any relevant version change invalidates readiness and requires new evidence plus two human decisions.</p>
            </article>
            <article>
              <h3><ShieldCheck size={15} aria-hidden="true" /> Expected validation gates</h3>
              <ul>{contract.expectedValidationGates.map((gate) => <li key={gate}>{gate}</li>)}</ul>
            </article>
          </div>
          <details className="foundry-origin-ledger">
            <summary>Inspect element-origin ledger</summary>
            <div>{Object.entries(contract.elementOrigins).map(([element, origin]) => <p key={element}><code>{element}</code><TruthOrigin origin={origin} /></p>)}</div>
          </details>
          <p className="foundry-receipt-note"><Fingerprint size={14} aria-hidden="true" /> Seed {contract.deterministicSeed} · expires <time dateTime={contract.expirationPolicy.expiresAt}>{formatInstant(contract.expirationPolicy.expiresAt)}</time> · {contract.forbiddenContent.length} forbidden-content categories bound into the contract.</p>
        </>
      )}
      <div className="button-row">
        {state.phase === "INTAKE_ACCEPTED" ? <ActionButton tone="primary" onClick={() => onAction({ type: "COMPILE_CONTRACT", actorId: "agent-demo-preflight", kind: "AGENT" })}><GitBranch size={15} aria-hidden="true" /> Compile versioned contract</ActionButton> : null}
      </div>
    </Panel>
  );
}

function ValidateView({
  state,
  previewPersona,
  onPreviewPersona,
  onAction,
}: {
  state: ScenarioFoundryState;
  previewPersona: ScenarioPersonaId;
  onPreviewPersona: (persona: ScenarioPersonaId) => void;
  onAction: FoundryUiActionHandler;
}) {
  const preview = useMemo(() => state.world ? personaView(state.world, previewPersona) : null, [state.world, previewPersona]);
  return (
    <div className="foundry-stack">
      <GeneratedWorld state={state} onAction={onAction} />
      <ValidationReports state={state} onAction={onAction} />
      <Panel className="foundry-card" id="foundry-persona-preview" tabIndex={-1}>
        <SectionHeading
          icon={Eye}
          eyebrow="06 · Persona Preview"
          title="Permissions belong inside the world"
          description="Switch fictional training personas to inspect positive and negative permissions. This is not a production RBAC claim."
          action={<StatusPill tone={preview ? "info" : "neutral"}>{preview ? "SCOPED VIEW" : "NO WORLD"}</StatusPill>}
        />
        {!preview ? <EmptyCausalState icon={Eye} title="No persona projection exists" copy="A generated world must exist before a permission-aware preview can be derived." /> : (
          <>
            <label className="foundry-persona-select" htmlFor="foundry-persona">
              <span>Active fictional persona</span>
              <select id="foundry-persona" value={previewPersona} onChange={(event) => onPreviewPersona(event.target.value as ScenarioPersonaId)}>
                {(Object.keys(PERSONA_LABELS) as ScenarioPersonaId[]).map((persona) => <option value={persona} key={persona}>{PERSONA_LABELS[persona]}</option>)}
              </select>
            </label>
            <div className="foundry-permission-grid" data-testid="foundry-persona-projection">
              <article><span>Object access</span><strong>{preview.persona.objectAccess.length ? preview.persona.objectAccess.map(humanize).join(" · ") : "No record objects"}</strong><small>Scope: {humanize(preview.persona.recordScope)}</small></article>
              <article><span>Records visible</span><strong>{Object.values(preview.records).reduce((total, records) => total + (records?.length ?? 0), 0)}</strong><small>Derived through the permission evaluator</small></article>
              <article><span>Hidden fields</span><strong>{preview.hiddenFieldNames.length ? preview.hiddenFieldNames.join(" · ") : "None for this fictional role"}</strong><small>Hidden means omitted, not visually obscured</small></article>
              <article><span>Must not disclose</span><strong>{preview.persona.prohibitedDisclosures.length ? preview.persona.prohibitedDisclosures.join(" · ") : "No additional fact codes"}</strong><small>Oracle tests these negative boundaries</small></article>
            </div>
            <div className="foundry-action-boundary">
              <div><CheckCircle2 size={16} aria-hidden="true" /><div><strong>Allowed actions</strong><p>{preview.allowedActions.length ? preview.allowedActions.map(humanize).join(" · ") : "None"}</p></div></div>
              <div><LockKeyhole size={16} aria-hidden="true" /><div><strong>Blocked actions</strong><p>{preview.blockedActions.length ? preview.blockedActions.map(humanize).join(" · ") : "None"}</p></div></div>
              <div><ShieldCheck size={16} aria-hidden="true" /><div><strong>Human approval required</strong><p>{preview.persona.approvalRequiredActions.length ? preview.persona.approvalRequiredActions.map(humanize).join(" · ") : "No additional approvals for this role"}</p></div></div>
            </div>
            <details className="foundry-visible-records">
              <summary>Inspect visible synthetic record IDs</summary>
              <dl>{Object.entries(preview.records).map(([object, records]) => <div key={object}><dt>{humanize(object)}</dt><dd>{records?.length ? records.map(projectedRecordLabel).join(" · ") : "No visible records"}</dd></div>)}</dl>
            </details>
          </>
        )}
      </Panel>
    </div>
  );
}

function GeneratedWorld({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const world = state.world;
  if (!world) {
    return (
      <Panel className="foundry-card" id="foundry-generated-world" role="group" aria-label="Generated World" tabIndex={-1}>
        <SectionHeading icon={Database} eyebrow="04 · Generated World" title="Salesforce-shaped fictional enterprise" description="Generation is deterministic and bounded. It does not imply privacy validation, quality validation, approval, activation, or readiness." action={<StatusPill tone="neutral">NOT GENERATED</StatusPill>} />
        <EmptyCausalState icon={Database} title="No generated records exist" copy={state.contract ? "The reviewed contract is ready for deterministic generation." : "A safe receipt and compiled contract must exist before generation."} />
        {state.phase === "BLUEPRINTED" ? <div className="button-row"><ActionButton tone="primary" onClick={() => onAction({ type: "GENERATE_WORLD", actorId: "agent-demo-preflight", kind: "AGENT" })}><Sparkles size={15} aria-hidden="true" /> Generate deterministic world</ActionButton></div> : null}
      </Panel>
    );
  }

  const counts = world.records;
  const chronologicalActivities = [...counts.activities].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  return (
    <Panel className="foundry-card foundry-world" id="foundry-generated-world" role="group" aria-label="Generated World" tabIndex={-1} data-testid="foundry-generated-world">
      <div className="foundry-watermark" role="note"><Fingerprint size={14} aria-hidden="true" /> SYNTHETIC REVENUE WORLD · NO SALESFORCE CONNECTION OR CUSTOMER DATA</div>
      <SectionHeading
        icon={Database}
        eyebrow="04 · Generated World"
        title="A causally coherent fictional enterprise"
        description="One renewal, one expansion, an unresolved security concern, conflicting signals, activity gaps, stale fields, and permission restrictions share one inspectable record graph."
        action={<StatusPill tone="amethyst">SYNTHETIC</StatusPill>}
      />
      <div className="foundry-world-summary">
        <div><span>Accounts</span><strong>{counts.accounts.length}</strong></div>
        <div><span>Contacts</span><strong>{counts.contacts.length}</strong></div>
        <div><span>Opportunities</span><strong>{counts.opportunities.length}</strong></div>
        <div><span>Cases</span><strong>{counts.cases.length}</strong></div>
        <div><span>Activities</span><strong>{counts.activities.length}</strong></div>
        <div><span>Output hash</span><code>{world.outputHash}</code></div>
      </div>

      <div className="foundry-world-story">
        <article><StatusPill tone="warning">RENEWAL RISK</StatusPill><h3>Deteriorating renewal signals</h3><p>Recent activity is sparse, next-step data is missing, and an unresolved synthetic security concern conflicts with a positive stakeholder signal.</p></article>
        <article><StatusPill tone="success">EXPANSION</StatusPill><h3>Plausible adjacent opportunity</h3><p>The expansion follows an established fictional customer relationship and shares stakeholders without erasing the renewal risk.</p></article>
        <article><StatusPill tone="info">PERMISSION BOUNDARY</StatusPill><h3>Governed update</h3><p>The synthetic seller may update an allowed next step. The restricted viewer may not see or perform the same action.</p></article>
      </div>

      <div className="foundry-record-tables">
        <RecordTable title="Accounts" count={counts.accounts.length}>
          <table><caption>Synthetic accounts and reconciled opportunity rollups</caption><thead><tr><th scope="col">ID</th><th scope="col">Fictional name</th><th scope="col">Region</th><th scope="col">Customer since</th><th scope="col">Open pipeline</th><th scope="col">Open opportunities</th></tr></thead><tbody>{counts.accounts.map((record) => <tr key={record.id}><td><code>{record.id}</code></td><td>{record.name}</td><td>{record.region}</td><td>{record.customerSince}</td><td>{humanize(record.openPipelineValueBand)}</td><td>{record.openOpportunityCount}</td></tr>)}</tbody></table>
        </RecordTable>
        <RecordTable title="Contacts" count={counts.contacts.length}>
          <table><caption>Synthetic contacts with non-routable contact values</caption><thead><tr><th scope="col">ID</th><th scope="col">Account</th><th scope="col">Fictional name</th><th scope="col">Role</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Restriction</th></tr></thead><tbody>{counts.contacts.map((record) => <tr key={record.id}><td><code>{record.id}</code></td><td><code>{record.accountId}</code></td><td>{record.fullName}</td><td>{record.role}</td><td>{record.email}</td><td>{record.phone}</td><td>{record.restricted ? "Restricted synthetic record" : "Standard synthetic record"}</td></tr>)}</tbody></table>
        </RecordTable>
        <RecordTable title="Opportunities" count={counts.opportunities.length}>
          <table><caption>Synthetic opportunity chronology, stage constraints, and conflicting risk signals</caption><thead><tr><th scope="col">ID</th><th scope="col">Account</th><th scope="col">Motion</th><th scope="col">Stage</th><th scope="col">Probability</th><th scope="col">Value band</th><th scope="col">Close date</th><th scope="col">Next step</th><th scope="col">Security</th></tr></thead><tbody>{counts.opportunities.map((record) => <tr key={record.id}><td><code>{record.id}</code></td><td><code>{record.accountId}</code></td><td>{record.kind}</td><td>{record.stage}</td><td>{record.probabilityPercent}%</td><td>{humanize(record.valueBand)}</td><td>{record.closeDate}</td><td>{record.nextStep ?? "Missing · intentional edge case"}</td><td>{humanize(record.securityRisk)}</td></tr>)}</tbody></table>
        </RecordTable>
        <RecordTable title="Cases" count={counts.cases.length}>
          <table><caption>Synthetic support and security cases with plausible open and resolution timelines</caption><thead><tr><th scope="col">ID</th><th scope="col">Account</th><th scope="col">Opportunity</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Severity</th><th scope="col">Opened</th><th scope="col">Resolved</th><th scope="col">Restriction</th></tr></thead><tbody>{counts.cases.map((record) => <tr key={record.id}><td><code>{record.id}</code></td><td><code>{record.accountId}</code></td><td><code>{record.opportunityId ?? "None"}</code></td><td>{record.kind}</td><td>{record.status}</td><td>{record.severity}</td><td>{record.openedAt}</td><td>{record.resolvedAt ?? "Open"}</td><td>{record.restricted ? "Restricted synthetic record" : "Standard synthetic record"}</td></tr>)}</tbody></table>
        </RecordTable>
      </div>

      <div className="foundry-timeline" aria-label="Synthetic activity timeline">
        <h3><Clock3 size={15} aria-hidden="true" /> Relationship and activity chronology</h3>
        {chronologicalActivities.map((activity) => <div key={activity.id}><time dateTime={activity.occurredAt}>{formatInstant(activity.occurredAt)}</time><StatusPill tone={activity.signal === "POSITIVE" ? "success" : activity.signal === "NEGATIVE" ? "warning" : "neutral"}>{activity.signal}</StatusPill><div><strong>{humanize(activity.kind)}</strong><span>{humanize(activity.summaryCode)} · <code>{activity.id}</code></span></div></div>)}
      </div>
    </Panel>
  );
}

function ValidationReports({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const privacy = state.privacyReport;
  const quality = state.qualityReport;
  const failed = privacy?.outcome === "FAIL" || quality?.outcome === "FAIL" || state.phase === "QUARANTINED";
  return (
    <Panel className="foundry-card" id="foundry-privacy-quality" role="group" aria-label="Privacy and Quality" tabIndex={-1}>
      <SectionHeading
        icon={FileCheck2}
        eyebrow="05 · Privacy and Quality"
        title="Evidence before review"
        description="Each gate binds the exact generation run and returns explainable checks. A failure quarantines the pack and creates no approval, activation, or readiness artifact."
        action={<StatusPill tone={failed ? "danger" : privacy && quality ? "success" : "warning"}>{failed ? "QUARANTINED" : privacy && quality ? "ALL GATES PASS" : "EVIDENCE REQUIRED"}</StatusPill>}
      />
      {!state.world ? <EmptyCausalState icon={FileCheck2} title="No validation target exists" copy="Validation cannot run until the deterministic generator produces a bound output hash." /> : (
        <div className="foundry-report-grid">
          <ValidationReportCard title="Privacy report" report={privacy} empty="No privacy report. Generation alone is not a safety result." />
          <ValidationReportCard title="Quality report" report={quality} empty="No quality report. Privacy validation alone is not a realism result." />
        </div>
      )}
      <div className="button-row">
        {state.phase === "GENERATED" ? <ActionButton tone="primary" onClick={() => onAction({ type: "RUN_PRIVACY_VALIDATION", actorId: "agent-demo-preflight", kind: "AGENT" })}><ShieldCheck size={15} aria-hidden="true" /> Run privacy validators</ActionButton> : null}
        {state.phase === "PRIVACY_VALIDATED" ? <ActionButton tone="primary" onClick={() => onAction({ type: "RUN_QUALITY_VALIDATION", actorId: "agent-demo-preflight", kind: "AGENT" })}><PackageCheck size={15} aria-hidden="true" /> Run quality validators</ActionButton> : null}
        {state.phase === "QUALITY_VALIDATED" ? <ActionButton tone="positive" onClick={() => onAction({ type: "SUBMIT_FOR_REVIEW", actorId: "sofia", kind: "HUMAN" })}><ArrowRight size={15} aria-hidden="true" /> Submit pack for independent review</ActionButton> : null}
      </div>
      {state.phase === "REVIEW_REQUIRED" ? <p className="foundry-human-gate"><Users size={15} aria-hidden="true" /> Review is now assigned to Aisha Okafor. Sofia Reyes cannot approve her own pack.</p> : null}
    </Panel>
  );
}

function RehearseView({ state, capabilityChangeAvailable, capabilityChangeApplicable, onAction }: { state: ScenarioFoundryState; capabilityChangeAvailable: boolean; capabilityChangeApplicable: boolean; onAction: FoundryUiActionHandler }) {
  const readiness = scenarioReadiness(state);
  const latestActivation = state.activationReceipts.at(-1);
  const revalidationApproved = Boolean(
    state.revalidationApproval &&
    state.revalidationReport &&
    state.revalidationApproval.reportId === state.revalidationReport.id &&
    state.revalidationApproval.packId === state.packId,
  );
  return (
    <div className="foundry-stack">
      <Panel className="foundry-card" id="foundry-activation" role="group" aria-label="Pack Review and Activation" tabIndex={-1}>
        <SectionHeading
          icon={Users}
          eyebrow="07 · Human review and activation"
          title="Approval does not imply activation"
          description="The requester, independent reviewer, and DemoOps administrator remain separate fictional actors. No agent can approve or activate a pack."
          action={<StatusPill tone={readinessTone(readiness.state)}>{readiness.state.replaceAll("_", " ")}</StatusPill>}
        />
        <div className="foundry-authority-chain" aria-label="Scenario authority chain">
          <div className={state.contextReceipt ? "is-complete" : ""}><span>01</span><strong>Sofia Reyes</strong><small>Requests and submits · cannot self-approve</small></div>
          <ArrowRight aria-hidden="true" />
          <div className={state.reviewDecision ? "is-complete" : ""}><span>02</span><strong>Aisha Okafor</strong><small>Independent privacy and scenario reviewer</small></div>
          <ArrowRight aria-hidden="true" />
          <div className={latestActivation ? "is-complete" : ""}><span>03</span><strong>Maya Chen</strong><small>Activates one simulated demo session</small></div>
        </div>

        {!state.reviewDecision ? <EmptyCausalState icon={Users} title="No review decision exists" copy={state.phase === "REVIEW_REQUIRED" ? "Both validation reports passed. Aisha may now review the exact bound pack." : "Submission becomes available only after both validators pass."} /> : (
          <div className="foundry-receipt foundry-receipt--compact" data-testid="foundry-review-decision">
            <div className="foundry-receipt__header"><div><BadgeCheck size={18} aria-hidden="true" /><div><strong>Independent pack approval</strong><code>{state.reviewDecision.id}</code></div></div><StatusPill tone="success">APPROVED</StatusPill></div>
            <p>Aisha Okafor approved generation run <code>{state.reviewDecision.generationRunId}</code> after reviewing privacy <code>{shortHash(state.reviewDecision.privacyReportHash)}</code> and quality <code>{shortHash(state.reviewDecision.qualityReportHash)}</code>.</p>
          </div>
        )}

        {latestActivation ? (
          <div className="foundry-receipt foundry-receipt--compact" data-testid="foundry-activation-receipt">
            <div className="foundry-receipt__header"><div><PackageCheck size={18} aria-hidden="true" /><div><strong>One-session activation receipt</strong><code>{latestActivation.id}</code></div></div><StatusPill tone={readiness.ready ? "success" : "warning"}>{readiness.ready ? "READY" : state.phase === "ACTIVE" && !state.stalenessReceipt ? "ACTIVE · EVALUATION REQUIRED" : "HISTORICAL · NOT READY"}</StatusPill></div>
            <p>Actor Maya Chen · output <code>{shortHash(latestActivation.outputHash)}</code> · capability pins {latestActivation.capabilityPins.map((pin) => `${pin.id}@${pin.version}`).join(" · ")}</p>
          </div>
        ) : null}

        <div className="button-row">
          {state.phase === "REVIEW_REQUIRED" ? <ActionButton tone="positive" onClick={() => onAction({ type: "APPROVE_PACK", actorId: "aisha", kind: "HUMAN" })}><BadgeCheck size={15} aria-hidden="true" /> Approve pack as Aisha Okafor</ActionButton> : null}
          {state.phase === "APPROVED" ? <ActionButton tone="primary" onClick={() => onAction({ type: "ACTIVATE_PACK", actorId: "maya", kind: "HUMAN" })}><PlayCircle size={15} aria-hidden="true" /> Activate one demo session</ActionButton> : null}
        </div>
        <p className="foundry-agent-boundary"><LockKeyhole size={15} aria-hidden="true" /> <strong>Agent boundary:</strong> agent-demo-preflight may compile, generate, validate, simulate oracle assertions, and revalidate. It cannot approve, activate, change policy or permissions, access Salesforce, call a model, export automatically, merge, or deploy.</p>
      </Panel>

      <OracleRehearsal state={state} onAction={onAction} />

      <Panel className="foundry-card" id="foundry-staleness" role="group" aria-label="Capability Change and Staleness" tabIndex={-1}>
        <SectionHeading
          icon={RefreshCw}
          eyebrow="08 · Capability-change connection"
          title="A changed capability revokes readiness"
          description="The deterministic event is produced by replaying the existing Phase 3A reducer through human approval and passing v2 evidence. It is not a current product feed or claim about private systems."
          action={<StatusPill tone={state.stalenessReceipt ? "warning" : "neutral"}>{state.stalenessReceipt ? "READINESS REVOKED" : "NO RELEVANT CHANGE"}</StatusPill>}
        />
        {!state.stalenessReceipt ? (
          <EmptyCausalState icon={RefreshCw} title="No staleness evidence exists" copy="An active, evaluated pack remains pinned to its validated capability versions until an authorized version-change event impact-maps the exact pack." />
        ) : (
          <div className="foundry-stale-callout" data-testid="foundry-staleness-receipt">
            <TriangleAlert size={21} aria-hidden="true" />
            <div><strong>Pack is stale; prior readiness is revoked</strong><p><code>{state.stalenessReceipt.id}</code> binds change <code>{state.stalenessReceipt.capabilityChange.changeId}</code>: {state.stalenessReceipt.capabilityChange.capabilityId} {state.stalenessReceipt.capabilityChange.previousVersion} → {state.stalenessReceipt.capabilityChange.nextVersion}.</p><small>Approved upstream by {state.stalenessReceipt.capabilityChange.approvedBy}; impact-mapped locally to {state.packId}. Old activation {state.stalenessReceipt.priorActivationReceiptId} remains historical evidence only.</small></div>
          </div>
        )}
        {state.revalidationMission ? <div className="foundry-mission-card"><StatusPill tone="warning">DRAFT · HUMAN-GOVERNED</StatusPill><h3>Scoped revalidation mission</h3><p><code>{state.revalidationMission.id}</code> · owner Maya Chen · reviewer Aisha Okafor</p><ul>{state.revalidationMission.requiredCapabilityPins.map((pin) => <li key={pin.id}>{pin.id}@{pin.version}</li>)}</ul></div> : null}
        <div className="button-row">
          {state.phase === "ACTIVE" && state.oracleReports.length > 0 && !state.stalenessReceipt && capabilityChangeAvailable && capabilityChangeApplicable ? <ActionButton tone="primary" onClick={() => onAction({ type: "APPLY_VERIFIED_CAPABILITY_CHANGE", actorId: "scenario-foundry-system", kind: "SYSTEM" })}><RefreshCw size={15} aria-hidden="true" /> Apply capability v2 change</ActionButton> : null}
        </div>
        {state.phase === "ACTIVE" && state.oracleReports.length > 0 && !capabilityChangeAvailable ? <p className="foundry-human-gate"><LockKeyhole size={15} aria-hidden="true" /> Capability-change control is unavailable because independently verified Phase 3A rehearsal lineage was not supplied.</p> : null}
        {state.phase === "ACTIVE" && state.oracleReports.length > 0 && capabilityChangeAvailable && !capabilityChangeApplicable ? <p className="foundry-human-gate"><LockKeyhole size={15} aria-hidden="true" /> This pack is not pinned to the demonstrated prior version, so the v1-to-v2 change cannot be impact-mapped to it.</p> : null}
      </Panel>

      <Panel className="foundry-card" id="foundry-revalidation" role="group" aria-label="Scoped Revalidation" tabIndex={-1}>
        <SectionHeading
          icon={BookOpenCheck}
          eyebrow="09 · Revalidation"
          title="New evidence, new approval, new activation"
          description="The same oracle and validators rerun against the changed pin. Passing evidence is necessary, but only humans may approve and restore readiness."
          action={<StatusPill tone={state.revalidationReport?.outcome === "PASS" ? "success" : state.stalenessReceipt ? "warning" : "neutral"}>{state.revalidationReport ? `${state.revalidationReport.outcome} REPORT` : "NOT RUN"}</StatusPill>}
        />
        {!state.stalenessReceipt ? <EmptyCausalState icon={BookOpenCheck} title="Revalidation is not required" copy="A scoped mission and report may not appear before an impact-mapped capability change makes the pack stale." /> : state.revalidationReport ? (
          <div className="foundry-report-card">
            <div><StatusPill tone={state.revalidationReport.outcome === "PASS" ? "success" : "danger"}>{state.revalidationReport.outcome}</StatusPill><strong>Bound revalidation report</strong><code>{state.revalidationReport.id}</code></div>
            <p>Current simulated oracle evidence: <code>{state.revalidationReport.oracleReportId}</code>. Earlier oracle receipts remain historical and cannot certify the new capability pin.</p>
            <ul>{state.revalidationReport.checks.map((check) => <li key={check.id}><span>{check.outcome === "PASS" ? <CheckCircle2 size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}<strong>{check.outcome}</strong></span><p>{check.evidence}</p></li>)}</ul>
          </div>
        ) : <EmptyCausalState icon={BookOpenCheck} title="No replacement evidence exists" copy="The stale pack remains unavailable for a ready demo until the scoped deterministic checks run." />}
        {state.revalidationApproval ? <div className="foundry-receipt foundry-receipt--compact" data-testid="foundry-revalidation-approval"><div className="foundry-receipt__header"><div><BadgeCheck size={18} aria-hidden="true" /><div><strong>Bound revalidation approval</strong><code>{state.revalidationApproval.id}</code></div></div><StatusPill tone="success">APPROVED BY AISHA</StatusPill></div><p>Report <code>{state.revalidationApproval.reportId}</code> · pack <code>{state.revalidationApproval.packId}</code> · <time dateTime={state.revalidationApproval.at}>{formatInstant(state.revalidationApproval.at)}</time></p></div> : null}
        <div className="button-row">
          {state.phase === "STALE_REVALIDATION_REQUIRED" && !state.revalidationReport ? <ActionButton tone="primary" onClick={() => onAction({ type: "RUN_REVALIDATION", actorId: "agent-demo-preflight", kind: "AGENT" })}><PlayCircle size={15} aria-hidden="true" /> Run scoped revalidation</ActionButton> : null}
          {state.phase === "REVALIDATED" && !revalidationApproved ? <ActionButton tone="positive" onClick={() => onAction({ type: "APPROVE_REVALIDATION", actorId: "aisha", kind: "HUMAN" })}><BadgeCheck size={15} aria-hidden="true" /> Approve revalidation evidence</ActionButton> : null}
          {state.phase === "REVALIDATED" && revalidationApproved ? <ActionButton tone="primary" onClick={() => onAction({ type: "REACTIVATE_PACK", actorId: "maya", kind: "HUMAN" })}><PackageCheck size={15} aria-hidden="true" /> Restore readiness</ActionButton> : null}
        </div>
      </Panel>

      <LifecycleControls state={state} onAction={onAction} />
    </div>
  );
}

function OracleRehearsal({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const world = state.world;
  const report = state.oracleReports.at(-1);
  return (
    <Panel className="foundry-card" id="foundry-oracle" role="group" aria-label="Known-answer Oracle" tabIndex={-1}>
      <SectionHeading
        icon={Boxes}
        eyebrow="Claudeforce Readiness Rehearsal · public product context only"
        title="Known-answer oracle"
        description="Fact-and-authority assertions cover the publicly described categories: meeting preparation, deal-health review, pipeline review, and one governed update. No actual Claude response is produced."
        action={<StatusPill tone={report?.outcome === "PASS" ? "success" : "warning"}>SIMULATED EVALUATION{report ? ` · ${report.outcome}` : " · NOT RUN"}</StatusPill>}
      />
      {!world ? <EmptyCausalState icon={Boxes} title="No oracle fixture exists" copy="The oracle is generated with—and hash-bound to—the synthetic world. It cannot exist independently." /> : (
        <div className="foundry-oracle-grid">
          {world.oracle.assertions.map((assertion) => {
            const result = report?.results.find((candidate) => candidate.assertionId === assertion.id);
            return (
              <article key={assertion.id}>
                <div className="foundry-oracle-card__header"><StatusPill tone="warning">SIMULATED EVALUATION</StatusPill><StatusPill tone={result?.outcome === "PASS" ? "success" : result ? "danger" : "neutral"}>{result?.outcome ?? "AWAITING RUN"}</StatusPill></div>
                <h3>{humanize(assertion.evaluation)}</h3>
                <p><strong>Active persona:</strong> {PERSONA_LABELS[assertion.activePersonaId]}</p>
                <dl>
                  <div><dt>Fact → synthetic evidence</dt><dd>{assertion.factEvidence.map((binding) => <span key={binding.factCode}><strong>{humanize(binding.factCode)}</strong> → {binding.evidenceRecordIds.map((id) => <code key={id}>{id}</code>)}</span>)}</dd></div>
                  <div><dt>Must not disclose</dt><dd>{assertion.prohibitedFactCodes.length ? assertion.prohibitedFactCodes.map(humanize).join(" · ") : "No additional fact code"}</dd></div>
                  <div><dt>Allowed actions</dt><dd>{assertion.allowedActions.length ? assertion.allowedActions.map(humanize).join(" · ") : "None"}</dd></div>
                  <div><dt>Blocked actions</dt><dd>{assertion.blockedActions.length ? assertion.blockedActions.map(humanize).join(" · ") : "None"}</dd></div>
                  <div><dt>Required transition</dt><dd>{assertion.requiredStateTransition ?? "No mutation required"}</dd></div>
                  <div><dt>Stale/conflict behavior</dt><dd>{assertion.conflictBehavior}</dd></div>
                </dl>
                {result ? <p className="foundry-oracle-result"><CheckCircle2 size={14} aria-hidden="true" /> {result.explanation}</p> : null}
                {result?.simulatedTransitionReceipt ? <div className="foundry-receipt foundry-receipt--compact"><strong>SIMULATED governed-update receipt</strong><code>{result.simulatedTransitionReceipt.id}</code><p>{result.simulatedTransitionReceipt.field}: {String(result.simulatedTransitionReceipt.before)} → {result.simulatedTransitionReceipt.after} · authorized for {PERSONA_LABELS[result.simulatedTransitionReceipt.personaId]} · applied to a copy only; the pack record remains unchanged.</p></div> : null}
              </article>
            );
          })}
        </div>
      )}
      <p className="foundry-no-model"><CircleSlash2 size={14} aria-hidden="true" /> These checks compare synthetic facts, evidence IDs, permissions, and state transitions—not prose. They never call a model and are never presented as actual Claude output.</p>
      <div className="button-row">
        {state.phase === "ACTIVE" && state.oracleReports.length === 0 ? <ActionButton tone="primary" onClick={() => onAction({ type: "RUN_ORACLE_EVALUATIONS", actorId: "agent-demo-preflight", kind: "AGENT" })}><PlayCircle size={15} aria-hidden="true" /> Run four simulated evaluations</ActionButton> : null}
        {state.phase === "ACTIVE" && scenarioReadiness(state).ready && report?.outcome === "PASS" && !state.feedbackCandidate ? <ActionButton onClick={() => onAction({ type: "PROPOSE_TEMPLATE_IMPROVEMENT", actorId: "sofia", kind: "HUMAN", category: "EDGE_CASE_COVERAGE" })}>Record inactive improvement candidate</ActionButton> : null}
      </div>
    </Panel>
  );
}

function LifecycleControls({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const readiness = scenarioReadiness(state);
  const latestReset = state.resetReceipts.at(-1);
  const latestResetValid = Boolean(latestReset && resetReceiptIsValid(state, latestReset));
  const teardownValid = teardownReceiptIsValid(state);
  return (
    <Panel className="foundry-card" id="foundry-lifecycle-controls" role="group" aria-label="Activation Reset Expiration and Teardown" tabIndex={-1}>
      <SectionHeading
        icon={RotateCcw}
        eyebrow="10 · Activation, reset, expiration, and teardown"
        title="The local world has an inspectable end"
        description="Reset, expiration, and teardown are explicit typed transitions. They never rely on storage cleanup, a timer, or an old activation receipt."
        action={<StatusPill tone={state.phase === "DESTROYED" ? "success" : state.phase === "EXPIRED" ? "warning" : "neutral"}>{PHASE_LABELS[state.phase]}</StatusPill>}
      />
      <div className="foundry-lifecycle-grid">
        <article><RotateCcw size={18} aria-hidden="true" /><h3>Reset generated world</h3><p>Rebuild the same byte-identical world from its reviewed contract, seed, generator, and UTC anchor; clear session mutations; emit a passing reset receipt.</p><strong>{latestResetValid ? `Verified · ${latestReset!.id}` : latestReset ? "Receipt present · evidence invalid" : "No reset receipt"}</strong></article>
        <article><Clock3 size={18} aria-hidden="true" /><h3>Expire at TTL boundary</h3><p>Deterministically model expiration. Readiness is revoked; old activation evidence cannot restore the pack.</p><strong>{state.phase === "EXPIRED" ? "Expired · not ready" : `Scheduled by contract · ${state.contract?.expirationPolicy.expiresAt ?? "not compiled"}`}</strong></article>
        <article><Trash2 size={18} aria-hidden="true" /><h3>Verified teardown</h3><p>Remove the generated world from authoritative active state. Repeated teardown is idempotent and preserves bounded final-state and oracle evidence; no secure JavaScript heap-erasure claim is made.</p><strong>{teardownValid ? `Verified · ${state.teardownReceipt!.id}` : state.teardownReceipt ? "Receipt present · evidence invalid" : "No teardown receipt"}</strong></article>
      </div>
      <div className="button-row">
        {state.phase === "ACTIVE" ? <ActionButton onClick={() => onAction({ type: "RESET_WORLD", actorId: "maya", kind: "HUMAN" })}><RotateCcw size={15} aria-hidden="true" /> Reset generated world</ActionButton> : null}
        {state.phase === "ACTIVE" ? <ActionButton tone="quiet" onClick={() => onAction({ type: "EXPIRE_PACK", actorId: "maya", kind: "HUMAN" })}><Clock3 size={15} aria-hidden="true" /> Expire at TTL boundary</ActionButton> : null}
        {state.phase !== "DESTROYED" && state.phase !== "DRAFT" ? <ActionButton tone="danger" onClick={() => onAction({ type: "TEARDOWN_WORLD", actorId: "maya", kind: "HUMAN" })}><Trash2 size={15} aria-hidden="true" /> Verify teardown</ActionButton> : null}
        {state.phase === "DESTROYED" ? <ActionButton tone="quiet" onClick={() => onAction({ type: "TEARDOWN_WORLD", actorId: "maya", kind: "HUMAN" })}><Trash2 size={15} aria-hidden="true" /> Verify teardown again</ActionButton> : null}
        {state.phase === "DESTROYED" && teardownValid && state.teardownReceipt?.oracleOutcome === "PASS" && !state.feedbackCandidate ? <ActionButton onClick={() => onAction({ type: "PROPOSE_TEMPLATE_IMPROVEMENT", actorId: "sofia", kind: "HUMAN", category: "EDGE_CASE_COVERAGE" })}><Sparkles size={15} aria-hidden="true" /> Record inactive post-demo candidate</ActionButton> : null}
        {(state.phase === "DESTROYED" || state.phase === "EXPIRED") ? <ActionButton tone="primary" onClick={() => onAction({ type: "RESTART", actorId: "maya", kind: "HUMAN" })}><RefreshCw size={15} aria-hidden="true" /> Start new pack · retain session audit</ActionButton> : null}
      </div>
      {state.feedbackCandidate ? <p className="foundry-candidate"><Sparkles size={14} aria-hidden="true" /> <strong>PROPOSED · INACTIVE:</strong> {humanize(state.feedbackCandidate.category)} cites {state.feedbackCandidate.sourceReceiptId}. It cannot modify or activate the trusted template.</p> : null}
      <p className="foundry-receipt-note"><ShieldCheck size={14} aria-hidden="true" /> Current readiness: <strong>{readiness.state.replaceAll("_", " ")}</strong> · {readiness.reason}</p>
    </Panel>
  );
}

function GovernanceView({ state, onAction }: { state: ScenarioFoundryState; onAction: FoundryUiActionHandler }) {
  const readiness = scenarioReadiness(state);
  const measurements = scenarioMeasurements(state);
  const provenance = scenarioProvenance(state);
  const world = state.world;
  const contract = state.contract;
  const validResetReceipts = state.resetReceipts.filter((receipt) => resetReceiptIsValid(state, receipt));
  const teardownValid = teardownReceiptIsValid(state);
  const canExport = Boolean(readiness.ready && world && contract && state.privacyReport?.outcome === "PASS" && state.qualityReport?.outcome === "PASS" && state.reviewDecision && state.activationReceipts.length > 0);

  function exportPack() {
    if (!canExport) return;
    const body = `${serializeScenarioExport(state)}\n`;
    const blob = new Blob([body], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${state.packId.replaceAll(":", "-")}.json`;
    link.click();
    URL.revokeObjectURL(href);
    onAction({ type: "MARK_EXPORTED", actorId: "sofia", kind: "HUMAN" });
  }

  const nutritionRows = [
    ["Source mode", provenance.sourceMode.replaceAll("_", " ")],
    ["External connection", "None · no Salesforce connection or production data"],
    ["Accepted signal categories", provenance.acceptedSignalCategories.length ? provenance.acceptedSignalCategories.map(humanize).join(" · ") : "No accepted receipt"],
    ["Contract", provenance.contractVersion && contract ? `v${provenance.contractVersion} · ${contract.id}` : "Not created"],
    ["Template / generator", `${provenance.templateVersion} · ${provenance.generatorVersion}`],
    ["Seed / UTC anchor", `${provenance.seed} · ${provenance.utcAnchor}`],
    ["Synthetic entity counts", provenance.entityCounts ? `${provenance.entityCounts.accounts} accounts · ${provenance.entityCounts.contacts} contacts · ${provenance.entityCounts.opportunities} opportunities · ${provenance.entityCounts.cases} cases · ${provenance.entityCounts.activities} activities` : teardownValid ? "World removed by verified teardown" : state.teardownReceipt ? "World absent · teardown evidence invalid" : "Not generated"],
    ["Capability pins", provenance.capabilityPins.map((pin) => `${pin.id}@${pin.version}`).join(" · ")],
    ["Privacy / integrity", `${provenance.privacyOutcome} · ${provenance.qualityOutcome}`],
    ["Creation / expiration", provenance.createdAt && provenance.expiresAt ? `${formatInstant(provenance.createdAt)} · ${formatInstant(provenance.expiresAt)}` : "Not created"],
    ["Owner / reviewer", "Maya Chen · Aisha Okafor · fictional training roles"],
    ["Export", state.exportStatus === "USER_EXPORTED" ? "User initiated JSON export" : "Not exported"],
    ["Reset / teardown", `${validResetReceipts.length ? `${validResetReceipts.length} verified reset receipt${validResetReceipts.length === 1 ? "" : "s"}` : "No verified reset"} · ${teardownValid ? "Verified destroyed" : state.teardownReceipt ? "Destroyed · evidence invalid" : "Not destroyed"}`],
  ] as const;

  return (
    <div className="foundry-stack">
      <Panel className="foundry-card" id="foundry-provenance" role="group" aria-label="Scenario Provenance" tabIndex={-1}>
        <SectionHeading
          icon={Fingerprint}
          eyebrow="11 · Data nutrition and provenance"
          title="Inspect what this pack is—and is not"
          description="The label reports only evidence available in this browser-memory session. Missing history is never converted into a trend or score."
          action={<StatusPill tone="amethyst">SYNTHETIC</StatusPill>}
        />
        <dl className="foundry-nutrition" data-testid="foundry-provenance-label">
          {nutritionRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          <div><dt>Known limitations</dt><dd>One authored B2B software story; one active pack; browser memory only; deterministic templates; simulated assertions; no model, Salesforce, Slack, shared identity, durable storage, or production RBAC.</dd></div>
        </dl>
        <div className="foundry-export">
          <div><Download size={18} aria-hidden="true" /><div><strong>Explicit canonical JSON export</strong><p>Contains only the safe contract, synthetic records, ground-truth oracle, validation summaries, provenance manifest, and receipt lineage. Its bytes are stable for the same complete bound lifecycle state; rejected input and internal state are excluded.</p></div></div>
          <ActionButton tone="primary" disabled={!canExport} onClick={exportPack}><Download size={15} aria-hidden="true" /> Export reviewed pack (.json)</ActionButton>
          {!canExport ? <small>Export is disabled until a currently ready pack binds generation, passing reports, independent approval, current capability pins, and activation. Historical or stale activation is insufficient.</small> : <small>No automatic download. This button is the only export trigger.</small>}
        </div>
      </Panel>

      <div className="foundry-two-column">
        <Panel className="foundry-card">
          <SectionHeading icon={GitBranch} eyebrow="Causal receipt lineage" title="Every artifact binds its predecessor" description="A missing value means that transition has not occurred." />
          <ol className="foundry-lineage">
            <LineageRow label="requestId" value={state.requestId} />
            <LineageRow label="packId" value={state.packId} />
            <LineageRow label="contextReceiptId" value={state.contextReceipt?.id} />
            <LineageRow label="acceptedProfileHash" value={state.contextReceipt?.acceptedProfileHash} />
            <LineageRow label="contractHash" value={state.contract?.contractHash} />
            <LineageRow label="generationRunId" value={state.world?.generationRunId ?? state.teardownReceipt?.destroyedGenerationRunId} />
            <LineageRow label="outputHash" value={state.world?.outputHash ?? state.teardownReceipt?.destroyedOutputHash} />
            <LineageRow label="privacyReportHash" value={state.privacyReport?.reportHash} />
            <LineageRow label="qualityReportHash" value={state.qualityReport?.reportHash} />
            <LineageRow label="reviewDecisionId" value={state.reviewDecision?.id} />
            <LineageRow label="activationReceiptId" value={state.activationReceipts.at(-1)?.id} />
            <LineageRow label="oracleReportId" value={state.oracleReports.at(-1)?.id ?? state.teardownReceipt?.oracleReportId} />
            <LineageRow label="capabilityChangeId" value={state.stalenessReceipt?.capabilityChange.id} />
            <LineageRow label="capabilityReviewDecisionId" value={state.stalenessReceipt?.capabilityChange.reviewDecisionId} />
            <LineageRow label="capabilityLearningRecordId" value={state.stalenessReceipt?.capabilityChange.learningRecordId} />
            <LineageRow label="stalenessReceiptId" value={state.stalenessReceipt?.id} />
            <LineageRow label="revalidationMissionId" value={state.revalidationMission?.id} />
            <LineageRow label="revalidationReportId" value={state.revalidationReport?.id} />
            <LineageRow label="revalidationApprovalId" value={state.revalidationApproval?.id} />
            <LineageRow label="resetReceiptId" value={state.resetReceipts.at(-1)?.id} />
            <LineageRow label="teardownReceiptId" value={state.teardownReceipt?.id} />
          </ol>
        </Panel>
        <Panel className="foundry-card">
          <SectionHeading icon={PackageCheck} eyebrow="Session evidence only" title="Honest readiness measurements" description="No revenue influence, win rate, time saved, adoption, productivity, customer outcome, trend, or Claudeforce performance is inferred." />
          <div className="foundry-measurements">
            <EvidenceMeasurement label="Privacy gate" value={measurements.privacyGate} />
            <EvidenceMeasurement label="Referential integrity" value={measurements.referentialIntegrity} />
            <EvidenceMeasurement label="Permission boundary" value={measurements.permissionBoundary} />
            <EvidenceMeasurement label="Deterministic replay" value={measurements.deterministicReplay} />
            <EvidenceMeasurement label="Scenario freshness" value={measurements.scenarioFreshness} />
            <EvidenceMeasurement label="Readiness" value={measurements.readiness} />
            <EvidenceMeasurement label="Reset / teardown" value={measurements.resetOrTeardown} />
            <EvidenceMeasurement label="Validated oracle assertions" value={typeof measurements.validatedOracleAssertions === "number" ? String(measurements.validatedOracleAssertions) : measurements.validatedOracleAssertions} />
          </div>
        </Panel>
      </div>

      <Panel className="foundry-card">
        <SectionHeading
          icon={ExternalLink}
          eyebrow="PUBLIC REFERENCE"
          title="Public Claudeforce product context—not private architecture"
          description="Salesforce publicly describes an expanded strategic partnership with Anthropic, Salesforce in Claude, 37 prebuilt sales skills, managed authentication and permissions, Salesforce-enforced business rules, and integrations across Claude, Salesforce, and Slack."
          action={<StatusPill tone="info">PUBLIC REFERENCE</StatusPill>}
        />
        <p className="foundry-public-note">This rehearsal borrows four publicly described skill categories only. It does not imply a merger, internal team structure, roadmap, customer, process, personnel, implementation detail, production access, or connection.</p>
        <a className="source-link" href="https://www.salesforce.com/news/press-releases/2026/08/26/salesforce-and-anthropic-announce-claudeforce/" target="_blank" rel="noreferrer">Read the public Salesforce announcement <ExternalLink size={13} aria-hidden="true" /></a>
      </Panel>

      <Panel className="foundry-card" id="foundry-organizational-reach">
        <SectionHeading icon={Users} eyebrow="Proposed operating model" title="Centralized guardrails, federated authorship" description="This is a proposed collaboration pattern, not a claim about Anthropic. It does not rank or surveil individual SE performance." />
        <div className="foundry-operating-model">
          <OperatingRole owner="DemoOps" responsibility="Guardrails, synthetic environments, evidence receipts, reset, teardown, and reliability" />
          <OperatingRole owner="Solution Engineers" responsibility="Business narrative and desired demo outcome through bounded structured signals" />
          <OperatingRole owner="Product" responsibility="Capability claims and supported version declarations" />
          <OperatingRole owner="Security / Privacy" responsibility="Input policy, prohibited content, and review of data-safety controls" />
          <OperatingRole owner="Legal" responsibility="Names, logos, endorsements, and external claims" />
          <OperatingRole owner="Partner engineering" responsibility="Reviewed joint Salesforce / Claude behavior and adapter boundaries" />
          <OperatingRole owner="Enablement" responsibility="Review and curate reusable scenario packs" />
          <OperatingRole owner="CS and Support" responsibility="Contribute de-identified pattern candidates for separate review—not records" />
        </div>
      </Panel>

      <Panel className="foundry-card">
        <SectionHeading icon={FileCheck2} eyebrow="Authority audit" title="Accepted and rejected typed events" description="The transcript exposes reducer outcomes without hidden reasoning or unsafe payload echoes." />
        {state.audit.length ? <div className="foundry-audit table-scroll" role="region" aria-label="Scenario Foundry reducer audit table" tabIndex={0}><table><caption>Scenario Foundry reducer audit</caption><thead><tr><th scope="col">Event</th><th scope="col">Action</th><th scope="col">Actor</th><th scope="col">Outcome</th><th scope="col">Safe reason code</th><th scope="col">Prior event</th></tr></thead><tbody>{state.audit.map((event) => <tr key={`${event.eventId}-${event.outcome}`}><td><code>{event.eventId}</code></td><td>{humanize(event.type)}</td><td>{event.actor.id} · {event.actor.kind}</td><td><StatusPill tone={event.outcome === "ACCEPTED" ? "success" : "danger"}>{event.outcome}</StatusPill></td><td>{humanize(event.reasonCode)}</td><td><code>{event.priorEventId ?? "Initial event"}</code></td></tr>)}</tbody></table></div> : <EmptyCausalState icon={FileCheck2} title="No causal transcript exists" copy="Audit entries appear only when a typed action is attempted." />}
      </Panel>
    </div>
  );
}

function ValidationReportCard({
  title,
  report,
  empty,
}: {
  title: string;
  report: PrivacyReport | QualityReport | null;
  empty: string;
}) {
  return (
    <article className="foundry-report-card">
      <div>
        <StatusPill tone={report?.outcome === "PASS" ? "success" : report ? "danger" : "neutral"}>{report?.outcome ?? "NOT RUN"}</StatusPill>
        <h3>{title}</h3>
        <code>{report?.id ?? "No receipt"}</code>
      </div>
      {report ? <><ul>{report.checks.map((check) => <li key={check.id}><span>{check.outcome === "PASS" ? <CheckCircle2 size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}<strong>{check.outcome}</strong></span><p>{check.evidence}</p></li>)}</ul><small>Hash <code>{report.reportHash}</code> · actor {report.actor.id} ({report.actor.kind}) · <time dateTime={report.at}>{formatInstant(report.at)}</time></small></> : <p className="empty-inline">{empty}</p>}
    </article>
  );
}

function RecordTable({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details>
      <summary><span>{title}</span><StatusPill tone="amethyst">{count} SYNTHETIC</StatusPill></summary>
      <div className="table-scroll" role="region" aria-label={`${title} synthetic records table`} tabIndex={0}>{children}</div>
    </details>
  );
}

function TruthOrigin({ origin }: { origin: ContractElementOrigin }) {
  const labels: Readonly<Record<ContractElementOrigin, string>> = {
    USER_PROVIDED_SAFE_SIGNAL: "User-provided safe signal",
    POLICY_COARSENED_SIGNAL: "Policy-coarsened signal",
    DETERMINISTICALLY_DERIVED_BLUEPRINT: "Deterministically derived blueprint",
    AUTHORED_FICTIONAL_TEMPLATE: "Authored fictional template",
    CALCULATED_CONSTRAINT: "Calculated constraint",
  };
  const tone: StatusTone = origin === "USER_PROVIDED_SAFE_SIGNAL" ? "info" : origin === "AUTHORED_FICTIONAL_TEMPLATE" ? "amethyst" : origin === "CALCULATED_CONSTRAINT" ? "success" : "neutral";
  return <StatusPill tone={tone}>{labels[origin]}</StatusPill>;
}

function EmptyCausalState({ icon: Icon, title, copy }: { icon: typeof Database; title: string; copy: string }) {
  return <div className="foundry-empty"><Icon size={22} aria-hidden="true" /><div><strong>{title}</strong><p>{copy}</p></div></div>;
}

function LineageRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const present = value !== null && value !== undefined && value !== "";
  return <li className={present ? "is-present" : ""}><span>{label}</span><code>{present ? String(value) : "Not created"}</code><small>{present ? "Evidence exists" : "Awaiting causal transition"}</small></li>;
}

function EvidenceMeasurement({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function OperatingRole({ owner, responsibility }: { owner: string; responsibility: string }) {
  return <article><strong>{owner}</strong><p>{responsibility}</p></article>;
}

function focusTargetForAction(type: FoundryUiCommand["type"], phase: FoundryPhase): string | null {
  if (type === "EDIT_SAFE_DRAFT") return phase === "QUARANTINED" ? "foundry-demo-brief" : null;
  if (type === "EDIT_CONFIGURATION" || type === "PROPOSE_TEMPLATE_IMPROVEMENT" || type === "MARK_EXPORTED") return null;
  if (type === "ACCEPT_CONTEXT") return "foundry-context-firewall";
  if (type === "COMPILE_CONTRACT") return "foundry-world-blueprint";
  if (type === "GENERATE_WORLD") return "foundry-generated-world";
  if (type === "RUN_PRIVACY_VALIDATION" || type === "RUN_QUALITY_VALIDATION" || type === "SUBMIT_FOR_REVIEW") return "foundry-privacy-quality";
  if (type === "APPROVE_PACK" || type === "ACTIVATE_PACK") return "foundry-activation";
  if (type === "RUN_ORACLE_EVALUATIONS") return "foundry-oracle";
  if (type === "APPLY_VERIFIED_CAPABILITY_CHANGE") return "foundry-staleness";
  if (type === "RUN_REVALIDATION" || type === "APPROVE_REVALIDATION" || type === "REACTIVATE_PACK") return "foundry-revalidation";
  if (type === "RESTART") return "foundry-demo-brief";
  return "foundry-lifecycle-controls";
}

function dispositionTone(disposition: ContextDisposition): StatusTone {
  if (disposition === "ACCEPTED_UNCHANGED") return "success";
  if (disposition === "COARSENED_INTO_APPROVED_BAND") return "info";
  if (disposition === "REJECTED_BY_POLICY") return "danger";
  return "neutral";
}

function readinessTone(state: ReturnType<typeof scenarioReadiness>["state"]): StatusTone {
  if (state === "READY") return "success";
  if (state === "STALE" || state === "EXPIRED") return "warning";
  if (state === "QUARANTINED") return "danger";
  return "neutral";
}

function formatSafeValue(value: string | number | readonly string[]): string {
  return Array.isArray(value) ? value.map(humanize).join(" · ") : typeof value === "string" ? humanize(value) : String(value);
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function formatInstant(value: string): string {
  return value.replace("T", " ").replace(".000Z", " UTC");
}

function projectedRecordLabel(record: Readonly<Record<string, unknown>>): string {
  if (typeof record.id === "string") return record.id;
  return Object.entries(record)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
    .join(", ");
}
