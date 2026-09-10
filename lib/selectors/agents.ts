import type { LoopRun } from "../../features/causal-loop";
import type { PublicChangeEvent } from "../change-radar/types";
import { AGENT_STATUS, INCIDENT_STATUS } from "../domain/enums";
import type {
  AgentActionProposal,
  DemoOpsState,
  OperationalAgent,
} from "../domain/types";
import { memoizeLast } from "../utils/memoize";
import { evaluateDemoAccess } from "./effective-access";

const agentBySystem: Partial<Record<string, string>> = {
  identity: "agent-identity-sentinel",
  scim: "agent-scim-drift",
  connectors: "agent-connector-credentials",
  model_governance: "agent-policy-model-access",
};

const OPEN_AGENT_PROPOSAL_STATUSES = new Set<AgentActionProposal["status"]>([
  "PROPOSED",
  "APPROVED",
  "EXECUTED",
]);

export interface CausalAgentContext {
  publicChanges?: readonly PublicChangeEvent[];
  loop?: LoopRun;
}

export function selectOpenAgentProposal(
  proposals: readonly AgentActionProposal[],
  agentId: string,
): AgentActionProposal | null {
  return proposals.find(
    (proposal) =>
      proposal.agentId === agentId &&
      OPEN_AGENT_PROPOSAL_STATUSES.has(proposal.status),
  ) ?? null;
}

export function computeCausalAgents(
  state: DemoOpsState,
  context: CausalAgentContext = {},
): OperationalAgent[] {
  const activeIncidents = state.incidents.filter(
    (incident) => incident.status !== INCIDENT_STATUS.RESOLVED,
  );
  const resolvedIncidents = state.incidents.filter(
    (incident) => incident.status === INCIDENT_STATUS.RESOLVED,
  );
  const pendingProposals = state.agentActionProposals.filter(
    (proposal) => proposal.status === "PROPOSED",
  );
  const publicChanges = context.publicChanges ?? [];
  const blockedDemos = state.demos.filter(
    (demo) => evaluateDemoAccess(state, demo.id)?.ready === false,
  );
  const deniedGatewayRequests = state.gateway.recentRequests.filter(
    (request) => request.outcome === "DENIED",
  );
  const deniedRouteAudits = state.gateway.routeAudits.filter(
    (audit) => audit.outcome === "DENIED",
  );

  return state.agents.map((agent) => {
    const directlyLinked = activeIncidents.filter((incident) => {
      const scenario = state.incidentScenarios.find(
        (candidate) => candidate.key === incident.scenarioKey,
      );
      return scenario && agentBySystem[scenario.systemId] === agent.id;
    });
    const pendingForAgent = pendingProposals.some(
      (proposal) => proposal.agentId === agent.id,
    );

    if (directlyLinked.length > 0) {
      return {
        ...agent,
        status: AGENT_STATUS.ATTENTION,
        mostRecentFinding: `${directlyLinked.length} active incident(s) require attention in ${agent.monitoredDomain}.`,
        linkedIncidentIds: directlyLinked.map((incident) => incident.id),
      };
    }

    if (pendingForAgent) {
      return { ...agent, status: AGENT_STATUS.WAITING_FOR_HUMAN };
    }

    if (agent.id === "agent-incident-triage" && activeIncidents.length > 0) {
      return {
        ...agent,
        status: AGENT_STATUS.ATTENTION,
        mostRecentFinding: `${activeIncidents.length} active incident(s) are awaiting triage or remediation.`,
        linkedIncidentIds: activeIncidents.map((incident) => incident.id),
      };
    }

    if (agent.id === "agent-postmortem-scribe" && resolvedIncidents.length > 0) {
      return {
        ...agent,
        status: AGENT_STATUS.WATCHING,
        mostRecentFinding: `${resolvedIncidents.length} verified incident timeline(s) are available for a draft.`,
        linkedIncidentIds: resolvedIncidents.map((incident) => incident.id),
      };
    }

    if (agent.id === "agent-documentation-sentinel") {
      return deriveDocumentationSentinel(
        agent,
        publicChanges,
        context.loop,
      );
    }

    if (agent.id === "agent-change-impact") {
      return deriveChangeImpactAnalyst(
        agent,
        publicChanges,
        context.loop,
      );
    }

    if (agent.id === "agent-policy-model-access") {
      const fallbackCount = state.gateway.recentRequests.filter(
        (request) => request.outcome === "FALLBACK_SUCCEEDED",
      ).length;
      const deniedGatewayDecisions = deniedGatewayRequests.length + deniedRouteAudits.length;
      const hasPolicyAttention = blockedDemos.length > 0 || deniedGatewayDecisions > 0;
      return {
        ...agent,
        status: hasPolicyAttention ? AGENT_STATUS.ATTENTION : AGENT_STATUS.HEALTHY,
        mostRecentFinding: hasPolicyAttention
          ? `${blockedDemos.length} demo(s) are blocked by effective access; ${deniedGatewayDecisions} recent gateway decision(s) were denied and ${fallbackCount} used fallback.`
          : `Every demo requirement intersects cleanly with current gateway policy; ${fallbackCount} recent request(s) used an allowed fallback.`,
        proposedNextAction: hasPolicyAttention
          ? "Explain the narrowest blocking policy layer and prepare a human-reviewed correction."
          : "Continue comparing demo requirements with effective model and tool access.",
        linkedDemoIds: blockedDemos.map((demo) => demo.id),
        linkedPolicyIds: [
          ...new Set([
            ...agent.linkedPolicyIds,
            "policy-model-allowlist",
            "policy-sensitive-data-tier",
            "policy-fallback-eligibility",
          ]),
        ],
      };
    }

    if (
      agent.id === "agent-demo-preflight" &&
      state.demos.some((demo) => demo.atRisk && demo.minutesUntil <= 60)
    ) {
      const linked = state.demos
        .filter((demo) => demo.atRisk && demo.minutesUntil <= 60)
        .map((demo) => demo.id);
      return {
        ...agent,
        status: AGENT_STATUS.ATTENTION,
        mostRecentFinding: `${linked.length} imminent demo(s) are at risk.`,
        linkedDemoIds: linked,
      };
    }

    return agent;
  });
}

function deriveDocumentationSentinel(
  agent: OperationalAgent,
  publicChanges: readonly PublicChangeEvent[],
  loop: LoopRun | undefined,
): OperationalAgent {
  const awaitingAcknowledgement = loop?.phase === "OBSERVED" ? 1 : 0;

  return {
    ...agent,
    status: awaitingAcknowledgement > 0
      ? AGENT_STATUS.ATTENTION
      : publicChanges.length > 0
        ? AGENT_STATUS.WATCHING
        : AGENT_STATUS.HEALTHY,
    mostRecentFinding: awaitingAcknowledgement > 0
      ? "One validated rehearsal event requires a named human review; live-source health remains separate."
      : publicChanges.length > 0
        ? `${publicChanges.length} emitted public-source observation(s) remain available for human review.`
      : "No emitted public-source delta is waiting in the validated latest artifact.",
    proposedNextAction: awaitingAcknowledgement > 0
      ? "Present the exact source evidence for human acknowledgement; do not alter lab policy."
      : "Continue observing the next allowlisted local checker result.",
    linkedDocumentationChangeIds: loop
      ? [...new Set([loop.change.id, ...publicChanges.map((change) => change.id)])]
      : publicChanges.map((change) => change.id),
  };
}

function deriveChangeImpactAnalyst(
  agent: OperationalAgent,
  publicChanges: readonly PublicChangeEvent[],
  loop: LoopRun | undefined,
): OperationalAgent {
  const detected = loop?.phase === "OBSERVED" ? 1 : 0;
  const triaged = 0;
  const proposed = loop && !["OBSERVED", "CLOSED"].includes(loop.phase) ? 1 : 0;

  if (proposed > 0) {
    return {
      ...agent,
      status: AGENT_STATUS.WAITING_FOR_HUMAN,
      mostRecentFinding: `${proposed} accepted rehearsal change is progressing through named human decisions and bounded verification.`,
      proposedNextAction: "Preserve the evidence boundary and wait at the next named human gate.",
      linkedDocumentationChangeIds: loop ? [loop.change.id] : publicChanges.map((change) => change.id),
    };
  }

  if (triaged > 0) {
    return {
      ...agent,
      status: AGENT_STATUS.ATTENTION,
      mostRecentFinding: `${triaged} triaged public-source observation(s) are ready for a bounded impact proposal.`,
      proposedNextAction: "Draft impacted lab domains and a proposed update without changing policy or permissions.",
      linkedDocumentationChangeIds: publicChanges.map((change) => change.id),
    };
  }

  if (detected > 0) {
    return {
      ...agent,
      status: AGENT_STATUS.WAITING_FOR_HUMAN,
      mostRecentFinding: `${detected} detected observation(s) await human acknowledgement before impact analysis.`,
      proposedNextAction: "Wait for human triage, then draft the narrowest evidence-backed impact proposal.",
      linkedDocumentationChangeIds: publicChanges.map((change) => change.id),
    };
  }

  return {
    ...agent,
    status: AGENT_STATUS.HEALTHY,
    mostRecentFinding: publicChanges.length > 0
      ? "Every emitted public-source observation remains evidence only until a human decision."
      : "No actionable public-source observation is waiting for impact analysis.",
    proposedNextAction: "Remain ready to assess the next human-triaged observation.",
    linkedDocumentationChangeIds: publicChanges.map((change) => change.id),
  };
}

export const selectCausalAgents = memoizeLast(computeCausalAgents);
