"use client";

import { Activity, CheckCircle2, FileClock, Handshake, Network, PlayCircle, ShieldCheck, Users } from "lucide-react";
import { AccessibleTabList } from "@/components/ui/AccessibleTabList";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill } from "@/components/ui/StatusPill";
import { operationalLearningMetrics, transcript, type LoopAction, type LoopRun } from "@/features/causal-loop";
import { findOverloadedOwners } from "./domain/rules";
import { AGENT_CONTRACTS, COVERAGE_WINDOWS, TEAM_MEMBERS } from "./fixtures/team";

export type TeamView = "cockpit" | "field" | "knowledge";

const teamTabs = [
  { id: "cockpit", label: "My Cockpit", contentId: "team-panel-cockpit" },
  { id: "field", label: "Team Field", contentId: "team-panel-field" },
  { id: "knowledge", label: "Knowledge Spine", contentId: "team-panel-knowledge" },
] as const;

type LoopActionHandler = (type: LoopAction["type"], actorId: string, kind: "HUMAN" | "AGENT") => void;

export function TeamOperationsView({
  loop,
  view,
  onViewChange,
  onLoopAction,
}: {
  loop: LoopRun;
  view: TeamView;
  onViewChange: (view: TeamView) => void;
  onLoopAction: LoopActionHandler;
}) {
  return (
    <div className="plane-view" data-testid="team-operations-view">
      <section className="plane-intro plane-intro--team">
        <div><p className="eyebrow">Plausible synthetic collaboration model</p><h1>Team Operations</h1><p>One shared causal state connects the observed change, named ownership, governed verification, approved learning, and evidence-backed closure.</p></div>
        <div className="boundary-note"><Users size={18} aria-hidden="true" /><span>Fictional teammates and local-session actions only. Nothing here is authenticated, shared, or connected to Anthropic systems.</span></div>
      </section>

      <AccessibleTabList ariaLabel="Team operations views" className="team-view-switch" idPrefix="team" selected={view} tabs={teamTabs} onSelect={onViewChange} />

      <section id="team-panel-cockpit" role="tabpanel" aria-labelledby="team-tab-cockpit" hidden={view !== "cockpit"} tabIndex={view === "cockpit" ? 0 : -1}>{view === "cockpit" ? <Cockpit loop={loop} onLoopAction={onLoopAction} /> : null}</section>
      <section id="team-panel-field" role="tabpanel" aria-labelledby="team-tab-field" hidden={view !== "field"} tabIndex={view === "field" ? 0 : -1}>{view === "field" ? <TeamField loop={loop} /> : null}</section>
      <section id="team-panel-knowledge" role="tabpanel" aria-labelledby="team-tab-knowledge" hidden={view !== "knowledge"} tabIndex={view === "knowledge" ? 0 : -1}>{view === "knowledge" ? <KnowledgeSpine loop={loop} onLoopAction={onLoopAction} /> : null}</section>

      <p className="truth-strip"><strong>Local rehearsal boundary.</strong> The eight people, team state, mission, runbooks, and receipts are fictional. Public-source provenance is explicit; impact is inference; changes remain proposed until a named human acts.</p>
    </div>
  );
}

function Cockpit({ loop, onLoopAction }: { loop: LoopRun; onLoopAction: LoopActionHandler }) {
  const work = loop.workItem;
  const latestReceipt = loop.receipts.at(-1);

  return <>
    <div className="metric-grid metric-grid--compact">
      <EvidenceMetric label="My causal assignments" value={work?.ownerId === "maya" ? "1" : "0"} detail={work ? `${work.state.replaceAll("_", " ")} · exact work item` : "No work before acceptance"} />
      <EvidenceMetric label="Unresolved handoffs" value={work?.state === "HANDED_OFF" ? "1" : "0"} detail={work?.state === "HANDED_OFF" ? "Awaiting Maya Chen" : "No pending causal handoff"} warning={work?.state === "HANDED_OFF"} />
      <EvidenceMetric label="Verification evidence" value={String(loop.receipts.length)} detail={latestReceipt ? `${latestReceipt.outcome} · attempt ${loop.currentAttempt}` : "No receipt before approved check"} warning={latestReceipt?.outcome === "FAIL"} />
      <EvidenceMetric label="Human decisions" value={String(loop.audit.filter((entry) => entry.outcome === "ACCEPTED" && entry.action !== "RUN_VERIFICATION").length)} detail="Recorded in this rehearsal" />
    </div>

    {!work ? (
      <Panel className="team-card empty-state" id="causal-work-empty"><Handshake size={24} aria-hidden="true" /><h2>No change-driven work exists</h2><p>A mission, assignment, handoff, transcript, stale-runbook state, and verification receipt appear only after a human accepts the public-change proposal in Change Radar.</p></Panel>
    ) : (
      <Panel className="team-card" id="causal-work-item">
        <SectionHeading eyebrow="Exact linked assignment" title={loop.change.title} description={`Work ${work.id} · mission ${work.missionId}`} action={<StatusPill tone={work.state === "HANDED_OFF" ? "warning" : work.state === "CLOSED" ? "success" : "info"}>{work.state.replaceAll("_", " ")}</StatusPill>} />
        <div className="ownership-strip">
          <div><span>Accountable</span><strong>{work.ownerId ? person(work.ownerId) : `Awaiting claim by ${person(work.proposedOwnerId)}`}</strong></div>
          <div><span>Backup</span><strong>{person(work.backupOwnerId)}</strong></div>
          <div><span>Reviewer</span><strong>{person(work.reviewerId)}</strong></div>
          <div><span>Approver</span><strong>{person(work.approverId)}</strong></div>
        </div>
        <dl className="handoff-grid">
          <div><dt>Situation</dt><dd>{work.handoff.situation}</dd></div>
          <div><dt>Impact</dt><dd>{work.handoff.impact}</dd></div>
          <div><dt>Current → receiving</dt><dd>{person(work.handoff.currentOwnerId)} → {person(work.handoff.receivingOwnerId)}</dd></div>
          <div><dt>Hypothesis</dt><dd>{work.handoff.hypothesis}</dd></div>
          <div><dt>Evidence gathered</dt><dd>{work.handoff.evidenceGathered.join(" · ")}</dd></div>
          <div><dt>Evidence missing</dt><dd>{work.handoff.evidenceMissing.join(" · ")}</dd></div>
          <div><dt>Actions taken</dt><dd>{work.handoff.actionsTaken.join(" · ")}</dd></div>
          <div><dt>Intentionally not taken</dt><dd>{work.handoff.actionsNotTaken.join(" · ")}</dd></div>
          <div><dt>Pending approval</dt><dd>{work.handoff.pendingApproval}</dd></div>
          <div><dt>Next action</dt><dd>{work.handoff.nextAction}</dd></div>
          <div><dt>Rollback</dt><dd>{work.handoff.rollback}</dd></div>
          <div><dt>Deadline</dt><dd>{work.handoff.deadline}</dd></div>
        </dl>
        <p className="rubric">Completeness rubric: 12/12 required fields present · receiving owner acknowledgement is still explicit.</p>
        <div className="button-row">
          {loop.phase === "CHANGE_ACCEPTED" ? <ActionButton tone="primary" onClick={() => onLoopAction("CLAIM_WORK", loop.contract.ownerId, "HUMAN")}>Claim this exact work item</ActionButton> : null}
          {loop.phase === "WORK_CLAIMED" ? <ActionButton tone="primary" onClick={() => onLoopAction("APPROVE_MISSION", loop.contract.approverId, "HUMAN")}>Approve draft mission scope</ActionButton> : null}
          {loop.phase === "MISSION_APPROVED" ? <ActionButton tone="primary" onClick={() => onLoopAction("APPROVE_VERIFICATION_PLAN", loop.contract.verificationPlanApproverId, "HUMAN")}>Approve reversible verification plan</ActionButton> : null}
          {loop.phase === "PLAN_APPROVED" ? <ActionButton tone="positive" onClick={() => onLoopAction("RUN_VERIFICATION", loop.contract.verificationAgentId, "AGENT")}><PlayCircle size={15} aria-hidden="true" /> Run local deterministic check</ActionButton> : null}
        </div>
      </Panel>
    )}

    <div className="two-column-plane">
      <Panel className="team-card"><SectionHeading eyebrow="Authority at this moment" title="Human decision and agent boundary" />
        <p className="authority-callout"><ShieldCheck size={16} aria-hidden="true" /> {authorityCopy(loop)}</p>
        <ul className="calm-list"><li>Agent may read typed state and run only the approved reversible fixture.</li><li>Agent cannot accept the change, approve mission or learning, close work, change access, promote a source, merge, or deploy.</li><li>Stop after {loop.contract.maximumAttempts} attempts or missing evidence; escalate to {person(loop.contract.accountableHuman)}.</li></ul>
      </Panel>
      <Panel className="team-card"><SectionHeading eyebrow="Provenance" title="Causal lineage so far" />
        <LineageList loop={loop} />
      </Panel>
    </div>
  </>;
}

function TeamField({ loop }: { loop: LoopRun }) {
  const underCovered = COVERAGE_WINDOWS.filter((window) => window.qualifiedOwnerIds.length < 2);
  const overloaded = findOverloadedOwners(TEAM_MEMBERS);
  const metrics = operationalLearningMetrics(loop);
  return <>
    <Panel className="team-card"><SectionHeading eyebrow="Follow-the-sun" title="Coverage and accountable backup" detail="Coverage and load are fictional planning fixtures, not claims about Anthropic staffing." /><div className="coverage-track">{COVERAGE_WINDOWS.map((window) => <div key={window.region}><strong>{window.region}</strong><span>{window.startUtc}:00–{window.endUtc}:00 UTC</span><small>{window.qualifiedOwnerIds.map(person).join(" · ")}</small>{window.qualifiedOwnerIds.length < 2 ? <StatusPill tone="warning">Single qualified human</StatusPill> : <StatusPill tone="success">Backup present</StatusPill>}</div>)}</div><p className="coverage-warning">{underCovered.length} under-covered window · {overloaded.map(person).join(" · ")} at or above the 80% rehearsal-load threshold · agents preserve evidence but never replace the accountable human or backup.</p></Panel>
    <div className="team-grid">{TEAM_MEMBERS.map((member) => {
      const linked = loop.workItem?.ownerId === member.id || loop.workItem?.backupOwnerId === member.id;
      return <Panel className="team-member" key={member.id}><div className="change-card__header"><div><StatusPill tone={member.status === "OFFLINE" ? "neutral" : member.status === "ON_CALL" ? "warning" : "success"}>{member.status.replaceAll("_", " ")}</StatusPill><h3>{member.name}</h3><p>{member.role}</p></div><strong>{member.capacityPercent}% synthetic load</strong></div><p>{member.timezone} · {member.coverage}</p><dl><div><dt>Responsibilities</dt><dd>{member.responsibilities.join(" · ")}</dd></div><div><dt>Primary for</dt><dd>{member.primaryFor.join(" · ")}</dd></div><div><dt>Backup</dt><dd>{member.backupIds.map(person).join(" · ") || "No named backup — coverage gap"}</dd></div><div><dt>Approval</dt><dd>{member.approvalScope.join(" · ")}</dd></div><div><dt>Access</dt><dd>{member.accessLevel}</dd></div><div><dt>Escalation</dt><dd>{member.escalationPath}</dd></div></dl>{linked ? <p className="receipt-note">Linked to active loop as {loop.workItem?.ownerId === member.id ? "accountable owner" : "backup human"}.</p> : null}</Panel>;
    })}</div>
    <Panel className="team-card"><SectionHeading eyebrow="Sustainable operations" title="Evidence-backed team health" detail="No leaderboard and no fabricated trend. One rehearsal is not enough history for a rate." /><div className="health-grid"><Health label="Reviewer correction rate" value={formatMetric(metrics.reviewerCorrectionRate)} /><Health label="Detection-to-owner time" value={metrics.detectionToOwnerMinutes === "Insufficient observations" ? metrics.detectionToOwnerMinutes : `${metrics.detectionToOwnerMinutes.toFixed(0)} min · this rehearsal`} /><Health label="Handoff completeness" value={formatCompleteness(metrics.handoffCompleteness)} /><Health label="First-pass verification rate" value={formatMetric(metrics.firstPassVerificationRate)} /><Health label="Repeated-failure rate" value={formatMetric(metrics.repeatedFailureRate)} /><Health label="Evidence-complete closure rate" value={formatMetric(metrics.evidenceCompleteClosureRate)} /></div></Panel>
  </>;
}

function KnowledgeSpine({ loop, onLoopAction }: { loop: LoopRun; onLoopAction: LoopActionHandler }) {
  const messages = transcript(loop);
  const latestReceipt = loop.receipts.at(-1);
  return <>
    <Panel className="team-card" id="runbook-learning"><SectionHeading eyebrow="Operational memory" title="Immutable runbook versions" detail="Failure proposes learning. Only human approval can append a new immutable version." />
      {loop.affectedRunbook ? <p className="authority-callout"><FileClock size={16} aria-hidden="true" /> <strong>{loop.affectedRunbook.state.replaceAll("_", " ")}</strong> · {loop.affectedRunbook.reason}</p> : <p className="empty-inline">No change-driven runbook assessment exists before human acceptance.</p>}
      <div className="knowledge-list">{loop.runbookVersions.map((runbook) => {
        const active = loop.activeRunbookVersionId === runbook.id;
        const awaitingReplay = loop.affectedRunbook?.runbookVersionId === runbook.id && loop.affectedRunbook.state === "UPDATED_AWAITING_REPLAY";
        return <article key={runbook.id}><StatusPill tone={active ? "success" : awaitingReplay ? "warning" : "neutral"}>{active ? "ACTIVE" : awaitingReplay ? "APPROVED · REPLAY REQUIRED" : "PRESERVED"}</StatusPill><h3>Effective model access preflight · v{runbook.version}</h3><p>Expected entitlement: {runbook.expectedEntitlement}</p><small>{runbook.approvedBy ? `Approved by ${person(runbook.approvedBy)} at ${runbook.approvedAt}` : "Baseline fixture"} · immutable {String(runbook.immutable)}</small></article>;
      })}</div>
      {loop.learningRecord ? <div className="learning-proposal"><StatusPill tone={loop.learningRecord.state === "ACTIVE" ? "success" : "warning"}>{loop.learningRecord.state === "ACTIVE" ? "ACTIVE · PASSING EVIDENCE ATTACHED" : loop.learningRecord.humanDecision ? "APPROVED · REPLAY REQUIRED" : "PROPOSED · HUMAN APPROVAL REQUIRED"}</StatusPill><h3>Lesson from failed verification</h3><p><strong>Original prediction:</strong> {loop.learningRecord.originalPrediction}</p><p><strong>Failure evidence:</strong> {loop.learningRecord.supportingEvidence.join(" · ")}</p><p><strong>Human decision:</strong> {loop.learningRecord.humanDecision ? `${loop.learningRecord.humanDecision.outcome} by ${person(loop.learningRecord.humanDecision.actorId)} at ${loop.learningRecord.humanDecision.at}` : "Pending human review"}</p><p><strong>Approved operational lesson:</strong> {loop.learningRecord.approvedOperationalLesson ?? "Not approved; the proposal is inactive."}</p><p><strong>Activation evidence:</strong> {loop.learningRecord.activationReceiptId ?? "Not created; the lesson and candidate version remain inactive."}</p>{loop.phase === "FIRST_VERIFICATION_FAILED" ? <ActionButton tone="primary" onClick={() => onLoopAction("APPROVE_LEARNING", loop.contract.runbookApproverId, "HUMAN")}>Approve lesson and append runbook v2</ActionButton> : null}</div> : null}
      {loop.phase === "RUNBOOK_APPROVED" ? <div className="learning-proposal"><StatusPill tone="warning">RUNBOOK V2 APPROVED · NOT ACTIVE</StatusPill><h3>Replay the identical scenario</h3><p>The human-approved immutable candidate remains inactive until this identical scenario produces independent passing evidence. The source, mission, work item, plan, and scenario remain unchanged.</p><ActionButton tone="positive" onClick={() => onLoopAction("RUN_VERIFICATION", loop.contract.verificationAgentId, "AGENT")}><PlayCircle size={15} aria-hidden="true" /> Replay against runbook v2</ActionButton></div> : null}
    </Panel>

    <div className="two-column-plane">
      <Panel className="team-card"><SectionHeading eyebrow="Verification evidence" title="Receipts" detail="A receipt exists only after the approved Verification Agent check executes." />{loop.receipts.length ? <div className="receipt-stack">{loop.receipts.map((receipt) => <article key={receipt.id}><StatusPill tone={receipt.outcome === "PASS" ? "success" : "danger"}>{receipt.outcome}</StatusPill><h3>{receipt.id}</h3><p>Runbook {receipt.runbookVersionId} · actor {receipt.actor.id} · {receipt.durationMs} ms · reversible</p><ul>{receipt.checks.map((check) => <li key={check.name}><strong>{check.outcome}</strong> {check.name} — {check.evidence}</li>)}</ul></article>)}</div> : <p className="empty-inline">No verification receipt exists.</p>}{latestReceipt?.outcome === "PASS" ? <p className="receipt-note"><CheckCircle2 size={14} aria-hidden="true" /> Objective replay passed. Independent human closure is now permitted in the Active Loop ledger.</p> : null}</Panel>
      <Panel className="team-card"><SectionHeading eyebrow="Causal lineage" title="Evidence chain" /><LineageList loop={loop} /></Panel>
    </div>

    <Panel className="team-card agent-transcript" id="causal-transcript"><SectionHeading eyebrow="Operational transcript · no hidden reasoning" title="Derived from accepted reducer transitions" detail="Rejected attempts remain visible and cannot mutate domain state." />{messages.length ? messages.map((message) => <div key={`${message.at}-${message.action}`}><Activity size={14} aria-hidden="true" /><strong>{message.actorId}</strong><span>{message.action.replaceAll("_", " ")} · {message.outcome} · {message.reason}</span></div>) : <p className="empty-inline">No causal transcript exists before the first human decision.</p>}</Panel>

    <Panel className="team-card"><SectionHeading eyebrow="Inspect, do not trust blindly" title="Ten bounded agent contracts, each with a named human owner" detail="Each contract exposes purpose, inputs, outputs, allowed action, prohibited actions, and escalation." /><div className="agent-contract-grid">{AGENT_CONTRACTS.map((agent) => <article key={agent.id}><Network size={15} aria-hidden="true" /><h3>{agent.name}</h3><p>{agent.className} · {agent.domain}</p><small>Human owner: {person(agent.accountableHumanId)}</small><StatusPill tone={agent.permittedAction.includes("EXECUTE") ? "success" : "info"}>{agent.permittedAction.replaceAll("_", " ")}</StatusPill><details><summary>Full authority contract</summary><p>Purpose: {agent.purpose}</p><p>Inputs: {agent.inputs.join(", ")}</p><p>Outputs: {agent.outputs.join(", ")}</p><p>Allowed: {agent.permittedAction.replaceAll("_", " ")}</p><p>Prohibited: {agent.deniedActions.join(", ")}</p><p>Escalate: {agent.escalationCondition}</p><p>Fallback: {agent.fallback}</p><p>Last human review: {agent.lastHumanReview}</p></details></article>)}</div></Panel>
  </>;
}

function EvidenceMetric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <Panel className="metric-card">
    <div className="metric-card__label"><span>{label}</span><Handshake size={16} aria-hidden="true" /></div>
    <strong className={`metric-card__value${warning ? " metric-card__value--warning" : ""}`}>{value}</strong>
    <span className={`metric-card__detail${warning ? " text-warning" : ""}`}>{detail}</span>
  </Panel>;
}

function Health({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function LineageList({ loop }: { loop: LoopRun }) {
  const rows = [
    ["changeId", loop.change.id],
    ["reviewDecisionId", loop.reviewDecision?.id],
    ["missionId", loop.mission?.id],
    ["workItemId", loop.workItem?.id],
    ["verificationReceiptId", loop.receipts.at(-1)?.id],
    ["learningRecordId", loop.learningRecord?.id],
    ["runbookVersion", loop.learningRecord?.runbookVersionId ?? loop.activeRunbookVersionId],
  ] as const;
  return <ol className="lineage-list">{rows.map(([label, value]) => <li key={label} className={value ? "lineage-list--present" : ""}><span>{label}</span><code>{value ?? "Not created"}</code></li>)}</ol>;
}

function authorityCopy(loop: LoopRun) {
  if (["PLAN_APPROVED", "RUNBOOK_APPROVED"].includes(loop.phase)) return "A named human approved the exact reversible plan; the Verification Agent may execute only that local deterministic check.";
  if (loop.phase === "FIRST_VERIFICATION_FAILED") return "The agent produced failure evidence and a proposed lesson. It cannot approve or activate that lesson.";
  if (loop.phase === "REPLAY_PASSED") return "The agent produced passing evidence. Only Priya Raman may close the consequential work.";
  return "The next transition requires the named fictional human. Agent execution remains stopped.";
}

function person(id: string) { return TEAM_MEMBERS.find((member) => member.id === id)?.name ?? (id === "verification-agent" ? "Verification Agent" : id); }
function formatMetric(value: number | "Insufficient observations") { return value === "Insufficient observations" ? value : `${Math.round(value * 100)}% · this rehearsal`; }
function formatCompleteness(value: number | "Insufficient observations") { return value === "Insufficient observations" ? value : `${Math.round(value * 12)}/12 fields · this rehearsal`; }
