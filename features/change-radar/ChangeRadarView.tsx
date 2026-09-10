"use client";

import { ArrowUpRight, FileClock, Radar, RotateCcw, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { LoopAction, LoopRun } from "@/features/causal-loop";
import { PUBLIC_CHANGE_REFERENCE } from "@/features/causal-loop/public-reference";
import type { PublicChangeEvent, RadarSourceHealth } from "@/lib/change-radar/types";

type LoopActionHandler = (type: LoopAction["type"], actorId: string, kind: "HUMAN" | "AGENT") => void;

export function ChangeRadarView({
  liveEvents,
  sourceHealth,
  loop,
  onLoopAction,
}: {
  liveEvents: readonly PublicChangeEvent[];
  sourceHealth: readonly RadarSourceHealth[];
  loop: LoopRun;
  onLoopAction: LoopActionHandler;
}) {
  const healthy = sourceHealth.filter((source) => source.stage === "HEALTHY").length;
  const lastLiveEvent = [...liveEvents].sort((a, b) => a.detectedAt.localeCompare(b.detectedAt)).at(-1);

  return (
    <div className="plane-view" data-testid="change-radar-view">
      <section className="plane-intro plane-intro--radar">
        <div>
          <p className="eyebrow">External intelligence · public sources only</p>
          <h1>Anthropic Change Radar</h1>
          <p>Inspect recorded public context, trace possible effects on fictional demos, and decide who should investigate. A source change alone cannot prove operational impact.</p>
        </div>
        <div className="boundary-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Fetched text is untrusted input. It is never executed, rendered as HTML, placed in a model prompt, or allowed to issue instructions.</span>
        </div>
      </section>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="Recorded source events" value={String(liveEvents.length)} detail="validated repository artifacts" icon={Radar} tone={liveEvents.length ? "warning" : "neutral"} />
        <MetricCard label="Source transport" value={sourceHealth.length ? `${healthy}/${sourceHealth.length}` : "No run"} detail="isolated health records" icon={ShieldCheck} tone={sourceHealth.length && healthy !== sourceHealth.length ? "warning" : "success"} />
        <MetricCard label="Latest recorded detection" value={lastLiveEvent ? "Recorded" : "None"} detail={lastLiveEvent ? `${formatTimestamp(lastLiveEvent.detectedAt)} UTC` : "No browser source fetching"} icon={FileClock} />
        <MetricCard label="Rehearsal attempt" value={`${loop.currentAttempt}/${loop.contract.maximumAttempts}`} detail="deterministic and resettable" icon={RotateCcw} />
      </div>

      <SectionHeading
        icon={Radar}
        title="A public change, followed by a fictional rehearsal"
        description="The dated public reference is separate from the authored entitlement fixture used to practice the response."
      />

      <Panel className="team-card">
        <StatusPill tone="amethyst">Recorded public reference</StatusPill>
        <h2>{PUBLIC_CHANGE_REFERENCE.title}</h2>
        <p>{PUBLIC_CHANGE_REFERENCE.summary}</p>
        <p>Published {PUBLIC_CHANGE_REFERENCE.publishedOn} · manually reviewed {PUBLIC_CHANGE_REFERENCE.reviewedAt}</p>
        <a className="source-link" href={PUBLIC_CHANGE_REFERENCE.url} target="_blank" rel="noreferrer">Inspect the dated release note <ArrowUpRight size={14} aria-hidden="true" /></a>
        <p>{PUBLIC_CHANGE_REFERENCE.boundary}</p>
      </Panel>

      <Panel as="article" className="change-card rehearsal-change" id="rehearsal-change-evidence">
        <div className="change-card__header">
          <div>
            <div className="pill-row">
              <StatusPill tone="amethyst">Authored change fixture</StatusPill>
              <StatusPill tone="info">Synthetic operational environment</StatusPill>
              <StatusPill tone="warning">Not an Anthropic internal event</StatusPill>
              <StatusPill tone={phaseTone(loop.phase)}>{loop.phase.replaceAll("_", " ")}</StatusPill>
            </div>
            <h3>{loop.change.title}</h3>
            <p>Illustrative entitlement wording · {loop.change.headingPath.join(" › ")}. The source URL is a public reference, not evidence for these authored sentences.</p>
          </div>
          <a className="source-link" href={loop.change.canonicalUrl} target="_blank" rel="noreferrer">
            Open public source reference <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>

        <h3>What changed?</h3>
        <div className="journey-diff">
          <div><span className="field-label">Before · authored fixture</span><p>{loop.change.excerptBefore}</p></div>
          <div><span className="field-label">After · authored fixture</span><p>{loop.change.excerptAfter}</p></div>
        </div>
        <p><strong>Why this matters:</strong> A fictional presenter may need a model that their role does not allow. Review the demo, preflight runbook, and AI Gateway briefing before treating it as ready.</p>
        <details className="journey-details">
          <summary>Inspect fixture classification, hashes & timestamp</summary>
        <div className="change-card__body change-card__body--five">
          {loop.change.evidence.map((evidence) => (
            <div key={evidence.label}>
              <span className="field-label">{evidence.label}</span>
              <p>{evidence.value}</p>
            </div>
          ))}
        </div>

        <div className="evidence-provenance">
          <div><span>Source</span><code>{loop.change.sourceId}</code></div>
          <div><span>Previous SHA-256</span><code>{loop.change.previousHash}</code></div>
          <div><span>Current SHA-256</span><code>{loop.change.currentHash}</code></div>
          <div><span>Event ID</span><code>{loop.change.id}</code></div>
          <div><span>Fixture timestamp · synthetic</span><code>{loop.change.detectedAt}</code></div>
          <div><span>Evidence receipt</span><code>{loop.change.evidenceReceiptId}</code></div>
        </div>
        </details>

        <div className="change-card__actions">
          {loop.phase === "OBSERVED" ? (
            <>
              <ActionButton tone="primary" onClick={() => onLoopAction("ACCEPT_CHANGE", loop.contract.reviewerId, "HUMAN")}>Accept for synthetic assessment</ActionButton>
              <p className="inline-receipt">No mission, work item, handoff, stale runbook, transcript, or verification receipt exists before this human decision.</p>
            </>
          ) : (
            <p className="inline-receipt">Human review decision {loop.reviewDecision?.id} created the linked draft mission and handoff. No policy or entitlement changed.</p>
          )}
          <ActionButton tone="quiet" compact onClick={() => onLoopAction("RESET", loop.contract.accountableHuman, "HUMAN")}>Reset rehearsal</ActionButton>
        </div>
      </Panel>

      <SectionHeading
        eyebrow="Recorded public-source boundary"
        title="Validated emitted observations"
        description="These artifacts are loaded from the repository. Visitors do not trigger a fetch, connect an account, or spend provider credits."
      />
      {liveEvents.length === 0 ? (
        <Panel className="empty-state">
          <Radar size={24} aria-hidden="true" />
          <h3>No recorded source delta</h3>
          <p>No live change is claimed. The optional maintainer-run public-source checker can refresh artifacts separately; the guided journey uses the labeled fixture above.</p>
        </Panel>
      ) : (
        <div className="change-list">
          {liveEvents.map((event) => <LiveEventCard event={event} key={event.id} />)}
        </div>
      )}

      <Panel className="partnership-note"><strong>Truth boundary</strong><p>Live events contain observed public metadata and bounded excerpts. Impact domains and affected fictional assets are deterministic builder inference. Missions, people, runbooks, verification, and learning are synthetic proposals until the named fictional human acts.</p></Panel>
    </div>
  );
}

function LiveEventCard({ event }: { event: PublicChangeEvent }) {
  return (
    <Panel as="article" className="change-card">
      <div className="change-card__header">
        <div><div className="pill-row"><StatusPill tone="info">Recorded public observation</StatusPill><StatusPill tone={impactTone(event.impactLevel)}>{event.impactLevel.replaceAll("_", " ")}</StatusPill></div><h3>{event.sourceTitle}</h3><p>{event.headingPath.join(" › ") || event.changeType.replaceAll("_", " ")} · occurrence {event.headingOccurrence} · captured {formatTimestamp(event.fetchedAt)} UTC</p></div>
        <a className="source-link" href={event.canonicalUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
      <div className="change-card__body">
        <div><span className="field-label">OBSERVED</span><p>{event.observedFacts.join(" · ") || "Validated source metadata and content hash."}</p></div>
        <div><span className="field-label">DERIVED</span><p>{event.changeType.replaceAll("_", " ")} · hash {event.currentHash.slice(0, 16)}…</p></div>
        <div><span className="field-label">INFERRED · NOT SOURCE FACT</span><p>{event.inferredImpactDomains.join(" · ") || "No impact domain inferred."}</p></div>
        <div><span className="field-label">PROPOSED</span><p>{event.proposedActions.join(" · ") || "No operational action proposed."}</p></div>
      </div>
    </Panel>
  );
}

function phaseTone(phase: LoopRun["phase"]): StatusTone {
  if (phase === "OBSERVED") return "warning";
  if (phase === "FIRST_VERIFICATION_FAILED") return "danger";
  if (phase === "CLOSED" || phase === "REPLAY_PASSED") return "success";
  return "info";
}

function impactTone(impact: PublicChangeEvent["impactLevel"]): StatusTone {
  if (impact === "HIGH" || impact === "REVIEW_REQUIRED") return "warning";
  return impact === "MEDIUM" ? "info" : "neutral";
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}
