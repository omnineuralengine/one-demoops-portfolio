import { BarChart3, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill } from "@/components/ui/StatusPill";
import type { DemoOpsState } from "@/lib/domain/types";

export function DebriefsView({ state }: { state: DemoOpsState }) {
  return (
    <div className="plane-view" data-testid="debriefs-view">
      <section className="plane-intro plane-intro--debriefs"><div><p className="eyebrow">Explainable learning · no single opaque score</p><h1>Debriefs</h1><p>Each completed mission is reviewed across independent dimensions, with the evidence and a defensible alternative path preserved.</p></div><div className="boundary-note"><BarChart3 size={18} aria-hidden="true" /><span>Strong customer outcomes do not erase weak auditability, privilege, or verification choices.</span></div></section>
      {state.debriefs.length === 0 ? <Panel className="empty-state"><CheckCircle2 size={24} aria-hidden="true" /><h2>No filed debriefs yet</h2><p>Complete a mission, choose a prevention mechanism, and file the result.</p></Panel> : state.debriefs.map((debrief) => { const mission = state.missionCatalog.find((candidate) => candidate.id === debrief.missionId); return <section className="debrief" key={debrief.id}><SectionHeading title={mission?.title ?? debrief.missionId} description={`Completed ${formatFixedDate(debrief.completedAt)} · ${debrief.status}`} /><div className="debrief-grid">{debrief.dimensions.map((dimension) => <Panel as="article" className="debrief-card" key={dimension.key}><div className="card-title-row"><h3>{dimension.label}</h3><StatusPill tone={dimension.score >= 90 ? "success" : dimension.score >= 70 ? "info" : dimension.score >= 45 ? "warning" : "danger"}>{dimension.rating.replaceAll("_", " ")} · {dimension.score}</StatusPill></div><div className="score-track" aria-label={`${dimension.label}: ${dimension.score} out of 100`}><i style={{ width: `${dimension.score}%` }} /></div><p>{dimension.explanation}</p><small><strong>Alternative defensible path:</strong> {dimension.alternativePath}</small></Panel>)}</div><Panel className="timeline"><span className="field-label">Decision replay</span>{debrief.timeline.map((entry) => <div key={entry.id}><time>t={entry.atMinute}m</time><StatusPill tone="amethyst">{entry.phase}</StatusPill><span><strong>{entry.label}</strong><small>{entry.detail}</small></span></div>)}</Panel></section>; })}
    </div>
  );
}

function formatFixedDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}
