import {
  ACTION_PHASE,
  AGENT_OPERATION_KIND,
  AGENT_PERMISSION_MODE,
  RISK_LEVEL,
} from "./enums";
import type {
  AgentAuthorizationDecision,
  AgentOperationDefinition,
  AgentOperationKind,
  ApprovalReceipt,
  OperationalAgent,
} from "./types";
import { isApprovalUsable } from "./approvals";

export const AGENT_OPERATION_CATALOG: Record<
  AgentOperationKind,
  AgentOperationDefinition
> = {
  [AGENT_OPERATION_KIND.OBSERVE_SIGNAL]: {
    kind: AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
    label: "Observe a synthetic signal",
    phase: ACTION_PHASE.OBSERVE,
    risk: RISK_LEVEL.LOW,
    reversible: true,
    consequential: false,
    requiresHumanApproval: false,
  },
  [AGENT_OPERATION_KIND.RUN_PREFLIGHT]: {
    kind: AGENT_OPERATION_KIND.RUN_PREFLIGHT,
    label: "Run a synthetic demo preflight",
    phase: ACTION_PHASE.EXECUTE,
    risk: RISK_LEVEL.LOW,
    reversible: true,
    consequential: false,
    requiresHumanApproval: false,
  },
  [AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC]: {
    kind: AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
    label: "Run read-only diagnostics",
    phase: ACTION_PHASE.EXECUTE,
    risk: RISK_LEVEL.LOW,
    reversible: true,
    consequential: false,
    requiresHumanApproval: false,
  },
  [AGENT_OPERATION_KIND.CLASSIFY_EVENT]: {
    kind: AGENT_OPERATION_KIND.CLASSIFY_EVENT,
    label: "Classify an event",
    phase: ACTION_PHASE.EXECUTE,
    risk: RISK_LEVEL.LOW,
    reversible: true,
    consequential: false,
    requiresHumanApproval: false,
  },
  [AGENT_OPERATION_KIND.DRAFT_RUNBOOK]: {
    kind: AGENT_OPERATION_KIND.DRAFT_RUNBOOK,
    label: "Draft a runbook",
    phase: ACTION_PHASE.RECOMMEND,
    risk: RISK_LEVEL.LOW,
    reversible: true,
    consequential: false,
    requiresHumanApproval: false,
  },
  [AGENT_OPERATION_KIND.DRAFT_POSTMORTEM]: {
    kind: AGENT_OPERATION_KIND.DRAFT_POSTMORTEM,
    label: "Draft a postmortem",
    phase: ACTION_PHASE.RECOMMEND,
    risk: RISK_LEVEL.LOW,
    reversible: true,
    consequential: false,
    requiresHumanApproval: false,
  },
  [AGENT_OPERATION_KIND.CREATE_PROPOSED_CHANGE]: {
    kind: AGENT_OPERATION_KIND.CREATE_PROPOSED_CHANGE,
    label: "Create a proposed change record",
    phase: ACTION_PHASE.PROPOSE,
    risk: RISK_LEVEL.LOW,
    reversible: true,
    consequential: false,
    requiresHumanApproval: false,
  },
  [AGENT_OPERATION_KIND.CHANGE_ROLE]: consequential(
    AGENT_OPERATION_KIND.CHANGE_ROLE,
    "Change a role or permission",
    RISK_LEVEL.HIGH,
  ),
  [AGENT_OPERATION_KIND.CHANGE_MODEL_ENTITLEMENT]: consequential(
    AGENT_OPERATION_KIND.CHANGE_MODEL_ENTITLEMENT,
    "Change a model entitlement",
    RISK_LEVEL.HIGH,
  ),
  [AGENT_OPERATION_KIND.ROTATE_CREDENTIAL]: consequential(
    AGENT_OPERATION_KIND.ROTATE_CREDENTIAL,
    "Rotate a connector credential",
    RISK_LEVEL.HIGH,
  ),
  [AGENT_OPERATION_KIND.REAUTHORIZE_CONNECTOR]: consequential(
    AGENT_OPERATION_KIND.REAUTHORIZE_CONNECTOR,
    "Reauthorize a connector",
    RISK_LEVEL.HIGH,
  ),
  [AGENT_OPERATION_KIND.REACTIVATE_USER]: consequential(
    AGENT_OPERATION_KIND.REACTIVATE_USER,
    "Reactivate a user",
    RISK_LEVEL.HIGH,
  ),
  [AGENT_OPERATION_KIND.DEPROVISION_USER]: consequential(
    AGENT_OPERATION_KIND.DEPROVISION_USER,
    "Deprovision a user",
    RISK_LEVEL.CRITICAL,
  ),
  [AGENT_OPERATION_KIND.CHANGE_ORG_CONFIGURATION]: consequential(
    AGENT_OPERATION_KIND.CHANGE_ORG_CONFIGURATION,
    "Change organization-wide configuration",
    RISK_LEVEL.CRITICAL,
  ),
  [AGENT_OPERATION_KIND.GRANT_WRITE_TOOL_ACCESS]: consequential(
    AGENT_OPERATION_KIND.GRANT_WRITE_TOOL_ACCESS,
    "Grant write-capable tool access",
    RISK_LEVEL.CRITICAL,
  ),
  [AGENT_OPERATION_KIND.CHANGE_POLICY]: consequential(
    AGENT_OPERATION_KIND.CHANGE_POLICY,
    "Change an operating policy",
    RISK_LEVEL.CRITICAL,
  ),
  [AGENT_OPERATION_KIND.ACCEPT_DOCUMENTATION_UPDATE]: consequential(
    AGENT_OPERATION_KIND.ACCEPT_DOCUMENTATION_UPDATE,
    "Accept a documentation update into the lab model",
    RISK_LEVEL.HIGH,
  ),
};

function consequential(
  kind: AgentOperationKind,
  label: string,
  risk: "HIGH" | "CRITICAL",
): AgentOperationDefinition {
  return {
    kind,
    label,
    phase: ACTION_PHASE.EXECUTE,
    risk,
    reversible: false,
    consequential: true,
    requiresHumanApproval: true,
  };
}

export function evaluateAgentAuthorization(
  agent: OperationalAgent,
  operationKind: AgentOperationKind,
  targetId: string,
  approval: ApprovalReceipt | null,
  evaluatedAt: string,
): AgentAuthorizationDecision {
  const operation = AGENT_OPERATION_CATALOG[operationKind];

  if (agent.permissionMode === AGENT_PERMISSION_MODE.DISABLED) {
    return denied(operation, "Agent is disabled.");
  }

  if (!agent.allowedOperations.includes(operationKind)) {
    return denied(operation, "Operation is outside this agent's explicit allowlist.");
  }

  if (agent.permissionMode === AGENT_PERMISSION_MODE.OBSERVE_ONLY) {
    return operation.phase === ACTION_PHASE.OBSERVE
      ? allowed(operation, null)
      : denied(operation, "OBSERVE_ONLY agents cannot recommend, propose, or execute actions.");
  }

  if (agent.permissionMode === AGENT_PERMISSION_MODE.RECOMMEND_ONLY) {
    return operation.phase === ACTION_PHASE.OBSERVE ||
      operation.phase === ACTION_PHASE.RECOMMEND
      ? allowed(operation, null)
      : denied(operation, "RECOMMEND_ONLY agents cannot create or execute changes.");
  }

  if (agent.permissionMode === AGENT_PERMISSION_MODE.EXECUTE_LOW_RISK) {
    if (operation.consequential || operation.requiresHumanApproval) {
      return denied(
        operation,
        "EXECUTE_LOW_RISK cannot be broadened into consequential authority, even with a receipt.",
      );
    }
    return allowed(operation, null);
  }

  if (operation.phase !== ACTION_PHASE.EXECUTE) {
    return allowed(operation, null);
  }

  const usableApproval = isApprovalUsable(
    approval,
    {
      targetType: "AGENT_ACTION",
      targetId,
      operation: operationKind,
      agentId: agent.id,
    },
    evaluatedAt,
  );

  if (!usableApproval) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: "A current, exact-scope human approval receipt is required.",
      operation,
      approvalId: null,
    };
  }

  return allowed(operation, approval?.id ?? null);
}

export function canAgentProposeOperation(
  agent: OperationalAgent,
  operationKind: AgentOperationKind,
): { allowed: boolean; reason: string } {
  if (agent.permissionMode === AGENT_PERMISSION_MODE.DISABLED) {
    return { allowed: false, reason: "Agent is disabled." };
  }
  if (!agent.allowedOperations.includes(operationKind)) {
    return {
      allowed: false,
      reason: "Operation is outside this agent's explicit allowlist.",
    };
  }
  if (agent.permissionMode === AGENT_PERMISSION_MODE.OBSERVE_ONLY) {
    return {
      allowed: false,
      reason: "OBSERVE_ONLY agents cannot create action proposals.",
    };
  }
  if (agent.permissionMode === AGENT_PERMISSION_MODE.RECOMMEND_ONLY) {
    return {
      allowed: false,
      reason: "RECOMMEND_ONLY agents may draft recommendations but cannot create executable proposals.",
    };
  }
  if (
    agent.permissionMode === AGENT_PERMISSION_MODE.EXECUTE_LOW_RISK &&
    AGENT_OPERATION_CATALOG[operationKind].consequential
  ) {
    return {
      allowed: false,
      reason: "EXECUTE_LOW_RISK cannot propose a consequential operation for itself.",
    };
  }
  return { allowed: true, reason: "Operation may enter the governed proposal workflow." };
}

function allowed(
  operation: AgentOperationDefinition,
  approvalId: string | null,
): AgentAuthorizationDecision {
  return {
    allowed: true,
    requiresApproval: operation.requiresHumanApproval,
    reason: approvalId
      ? "Exact-scope human approval validated."
      : "Operation is within the agent's explicit low-risk authority.",
    operation,
    approvalId,
  };
}

function denied(
  operation: AgentOperationDefinition,
  reason: string,
): AgentAuthorizationDecision {
  return {
    allowed: false,
    requiresApproval: operation.requiresHumanApproval,
    reason,
    operation,
    approvalId: null,
  };
}
