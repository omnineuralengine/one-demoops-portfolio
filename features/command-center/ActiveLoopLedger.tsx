"use client";

import { CheckCircle2, GitBranch, RotateCcw, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill } from "@/components/ui/StatusPill";
import { loopReadiness, operationalLearningMetrics, type LoopAction, type LoopRun } from "@/features/causal-loop";
import { TEAM_MEMBERS } from "@/features/team-operations/fixtures/team";

export function ActiveLoopLedger({
  loop,
  onAction,
}: {
  loop: LoopRun;
  onAction: (type: LoopAction["type"], actorId: string, kind: "HUMAN" | "AGENT") => void;
}) {
  const metrics = operationalLearningMetrics(loop);
  const readiness = loopReadiness(loop);
  const latestReceipt = loop.receipts.at(-1);
  const candidateVersionId = loop.learningRecord?.runbookVersionId;
  const afterVersion = candidateVersionId
    ? `${candidateVersionId} · ${loop.activeRunbookVersionId === candidateVersionId ? "active after passing replay" : "approved candidate; replay required"}`
    : "Not created";

  return (
    <section className="active-loop" id="active-loop-ledger" aria-labelledby="active-loop-title">
      <Panel className="active-loop__panel" elevated>
        <SectionHeading
          eyebrow="Active Loop / Loop Ledger"
          title="Causal change-to-learning rehearsal"
          description="One shared state drives Change Radar, ownership, evidence, learning, readiness, and this ledger."
          action={<StatusPill tone={phaseTone(loop.phase)}>{loop.phase.replaceAll("_", " ")}</StatusPill>}
        />

        <dl className="loop-ledger-grid">
          <LedgerField label="Goal" value={loop.contract.goal} />
          <LedgerField label="Trigger" value={loop.contract.trigger} />
          <LedgerField label="Accountable human" value={`${person(loop.contract.accountableHuman)} · backup ${person(loop.contract.backupOwnerId)}`} />
          <LedgerField label="Agent authority boundary" value="May run only approved, local, reversible deterministic checks; cannot approve, close, merge, deploy, or change access." />
          <LedgerField label="Attempt budget" value={`${loop.currentAttempt} / ${loop.contract.maximumAttempts} · ${loop.contract.executionBudgetMs} ms execution · ${loop.contract.timeBudgetMinutes} min human window`} />
          <LedgerField label="Next required human decision" value={nextDecision(loop)} />
          <LedgerField label="Evidence collected" value={`${loop.change.evidence.length + loop.receipts.flatMap((receipt) => receipt.checks).length} classified evidence item(s) · ${loop.receipts.length} verification receipt(s)`} />
          <LedgerField label="Stop / escalation" value={loop.stopReason ?? loop.escalationReason ?? `Stop: ${loop.contract.stopConditions.join("; ")} · Escalate: ${loop.contract.escalationConditions.join("; ")}`} />
          <LedgerField label="Runbook before → after" value={`${loop.runbookVersions[0].id} → ${afterVersion}`} />
          <LedgerField label="Objective verification" value={latestReceipt ? `${latestReceipt.outcome} · ${latestReceipt.checks.filter((check) => check.outcome === "PASS").length}/${latestReceipt.checks.length} controls passed · receipt ${latestReceipt.id}` : "Not run — no receipt exists"} />
          <LedgerField label="Loop readiness" value={`${readiness.state.replaceAll("_", " ")} · ${readiness.reason}`} />
        </dl>

        <div className="loop-metrics" aria-label="Evidence-backed learning measurements">
          <Metric label="Reviewer correction rate" value={formatRate(metrics.reviewerCorrectionRate)} />
          <Metric label="Detection-to-owner time" value={formatMinutes(metrics.detectionToOwnerMinutes)} />
          <Metric label="Handoff completeness" value={formatCompleteness(metrics.handoffCompleteness)} />
          <Metric label="First-pass verification rate" value={formatRate(metrics.firstPassVerificationRate)} />
          <Metric label="Repeated-failure rate" value={formatRate(metrics.repeatedFailureRate)} />
          <Metric label="Runbook freshness" value={formatRate(metrics.runbookFreshness)} />
          <Metric label="Evidence-complete closure rate" value={formatRate(metrics.evidenceCompleteClosureRate)} />
        </div>

        <div className="active-loop__actions">
          {loop.phase === "REPLAY_PASSED" ? (
            <ActionButton tone="positive" onClick={() => onAction("CLOSE_LOOP", loop.contract.closureApproverId, "HUMAN")}>
              <CheckCircle2 size={15} aria-hidden="true" /> Close with passing evidence
            </ActionButton>
          ) : null}
          <ActionButton tone="quiet" onClick={() => onAction("RESET", loop.contract.accountableHuman, "HUMAN")}>
            <RotateCcw size={15} aria-hidden="true" /> Reset deterministic rehearsal
          </ActionButton>
        </div>

        <p className="loop-boundary"><ShieldCheck size={14} aria-hidden="true" /> Deterministic rehearsal · synthetic operational environment · not an Anthropic internal event. This is human-approved operational learning, not autonomous model training or invisible self-modification.</p>
      </Panel>
    </section>
  );
}

function LedgerField({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function person(id: string) {
  return TEAM_MEMBERS.find((member) => member.id === id)?.name ?? id;
}

function nextDecision(loop: LoopRun): string {
  switch (loop.phase) {
    case "OBSERVED": return `${person(loop.contract.reviewerId)} must accept the observed change.`;
    case "CHANGE_ACCEPTED": return `${person(loop.contract.ownerId)} must claim the exact handoff.`;
    case "WORK_CLAIMED": return `${person(loop.contract.approverId)} must approve the draft mission scope.`;
    case "MISSION_APPROVED": return `${person(loop.contract.verificationPlanApproverId)} must approve the reversible verification plan.`;
    case "PLAN_APPROVED": return "None — the approved Verification Agent check is ready to run.";
    case "FIRST_VERIFICATION_FAILED": return `${person(loop.contract.runbookApproverId)} must approve or reject the proposed lesson.`;
    case "RUNBOOK_APPROVED": return "None — the approved scenario replay is ready to run.";
    case "REPLAY_FAILED": return `${person(loop.contract.accountableHuman)} must review the stopped replay; the candidate remains inactive.`;
    case "REPLAY_PASSED": return `${person(loop.contract.closureApproverId)} must review the independent passing receipt and close work.`;
    case "CLOSED": return "None — work is closed with passing evidence.";
  }
}

function formatRate(value: number | "Insufficient observations") {
  return value === "Insufficient observations" ? value : `${Math.round(value * 100)}% · observed`;
}

function formatMinutes(value: number | "Insufficient observations") {
  return value === "Insufficient observations" ? value : `${value.toFixed(0)} min · observed`;
}

function formatCompleteness(value: number | "Insufficient observations") {
  return value === "Insufficient observations" ? value : `${Math.round(value * 12)}/12 fields · this rehearsal`;
}

function phaseTone(phase: LoopRun["phase"]) {
  if (phase === "CLOSED" || phase === "REPLAY_PASSED") return "success" as const;
  if (phase === "FIRST_VERIFICATION_FAILED" || phase === "REPLAY_FAILED") return "danger" as const;
  if (phase === "OBSERVED") return "warning" as const;
  return "info" as const;
}
