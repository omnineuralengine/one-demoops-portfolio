"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  KeyRound,
  ListChecks,
  PlugZap,
  Radio,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { BoundedLoops } from "./BoundedLoops";
import type {
  AccessRequestEffect,
  DemoOpsState,
  EffectiveModelAccess,
  Incident,
  ReadinessSummary,
  RemediationOption,
  ScenarioKey,
  SystemHealth,
} from "@/lib/domain/types";

type AccessOperation = "INSPECT" | "REQUEST_APPROVAL" | "APPROVE" | "REJECT" | "PROCESS";

export interface CommandCenterActions {
  injectIncident: (scenarioKey: ScenarioKey) => void;
  runPreflight: (demoId: string) => void;
  investigateIncident: (incidentId: string, optionId: string) => void;
  diagnoseIncident: (incidentId: string) => void;
  proposeRemediation: (incidentId: string, remediationId: string) => void;
  decideIncidentApproval: (incidentId: string, approved: boolean) => void;
  executeRemediation: (incidentId: string) => void;
  verifyIncident: (incidentId: string) => void;
  updateAccessRequest: (requestId: string, operation: AccessOperation) => void;
}

export function CommandCenterView({
  state,
  readiness,
  effectiveAccess,
  actions,
}: {
  state: DemoOpsState;
  readiness: ReadinessSummary;
  effectiveAccess: EffectiveModelAccess[];
  actions: CommandCenterActions;
}) {
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState(state.users[0]?.id ?? "");
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>(state.incidentScenarios[0]?.key ?? "SSO_FAILURE");
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);
  const demos = useMemo(() => [...state.demos].sort((a, b) => a.minutesUntil - b.minutesUntil), [state.demos]);
  const activeIncidents = state.incidents.filter((incident) => incident.status !== "RESOLVED");
  const healthyIntegrations = state.integrations.filter((integration) => integration.status === "GREEN").length;
  const openRequests = state.accessRequests.filter((request) => !["APPROVED", "REJECTED", "PROCESSED"].includes(request.status)).length;
  const selectedSystem = state.systems.find((system) => system.id === selectedSystemId) ?? null;
  const selectedUser = state.users.find((user) => user.id === selectedUserId);
  const selectedAccess = effectiveAccess.find((access) => access.userId === selectedUserId);
  const selectedRole = state.roles.find((role) => role.id === selectedAccess?.roleId);

  return (
    <div className="plane-view" data-testid="command-center-view">
      <section className="plane-intro plane-intro--command">
        <div>
          <p className="eyebrow">Synthetic operations · deterministic state</p>
          <h1>Command Center</h1>
          <p>
            Identity, access, connectors, model policy, demo dependencies, incidents, and learning
            stay causally connected.
          </p>
        </div>
        <div className="readiness-orbit" role="meter" aria-label={`Demo readiness, ${readiness.status.replaceAll("_", " ")}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.score}>
          <div style={{ "--readiness": `${readiness.score * 3.6}deg` } as React.CSSProperties}>
            <strong>{readiness.score}%</strong>
            <span>{readiness.status.replaceAll("_", " ")}</span>
          </div>
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard label="Upcoming demos" value={String(demos.length)} detail={`${readiness.atRiskDemoIds.length} at risk`} icon={Clock3} tone={readiness.atRiskDemoIds.length ? "warning" : "success"} />
        <MetricCard label="Active environments" value={String(demos.length)} detail="fictional sandboxes" icon={ServerCog} />
        <MetricCard label="Healthy integrations" value={`${healthyIntegrations}/${state.integrations.length}`} detail="synthetic health checks" icon={PlugZap} tone={healthyIntegrations === state.integrations.length ? "success" : "warning"} />
        <MetricCard label="Open access requests" value={String(openRequests)} detail="least-privilege queue" icon={ListChecks} />
        <MetricCard label="Active incidents" value={String(activeIncidents.length)} detail="causal simulator" icon={AlertTriangle} tone={activeIncidents.length ? "danger" : "success"} />
        <MetricCard label="Users / seats" value={`${state.seats.used}/${state.seats.total}`} detail={`${state.seats.total - state.seats.used} available`} icon={Users} />
      </div>

      <SectionHeading
        icon={Activity}
        title="System health"
        description="Select a system to inspect its purpose, current evidence, and troubleshooting path."
      />
      <div className="system-grid">
        {state.systems.map((system) => (
          <button
            className={`system-card ${selectedSystemId === system.id ? "system-card--selected" : ""}`}
            key={system.id}
            onClick={() => setSelectedSystemId((current) => current === system.id ? null : system.id)}
            aria-expanded={selectedSystemId === system.id}
          >
            <span className={`status-dot status-dot--${system.status.toLowerCase()}`} aria-hidden="true" />
            <span><strong>{system.name}</strong><small>{system.blurb}</small></span>
            <StatusPill tone={systemTone(system.status)}>{system.status}</StatusPill>
          </button>
        ))}
      </div>

      {selectedSystem ? <SystemInspector system={selectedSystem} state={state} /> : null}

      <SectionHeading
        icon={ShieldCheck}
        title="Identity and effective-access trace"
        description="User → IdP → provisioning → seat → role → workspace → model and tool intersection"
        action={
          <label className="inline-select">
            <span className="sr-only">Select a synthetic user</span>
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              {state.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}
            </select>
          </label>
        }
      />
      {selectedUser && selectedAccess ? (
        <IdentityTrace user={selectedUser} roleName={selectedRole?.name ?? "Unresolved"} access={selectedAccess} />
      ) : null}

      <div className="command-columns">
        <section>
          <SectionHeading icon={Clock3} title="Upcoming demos" description="Immutable time ordering with on-demand preflight." />
          <div className="stack-list">
            {demos.map((demo) => {
              const user = state.users.find((candidate) => candidate.id === demo.presenterUserId);
              return (
                <Panel as="article" className="demo-card" key={demo.id}>
                  <div className="card-title-row">
                    <div><h3>{demo.customer}</h3><p>{user?.name} · {demo.environment}</p></div>
                    <StatusPill tone={demo.atRisk ? "danger" : demo.lastPreflight?.overall === "AT_RISK" ? "warning" : "success"}>{demo.atRisk ? "At risk" : demo.lastPreflight?.overall ?? "On track"}</StatusPill>
                  </div>
                  <div className="demo-card__details">
                    <span>Starts in <strong>{formatMinutes(demo.minutesUntil)}</strong></span>
                    <span>Requires <strong>{titleCase(demo.requiredModel)} · {demo.requiredEffort.toLowerCase()} effort</strong></span>
                    <span>Integrations <strong>{demo.integrationIds.join(", ")}</strong></span>
                  </div>
                  {demo.riskReasons.length ? <p className="risk-copy">{demo.riskReasons.join(" · ")}</p> : null}
                  <ActionButton compact tone="primary" onClick={() => actions.runPreflight(demo.id)}>Run preflight</ActionButton>
                  {demo.lastPreflight ? <PreflightResult result={demo.lastPreflight} /> : null}
                </Panel>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeading icon={KeyRound} title="Access queue" description="Consequential identity and role work pauses for approval." />
          <div className="stack-list">
            {state.accessRequests.map((request) => (
              <Panel as="article" className="access-card" key={request.id}>
                <div className="card-title-row">
                  <div><h3>{request.type}</h3><p>{request.target}</p></div>
                  <div className="pill-row"><StatusPill tone={riskTone(request.risk)}>{request.risk}</StatusPill><StatusPill tone={request.requiresApproval ? "warning" : "info"}>{request.requiresApproval ? "Approval required" : "Inspected low-risk"}</StatusPill></div>
                </div>
                <small>Requested by {request.requester}</small>
                {request.status !== "PENDING" ? <p className="access-card__detail">{request.detail}<br /><strong>Bounded effect:</strong> {accessEffectLabel(request.effect)}</p> : null}
                <div className="button-row">
                  {request.status === "PENDING" ? <ActionButton compact tone="quiet" onClick={() => actions.updateAccessRequest(request.id, "INSPECT")}>Inspect</ActionButton> : null}
                  {request.status === "INSPECTED" && request.requiresApproval ? <ActionButton compact onClick={() => actions.updateAccessRequest(request.id, "REQUEST_APPROVAL")}>Request approval</ActionButton> : null}
                  {request.status === "INSPECTED" && !request.requiresApproval ? <ActionButton compact tone="positive" onClick={() => actions.updateAccessRequest(request.id, "PROCESS")}>Process scoped fix</ActionButton> : null}
                  {request.status === "AWAITING_APPROVAL" ? <><ActionButton compact tone="positive" onClick={() => actions.updateAccessRequest(request.id, "APPROVE")}>Human approve</ActionButton><ActionButton compact tone="quiet" onClick={() => actions.updateAccessRequest(request.id, "REJECT")}>Reject</ActionButton></> : null}
                  {request.status === "APPROVED" ? <ActionButton compact tone="primary" onClick={() => actions.updateAccessRequest(request.id, "PROCESS")}>Execute with receipt</ActionButton> : null}
                  {["REJECTED", "PROCESSED"].includes(request.status) ? <StatusPill tone={request.status === "REJECTED" ? "neutral" : "success"}>{request.status}</StatusPill> : null}
                </div>
              </Panel>
            ))}
          </div>
        </section>
      </div>

      <Panel className="failure-lab" elevated>
        <div>
          <Zap size={18} aria-hidden="true" />
          <div><h2>Inject a synthetic failure</h2><p>Watch the causal state flow into systems, demos, agents, readiness, and the audit trail.</p></div>
        </div>
        <div className="failure-lab__actions">
          <label><span className="sr-only">Failure scenario</span><select value={scenarioKey} onChange={(event) => setScenarioKey(event.target.value as ScenarioKey)}>{state.incidentScenarios.map((scenario) => <option value={scenario.key} key={scenario.key}>{scenario.title}</option>)}</select></label>
          <ActionButton tone="danger" disabled={activeIncidents.some((incident) => incident.scenarioKey === scenarioKey)} onClick={() => actions.injectIncident(scenarioKey)}>{activeIncidents.some((incident) => incident.scenarioKey === scenarioKey) ? "Already active" : "Inject failure"}</ActionButton>
        </div>
      </Panel>

      <SectionHeading
        icon={AlertTriangle}
        title="Incident center"
        description="DETECT → DIAGNOSE → PROPOSE → APPROVE → EXECUTE → VERIFY → LEARN"
      />
      {state.incidents.length === 0 ? (
        <Panel className="empty-state"><CheckCircle2 size={24} aria-hidden="true" /><h3>No incidents</h3><p>Inject a fictional scenario above to exercise the governed recovery path.</p></Panel>
      ) : (
        <div className="stack-list">
          {state.incidents.map((incident) => (
            <IncidentCard
              incident={incident}
              state={state}
              actions={actions}
              expanded={expandedIncidentId === incident.id}
              onToggle={() => setExpandedIncidentId((current) => current === incident.id ? null : incident.id)}
              key={incident.id}
            />
          ))}
        </div>
      )}

      <BoundedLoops />

      <SectionHeading icon={Radio} title="Event stream" description="A deterministic, inspectable receipt for every synthetic state transition." />
      <Panel className="event-stream">
        {state.events.length === 0 ? <p>No events recorded.</p> : state.events.map((event) => (
          <div key={event.id}>
            <time dateTime={event.occurredAt}>{formatUtc(event.occurredAt)}</time>
            <StatusPill tone={event.severity === "CRITICAL" ? "danger" : event.severity === "WARNING" ? "warning" : "info"}>{event.severity}</StatusPill>
            <code>{event.type}</code>
            <span>{event.message}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function SystemInspector({ system, state }: { system: SystemHealth; state: DemoOpsState }) {
  const relatedEvents = state.events.filter((event) => event.systemId === system.id).slice(0, 4);
  const relatedIncidents = state.incidents.filter((incident) => state.incidentScenarios.find((scenario) => scenario.key === incident.scenarioKey)?.systemId === system.id);
  return (
    <Panel className="system-inspector" elevated>
      <div className="card-title-row"><div><p className="card-kicker">Current evidence</p><h3>{system.name}</h3></div><StatusPill tone={systemTone(system.status)}>{system.status} · {system.note}</StatusPill></div>
      <div className="system-inspector__grid">
        <div><span className="field-label">What it does</span><p>{system.description}</p><span className="field-label">Why it matters</span><p>{system.whyItMatters}</p></div>
        <div><span className="field-label">Troubleshooting</span><ol>{system.troubleshooting.map((item) => <li key={item}>{item}</li>)}</ol></div>
        <div><span className="field-label">Related state</span><p>{relatedIncidents.length} incident(s) · {relatedEvents.length} recent event(s)</p>{relatedEvents.map((event) => <code className="event-chip" key={event.id}>{event.type}</code>)}</div>
      </div>
    </Panel>
  );
}

function IdentityTrace({ user, roleName, access }: { user: DemoOpsState["users"][number]; roleName: string; access: EffectiveModelAccess }) {
  const temporaryRoleNote = user.temporaryRoleExpiresAt
    ? access.roleId === user.temporaryRoleId
      ? ` · temporary until ${formatUtc(user.temporaryRoleExpiresAt)}`
      : ` · temporary elevation expired ${formatUtc(user.temporaryRoleExpiresAt)}`
    : "";
  const steps = [
    ["User", user.name, user.active],
    ["Identity provider", user.identityProvider, user.active],
    ["Provisioning", user.provisioning.replaceAll("_", " "), user.active],
    ["Seat", user.seatType ?? "No seat", user.seatActive],
    ["Role", `${roleName}${temporaryRoleNote}`, Boolean(access.roleId)],
    ["Workspace", user.workspaces.join(", ") || "None", user.workspaces.length > 0],
    ["Effective models", access.effectiveModels.map(titleCase).join(", ") || "Blocked", access.effectiveModels.length > 0],
    ["Tool access", access.effectiveToolPermissions.join(", ") || "None", access.effectiveToolPermissions.length > 0],
  ] as const;
  return (
    <Panel
      className="identity-trace"
      role="region"
      tabIndex={0}
      aria-label="Effective-access trace; scroll horizontally to inspect each policy layer"
    >
      {steps.map(([label, detail, ok], index) => (
        <div key={label}>
          <span className={`status-dot status-dot--${ok ? "green" : "red"}`} aria-hidden="true" />
          <small>{label}</small><strong>{detail}</strong>
          {index < steps.length - 1 ? <i aria-hidden="true">→</i> : null}
        </div>
      ))}
    </Panel>
  );
}

function PreflightResult({ result }: { result: NonNullable<DemoOpsState["demos"][number]["lastPreflight"]> }) {
  return (
    <div className="preflight-result">
      <div><span>Preflight · {formatUtc(result.checkedAt)}</span><StatusPill tone={result.overall === "READY" ? "success" : result.overall === "AT_RISK" ? "warning" : "danger"}>{result.overall.replaceAll("_", " ")}</StatusPill></div>
      <ul>{result.checks.map((check) => <li key={check.id}>{check.result === "PASS" ? <CheckCircle2 size={13} /> : check.result === "WARN" ? <AlertTriangle size={13} /> : <XCircle size={13} />}<span>{check.label}</span><small>{check.explanation}</small></li>)}</ul>
    </div>
  );
}

function IncidentCard({ incident, state, actions, expanded, onToggle }: { incident: Incident; state: DemoOpsState; actions: CommandCenterActions; expanded: boolean; onToggle: () => void }) {
  const scenario = state.incidentScenarios.find((candidate) => candidate.key === incident.scenarioKey);
  if (!scenario) return null;
  const chosenRemediation = scenario.remediation.find((option) => option.id === incident.chosenRemediationId);
  const chosenInvestigation = new Set(incident.investigationLog);
  const canDiagnose = incident.investigationLog.some((id) => scenario.investigation.find((option) => option.id === id)?.quality === "DECISIVE") || incident.investigationLog.length >= 3;
  const approval = state.approvals.find((candidate) => candidate.targetType === "INCIDENT_REMEDIATION" && candidate.targetId === incident.id);
  return (
    <Panel as="article" className={`incident-card incident-card--${incident.status === "RESOLVED" ? "resolved" : "active"}`}>
      <button className="incident-card__toggle" onClick={onToggle} aria-expanded={expanded}>
        <span><AlertTriangle size={15} aria-hidden="true" /><strong>{scenario.title}</strong></span>
        <div className="pill-row"><StatusPill tone={incident.status === "RESOLVED" ? "success" : "danger"}>{incident.status.replaceAll("_", " ")}</StatusPill><span aria-hidden="true">{expanded ? "−" : "+"}</span></div>
      </button>
      {expanded ? (
        <div className="incident-card__body">
          <div className="incident-stages" aria-label={`Incident stage ${incident.status.replaceAll("_", " ")}`}>
            {["DETECT", "DIAGNOSE", "PROPOSE", "APPROVE", "EXECUTE", "VERIFY", "LEARN"].map((stage) => <span key={stage}>{stage}</span>)}
          </div>
          <div><span className="field-label">Detect · observable evidence</span><ul>{scenario.detectEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div>

          {incident.status === "DETECTED" || incident.status === "INVESTIGATING" ? (
            <div className="incident-action-block">
              <span className="field-label">Investigate · choose evidence, not guesses</span>
              <div className="option-stack">{scenario.investigation.map((option) => <button disabled={chosenInvestigation.has(option.id)} onClick={() => actions.investigateIncident(incident.id, option.id)} key={option.id}><strong>{option.label}</strong>{chosenInvestigation.has(option.id) ? <span>{option.reveal}<small>{option.feedback}</small></span> : null}</button>)}</div>
              <ActionButton compact tone="primary" disabled={!canDiagnose} onClick={() => actions.diagnoseIncident(incident.id)}>Confirm likely diagnosis</ActionButton>
            </div>
          ) : null}

          {!["DETECTED", "INVESTIGATING"].includes(incident.status) ? <Panel className="diagnosis-note"><span className="field-label">Diagnosis</span><p>{scenario.diagnosis}</p></Panel> : null}

          {incident.status === "DIAGNOSED" ? (
            <div className="incident-action-block"><span className="field-label">Propose a remediation</span><div className="remediation-grid">{scenario.remediation.map((option) => <RemediationChoice key={option.id} option={option} onChoose={() => actions.proposeRemediation(incident.id, option.id)} />)}</div></div>
          ) : null}

          {incident.status === "AWAITING_APPROVAL" ? (
            <Panel className="approval-gate"><span className="field-label">Human approval gate</span><p>{chosenRemediation?.label} · {chosenRemediation?.blastRadius}</p><div className="button-row"><ActionButton compact tone="positive" onClick={() => actions.decideIncidentApproval(incident.id, true)}>Approve exact scope</ActionButton><ActionButton compact tone="quiet" onClick={() => actions.decideIncidentApproval(incident.id, false)}>Deny</ActionButton></div></Panel>
          ) : null}

          {incident.status === "REMEDIATION_PROPOSED" || incident.status === "APPROVED" ? (
            <Panel className="approval-gate"><span className="field-label">Execution boundary</span><p>{chosenRemediation?.label}</p>{approval ? <small>Receipt {approval.id} · {approval.status}</small> : <small>Low-risk synthetic action; no consequential scope.</small>}<ActionButton compact tone="primary" onClick={() => actions.executeRemediation(incident.id)}>Execute bounded remediation</ActionButton></Panel>
          ) : null}

          {incident.status === "REMEDIATED" ? (
            <div className="incident-action-block"><span className="field-label">Verify post-conditions</span><ul>{scenario.verificationSteps.map((item) => <li key={item}>{item}</li>)}</ul><ActionButton compact tone="positive" onClick={() => actions.verifyIncident(incident.id)}>Run verification</ActionButton></div>
          ) : null}

          {incident.status === "RESOLVED" ? (
            <div className="learning-grid"><div><span>What happened</span><p>{scenario.learning.whatHappened}</p></div><div><span>Why it matters</span><p>{scenario.learning.whyItMatters}</p></div><div><span>Safe to automate</span><p>{scenario.learning.safeToAutomate}</p></div><div><span>Stays human</span><p>{scenario.learning.shouldStayHuman}</p></div></div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function RemediationChoice({ option, onChoose }: { option: RemediationOption; onChoose: () => void }) {
  return (
    <Panel className="remediation-option">
      <div className="pill-row"><StatusPill tone={option.kind === "ROOT_CAUSE_FIX" ? "amethyst" : "warning"}>{option.kind.replaceAll("_", " ")}</StatusPill><StatusPill tone={riskTone(option.risk)}>{option.risk}</StatusPill></div>
      <h4>{option.label}</h4>
      <dl><div><dt>Speed</dt><dd>{option.speed}</dd></div><div><dt>Blast radius</dt><dd>{option.blastRadius}</dd></div><div><dt>Reversible</dt><dd>{option.reversible ? "Yes" : "No"}</dd></div><div><dt>Approval</dt><dd>{option.requiresApproval ? "Required" : "Not required"}</dd></div></dl>
      <ActionButton compact tone="quiet" onClick={onChoose}>Propose this option</ActionButton>
    </Panel>
  );
}

function systemTone(status: SystemHealth["status"]): StatusTone { return status === "GREEN" ? "success" : status === "YELLOW" ? "warning" : "danger"; }
function riskTone(risk: string): StatusTone { return risk === "LOW" ? "success" : risk === "MEDIUM" ? "warning" : "danger"; }
function titleCase(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(); }
function formatMinutes(minutes: number): string { if (minutes < 60) return `${minutes}m`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ${minutes % 60}m`; return `${Math.floor(hours / 24)}d ${hours % 24}h`; }
function formatUtc(value: string): string { return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }).format(new Date(value)) + " UTC"; }
function accessEffectLabel(effect: AccessRequestEffect): string {
  if (effect.type === "ALLOCATE_SEATS") return `allocate ${effect.count} seat${effect.count === 1 ? "" : "s"}`;
  if (effect.type === "GRANT_WORKSPACE") return `grant ${effect.workspace} to ${effect.userId}`;
  if (effect.type === "ENABLE_INTEGRATION") return `enable integration ${effect.integrationId}`;
  if (effect.type === "ASSIGN_ROLE") return `assign ${effect.roleId} to ${effect.userId}`;
  return `grant ${effect.roleId} to ${effect.userId} for ${effect.durationHours} hours`;
}
