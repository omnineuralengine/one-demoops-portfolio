"use client";

import { useMemo, useState } from "react";
import { Gauge, GitFork, LockKeyhole, Route, ScrollText, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill } from "@/components/ui/StatusPill";
import { GatewayCandidateTrace } from "@/features/ai-gateway/GatewayCandidateTrace";
import { useControlPlane } from "@/features/command-center/ControlPlaneProvider";
import { evaluateGatewayRoute } from "@/lib/gateway/routing";
import type {
  DemoOpsState,
  EffectiveModelAccess,
  GatewayCapability,
  GatewayCostBand,
  GatewayRouteInput,
  GatewaySensitivity,
  ModelId,
} from "@/lib/domain/types";

const modelLabels: Record<ModelId, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};

export function AiGatewayView({
  state,
  effectiveAccess,
}: {
  state: DemoOpsState;
  effectiveAccess: EffectiveModelAccess[];
}) {
  const { dispatch } = useControlPlane();
  const initialDemo = state.demos[0];
  const [requesterUserId, setRequesterUserId] = useState(initialDemo?.presenterUserId ?? state.users[0]?.id ?? "");
  const [demoId, setDemoId] = useState(initialDemo?.id ?? "");
  const [capability, setCapability] = useState<GatewayCapability>("DEEP_ANALYSIS");
  const [sensitivity, setSensitivity] = useState<GatewaySensitivity>("SYNTHETIC");
  const [latencyTarget, setLatencyTarget] = useState(5000);
  const [maximumCostBand, setMaximumCostBand] = useState<GatewayCostBand>("HIGH");
  const [previewed, setPreviewed] = useState(false);
  const input = useMemo<GatewayRouteInput>(() => ({
    requesterUserId,
    demoId,
    capability,
    sensitivity,
    latencyTargetMs: latencyTarget,
    maximumCostBand,
  }), [requesterUserId, demoId, capability, sensitivity, latencyTarget, maximumCostBand]);
  const preview = useMemo(() => evaluateGatewayRoute(state, input), [state, input]);
  const displayedDecision = previewed ? state.gateway.routeAudits[0] ?? null : null;
  const budgetPercent = Math.round((state.gateway.budgetUsed / state.gateway.budgetLimit) * 100);

  function explainRoute() {
    dispatch({ type: "GATEWAY_ROUTE_EVALUATE", input, at: new Date().toISOString(), actorId: requesterUserId });
    setPreviewed(true);
  }

  return (
    <div className="plane-view" data-testid="ai-gateway-view">
      <section className="plane-intro plane-intro--gateway">
        <div>
          <p className="eyebrow">Explainable routing · synthetic requests</p>
          <h1>AI Gateway</h1>
          <p>
            One policy plane decides how fictional model calls and agent actions are routed,
            observed, governed, and audited.
          </p>
        </div>
        <div className="boundary-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>No provider request leaves this browser. This is a deterministic policy model.</span>
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard label="Synthetic requests" value={state.gateway.requestCount.toLocaleString("en-US")} detail="seeded request history" icon={Route} tone="amethyst" />
        <MetricCard label="Success rate" value={`${state.gateway.successRate}%`} detail={`error rate ${state.gateway.errorRate}%`} tone="success" />
        <MetricCard label="Latency" value={`${state.gateway.p50LatencyMs} ms`} detail={`p50 · p95 ${state.gateway.p95LatencyMs} ms`} icon={Gauge} />
        <MetricCard label="Fallbacks" value={String(state.gateway.fallbackCount)} detail="policy-eligible requests" icon={GitFork} />
        <MetricCard label="Budget state" value={`${budgetPercent}%`} detail={`${state.gateway.budgetUsed} / ${state.gateway.budgetLimit} synthetic units`} tone={budgetPercent > 85 ? "warning" : "success"} />
      </div>

      <div className="two-column-plane">
        <section>
          <SectionHeading
            icon={Route}
            title="Routing policy preview"
            description="Change the request constraints, then inspect the resulting decision."
          />
          <Panel className="gateway-policy-card">
            <div className="form-grid">
              <label>
                <span>Presenter / requester</span>
                <select value={requesterUserId} onChange={(event) => { setRequesterUserId(event.target.value); setPreviewed(false); }}>
                  {state.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}
                </select>
              </label>
              <label>
                <span>Demo environment policy</span>
                <select
                  value={demoId}
                  onChange={(event) => {
                    const nextDemo = state.demos.find((candidate) => candidate.id === event.target.value);
                    setDemoId(event.target.value);
                    if (nextDemo) setRequesterUserId(nextDemo.presenterUserId);
                    setPreviewed(false);
                  }}
                >
                  {state.demos.map((demo) => <option value={demo.id} key={demo.id}>{demo.customer} · {demo.environment}</option>)}
                </select>
              </label>
              <label>
                <span>Capability requirement</span>
                <select value={capability} onChange={(event) => { setCapability(event.target.value as GatewayCapability); setPreviewed(false); }}>
                  <option value="FAST_CLASSIFICATION">Fast classification</option>
                  <option value="BALANCED_REASONING">Balanced reasoning</option>
                  <option value="DEEP_ANALYSIS">Deep analysis</option>
                </select>
              </label>
              <label>
                <span>Data sensitivity</span>
                <select value={sensitivity} onChange={(event) => { setSensitivity(event.target.value as GatewaySensitivity); setPreviewed(false); }}>
                  <option value="SYNTHETIC">Synthetic</option>
                  <option value="INTERNAL_LAB">Internal lab</option>
                </select>
              </label>
              <label>
                <span>Latency target</span>
                <select value={latencyTarget} onChange={(event) => { setLatencyTarget(Number(event.target.value)); setPreviewed(false); }}>
                  <option value={700}>Under 700 ms</option>
                  <option value={1800}>Under 1,800 ms</option>
                  <option value={5000}>Under 5,000 ms</option>
                </select>
              </label>
              <label>
                <span>Maximum cost band</span>
                <select value={maximumCostBand} onChange={(event) => { setMaximumCostBand(event.target.value as GatewayCostBand); setPreviewed(false); }}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
            </div>
            <div className="form-summary">
              <span>Live policy result</span>
              <strong>{preview.outcome === "ELIGIBLE" && preview.selectedModel ? `${modelLabels[preview.selectedModel]} · ${preview.selectedCostBand}` : "DENIED"}</strong>
            </div>
            <ActionButton tone="primary" onClick={explainRoute}>Explain and record route</ActionButton>

            {displayedDecision ? (
              <div className="route-explanation" aria-live="polite">
                <div className="route-result">
                  <div>
                    <span>Selected model</span>
                    <strong>{displayedDecision.selectedModel ? modelLabels[displayedDecision.selectedModel] : "No eligible model"}</strong>
                  </div>
                  <StatusPill tone={displayedDecision.outcome === "DENIED" ? "danger" : "success"}>{displayedDecision.outcome === "DENIED" ? "Denied" : "Policy eligible"}</StatusPill>
                </div>
                <ol>
                  {displayedDecision.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ol>
                <GatewayCandidateTrace candidates={displayedDecision.candidates} />
                <p className="audit-caption">Evidence {displayedDecision.id} · owner {state.users.find((user) => user.id === displayedDecision.ownerUserId)?.name ?? displayedDecision.ownerUserId} · read-only evaluation, so no execution receipt is required.</p>
              </div>
            ) : null}
          </Panel>
        </section>

        <section>
          <SectionHeading title="Model mix and quota" description="Seeded request distribution; no live billing data." />
          <Panel className="model-mix-card">
            {(Object.entries(state.gateway.modelMix) as [ModelId, number][]).map(([model, value]) => (
              <div className="model-mix-row" key={model}>
                <span>{modelLabels[model]}</span>
                <div aria-hidden="true"><i style={{ width: `${value}%` }} /></div>
                <strong>{value}%</strong>
              </div>
            ))}
            <div className="quota-track" role="meter" aria-label="Synthetic budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budgetPercent}>
              <span>Budget / quota</span>
              <div><i style={{ width: `${budgetPercent}%` }} /></div>
              <strong>{budgetPercent}%</strong>
            </div>
          </Panel>
        </section>
      </div>

      <SectionHeading
        icon={LockKeyhole}
        title="Governance and effective access"
        description="Organization allowlist ∩ role policy ∩ user and tool state."
      />
      <Panel className="data-table-panel">
        <div
          className="table-scroll"
          role="region"
          tabIndex={0}
          aria-label="Effective model access table; scroll horizontally if needed"
        >
          <table>
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Org allowlist</th><th>Role allowlist</th><th>Effective models</th><th>Effort</th><th>Tool boundary</th><th>Blocking layer</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((user) => {
                const access = effectiveAccess.find((candidate) => candidate.userId === user.id);
                const role = state.roles.find((candidate) => candidate.id === access?.roleId);
                const temporaryRoleNote = user.temporaryRoleExpiresAt
                  ? access?.roleId === user.temporaryRoleId
                    ? ` · temporary until ${formatUtc(user.temporaryRoleExpiresAt)}`
                    : ` · temporary elevation expired ${formatUtc(user.temporaryRoleExpiresAt)}`
                  : "";
                return (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td>{role?.name ?? "Unresolved"}{temporaryRoleNote}</td>
                    <td>{state.organizationModelPolicy.enabledModels.map((model) => modelLabels[model]).join(", ")}</td>
                    <td>{access?.roleModels.map((model) => modelLabels[model]).join(", ") || "None"}</td>
                    <td>{access?.effectiveModels.map((model) => modelLabels[model]).join(", ") || "None"}</td>
                    <td>{access?.effectiveEffortLimit ?? "Blocked"}</td>
                    <td>{access?.effectiveToolPermissions.join(", ") || "None"}</td>
                    <td>{access?.blockingLayers.join(" · ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="two-column-plane">
        <section>
          <SectionHeading icon={ScrollText} title="Recent routed requests" description="Provenance and policy rationale stay attached." />
          <div className="request-list">
            {state.gateway.recentRequests.map((request) => (
              <Panel as="article" className="request-card" key={request.id}>
                <div className="card-title-row">
                  <div><p className="card-kicker">{request.provenance.replaceAll("_", " ")}</p><h3>{request.capability}</h3></div>
                  <StatusPill tone={request.outcome === "DENIED" || request.outcome === "FAILED" ? "danger" : request.outcome === "FALLBACK_SUCCEEDED" ? "warning" : "success"}>{request.outcome.replaceAll("_", " ")}</StatusPill>
                </div>
                <p>{modelLabels[request.selectedModel]} · {request.effort} effort · {request.latencyMs} ms · {request.sensitivity}</p>
                <ul>{request.policyExplanation.map((item) => <li key={item}>{item}</li>)}</ul>
              </Panel>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading icon={ShieldCheck} title="Human boundary" description="No high-impact action skips a phase." />
          <Panel className="human-boundary">
            {[
              ["Observe", "Read signals and collect provenance."],
              ["Recommend", "Explain the finding and alternatives."],
              ["Propose", "Name target, risk, rollback, and verification."],
              ["Approve", "A human issues an exact-scope receipt."],
              ["Execute", "The bounded action consumes the receipt."],
              ["Verify", "Post-conditions decide whether work is done."],
            ].map(([phase, explanation], index) => (
              <div key={phase}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{phase}</strong>
                <p>{explanation}</p>
              </div>
            ))}
          </Panel>
          <Panel className="audit-summary">
            <span className="field-label">Decision and action audit</span>
            <strong>{state.organizationModelPolicy.sensitiveDataTier.replaceAll("_", " ")} · {state.approvals.length} approval receipt(s)</strong>
            <p>Read-only route evaluations and governed agent actions retain their owner, exact scope, decision state, and receipt reference for this session.</p>
            <div className="gateway-audit-list">
              {state.gateway.routeAudits.slice(0, 4).map((audit) => (
                <div className="gateway-audit-row" key={audit.id}>
                  <div>
                    <span>{audit.id} · route evaluation</span>
                    <strong>{state.users.find((user) => user.id === audit.ownerUserId)?.name ?? audit.ownerUserId} → {state.demos.find((demo) => demo.id === audit.demoId)?.environment ?? audit.demoId}</strong>
                  </div>
                  <StatusPill tone={audit.outcome === "DENIED" ? "danger" : "success"}>{audit.outcome}</StatusPill>
                  <small>Receipt: not required · read-only</small>
                </div>
              ))}
              {state.agentActionProposals.slice(0, 4).map((proposal) => (
                <div className="gateway-audit-row" key={proposal.id}>
                  <div>
                    <span>{proposal.id} · {proposal.operation.replaceAll("_", " ")}</span>
                    <strong>{state.agents.find((agent) => agent.id === proposal.agentId)?.name ?? proposal.agentId} → {proposal.targetId}</strong>
                  </div>
                  <StatusPill tone={proposal.status === "DENIED" ? "danger" : proposal.status === "PROPOSED" ? "warning" : "success"}>{proposal.status}</StatusPill>
                  <small>Receipt: {proposal.approvalId ?? "pending human decision"}</small>
                </div>
              ))}
              {state.gateway.routeAudits.length === 0 && state.agentActionProposals.length === 0 ? (
                <p className="empty-inline">No new session decisions yet. Explain a route or propose an agent action to create evidence.</p>
              ) : null}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function formatUtc(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}
