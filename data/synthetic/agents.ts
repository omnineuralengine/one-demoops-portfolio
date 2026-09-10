import {
  AGENT_OPERATION_KIND,
  AGENT_PERMISSION_MODE,
  AGENT_STATUS,
} from "../../lib/domain/enums";
import type { OperationalAgent } from "../../lib/domain/types";

export const agents: OperationalAgent[] = [
  agent({
    id: "agent-identity-sentinel",
    name: "Identity Sentinel",
    monitoredDomain: "Identity / SSO",
    status: AGENT_STATUS.HEALTHY,
    confidence: 98,
    finding: "No synthetic authentication anomaly in the current window.",
    next: "Continue observing identity events.",
    mode: AGENT_PERMISSION_MODE.OBSERVE_ONLY,
    allowed: [AGENT_OPERATION_KIND.OBSERVE_SIGNAL],
    links: { policies: ["policy-identity-human-boundary"] },
  }),
  agent({
    id: "agent-scim-drift",
    name: "SCIM Drift Watcher",
    monitoredDomain: "Provisioning",
    status: AGENT_STATUS.WATCHING,
    confidence: 94,
    finding: "Directory and synthetic roster currently reconcile.",
    next: "Run the next read-only roster diff.",
    mode: AGENT_PERMISSION_MODE.EXECUTE_LOW_RISK,
    allowed: [
      AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
      AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
      AGENT_OPERATION_KIND.CLASSIFY_EVENT,
      AGENT_OPERATION_KIND.CREATE_PROPOSED_CHANGE,
    ],
  }),
  agent({
    id: "agent-seat-capacity",
    name: "Seat Capacity Guardian",
    monitoredDomain: "Seat capacity",
    status: AGENT_STATUS.HEALTHY,
    confidence: 99,
    finding: "Fifty-eight synthetic seats remain available.",
    next: "Recommend reclamation if utilization crosses 90%.",
    mode: AGENT_PERMISSION_MODE.RECOMMEND_ONLY,
    allowed: [AGENT_OPERATION_KIND.OBSERVE_SIGNAL, AGENT_OPERATION_KIND.DRAFT_RUNBOOK],
  }),
  agent({
    id: "agent-connector-credentials",
    name: "Connector Credential Monitor",
    monitoredDomain: "Connector credentials",
    status: AGENT_STATUS.ATTENTION,
    confidence: 97,
    finding: "A fictional Zendesk credential reaches its warning threshold in three days.",
    next: "Request human-approved reauthorization before expiry.",
    mode: AGENT_PERMISSION_MODE.HUMAN_APPROVAL_REQUIRED,
    allowed: [
      AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
      AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
      AGENT_OPERATION_KIND.CREATE_PROPOSED_CHANGE,
      AGENT_OPERATION_KIND.ROTATE_CREDENTIAL,
      AGENT_OPERATION_KIND.REAUTHORIZE_CONNECTOR,
    ],
    links: { policies: ["policy-connector-scope-review"] },
  }),
  agent({
    id: "agent-demo-preflight",
    name: "Demo Preflight Agent",
    monitoredDomain: "Upcoming demo readiness",
    status: AGENT_STATUS.WATCHING,
    confidence: 96,
    finding: "Wayne Enterprises has a role/model mismatch; the imminent demos are otherwise ready.",
    next: "Run a synthetic preflight for the next demo.",
    mode: AGENT_PERMISSION_MODE.EXECUTE_LOW_RISK,
    allowed: [
      AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
      AGENT_OPERATION_KIND.RUN_PREFLIGHT,
      AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
      AGENT_OPERATION_KIND.CLASSIFY_EVENT,
      AGENT_OPERATION_KIND.CREATE_PROPOSED_CHANGE,
    ],
    links: { demos: ["massive", "acme", "wayne"] },
  }),
  agent({
    id: "agent-policy-model-access",
    name: "Policy & Model Access Agent",
    monitoredDomain: "Gateway and model governance",
    status: AGENT_STATUS.ATTENTION,
    confidence: 99,
    finding: "Wayne's required Sonnet access is blocked at the Viewer role layer.",
    next: "Propose a roster-backed role correction for human review.",
    mode: AGENT_PERMISSION_MODE.HUMAN_APPROVAL_REQUIRED,
    allowed: [
      AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
      AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
      AGENT_OPERATION_KIND.CREATE_PROPOSED_CHANGE,
      AGENT_OPERATION_KIND.CHANGE_ROLE,
      AGENT_OPERATION_KIND.CHANGE_MODEL_ENTITLEMENT,
      AGENT_OPERATION_KIND.CHANGE_POLICY,
    ],
    links: { demos: ["wayne"], policies: ["policy-model-allowlist"] },
  }),
  agent({
    id: "agent-incident-triage",
    name: "Incident Triage Agent",
    monitoredDomain: "Incident signals",
    status: AGENT_STATUS.HEALTHY,
    confidence: 93,
    finding: "No active incident; two readiness warnings remain visible.",
    next: "Classify the next incoming event and suggest a runbook.",
    mode: AGENT_PERMISSION_MODE.EXECUTE_LOW_RISK,
    allowed: [
      AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
      AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
      AGENT_OPERATION_KIND.CLASSIFY_EVENT,
      AGENT_OPERATION_KIND.DRAFT_RUNBOOK,
    ],
  }),
  agent({
    id: "agent-postmortem-scribe",
    name: "Postmortem Scribe",
    monitoredDomain: "Incident learning",
    status: AGENT_STATUS.WATCHING,
    confidence: 91,
    finding: "No unresolved timeline currently needs a draft.",
    next: "Draft a postmortem after the next verified resolution.",
    mode: AGENT_PERMISSION_MODE.RECOMMEND_ONLY,
    allowed: [AGENT_OPERATION_KIND.OBSERVE_SIGNAL, AGENT_OPERATION_KIND.DRAFT_POSTMORTEM],
  }),
  agent({
    id: "agent-documentation-sentinel",
    name: "Documentation Sentinel",
    monitoredDomain: "Selected public documentation",
    status: AGENT_STATUS.WATCHING,
    confidence: 90,
    finding: "Generated Change Radar metadata contains no unreviewed high-impact change.",
    next: "Observe the next allowlisted local checker result.",
    mode: AGENT_PERMISSION_MODE.OBSERVE_ONLY,
    allowed: [AGENT_OPERATION_KIND.OBSERVE_SIGNAL],
    links: { documentation: ["docs-generated-summary"] },
  }),
  agent({
    id: "agent-change-impact",
    name: "Change Impact Analyst",
    monitoredDomain: "Documentation-to-lab impact",
    status: AGENT_STATUS.WATCHING,
    confidence: 89,
    finding: "No accepted documentation change is pending implementation.",
    next: "Draft an impact assessment when the sentinel detects a change.",
    mode: AGENT_PERMISSION_MODE.RECOMMEND_ONLY,
    allowed: [
      AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
      AGENT_OPERATION_KIND.DRAFT_RUNBOOK,
    ],
    links: { documentation: ["docs-generated-summary"], policies: ["policy-doc-change-review"] },
  }),
];

interface AgentSeed {
  id: string;
  name: string;
  monitoredDomain: string;
  status: OperationalAgent["status"];
  confidence: number;
  finding: string;
  next: string;
  mode: OperationalAgent["permissionMode"];
  allowed: OperationalAgent["allowedOperations"];
  links?: {
    demos?: string[];
    incidents?: string[];
    policies?: string[];
    documentation?: string[];
  };
}

function agent(seed: AgentSeed): OperationalAgent {
  return {
    id: seed.id,
    name: seed.name,
    monitoredDomain: seed.monitoredDomain,
    status: seed.status,
    confidence: seed.confidence,
    lastCheckedAt: "2026-09-02T13:55:00.000Z",
    inputs: ["Deterministic synthetic state", "Local event stream"],
    mostRecentFinding: seed.finding,
    proposedNextAction: seed.next,
    permissionMode: seed.mode,
    escalationPolicy:
      "Escalate uncertainty or consequential scope to a named human approver; never broaden authority silently.",
    requiresApproval: seed.mode === AGENT_PERMISSION_MODE.HUMAN_APPROVAL_REQUIRED,
    allowedOperations: seed.allowed,
    linkedDemoIds: seed.links?.demos ?? [],
    linkedIncidentIds: seed.links?.incidents ?? [],
    linkedPolicyIds: seed.links?.policies ?? [],
    linkedDocumentationChangeIds: seed.links?.documentation ?? [],
  };
}
