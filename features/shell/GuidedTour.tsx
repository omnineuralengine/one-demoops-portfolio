"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, RotateCcw, ShieldCheck, Users } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import type { LoopAction, LoopRun } from "@/features/causal-loop";
import { PUBLIC_CHANGE_REFERENCE } from "@/features/causal-loop/public-reference";
import { TEAM_MEMBERS } from "@/features/team-operations/fixtures/team";

const steps = ["Source", "Impact", "Response", "Handoff", "Verify", "Review"] as const;
const titles = [
  "One change. A whole chain of responsibility.",
  "Follow the change to the people it affects.",
  "Choose what happens next.",
  "Give the next person enough to act.",
  "Approval is permission to check. It is not proof.",
  "Close the loop with evidence.",
] as const;
type ActionHandler = (type: LoopAction["type"], actorId: string, kind: "HUMAN" | "AGENT") => void;

export function GuidedTour({ loop, onAction, onRestart, onClose }: {
  loop: LoopRun;
  onAction: ActionHandler;
  onRestart: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<"rehearse" | "hold" | null>(null);
  const [paused, setPaused] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastReceipt = loop.receipts.at(-1);
  const { contract } = loop;

  // Keep keyboard users with the next decision when the previous control disappears.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, loop.phase, paused]);

  function restart() {
    setStep(0);
    setChoice(null);
    setPaused(false);
    onRestart();
    headingRef.current?.focus();
  }
  const human = (type: LoopAction["type"], actor: string) => onAction(type, actor, "HUMAN");
  const verify = () => onAction("RUN_VERIFICATION", contract.verificationAgentId, "AGENT");

  return (
    <aside className="guided-journey" aria-label="90-second guided tour">
      <div className="journey-toolbar">
        <p className="eyebrow">A 90-second guided journey · at your pace</p>
        <div className="button-row">
          <ActionButton tone="quiet" onClick={restart}><RotateCcw size={15} aria-hidden="true" /> Restart journey</ActionButton>
          <ActionButton tone="quiet" onClick={onClose}>Explore freely <ArrowRight size={15} aria-hidden="true" /></ActionButton>
        </div>
      </div>
      <ol className="journey-progress" aria-label="Journey progress">
        {steps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}>
          <span aria-hidden="true">{index < step ? <CheckCircle2 size={16} /> : String(index + 1).padStart(2, "0")}</span>
          {label}<span className="sr-only">{index < step ? ", complete" : index === step ? ", current step" : ", upcoming"}</span>
        </li>)}
      </ol>
      <Panel className="journey-card">
        <p className="journey-stage-label">Step {step + 1} of 6 · {steps[step]}</p>
        <h1 className="journey-heading" ref={headingRef} tabIndex={-1}>{titles[step]}</h1>
        <div className="journey-stage">
          {step === 0 ? <>
            <p className="journey-lead">A model is retired. Which demos still assume it is available, who needs to respond, and what would count as fixed?</p>
            <div className="journey-context">
              <StatusPill tone="amethyst">Recorded public reference</StatusPill>
              <h2>{PUBLIC_CHANGE_REFERENCE.title}</h2>
              <p>{PUBLIC_CHANGE_REFERENCE.summary}</p>
              <p>Published <time dateTime={PUBLIC_CHANGE_REFERENCE.publishedOn}>January 5, 2026</time> · reviewed <time dateTime={PUBLIC_CHANGE_REFERENCE.reviewedAt}>September 10, 2026</time></p>
              <a className="source-link" href={PUBLIC_CHANGE_REFERENCE.url} target="_blank" rel="noreferrer">Inspect the public release note <ArrowUpRight size={14} aria-hidden="true" /></a>
            </div>
            <div>
              <h2>What changed?</h2>
              <p>The public announcement motivates this simplified access rehearsal. Its before/after wording is illustrative:</p>
              <div className="journey-diff">
                <div><span className="field-label">Before · authored fixture</span><p>{loop.change.excerptBefore}</p></div>
                <div><span className="field-label">After · authored fixture</span><p>{loop.change.excerptAfter}</p></div>
              </div>
            </div>
            <details className="journey-details"><summary>Source evidence & fixture provenance</summary>
              <blockquote>{PUBLIC_CHANGE_REFERENCE.excerpt}</blockquote>
              <p>{PUBLIC_CHANGE_REFERENCE.boundary}</p>
              <p>Review timestamp: <time dateTime={PUBLIC_CHANGE_REFERENCE.reviewedAt}>{PUBLIC_CHANGE_REFERENCE.reviewedAt}</time>. Rehearsal clock: {loop.change.detectedAt} (synthetic).</p>
              <dl className="journey-handoff"><div><dt>Fixture hash before</dt><dd><code>{loop.change.previousHash}</code></dd></div><div><dt>Fixture hash after</dt><dd><code>{loop.change.currentHash}</code></dd></div></dl>
              <p>These hashes fingerprint the authored inputs. No historical page snapshot or fresh source diff is claimed.</p>
            </details>
            <Why>Availability and permission are different checks. A replacement model can exist without being allowed for a presenter.</Why>
          </> : null}

          {step === 1 ? <>
            <p className="journey-lead">A change is not just an alert. It affects demos, people, permissions, learning material, and decisions—and someone must own the response.</p>
            <StatusPill tone="warning">Inferred impact · fictional assets</StatusPill>
            <div className="journey-impact-grid">
              <article><Users size={21} aria-hidden="true" /><h2>Demo rehearsal</h2><p>The model-access rehearsal may request a model the presenter cannot use.</p><strong>Maya Chen · owner</strong><p>Leila Haddad · backup</p></article>
              <article><ShieldCheck size={21} aria-hidden="true" /><h2>Permissions & routing</h2><p>The preflight and AI Gateway need an effective-access check before choosing a fallback.</p><strong>Aisha Okafor · reviewer</strong><p>Mateo Silva · scope approver</p></article>
              <article><BookOpen size={21} aria-hidden="true" /><h2>Learning resources</h2><p>Model access runbook v1 and the AI Gateway briefing may teach an outdated assumption.</p><strong>Mateo Silva · learning approver</strong><p>Priya Raman · closure reviewer</p></article>
            </div>
            <Why>The source does not tell us which demo will fail. These links are a reviewable hypothesis, so the team tests them before changing its guidance.</Why>
            <details className="journey-details"><summary>Inspect the dependency links</summary><ul>{loop.change.affectedSyntheticAssets.map((asset) => <li key={asset}><code>{asset}</code></li>)}</ul><p>The demo described here is the bounded causal-loop rehearsal. No production fleet or real presenter is connected.</p></details>
          </> : null}

          {step === 2 ? <>
            <p className="journey-lead">Act as Aisha, the fictional reviewer. Choose a bounded assessment or leave the change open while more evidence is gathered.</p>
            <div className="journey-choice-grid" role="group" aria-label="Response options">
              <button className="journey-choice" type="button" aria-pressed={choice === "rehearse"} onClick={() => { setChoice("rehearse"); setPaused(false); }}><strong>Rehearse a safe fallback</strong><span>Prepare a handoff, check the current runbook, and test a correction. No access is granted.</span>{choice === "rehearse" ? <span><CheckCircle2 size={14} aria-hidden="true" /> Selected response</span> : null}</button>
              <button className="journey-choice" type="button" aria-pressed={choice === "hold"} onClick={() => { setChoice("hold"); setPaused(false); }}><strong>Hold for more evidence</strong><span>Keep the change unresolved. Ask the reviewer to confirm scope before creating work.</span>{choice === "hold" ? <span><CheckCircle2 size={14} aria-hidden="true" /> Selected response</span> : null}</button>
            </div>
            <div className="journey-context" role="status">
              <h2>{paused ? "On hold · unresolved" : choice ? "Consequence of this response" : "Your decision stays explicit"}</h2>
              <p>{choice === "rehearse" ? "Accepting creates one draft mission and an unclaimed handoff for Maya. Every approval and verification still has to happen." : choice === "hold" ? "Aisha remains the proposed reviewer. No mission, assignment, approval, or verification receipt is created. Current readiness is unproven." : "Select a response to preview its consequences. Nothing has been accepted yet."}</p>
              {paused ? <p>The journey is paused in this browser only. Next step: confirm whether the fictional presenter needs the affected model, then reconsider the assessment.</p> : null}
            </div>
            <Why>Declining to automate is a valid decision. An unresolved question needs an owner and a next step, not a green status.</Why>
          </> : null}

          {step === 3 ? <>
            <p className="journey-lead">Aisha accepted an assessment. Maya must claim it, Mateo must approve its scope, and Aisha must approve the reversible check.</p>
            <StatusPill tone="amethyst">{loop.phase === "PLAN_APPROVED" ? "Human approvals recorded · unverified" : "Reviewable handoff · not resolved"}</StatusPill>
            <dl className="journey-handoff" data-testid="guided-handoff">
              <div><dt>Situation & impact</dt><dd>{loop.workItem?.handoff.situation} {loop.workItem?.handoff.impact}</dd></div>
              <div><dt>Ownership</dt><dd>{loop.workItem?.ownerId ? `${person(loop.workItem.ownerId)} · claimed` : "Maya Chen · awaiting claim"}<br />Leila Haddad · backup</dd></div>
              <div><dt>Evidence</dt><dd>Dated public reference + authored before/after input. {loop.receipts.length} simulated verification receipts.</dd></div>
              <div><dt>Uncertainty</dt><dd>The impact is inferred. A public announcement cannot establish a fictional presenter’s access or prove a working demo.</dd></div>
              <div><dt>Next step</dt><dd>{loop.phase === "CHANGE_ACCEPTED" ? "Maya claims the handoff." : loop.phase === "WORK_CLAIMED" ? "Mateo reviews and approves the mission scope." : loop.phase === "MISSION_APPROVED" ? "Aisha reviews and approves the verification plan." : "Run the approved local check against runbook v1."}</dd></div>
              <div><dt>Scope & rollback</dt><dd>Check two controls in local memory. Retain runbook v1 until v2 passes replay. No roles, entitlements, or accounts are changed.</dd></div>
            </dl>
            <details className="journey-details"><summary>Review the exact plan & decision trail</summary><ul>{contract.verificationChecks.map((check) => <li key={check}>{check}</li>)}</ul><p>Maximum {contract.maximumAttempts} attempts. A failed replay stops and escalates to Maya. Times are synthetic.</p><Audit loop={loop} /></details>
            <Why>Ownership, approval, and evidence are separate responsibilities. You are role-playing these people; the lab does not authenticate or contact them.</Why>
          </> : null}

          {step === 4 ? <>
            <p className="journey-lead">Run the same two controls against the same fictional model profile. The first check exposes the stale assumption; the replay tests the approved correction.</p>
            <StatusPill tone="info">Simulated verification · no provider call</StatusPill>
            <div className="journey-diff">
              <div><span className="field-label">Runbook v1 · original assumption</span><p>Request the fictional Opus profile. The fixture only allows the Sonnet profile.</p></div>
              <div><span className="field-label">Runbook v2 · {loop.runbookVersions.length > 1 ? "approved correction" : "proposed correction"}</span><p>Check effective access first and select the allowed Sonnet fallback.</p></div>
            </div>
            {loop.receipts.length ? <div className="journey-receipt" aria-label="Verification receipts">{loop.receipts.map((receipt, index) => <article key={receipt.id}><StatusPill tone={receipt.outcome === "PASS" ? "success" : "danger"}>{receipt.outcome} · simulated attempt {index + 1}</StatusPill><h2>{receipt.outcome === "PASS" ? "Corrected runbook passes both controls" : "The original runbook fails the access check"}</h2><ul>{receipt.checks.map((check) => <li key={check.name}><strong>{check.outcome}</strong> · {check.name}: {check.evidence}</li>)}</ul></article>)}</div> : <p className="journey-context">No result yet. Approvals are recorded, but the check has not run.</p>}
            {loop.phase === "FIRST_VERIFICATION_FAILED" ? <p role="status">What changed? Failure evidence created a proposed lesson. Runbook v1 remains active; Mateo must approve v2 before replay.</p> : null}
            {loop.phase === "RUNBOOK_APPROVED" ? <p role="status">Runbook v2 is approved but inactive. Approval alone is not resolution. Replay must pass before it can become active.</p> : null}
            {loop.phase === "REPLAY_PASSED" ? <p role="status">Both simulated checks passed. Runbook v2 is active in this rehearsal. Priya still needs to review the result before closure.</p> : null}
            {loop.phase === "REPLAY_FAILED" ? <p role="alert">Replay failed. The candidate stays inactive and the loop remains unresolved. Maya must review the failure; restart to rehearse again.</p> : null}
            <Why>A failed check is useful evidence. The agent may run the approved check and propose learning; it cannot approve a lesson or close the work.</Why>
          </> : null}

          {step === 5 ? <>
            <div className="journey-outcome" role="status"><StatusPill tone={loop.phase === "CLOSED" ? "success" : "amethyst"}>{loop.phase === "CLOSED" ? "Resolved in simulation" : "Verified in simulation · closure pending"}</StatusPill><h2>{loop.phase === "CLOSED" ? "Evidence checked. Responsibility recorded." : "A passing check is ready for human review."}</h2><p>{loop.phase === "CLOSED" ? "Priya closed the fictional work with the passing replay attached. The original runbook and failed receipt remain inspectable." : "Act as Priya. Review the result, remaining uncertainty, and follow-up before closing this bounded rehearsal."}</p></div>
            <dl className="journey-handoff"><div><dt>Accountable owner</dt><dd>Maya Chen · Leila Haddad is backup</dd></div><div><dt>Human decisions</dt><dd>Aisha reviewed the change and check plan. Mateo approved scope and runbook v2. Closure: {loop.closedBy ? person(loop.closedBy) : "awaiting Priya Raman"}.</dd></div><div><dt>Verification outcome</dt><dd>{lastReceipt?.outcome} · {lastReceipt?.checks.filter((check) => check.outcome === "PASS").length}/2 controls · attempt {loop.currentAttempt} · runbook v2</dd></div><div><dt>Remaining uncertainty & next steps</dt><dd>This verifies only the local fixture. Maya should rehearse with the presenter and confirm real permissions before any real demo; Mateo should review the learning material.</dd></div></dl>
            <details className="journey-details"><summary>Inspect evidence, lineage & human decisions</summary><p>Source: <a href={PUBLIC_CHANGE_REFERENCE.url} target="_blank" rel="noreferrer">{PUBLIC_CHANGE_REFERENCE.sourceTitle}</a> · published {PUBLIC_CHANGE_REFERENCE.publishedOn}; manually reviewed {PUBLIC_CHANGE_REFERENCE.reviewedAt}.</p><p>Authored rehearsal change: <code>{loop.change.id}</code></p><p>Work item: <code>{loop.workItem?.id}</code></p><p>Passing receipt: <code>{lastReceipt?.id}</code></p><p>Runbook: <code>{loop.activeRunbookVersionId}</code></p><Audit loop={loop} /></details>
            <Why>The response is accountable because evidence, uncertainty, decisions, and follow-up travel together. A passing simulation never certifies a live system.</Why>
          </> : null}
        </div>
        <div className="journey-actions">
          {step > 0 && step < 3 ? <ActionButton tone="quiet" onClick={() => { setPaused(false); setStep(step - 1); }}>Back</ActionButton> : null}
          {step === 0 ? <ActionButton tone="primary" onClick={() => setStep(1)}>Reveal affected work <ArrowRight size={16} aria-hidden="true" /></ActionButton> : null}
          {step === 1 ? <ActionButton tone="primary" onClick={() => setStep(2)}>Choose a response <ArrowRight size={16} aria-hidden="true" /></ActionButton> : null}
          {step === 2 && !choice ? <p>Select a response above to continue.</p> : null}
          {step === 2 && choice === "rehearse" ? <ActionButton tone="primary" onClick={() => { human("ACCEPT_CHANGE", contract.reviewerId); setStep(3); }}>Accept for synthetic assessment</ActionButton> : null}
          {step === 2 && choice === "hold" ? <ActionButton tone={paused ? "quiet" : "primary"} onClick={() => { if (paused) { setChoice(null); setPaused(false); } else setPaused(true); }}>{paused ? "Reconsider response" : "Pause this journey"}</ActionButton> : null}
          {step === 3 && loop.phase === "CHANGE_ACCEPTED" ? <ActionButton tone="primary" onClick={() => human("CLAIM_WORK", contract.ownerId)}>Claim as Maya</ActionButton> : null}
          {step === 3 && loop.phase === "WORK_CLAIMED" ? <ActionButton tone="primary" onClick={() => human("APPROVE_MISSION", contract.approverId)}>Approve scope as Mateo</ActionButton> : null}
          {step === 3 && loop.phase === "MISSION_APPROVED" ? <ActionButton tone="primary" onClick={() => human("APPROVE_VERIFICATION_PLAN", contract.verificationPlanApproverId)}>Approve check plan as Aisha</ActionButton> : null}
          {step === 3 && loop.phase === "PLAN_APPROVED" ? <ActionButton tone="primary" onClick={() => setStep(4)}>Continue to verification <ArrowRight size={16} aria-hidden="true" /></ActionButton> : null}
          {step === 4 && loop.phase === "PLAN_APPROVED" ? <ActionButton tone="positive" onClick={verify}>Run simulated check</ActionButton> : null}
          {step === 4 && loop.phase === "FIRST_VERIFICATION_FAILED" ? <ActionButton tone="primary" onClick={() => human("APPROVE_LEARNING", contract.runbookApproverId)}>Approve runbook v2 as Mateo</ActionButton> : null}
          {step === 4 && loop.phase === "RUNBOOK_APPROVED" ? <ActionButton tone="positive" onClick={verify}>Replay simulated check</ActionButton> : null}
          {step === 4 && loop.phase === "REPLAY_PASSED" ? <ActionButton tone="primary" onClick={() => setStep(5)}>Review the handoff <ArrowRight size={16} aria-hidden="true" /></ActionButton> : null}
          {step === 5 && loop.phase === "REPLAY_PASSED" ? <ActionButton tone="positive" onClick={() => human("CLOSE_LOOP", contract.closureApproverId)}>Close with passing evidence as Priya</ActionButton> : null}
          {step === 5 && loop.phase === "CLOSED" ? <ActionButton tone="primary" onClick={onClose}>Finish & explore the control plane</ActionButton> : null}
        </div>
      </Panel>
      <p className="journey-boundary">Recorded public context. Fictional people, authored change fixture, and simulated outcomes. Everything you do stays in browser memory and clears on refresh or restart.</p>
    </aside>
  );
}

function Why({ children }: { children: ReactNode }) {
  return <div className="journey-context"><strong>Why this matters</strong><p>{children}</p></div>;
}
function person(id: string) { return TEAM_MEMBERS.find((member) => member.id === id)?.name ?? id; }
function Audit({ loop }: { loop: LoopRun }) {
  return <ol>{loop.audit.map((record) => <li key={record.actionId}>{person(record.actorId)} · {record.action.replaceAll("_", " ").toLowerCase()} · {record.outcome.toLowerCase()} · <time dateTime={record.at}>{record.at}</time> (synthetic time)</li>)}</ol>;
}
