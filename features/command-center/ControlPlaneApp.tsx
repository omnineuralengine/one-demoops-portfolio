"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bot,
  BookOpen,
  ClipboardCheck,
  Factory,
  FileText,
  Gauge,
  GitBranch,
  Home,
  Keyboard,
  Radar,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AgentSwarmView } from "@/features/agent-swarm/AgentSwarmView";
import { AiGatewayView } from "@/features/ai-gateway/AiGatewayView";
import { ChangeRadarView } from "@/features/change-radar/ChangeRadarView";
import { createDeterministicLoopAction, type LoopAction } from "@/features/causal-loop";
import { DebriefsView } from "@/features/debriefs/DebriefsView";
import { GlossaryView } from "@/features/glossary/GlossaryView";
import { MissionsView } from "@/features/missions/MissionsView";
import { createVerifiedPhaseThreeCapabilityChange } from "@/features/scenario-foundry";
import { ScenarioFoundryView } from "@/features/scenario-foundry/ScenarioFoundryView";
import { GuidedTour } from "@/features/shell/GuidedTour";
import { TeamOperationsView, type TeamView } from "@/features/team-operations/TeamOperationsView";
import type { PublicChangeEvent, RadarSourceHealth } from "@/lib/change-radar/types";
import { AGENT_OPERATION_CATALOG } from "@/lib/domain/agents";
import type { DemoOpsState, MissionRun } from "@/lib/domain/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { ActionButton } from "@/components/ui/ActionButton";
import { AccessibleTabList } from "@/components/ui/AccessibleTabList";
import { ActiveLoopLedger } from "./ActiveLoopLedger";
import { CommandCenterView, type CommandCenterActions } from "./CommandCenterView";
import { ControlPlaneProvider, useControlPlane } from "./ControlPlaneProvider";

type PlaneView = "command" | "team" | "agents" | "gateway" | "changes" | "missions" | "foundry" | "debriefs" | "glossary";

const views = [
  { id: "command" as const, label: "Command Center", icon: Gauge },
  { id: "agents" as const, label: "Agent Swarm", icon: Bot },
  { id: "gateway" as const, label: "AI Gateway", icon: Route },
  { id: "changes" as const, label: "Change Radar", icon: Radar },
  { id: "missions" as const, label: "Missions", icon: GitBranch },
  { id: "team" as const, label: "Team Operations", icon: Users },
  { id: "debriefs" as const, label: "Debriefs", icon: ClipboardCheck },
  { id: "glossary" as const, label: "Glossary", icon: BookOpen },
  { id: "foundry" as const, label: "Scenario Foundry", icon: Factory },
];

const viewTabs = views.map((view) => ({
  ...view,
  contentId: `plane-panel-${view.id}`,
}));

const viewIds = new Set<PlaneView>(views.map((view) => view.id));

export function ControlPlaneApp({
  initialState,
  liveEvents = [],
  sourceHealth = [],
}: {
  initialState: DemoOpsState;
  liveEvents?: readonly PublicChangeEvent[];
  sourceHealth?: readonly RadarSourceHealth[];
}) {
  return (
    <ControlPlaneProvider
      initialState={initialState}
      publicChanges={liveEvents}
    >
      <ControlPlaneShell
        liveEvents={liveEvents}
        sourceHealth={sourceHealth}
      />
    </ControlPlaneProvider>
  );
}

function ControlPlaneShell({
  liveEvents,
  sourceHealth,
}: {
  liveEvents: readonly PublicChangeEvent[];
  sourceHealth: readonly RadarSourceHealth[];
}) {
  const { state, loop, foundry, readiness, effectiveAccess, dispatch, loopDispatch, foundryDispatch } = useControlPlane();
  const [view, setView] = useState<PlaneView>("command");
  const [teamView, setTeamView] = useState<TeamView>("cockpit");
  const [tourOpen, setTourOpen] = useState(false);
  const [foundryTourRequested, setFoundryTourRequested] = useState(false);
  const [announcement, setAnnouncement] = useState("Command Center selected");
  const foundryCapabilityChange = useMemo(() => createVerifiedPhaseThreeCapabilityChange(), []);

  const applyLoopAction = useCallback((type: LoopAction["type"], actorId: string, kind: "HUMAN" | "AGENT") => {
    loopDispatch(createDeterministicLoopAction(loop, type, actorId, kind));
    if (type === "RESET") {
      setView("changes");
      setTeamView("cockpit");
      setTourOpen(false);
      setAnnouncement("Rehearsal reset; Change Radar selected");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        url.hash = "changes";
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
  }, [loop, loopDispatch]);

  const navigate = useCallback((next: PlaneView) => {
    setView(next);
    const label = views.find((candidate) => candidate.id === next)?.label ?? next;
    setAnnouncement(`${label} selected`);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
    }
  }, []);

  function closeTour() {
    setTourOpen(false);
    const destination = loop.phase === "OBSERVED" ? "changes" : loop.phase === "CLOSED" || loop.phase === "REPLAY_PASSED" ? "command" : "team";
    if (["FIRST_VERIFICATION_FAILED", "RUNBOOK_APPROVED", "REPLAY_FAILED"].includes(loop.phase)) setTeamView("knowledge");
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    url.hash = destination;
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    navigate(destination);
    window.requestAnimationFrame(() => document.getElementById(`plane-panel-${destination}`)?.focus());
  }

  function restartTour() {
    loopDispatch(createDeterministicLoopAction(loop, "RESET", loop.contract.accountableHuman, "HUMAN"));
    setTeamView("cockpit");
    setView("changes");
    setAnnouncement("Journey restarted. All rehearsal decisions and receipts cleared.");
  }

  function startTour() {
    restartTour();
    setTourOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("tour", "1");
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  useEffect(() => {
    function applyLocation() {
      const hash = window.location.hash.slice(1) as PlaneView;
      if (viewIds.has(hash)) {
        setView(hash);
        const label = views.find((candidate) => candidate.id === hash)?.label ?? hash;
        setAnnouncement(`${label} selected`);
      }
      const tour = new URLSearchParams(window.location.search).get("tour");
      if (tour === "foundry") {
        setView("foundry");
        setAnnouncement("Scenario Foundry selected");
      }
      setFoundryTourRequested(tour === "foundry");
      setTourOpen(tour === "1");
    }

    const frame = window.requestAnimationFrame(applyLocation);
    window.addEventListener("hashchange", applyLocation);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", applyLocation);
    };
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (tourOpen) return;
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const index = Number(event.key) - 1;
      const next = views[index];
      if (!next) return;
      event.preventDefault();
      navigate(next.id);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [navigate, tourOpen]);

  const commandActions = useMemo<CommandCenterActions>(() => ({
    injectIncident: (scenarioKey) => dispatch({ type: "INCIDENT_INJECT", scenarioKey, at: actionTime() }),
    runPreflight: (demoId) => dispatch({ type: "PREFLIGHT_RUN", demoId, at: actionTime(), actorId: "human-operator" }),
    investigateIncident: (incidentId, optionId) => dispatch({ type: "INCIDENT_INVESTIGATE", incidentId, optionId, at: actionTime() }),
    diagnoseIncident: (incidentId) => dispatch({ type: "INCIDENT_DIAGNOSE", incidentId, at: actionTime() }),
    proposeRemediation: (incidentId, remediationId) => dispatch({ type: "INCIDENT_REMEDIATION_PROPOSE", incidentId, remediationId, rationale: "The proposed scope matches the diagnosed synthetic failure and keeps blast radius bounded.", at: actionTime() }),
    decideIncidentApproval: (incidentId, approved) => dispatch(approved
      ? { type: "INCIDENT_REMEDIATION_APPROVE", incidentId, approverId: "human-reviewer", rationale: "Approved after reviewing target, reversibility, blast radius, and verification plan.", at: actionTime() }
      : { type: "INCIDENT_REMEDIATION_DENY", incidentId, approverId: "human-reviewer", rationale: "Denied because the proposed synthetic scope needs revision.", at: actionTime() }),
    executeRemediation: (incidentId) => dispatch({ type: "INCIDENT_REMEDIATION_EXECUTE", incidentId, at: actionTime() }),
    verifyIncident: (incidentId) => dispatch({ type: "INCIDENT_VERIFY", incidentId, at: actionTime() }),
    updateAccessRequest: (requestId, operation) => {
      if (operation === "INSPECT") dispatch({ type: "ACCESS_REQUEST_INSPECT", requestId, at: actionTime() });
      if (operation === "REQUEST_APPROVAL") dispatch({ type: "ACCESS_REQUEST_SUBMIT", requestId, at: actionTime() });
      if (operation === "APPROVE") dispatch({ type: "ACCESS_REQUEST_APPROVE", requestId, approverId: "human-reviewer", rationale: "Approved the exact synthetic seat, role, and workspace scope.", at: actionTime() });
      if (operation === "REJECT") dispatch({ type: "ACCESS_REQUEST_DENY", requestId, approverId: "human-reviewer", rationale: "Denied because the request does not meet the current least-privilege case.", at: actionTime() });
      if (operation === "PROCESS") dispatch({ type: "ACCESS_REQUEST_EXECUTE", requestId, at: actionTime() });
    },
  }), [dispatch]);

  const currentContent = (() => {
    if (view === "command") return <><CommandCenterView state={state} readiness={readiness} effectiveAccess={effectiveAccess} actions={commandActions} /><ActiveLoopLedger loop={loop} onAction={applyLoopAction} /></>;
    if (view === "team") return <TeamOperationsView loop={loop} view={teamView} onViewChange={setTeamView} onLoopAction={applyLoopAction} />;
    if (view === "agents") return (
      <AgentSwarmView
        state={state}
        onPropose={(agentId, operation, targetId) => dispatch({ type: "AGENT_ACTION_PROPOSE", agentId, operation, targetId, rationale: `${AGENT_OPERATION_CATALOG[operation].label} is the narrowest next step supported by current synthetic evidence.`, at: actionTime(), actorId: agentId })}
        onApprove={(proposalId) => dispatch({ type: "AGENT_ACTION_APPROVE", proposalId, approverId: "human-reviewer", rationale: "Approved this exact target and operation after reviewing the agent boundary.", at: actionTime() })}
        onDeny={(proposalId) => dispatch({ type: "AGENT_ACTION_DENY", proposalId, approverId: "human-reviewer", rationale: "Denied because a human chose not to expand this proposal into execution.", at: actionTime() })}
        onExecute={(proposalId) => dispatch({ type: "AGENT_ACTION_EXECUTE", proposalId, at: actionTime() })}
        onVerify={(proposalId) => dispatch({ type: "AGENT_ACTION_VERIFY", proposalId, at: actionTime() })}
      />
    );
    if (view === "gateway") return <AiGatewayView state={state} effectiveAccess={effectiveAccess} />;
    if (view === "changes") {
      return (
        <ChangeRadarView
          liveEvents={liveEvents}
          sourceHealth={sourceHealth}
          loop={loop}
          onLoopAction={applyLoopAction}
        />
      );
    }
    if (view === "missions") return (
      <MissionsView
        state={state}
        actions={{
          start: (missionId, mode) => dispatch({ type: "MISSION_START", missionId, mode, at: actionTime() }),
          reset: () => dispatch({ type: "MISSION_RESET", at: actionTime() }),
          exit: () => dispatch({ type: "MISSION_EXIT", at: actionTime() }),
          runCommand: (commandId, rationale) => dispatch({ type: "MISSION_COMMAND_RUN", commandId, rationale, at: actionTime() }),
          updateHypothesis: (patch: Partial<MissionRun["hypothesis"]>) => dispatch({ type: "MISSION_HYPOTHESIS_UPDATE", layer: patch.layer, confidence: patch.confidence, nextTest: patch.nextTest, at: actionTime() }),
          commitHypothesis: (rationale) => dispatch({ type: "MISSION_HYPOTHESIS_COMMIT", rationale, at: actionTime() }),
          proposeRemediation: (remediationId, form) => dispatch({ type: "MISSION_REMEDIATION_PROPOSE", remediationId, ...form, at: actionTime() }),
          decideApproval: (approved, rationale) => dispatch(approved
            ? { type: "MISSION_REMEDIATION_APPROVE", approverId: "human-reviewer", rationale, at: actionTime() }
            : { type: "MISSION_REMEDIATION_DENY", approverId: "human-reviewer", rationale, at: actionTime() }),
          executeRemediation: () => dispatch({ type: "MISSION_REMEDIATION_EXECUTE", at: actionTime() }),
          verify: (rationale) => dispatch({ type: "MISSION_VERIFY", rationale, at: actionTime() }),
          choosePrevention: (preventionId) => dispatch({ type: "MISSION_PREVENTION_SELECT", preventionId, at: actionTime() }),
          fileDebrief: () => { dispatch({ type: "MISSION_DEBRIEF_FILE", at: actionTime() }); navigate("debriefs"); },
        }}
      />
    );
    if (view === "foundry") return (
      <ScenarioFoundryView
        state={foundry}
        dispatch={foundryDispatch}
        capabilityChange={foundryCapabilityChange}
        startTour={foundryTourRequested}
        onTourRequestConsumed={() => setFoundryTourRequested(false)}
      />
    );
    if (view === "debriefs") return <DebriefsView state={state} />;
    return <GlossaryView systems={state.systems} />;
  })();

  return (
    <div className="control-plane">
      <div className="control-plane__topline">
        <div><StatusPill tone="amethyst">Synthetic lab</StatusPill><p>Fictional identities, demos, policy, events, and requests</p></div>
        {!tourOpen ? <><ActionButton compact tone="quiet" onClick={startTour}>Start guided journey</ActionButton><span className="shortcut-hint"><Keyboard size={13} aria-hidden="true" /><kbd>Alt</kbd> + <kbd>1–9</kbd> switches planes</span></> : null}
      </div>

      <nav className="plane-navigation" aria-label="Control plane" hidden={tourOpen}>
        <Link className="plane-navigation__briefing" href="/briefing"><Home size={14} aria-hidden="true" /> Briefing</Link>
        <AccessibleTabList
          ariaLabel="Operational planes"
          className="plane-navigation__tabs"
          idPrefix="plane"
          selected={view}
          tabs={viewTabs}
          onSelect={navigate}
          renderLabel={(item, index) => {
            const Icon = views.find((candidate) => candidate.id === item.id)?.icon ?? Gauge;
            return <><Icon size={14} aria-hidden="true" /> {item.label} <span>{index + 1}</span></>;
          }}
        />
        <span className="plane-navigation__scroll-cue" aria-hidden="true">More&nbsp;→</span>
      </nav>

      {tourOpen ? <GuidedTour loop={loop} onAction={applyLoopAction} onRestart={restartTour} onClose={closeTour} /> : null}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {viewTabs.map((tab) => (
        <div
          key={tab.id}
          id={tab.contentId}
          role="tabpanel"
          aria-labelledby={`plane-tab-${tab.id}`}
          hidden={tourOpen || view !== tab.id}
          tabIndex={!tourOpen && view === tab.id ? 0 : -1}
        >
          {!tourOpen && view === tab.id ? currentContent : null}
        </div>
      ))}

      <div className="lab-disclaimer" role="note">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>Independent, synthetic demonstration built from publicly available information. Not affiliated with Anthropic and not representative of Anthropic’s internal systems or architecture.</span>
        <Link href="/about"><FileText size={13} aria-hidden="true" /> How I built this</Link>
      </div>
    </div>
  );
}

function actionTime(): string {
  return new Date().toISOString();
}
