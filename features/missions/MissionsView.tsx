"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, GitBranch, ListChecks, LockKeyhole, Radio, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill } from "@/components/ui/StatusPill";
import type { DemoOpsState, MissionMode, MissionRun } from "@/lib/domain/types";

export interface MissionActions {
  start: (missionId: string, mode: MissionMode) => void;
  reset: () => void;
  exit: () => void;
  runCommand: (commandId: string, rationale: string) => void;
  updateHypothesis: (patch: Partial<MissionRun["hypothesis"]>) => void;
  commitHypothesis: (rationale: string) => void;
  proposeRemediation: (
    remediationId: string,
    form: { rationale: string; expectedResult: string; rollback: string; verification: string },
  ) => void;
  decideApproval: (approved: boolean, rationale: string) => void;
  executeRemediation: () => void;
  verify: (rationale: string) => void;
  choosePrevention: (prevention: string) => void;
  fileDebrief: () => void;
}

const modes: Array<{ id: MissionMode; title: string; description: string }> = [
  { id: "GUIDED", title: "Guided", description: "Hints and evidence quality stay visible while you learn the system shape." },
  { id: "OPERATOR", title: "Operator", description: "Evidence quality stays hidden and every action advances the simulated clock." },
  { id: "INTERVIEW", title: "Interview", description: "Every investigation and consequential decision requires a written rationale." },
];

const preventionOptions = [
  ["PREFLIGHT", "Automated preflight"],
  ["MONITORING", "Monitoring"],
  ["ALERTING", "Alerting"],
  ["CONFIG_VALIDATION", "Configuration validation"],
  ["DRIFT_DETECTION", "Drift detection"],
  ["SCHEDULED_SCAN", "Scheduled readiness scan"],
  ["APPROVAL_WORKFLOW", "Approval workflow"],
  ["RUNBOOK", "Runbook"],
  ["AUTO_REMEDIATE_LOW_RISK", "Automatic low-risk remediation"],
  ["NONE", "No automation"],
] as const;

export function MissionsView({ state, actions }: { state: DemoOpsState; actions: MissionActions }) {
  const run = state.activeMission;
  const mission = run ? state.missionCatalog.find((candidate) => candidate.id === run.missionId) : null;

  if (!run || !mission) {
    return <MissionCatalog state={state} onStart={actions.start} />;
  }
  if (run.status !== "ACTIVE") {
    return <MissionOutcome run={run} mission={mission} actions={actions} />;
  }
  return <MissionPlayer key={run.id} run={run} mission={mission} actions={actions} />;
}

function MissionCatalog({ state, onStart }: { state: DemoOpsState; onStart: MissionActions["start"] }) {
  const [mode, setMode] = useState<MissionMode>("GUIDED");
  return (
    <div className="plane-view" data-testid="missions-view">
      <section className="plane-intro plane-intro--missions">
        <div><p className="eyebrow">Deterministic practice · replayable decisions</p><h1>Missions</h1><p>Practice evidence gathering, hypothesis formation, approval judgment, remediation, verification, and learning under a visible clock.</p></div>
        <div className="boundary-note"><GitBranch size={18} aria-hidden="true" /><span>Debriefs keep eight dimensions separate; there is no opaque single score.</span></div>
      </section>
      <div className="mission-catalog">
        {state.missionCatalog.map((mission) => (
          <Panel as="article" className="mission-catalog-card" elevated key={mission.id}>
            <div className="card-title-row"><div><p className="card-kicker">Seed {mission.seed}</p><h2>{mission.title}</h2></div><StatusPill tone="danger">{mission.deadlineMinutes} minute deadline</StatusPill></div>
            <p>{mission.briefing}</p>
            <div className="mission-constraints"><div><span>Customer constraints</span><ul>{mission.customerImpactConstraints.map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>Security constraints</span><ul>{mission.securityConstraints.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
            <fieldset className="mode-picker"><legend>Choose a mode</legend>{modes.map((item) => <label className={mode === item.id ? "mode-option mode-option--selected" : "mode-option"} key={item.id}><input type="radio" name={`mode-${mission.id}`} checked={mode === item.id} onChange={() => setMode(item.id)} /><span><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</fieldset>
            <ActionButton tone="primary" onClick={() => onStart(mission.id, mode)}>Start {modes.find((item) => item.id === mode)?.title} mission</ActionButton>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function MissionPlayer({ run, mission, actions }: { run: MissionRun; mission: DemoOpsState["missionCatalog"][number]; actions: MissionActions }) {
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [remediationForm, setRemediationForm] = useState({
    rationale: "",
    expectedResult: "",
    rollback: "",
    verification: "",
  });
  const [approvalRationale, setApprovalRationale] = useState("");
  const [verificationRationale, setVerificationRationale] = useState("");
  const chosenRemediation = mission.remediation.find((candidate) => candidate.id === run.chosenRemediationId);
  const remaining = mission.deadlineMinutes - run.elapsedMinutes;
  const evidenceFor = mission.commands.filter((command) => run.commandsUsed.includes(command.id) && run.hypothesis.layer === command.layer);
  const evidenceAgainst = mission.commands.filter((command) => run.commandsUsed.includes(command.id) && run.hypothesis.layer && run.hypothesis.layer !== command.layer);

  function chooseCommand(commandId: string) {
    if (run.mode === "INTERVIEW") {
      setPendingCommand(commandId);
      setRationale("");
    } else {
      actions.runCommand(commandId, "Evidence selected to test the active hypothesis.");
    }
  }

  function commitCommand() {
    if (!pendingCommand || !rationale.trim()) return;
    actions.runCommand(pendingCommand, rationale.trim());
    setPendingCommand(null);
    setRationale("");
  }

  return (
    <div className="plane-view" data-testid="mission-player">
      <div className="mission-player__header">
        <div><p className="card-kicker">{run.mode} · seed {mission.seed}</p><h1>{mission.title}</h1></div>
        <div className="mission-clock"><Clock3 size={15} aria-hidden="true" /><strong>{run.elapsedMinutes}m</strong><span>/ {mission.deadlineMinutes}m · {remaining}m remaining</span></div>
        <div className="button-row"><ActionButton compact tone="quiet" onClick={actions.reset}><RotateCcw size={14} aria-hidden="true" /> Reset</ActionButton><ActionButton compact tone="quiet" onClick={actions.exit}>Exit</ActionButton></div>
      </div>

      <div className="mission-layout">
        <div className="mission-main">
          <Panel className="mission-brief"><span className="field-label">Briefing</span><p>{mission.briefing}</p><span className="field-label">Initial evidence</span><ul>{mission.initialEvidence.map((item) => <li key={item}>{item}</li>)}</ul></Panel>

          <Panel className="operator-console">
            <SectionHeading icon={Radio} title="Operator console" description="Synthetic commands reveal pre-authored evidence and cost simulated time." />
            <div className="command-grid">{mission.commands.map((command) => { const used = run.commandsUsed.includes(command.id); return <button className={used ? "command-option command-option--used" : "command-option"} key={command.id} onClick={() => chooseCommand(command.id)}><code>{command.label}</code><span>+{command.timeCostMinutes}m {used ? "· run" : ""}</span></button>; })}</div>
            {pendingCommand ? <div className="rationale-gate"><LockKeyhole size={15} aria-hidden="true" /><div><strong>Rationale gate</strong><p>Why is this the best next test?</p><textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="State the causal reason for this command." /><div className="button-row"><ActionButton compact tone="primary" disabled={!rationale.trim()} onClick={commitCommand}>Commit and run</ActionButton><ActionButton compact tone="quiet" onClick={() => setPendingCommand(null)}>Cancel</ActionButton></div></div></div> : null}
            <div className="evidence-stack"><span className="field-label">Evidence gathered</span>{run.commandsUsed.length === 0 ? <p>No commands run yet.</p> : run.commandsUsed.map((commandId, index) => { const command = mission.commands.find((candidate) => candidate.id === commandId); if (!command) return null; return <div key={`${commandId}-${index}`}><div><code>{command.label}</code>{run.mode === "GUIDED" ? <StatusPill tone={command.quality === "DECISIVE" ? "success" : command.quality === "USEFUL" ? "warning" : "neutral"}>{command.quality}</StatusPill> : null}</div><p>{command.reveal}</p></div>; })}</div>
          </Panel>

          {run.diagnosisRevealed ? (
            <Panel className="remediation-workspace">
              <SectionHeading icon={AlertTriangle} title="Remediation workspace" description={mission.diagnosis} />
              {!chosenRemediation ? <><div className="remediation-form-grid">{([
                ["rationale", "Decision rationale", "Why does this fix match the failing layer and blast radius?"],
                ["expectedResult", "Expected result", "What observable state should change?"],
                ["rollback", "Rollback plan", "How will this synthetic change be reversed?"],
                ["verification", "Verification plan", "Which post-conditions prove readiness?"],
              ] as const).map(([key, label, placeholder]) => <label className="full-field" key={key}><span>{label}</span><textarea value={remediationForm[key]} onChange={(event) => setRemediationForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} /></label>)}</div><div className="remediation-grid">{mission.remediation.map((option) => <Panel className="remediation-option" key={option.id}><div className="pill-row"><StatusPill tone={option.kind === "ROOT_CAUSE_FIX" ? "amethyst" : "warning"}>{option.kind.replaceAll("_", " ")}</StatusPill><StatusPill tone={option.requiresApproval ? "warning" : "success"}>{option.requiresApproval ? "Approval required" : "Low-risk scope"}</StatusPill></div><h3>{option.label}</h3><p>{option.customerImpact}</p><small>Blast radius: {option.blastRadius} · reversible: {option.reversible ? "yes" : "no"}</small><ActionButton compact disabled={!Object.values(remediationForm).every((value) => value.trim())} onClick={() => actions.proposeRemediation(option.id, remediationForm)}>Propose option</ActionButton></Panel>)}</div></> : null}
              {chosenRemediation && !run.remediationApproved && chosenRemediation.requiresApproval ? <div className="rationale-gate"><LockKeyhole size={15} /><div><strong>Human approval required</strong><p>{chosenRemediation.label} · {chosenRemediation.blastRadius}</p><textarea value={approvalRationale} onChange={(event) => setApprovalRationale(event.target.value)} placeholder="Approve or deny with an exact-scope rationale." /><div className="button-row"><ActionButton compact tone="positive" disabled={run.mode === "INTERVIEW" && !approvalRationale.trim()} onClick={() => actions.decideApproval(true, approvalRationale || "Approved exact scope after reviewing blast radius.")}>Approve</ActionButton><ActionButton compact tone="quiet" onClick={() => actions.decideApproval(false, approvalRationale || "Denied; scope requires reconsideration.")}>Deny</ActionButton></div></div></div> : null}
              {chosenRemediation && (!chosenRemediation.requiresApproval || run.remediationApproved) && !run.remediationExecuted ? <div className="execution-receipt"><div><span className="field-label">Ready to execute</span><strong>{chosenRemediation.label}</strong><p>{run.remediationApprovalId ? `Approval receipt ${run.remediationApprovalId} is exact-scope and consumable once.` : "Reversible synthetic action is within the defined low-risk boundary."}</p></div><ActionButton tone="primary" onClick={actions.executeRemediation}>Execute bounded action</ActionButton></div> : null}
              {run.remediationExecuted && !run.verified ? <div className="verification-gate"><span className="field-label">Verify</span><ul>{mission.verificationSteps.map((item) => <li key={item}>{item}</li>)}</ul><textarea value={verificationRationale} onChange={(event) => setVerificationRationale(event.target.value)} placeholder="What post-condition proves the system is ready?" /><ActionButton tone="positive" disabled={run.mode === "INTERVIEW" && !verificationRationale.trim()} onClick={() => actions.verify(verificationRationale || "Verified the required model and linked readiness post-conditions.")}>Run verification</ActionButton></div> : null}
            </Panel>
          ) : null}
        </div>

        <aside className="mission-side">
          {run.mode === "GUIDED" ? <Panel className="guided-hint"><Sparkles size={15} aria-hidden="true" /><p><strong>Hint:</strong> Identity, seat, and connectors are healthy. Check the layer that controls which model this presenter may use.</p></Panel> : null}
          <Panel className="hypothesis-board">
            <SectionHeading icon={ListChecks} title="Hypothesis board" />
            <label><span>Suspected failing layer</span><select value={run.hypothesis.layer ?? ""} disabled={run.hypothesis.committed} onChange={(event) => actions.updateHypothesis({ layer: event.target.value || null })}><option value="">Not set</option>{[...new Set(mission.commands.map((command) => command.layer))].map((layer) => <option value={layer} key={layer}>{layer}</option>)}</select></label>
            <label><span>Confidence · {run.hypothesis.confidence}%</span><input type="range" min={0} max={100} step={5} value={run.hypothesis.confidence} disabled={run.hypothesis.committed} onChange={(event) => actions.updateHypothesis({ confidence: Number(event.target.value) })} /></label>
            <div className="evidence-columns"><div><span>Evidence for</span>{evidenceFor.length ? evidenceFor.map((item) => <p key={item.id}>{item.reveal}</p>) : <p>None yet.</p>}</div><div><span>Evidence against</span>{evidenceAgainst.length ? evidenceAgainst.map((item) => <p key={item.id}>{item.reveal}</p>) : <p>None yet.</p>}</div></div>
            <label><span>Next best test</span><input value={run.hypothesis.nextTest} disabled={run.hypothesis.committed} onChange={(event) => actions.updateHypothesis({ nextTest: event.target.value })} placeholder="What would confirm or rule this out?" /></label>
            {!run.hypothesis.committed ? <ActionButton tone="primary" disabled={!run.hypothesis.layer} onClick={() => actions.commitHypothesis(`The ${run.hypothesis.layer} is the likely blocker because the gathered evidence narrows the causal path.`)}>Commit hypothesis</ActionButton> : <StatusPill tone="success">Hypothesis committed</StatusPill>}
          </Panel>
          {run.diagnosisRevealed ? <Panel className="diagnosis-note"><span className="field-label">Diagnosis</span><p>{mission.diagnosis}</p></Panel> : null}
          <Timeline run={run} />
        </aside>
      </div>
    </div>
  );
}

function MissionOutcome({ run, mission, actions }: { run: MissionRun; mission: DemoOpsState["missionCatalog"][number]; actions: MissionActions }) {
  const succeeded = run.status === "SUCCEEDED";
  return (
    <div className="plane-view mission-outcome" data-testid="mission-outcome">
      <Panel elevated>
        {succeeded ? <CheckCircle2 size={30} aria-hidden="true" /> : <XCircle size={30} aria-hidden="true" />}
        <p className="eyebrow">{succeeded ? "Terminal condition met" : "Terminal condition missed"}</p>
        <h1>{succeeded ? "Mission succeeded" : "Mission failed"}</h1>
        <p>{succeeded ? mission.terminalConditions.success : mission.terminalConditions.failure}</p>
        <StatusPill tone={succeeded ? "success" : "danger"}>{run.elapsedMinutes} / {mission.deadlineMinutes} simulated minutes</StatusPill>
        {!run.preventionChoice ? <div className="prevention-picker"><span className="field-label">Choose a recurrence-prevention mechanism</span>{preventionOptions.map(([id, label]) => <button key={id} onClick={() => actions.choosePrevention(id)}>{label}</button>)}</div> : <div className="button-row"><ActionButton tone="primary" onClick={actions.fileDebrief}>File and view debrief</ActionButton><ActionButton tone="quiet" onClick={actions.reset}>Replay same seed</ActionButton><ActionButton tone="quiet" onClick={actions.exit}>Back to catalog</ActionButton></div>}
      </Panel>
    </div>
  );
}

function Timeline({ run }: { run: MissionRun }) {
  return <Panel className="timeline"><span className="field-label">Timeline</span>{run.timeline.length === 0 ? <p>No decisions recorded yet.</p> : run.timeline.map((entry) => <div key={entry.id}><time>t={entry.atMinute}m</time><StatusPill tone="amethyst">{entry.phase}</StatusPill><span><strong>{entry.label}</strong><small>{entry.detail}</small></span></div>)}</Panel>;
}
