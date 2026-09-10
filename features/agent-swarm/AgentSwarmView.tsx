"use client";

import { Bot, Link2, LockKeyhole, RadioTower, ShieldAlert } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { AGENT_OPERATION_CATALOG } from "@/lib/domain/agents";
import { AGENT_OPERATION_KIND } from "@/lib/domain/enums";
import type {
  AgentActionProposal,
  AgentOperationKind,
  DemoOpsState,
  OperationalAgent,
} from "@/lib/domain/types";
import { selectOpenAgentProposal } from "@/lib/selectors/agents";
import { AuthorityMatrix } from "./AuthorityMatrix";

function agentTone(status: OperationalAgent["status"]): StatusTone {
  if (status === "HEALTHY") return "success";
  if (status === "ATTENTION") return "danger";
  if (status === "WAITING_FOR_HUMAN") return "warning";
  if (status === "DISABLED") return "neutral";
  return "info";
}

function permissionTone(permission: OperationalAgent["permissionMode"]): StatusTone {
  if (permission === "EXECUTE_LOW_RISK") return "success";
  if (permission === "HUMAN_APPROVAL_REQUIRED") return "warning";
  if (permission === "DISABLED") return "neutral";
  return "amethyst";
}

export function AgentSwarmView({
  state,
  onPropose,
  onApprove,
  onDeny,
  onExecute,
  onVerify,
}: {
  state: DemoOpsState;
  onPropose: (agentId: string, operation: AgentOperationKind, targetId: string) => void;
  onApprove: (proposalId: string) => void;
  onDeny: (proposalId: string) => void;
  onExecute: (proposalId: string) => void;
  onVerify: (proposalId: string) => void;
}) {
  const waiting = state.agents.filter((agent) => agent.status === "WAITING_FOR_HUMAN").length;
  const attention = state.agents.filter((agent) => agent.status === "ATTENTION").length;
  const lowRisk = state.agents.filter((agent) => agent.permissionMode === "EXECUTE_LOW_RISK").length;

  return (
    <div className="plane-view" data-testid="agent-swarm-view">
      <section className="plane-intro plane-intro--agents">
        <div>
          <p className="eyebrow">Governed synthetic operations</p>
          <h1>Agent Swarm</h1>
          <p>
            Ten small agents watch shared state. Authority is explicit, narrow, and never silently
            broadened.
          </p>
        </div>
        <div className="boundary-note">
          <LockKeyhole size={18} aria-hidden="true" />
          <span>Only reversible synthetic checks and drafts may execute without a person.</span>
        </div>
      </section>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="Agents" value={String(state.agents.length)} detail="bounded specialists" icon={Bot} tone="amethyst" />
        <MetricCard label="Attention" value={String(attention)} detail="causal findings" icon={ShieldAlert} tone={attention ? "warning" : "success"} />
        <MetricCard label="Waiting for human" value={String(waiting)} detail="consequential proposals" tone={waiting ? "warning" : "success"} />
        <MetricCard label="Low-risk executors" value={String(lowRisk)} detail="reversible operations only" icon={RadioTower} tone="success" />
      </div>

      <SectionHeading
        icon={Bot}
        title="Monitor plane"
        description="Findings react to incidents, upcoming demos, gateway policy, and documentation changes."
      />
      <AuthorityMatrix />
      <div className="agent-grid">
        {state.agents.map((agent) => {
          const proposal = selectOpenAgentProposal(state.agentActionProposals, agent.id);
          const interactiveAction = selectInteractiveAction(state, agent);
          const operationDef = proposal
            ? AGENT_OPERATION_CATALOG[proposal.operation]
            : interactiveAction
              ? AGENT_OPERATION_CATALOG[interactiveAction.operation]
              : null;
          const executionSupported = proposal
            ? hasModeledDeterministicEffect(state, proposal)
            : false;
          return (
            <Panel as="article" className="agent-card" key={agent.id}>
              <div className="card-title-row">
                <div>
                  <p className="card-kicker">{agent.monitoredDomain}</p>
                  <h3>{agent.name}</h3>
                </div>
                <StatusPill tone={agentTone(agent.status)}>{agent.status.replaceAll("_", " ")}</StatusPill>
              </div>

              <div className="confidence-row">
                <span>Confidence</span>
                <div className="confidence-track" aria-hidden="true"><i style={{ width: `${agent.confidence}%` }} /></div>
                <strong>{agent.confidence}%</strong>
              </div>

              <dl className="agent-detail-list">
                <div><dt>Last check</dt><dd>{formatFixedTime(agent.lastCheckedAt)}</dd></div>
                <div><dt>Signals</dt><dd>{agent.inputs.join(" · ")}</dd></div>
                <div><dt>Finding</dt><dd>{agent.mostRecentFinding}</dd></div>
                <div><dt>Next action</dt><dd>{agent.proposedNextAction}</dd></div>
                <div><dt>Escalates when</dt><dd>{agent.escalationPolicy}</dd></div>
              </dl>

              <div className="agent-authority">
                <StatusPill tone={permissionTone(agent.permissionMode)}>{agent.permissionMode.replaceAll("_", " ")}</StatusPill>
                <span>{permissionSummary(agent)}</span>
              </div>

              <div className="linked-context">
                <Link2 size={13} aria-hidden="true" />
                <span>{linkedContext(state, agent)}</span>
              </div>

              {proposal && operationDef ? (
                <ProposalControls proposal={proposal} operation={operationDef.label} requiresApproval={operationDef.requiresHumanApproval} executionSupported={executionSupported} onApprove={onApprove} onDeny={onDeny} onExecute={onExecute} onVerify={onVerify} />
              ) : interactiveAction && operationDef ? (
                <ActionButton
                  compact
                  tone="primary"
                  onClick={() => onPropose(agent.id, interactiveAction.operation, interactiveAction.targetId)}
                >
                  Run preflight · {interactiveAction.targetLabel}
                </ActionButton>
              ) : (
                <ActionButton compact disabled>{inactiveActionLabel(agent)}</ActionButton>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function ProposalControls({
  proposal,
  operation,
  requiresApproval,
  executionSupported,
  onApprove,
  onDeny,
  onExecute,
  onVerify,
}: {
  proposal: AgentActionProposal;
  operation: string;
  requiresApproval: boolean;
  executionSupported: boolean;
  onApprove: (proposalId: string) => void;
  onDeny: (proposalId: string) => void;
  onExecute: (proposalId: string) => void;
  onVerify: (proposalId: string) => void;
}) {
  return (
    <div className="proposal-controls">
      <p><strong>{proposal.status}</strong> · {operation} · target <code>{proposal.targetId}</code></p>
      {!executionSupported && proposal.status === "PROPOSED" ? (
        <div className="button-row">
          <StatusPill tone="neutral">Execution is not offered without a modeled deterministic target effect.</StatusPill>
          <ActionButton compact tone="quiet" onClick={() => onDeny(proposal.id)}>Deny proposal</ActionButton>
        </div>
      ) : null}
      {executionSupported && proposal.status === "PROPOSED" ? (
        requiresApproval ? (
          <div className="button-row">
            <ActionButton compact tone="positive" onClick={() => onApprove(proposal.id)}>Human approve</ActionButton>
            <ActionButton compact tone="quiet" onClick={() => onDeny(proposal.id)}>Deny</ActionButton>
          </div>
        ) : (
          <ActionButton compact tone="primary" onClick={() => onExecute(proposal.id)}>Execute within low-risk boundary</ActionButton>
        )
      ) : null}
      {!executionSupported && proposal.status === "APPROVED" ? (
        <StatusPill tone="neutral">Approved receipt retained; execution is unavailable for this unmodeled effect.</StatusPill>
      ) : null}
      {executionSupported && proposal.status === "APPROVED" ? (
        <ActionButton compact tone="primary" onClick={() => onExecute(proposal.id)}>Execute with receipt</ActionButton>
      ) : null}
      {executionSupported && proposal.status === "EXECUTED" ? <ActionButton compact tone="positive" onClick={() => onVerify(proposal.id)}>Verify outcome</ActionButton> : null}
      {!executionSupported && proposal.status === "EXECUTED" ? <StatusPill tone="neutral">Execution receipt is read only because no deterministic effect is modeled.</StatusPill> : null}
      {proposal.status === "VERIFIED" ? <StatusPill tone="success">Verified receipt recorded</StatusPill> : null}
      {proposal.status === "DENIED" ? <StatusPill tone="neutral">Human denied</StatusPill> : null}
    </div>
  );
}

interface InteractiveAgentAction {
  operation: AgentOperationKind;
  targetId: string;
  targetLabel: string;
}

function hasModeledDeterministicEffect(
  state: DemoOpsState,
  proposal: AgentActionProposal,
): boolean {
  return (
    proposal.operation === AGENT_OPERATION_KIND.RUN_PREFLIGHT &&
    state.demos.some((demo) => demo.id === proposal.targetId)
  );
}

function selectInteractiveAction(
  state: DemoOpsState,
  agent: OperationalAgent,
): InteractiveAgentAction | null {
  if (
    agent.id !== "agent-demo-preflight" ||
    agent.permissionMode !== "EXECUTE_LOW_RISK" ||
    !agent.allowedOperations.includes(AGENT_OPERATION_KIND.RUN_PREFLIGHT)
  ) {
    return null;
  }

  const linkedIds = new Set(agent.linkedDemoIds);
  const demo = [...state.demos]
    .filter((candidate) => linkedIds.has(candidate.id))
    .sort((left, right) => {
      const riskDifference = Number(right.atRisk) - Number(left.atRisk);
      return riskDifference || left.minutesUntil - right.minutesUntil;
    })[0];

  return demo
    ? {
        operation: AGENT_OPERATION_KIND.RUN_PREFLIGHT,
        targetId: demo.id,
        targetLabel: demo.customer,
      }
    : null;
}

function permissionSummary(agent: OperationalAgent): string {
  if (agent.permissionMode === "OBSERVE_ONLY") {
    return "Reads signals only; cannot create or execute changes.";
  }
  if (agent.permissionMode === "RECOMMEND_ONLY") {
    return "Drafts recommendations only; cannot create executable changes.";
  }
  if (agent.permissionMode === "EXECUTE_LOW_RISK") {
    return "May run only explicit, reversible synthetic operations without approval.";
  }
  if (agent.permissionMode === "HUMAN_APPROVAL_REQUIRED") {
    return "Consequential execution requires a current exact-scope human receipt.";
  }
  return "Disabled; no action or recommendation authority.";
}

function inactiveActionLabel(agent: OperationalAgent): string {
  if (agent.permissionMode === "OBSERVE_ONLY") return "Observation only";
  if (agent.permissionMode === "RECOMMEND_ONLY") return "Recommendation only";
  if (agent.permissionMode === "HUMAN_APPROVAL_REQUIRED") {
    return "Execution unavailable without a modeled exact target";
  }
  if (agent.permissionMode === "DISABLED") return "Agent disabled";
  return "No causal low-risk action available";
}

function linkedContext(state: DemoOpsState, agent: OperationalAgent): string {
  const demos = state.demos.filter((demo) => agent.linkedDemoIds.includes(demo.id)).map((demo) => demo.customer);
  const incidents = state.incidents.filter((incident) => agent.linkedIncidentIds.includes(incident.id)).map((incident) => incident.scenarioKey.replaceAll("_", " "));
  const policies = agent.linkedPolicyIds;
  const documents = agent.linkedDocumentationChangeIds;
  const all = [...demos, ...incidents, ...policies, ...documents];
  return all.length ? all.join(" · ") : "Shared lab state";
}

function formatFixedTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}
