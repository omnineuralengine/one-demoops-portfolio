import {
  ACCESS_REQUEST_STATUS,
  ACTION_PHASE,
  AGENT_OPERATION_KIND,
  APPROVAL_STATUS,
  DEMO_READINESS,
  DOMAIN_EVENT_TYPE,
  EFFORT_LEVEL,
  INCIDENT_STATUS,
  MISSION_MODE,
  MISSION_STATUS,
  MODEL_ID,
  SYSTEM_STATUS,
} from "./enums";
import type {
  AccessRequest,
  AgentOperationKind,
  ApprovalReceipt,
  DemoOpsState,
  DomainEvent,
  EffortLevel,
  GatewayRouteInput,
  Incident,
  IncidentScenario,
  MissionCausalBaseline,
  MissionMode,
  MissionRun,
  ModelId,
  ScenarioKey,
  SystemId,
  SystemStatus,
} from "./types";
import { evaluateGatewayRoute } from "../gateway/routing";
import { consumeApproval, isApprovalUsable } from "./approvals";
import {
  canAgentProposeOperation,
  evaluateAgentAuthorization,
} from "./agents";
import { canDiagnoseIncident } from "./incidents";
import {
  createMissionRun,
  MISSION_TIME_COST,
  missionTimelineEntry,
  scoreMissionDebrief,
} from "./missions";
import { buildPreflightResult } from "./preflight";
import { evaluateDemoAccess } from "../selectors/effective-access";
import { deterministicId } from "../utils/ids";
import { replaceById, unique } from "../utils/collections";
import { clamp } from "../utils/numbers";

interface ActionMeta {
  at: string;
  actorId?: string;
}

const implementedAgentExecutions = new Set<AgentOperationKind>([
  AGENT_OPERATION_KIND.OBSERVE_SIGNAL,
  AGENT_OPERATION_KIND.RUN_PREFLIGHT,
  AGENT_OPERATION_KIND.RUN_READ_ONLY_DIAGNOSTIC,
  AGENT_OPERATION_KIND.CLASSIFY_EVENT,
  AGENT_OPERATION_KIND.DRAFT_RUNBOOK,
  AGENT_OPERATION_KIND.DRAFT_POSTMORTEM,
  AGENT_OPERATION_KIND.CREATE_PROPOSED_CHANGE,
]);

export type DemoOpsAction =
  | ({ type: "SYSTEM_STATUS_SET"; systemId: SystemId; status: SystemStatus; note: string } & ActionMeta)
  | ({ type: "PREFLIGHT_RUN"; demoId: string } & ActionMeta)
  | ({ type: "INCIDENT_INJECT"; scenarioKey: ScenarioKey } & ActionMeta)
  | ({ type: "INCIDENT_INVESTIGATE"; incidentId: string; optionId: string } & ActionMeta)
  | ({ type: "INCIDENT_DIAGNOSE"; incidentId: string } & ActionMeta)
  | ({ type: "INCIDENT_REMEDIATION_PROPOSE"; incidentId: string; remediationId: string; rationale: string } & ActionMeta)
  | ({ type: "INCIDENT_REMEDIATION_APPROVE"; incidentId: string; approverId: string; rationale: string; expiresAt?: string | null } & ActionMeta)
  | ({ type: "INCIDENT_REMEDIATION_DENY"; incidentId: string; approverId: string; rationale: string } & ActionMeta)
  | ({ type: "INCIDENT_REMEDIATION_EXECUTE"; incidentId: string } & ActionMeta)
  | ({ type: "INCIDENT_VERIFY"; incidentId: string } & ActionMeta)
  | ({ type: "ACCESS_REQUEST_INSPECT"; requestId: string } & ActionMeta)
  | ({ type: "ACCESS_REQUEST_SUBMIT"; requestId: string } & ActionMeta)
  | ({ type: "ACCESS_REQUEST_APPROVE"; requestId: string; approverId: string; rationale: string; expiresAt?: string | null } & ActionMeta)
  | ({ type: "ACCESS_REQUEST_DENY"; requestId: string; approverId: string; rationale: string } & ActionMeta)
  | ({ type: "ACCESS_REQUEST_EXECUTE"; requestId: string } & ActionMeta)
  | ({ type: "AGENT_ACTION_PROPOSE"; agentId: string; operation: AgentOperationKind; targetId: string; rationale: string } & ActionMeta)
  | ({ type: "AGENT_ACTION_APPROVE"; proposalId: string; approverId: string; rationale: string; expiresAt?: string | null } & ActionMeta)
  | ({ type: "AGENT_ACTION_DENY"; proposalId: string; approverId: string; rationale: string } & ActionMeta)
  | ({ type: "AGENT_ACTION_EXECUTE"; proposalId: string } & ActionMeta)
  | ({ type: "AGENT_ACTION_VERIFY"; proposalId: string } & ActionMeta)
  | ({ type: "GATEWAY_ROUTE_EVALUATE"; input: GatewayRouteInput } & ActionMeta)
  | ({ type: "MISSION_START"; missionId: string; mode: MissionMode } & ActionMeta)
  | ({ type: "MISSION_RESET" } & ActionMeta)
  | ({ type: "MISSION_EXIT" } & ActionMeta)
  | ({ type: "MISSION_COMMAND_RUN"; commandId: string; rationale?: string } & ActionMeta)
  | ({ type: "MISSION_HYPOTHESIS_UPDATE"; layer?: string | null; confidence?: number; nextTest?: string } & ActionMeta)
  | ({ type: "MISSION_HYPOTHESIS_COMMIT"; rationale?: string } & ActionMeta)
  | ({ type: "MISSION_REMEDIATION_PROPOSE"; remediationId: string; rationale: string; expectedResult: string; rollback: string; verification: string } & ActionMeta)
  | ({ type: "MISSION_REMEDIATION_APPROVE"; approverId: string; rationale: string; expiresAt?: string | null } & ActionMeta)
  | ({ type: "MISSION_REMEDIATION_DENY"; approverId: string; rationale: string } & ActionMeta)
  | ({ type: "MISSION_REMEDIATION_EXECUTE" } & ActionMeta)
  | ({ type: "MISSION_VERIFY"; rationale?: string } & ActionMeta)
  | ({ type: "MISSION_PREVENTION_SELECT"; preventionId: string } & ActionMeta)
  | ({ type: "MISSION_DEBRIEF_FILE" } & ActionMeta);

export function demoOpsReducer(
  state: DemoOpsState,
  action: DemoOpsAction,
): DemoOpsState {
  const next = reduceDemoOpsAction(state, action);
  if (next === state) return state;

  const currentTime = Date.parse(state.syntheticAsOf);
  const actionTime = Date.parse(action.at);
  return Number.isFinite(actionTime) &&
    (!Number.isFinite(currentTime) || actionTime > currentTime)
    ? { ...next, syntheticAsOf: action.at }
    : next;
}

function reduceDemoOpsAction(
  state: DemoOpsState,
  action: DemoOpsAction,
): DemoOpsState {
  switch (action.type) {
    case "SYSTEM_STATUS_SET":
      return setSystemStatus(state, action);
    case "PREFLIGHT_RUN":
      return runPreflight(state, action);
    case "INCIDENT_INJECT":
      return injectIncident(state, action);
    case "INCIDENT_INVESTIGATE":
      return investigateIncident(state, action);
    case "INCIDENT_DIAGNOSE":
      return diagnoseIncident(state, action);
    case "INCIDENT_REMEDIATION_PROPOSE":
      return proposeIncidentRemediation(state, action);
    case "INCIDENT_REMEDIATION_APPROVE":
      return approveIncidentRemediation(state, action);
    case "INCIDENT_REMEDIATION_DENY":
      return denyIncidentRemediation(state, action);
    case "INCIDENT_REMEDIATION_EXECUTE":
      return executeIncidentRemediation(state, action);
    case "INCIDENT_VERIFY":
      return verifyIncident(state, action);
    case "ACCESS_REQUEST_INSPECT":
      return inspectAccessRequest(state, action);
    case "ACCESS_REQUEST_SUBMIT":
      return submitAccessRequest(state, action);
    case "ACCESS_REQUEST_APPROVE":
      return approveAccessRequest(state, action);
    case "ACCESS_REQUEST_DENY":
      return denyAccessRequest(state, action);
    case "ACCESS_REQUEST_EXECUTE":
      return executeAccessRequest(state, action);
    case "AGENT_ACTION_PROPOSE":
      return proposeAgentAction(state, action);
    case "AGENT_ACTION_APPROVE":
      return approveAgentAction(state, action);
    case "AGENT_ACTION_DENY":
      return denyAgentAction(state, action);
    case "AGENT_ACTION_EXECUTE":
      return executeAgentAction(state, action);
    case "AGENT_ACTION_VERIFY":
      return verifyAgentAction(state, action);
    case "GATEWAY_ROUTE_EVALUATE":
      return evaluateGatewayRouteAction(state, action);
    case "MISSION_START":
      return startMission(state, action);
    case "MISSION_RESET":
      return resetMission(state, action);
    case "MISSION_EXIT":
      return exitMission(state);
    case "MISSION_COMMAND_RUN":
      return runMissionCommand(state, action);
    case "MISSION_HYPOTHESIS_UPDATE":
      return updateMissionHypothesis(state, action);
    case "MISSION_HYPOTHESIS_COMMIT":
      return commitMissionHypothesis(state, action);
    case "MISSION_REMEDIATION_PROPOSE":
      return proposeMissionRemediation(state, action);
    case "MISSION_REMEDIATION_APPROVE":
      return approveMissionRemediation(state, action);
    case "MISSION_REMEDIATION_DENY":
      return denyMissionRemediation(state, action);
    case "MISSION_REMEDIATION_EXECUTE":
      return executeMissionRemediation(state, action);
    case "MISSION_VERIFY":
      return verifyMission(state, action);
    case "MISSION_PREVENTION_SELECT":
      return selectMissionPrevention(state, action);
    case "MISSION_DEBRIEF_FILE":
      return fileMissionDebrief(state, action);
  }
}

function actor(action: ActionMeta): string {
  return action.actorId ?? "human-operator";
}

function allocateId(state: DemoOpsState, prefix: string) {
  return {
    id: deterministicId(prefix, state.nextSequence),
    state: { ...state, nextSequence: state.nextSequence + 1 },
  };
}

function appendEvent(
  state: DemoOpsState,
  event: Omit<DomainEvent, "id">,
): DemoOpsState {
  const allocated = allocateId(state, "event");
  return {
    ...allocated.state,
    events: [{ id: allocated.id, ...event }, ...allocated.state.events].slice(0, 100),
  };
}

function evaluateGatewayRouteAction(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "GATEWAY_ROUTE_EVALUATE" }>,
): DemoOpsState {
  const allocated = allocateId(state, "route");
  const decision = evaluateGatewayRoute(allocated.state, action.input);
  const withAudit: DemoOpsState = {
    ...allocated.state,
    gateway: {
      ...allocated.state.gateway,
      routeAudits: [
        {
          id: allocated.id,
          evaluatedAt: action.at,
          ownerUserId: action.input.requesterUserId,
          ...action.input,
          ...decision,
        },
        ...allocated.state.gateway.routeAudits,
      ].slice(0, 20),
    },
  };

  return appendEvent(withAudit, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.GATEWAY_DECISION_EVALUATED,
    severity: decision.outcome === "DENIED" ? "WARNING" : "INFO",
    systemId: "model_governance",
    message: decision.outcome === "DENIED"
      ? "Gateway denied a synthetic route preview at the policy intersection."
      : `Gateway selected ${decision.selectedModel ?? "no model"} for a synthetic route preview.`,
    actorId: action.input.requesterUserId,
  });
}

function setSystemStatus(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "SYSTEM_STATUS_SET" }>,
): DemoOpsState {
  if (!state.systems.some((system) => system.id === action.systemId)) return state;
  return {
    ...state,
    systems: replaceById(state.systems, action.systemId, (system) => ({
      ...system,
      status: action.status,
      note: action.note,
    })),
  };
}

function runPreflight(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "PREFLIGHT_RUN" }>,
): DemoOpsState {
  const result = buildPreflightResult(state, action.demoId, action.at);
  if (!result) return state;

  const next: DemoOpsState = {
    ...state,
    demos: replaceById(state.demos, action.demoId, (demo) => {
      const retainedReasons = demo.riskReasons.filter((reason) => !reason.startsWith("Latest preflight:"));
      const riskReasons = result.overall === DEMO_READINESS.READY
        ? retainedReasons
        : [...retainedReasons, `Latest preflight: ${result.overall.replaceAll("_", " ")}`];
      return {
        ...demo,
        atRisk: riskReasons.length > 0,
        riskReasons,
        lastPreflight: result,
      };
    }),
  };
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.PREFLIGHT_COMPLETED,
    severity:
      result.overall === DEMO_READINESS.READY
        ? "INFO"
        : result.overall === DEMO_READINESS.AT_RISK
          ? "WARNING"
          : "CRITICAL",
    systemId: "environment",
    message: `Preflight ${action.demoId}: ${result.overall}.`,
    actorId: actor(action),
  });
}

function injectIncident(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_INJECT" }>,
): DemoOpsState {
  const scenario = getScenario(state, action.scenarioKey);
  if (!scenario) return state;
  if (
    state.incidents.some(
      (incident) =>
        incident.scenarioKey === action.scenarioKey &&
        incident.status !== INCIDENT_STATUS.RESOLVED,
    )
  ) {
    return state;
  }

  const allocated = allocateId(state, "incident");
  const incident: Incident = {
    id: allocated.id,
    scenarioKey: action.scenarioKey,
    status: INCIDENT_STATUS.DETECTED,
    createdAt: action.at,
    investigationLog: [],
    chosenRemediationId: null,
    approvalId: null,
    verificationPassed: null,
    resolvedAt: null,
  };

  let next: DemoOpsState = {
    ...allocated.state,
    incidents: [incident, ...allocated.state.incidents],
    systems: replaceById(
      allocated.state.systems,
      scenario.systemId,
      (system) => ({
        ...system,
        status: SYSTEM_STATUS.RED,
        note: `Active synthetic incident: ${scenario.title}`,
      }),
    ),
    demos: allocated.state.demos.map((demo) =>
      isDemoAffected(scenario, demo.id)
        ? {
            ...demo,
            atRisk: true,
            riskReasons: unique([...demo.riskReasons, scenario.title]),
          }
        : demo,
    ),
  };

  if (scenario.key === "CONNECTOR_CREDENTIAL_EXPIRED") {
    next = {
      ...next,
      integrations: replaceById(next.integrations, "salesforce", (integration) => ({
        ...integration,
        status: SYSTEM_STATUS.RED,
        lastCheckedAt: action.at,
      })),
      systems: replaceById(next.systems, "environment", (system) => ({
        ...system,
        status: SYSTEM_STATUS.YELLOW,
        note: "A dependent synthetic connector is unavailable.",
      })),
    };
  }

  if (scenario.key === "SCIM_REMOVED_PRESENTER") {
    next = {
      ...next,
      users: replaceById(next.users, "u_jordan", (user) => ({
        ...user,
        active: false,
        orgMember: false,
      })),
    };
  }

  if (scenario.key === "MODEL_POLICY_MISMATCH") {
    next = {
      ...next,
      roles: replaceById(next.roles, "role_enterprise_se", (role) => ({
        ...role,
        modelPolicy: role.modelPolicy.filter((model) => model !== MODEL_ID.OPUS),
      })),
    };
  }

  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.INCIDENT_CREATED,
    severity: "CRITICAL",
    systemId: scenario.systemId,
    message: `${scenario.title} created and linked dependencies moved to risk.`,
    actorId: actor(action),
  });
}

function investigateIncident(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_INVESTIGATE" }>,
): DemoOpsState {
  const incident = getIncident(state, action.incidentId);
  if (!incident) return state;
  if (
    incident.status !== INCIDENT_STATUS.DETECTED &&
    incident.status !== INCIDENT_STATUS.INVESTIGATING
  ) {
    return state;
  }
  const scenario = getScenario(state, incident.scenarioKey);
  const option = scenario?.investigation.find(
    (candidate) => candidate.id === action.optionId,
  );
  if (!scenario || !option || incident.investigationLog.includes(option.id)) return state;

  const next = {
    ...state,
    incidents: replaceById(state.incidents, incident.id, (current) => ({
      ...current,
      status: INCIDENT_STATUS.INVESTIGATING,
      investigationLog: [...current.investigationLog, option.id],
    })),
  };
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.INVESTIGATION_STEP,
    severity: "INFO",
    systemId: scenario.systemId,
    message: option.label,
    actorId: actor(action),
  });
}

function diagnoseIncident(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_DIAGNOSE" }>,
): DemoOpsState {
  const incident = getIncident(state, action.incidentId);
  if (!incident || incident.status !== INCIDENT_STATUS.INVESTIGATING) return state;
  const scenario = getScenario(state, incident.scenarioKey);
  if (!scenario || !canDiagnoseIncident(incident, scenario)) return state;

  const next = {
    ...state,
    incidents: replaceById(state.incidents, incident.id, (current) => ({
      ...current,
      status: INCIDENT_STATUS.DIAGNOSED,
    })),
  };
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.DIAGNOSIS_CONFIRMED,
    severity: "WARNING",
    systemId: scenario.systemId,
    message: scenario.diagnosis,
    actorId: actor(action),
  });
}

function proposeIncidentRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_REMEDIATION_PROPOSE" }>,
): DemoOpsState {
  const incident = getIncident(state, action.incidentId);
  if (!incident || incident.status !== INCIDENT_STATUS.DIAGNOSED || !action.rationale.trim()) {
    return state;
  }
  const scenario = getScenario(state, incident.scenarioKey);
  const remediation = scenario?.remediation.find(
    (candidate) => candidate.id === action.remediationId,
  );
  if (!scenario || !remediation) return state;

  let next = state;
  let approvalId: string | null = null;
  if (remediation.requiresApproval) {
    const approvalAllocation = allocateId(next, "approval");
    approvalId = approvalAllocation.id;
    const approval: ApprovalReceipt = {
      id: approvalId,
      status: APPROVAL_STATUS.PENDING,
      requestedAt: action.at,
      decidedAt: null,
      expiresAt: null,
      requestedBy: actor(action),
      approverId: null,
      rationale: action.rationale.trim(),
      targetType: "INCIDENT_REMEDIATION",
      targetId: incident.id,
      operation: "INCIDENT_REMEDIATION",
      agentId: null,
      consumedAt: null,
    };
    next = {
      ...approvalAllocation.state,
      approvals: [approval, ...approvalAllocation.state.approvals],
    };
  }

  next = {
    ...next,
    incidents: replaceById(next.incidents, incident.id, (current) => ({
      ...current,
      chosenRemediationId: remediation.id,
      approvalId,
      status: remediation.requiresApproval
        ? INCIDENT_STATUS.AWAITING_APPROVAL
        : INCIDENT_STATUS.REMEDIATION_PROPOSED,
    })),
  };

  return appendEvent(next, {
    occurredAt: action.at,
    type: remediation.requiresApproval
      ? DOMAIN_EVENT_TYPE.APPROVAL_REQUESTED
      : DOMAIN_EVENT_TYPE.REMEDIATION_PROPOSED,
    severity: remediation.requiresApproval ? "WARNING" : "INFO",
    systemId: scenario.systemId,
    message: `${remediation.label} — ${action.rationale.trim()}`,
    actorId: actor(action),
  });
}

function approveIncidentRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_REMEDIATION_APPROVE" }>,
): DemoOpsState {
  const incident = getIncident(state, action.incidentId);
  if (
    !incident ||
    incident.status !== INCIDENT_STATUS.AWAITING_APPROVAL ||
    !incident.approvalId ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }
  const approval = state.approvals.find((candidate) => candidate.id === incident.approvalId);
  if (
    !approval
    || approval.status !== APPROVAL_STATUS.PENDING
    || approval.requestedBy === action.approverId
  ) return state;

  const next = {
    ...state,
    approvals: replaceById(state.approvals, approval.id, (current) => ({
      ...current,
      status: APPROVAL_STATUS.APPROVED,
      decidedAt: action.at,
      expiresAt: action.expiresAt ?? null,
      approverId: action.approverId,
      rationale: action.rationale.trim(),
    })),
    incidents: replaceById(state.incidents, incident.id, (current) => ({
      ...current,
      status: INCIDENT_STATUS.APPROVED,
    })),
  };
  const scenario = getScenario(next, incident.scenarioKey);
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.APPROVAL_GRANTED,
    severity: "INFO",
    systemId: scenario?.systemId ?? null,
    message: `Remediation approved by ${action.approverId}.`,
    actorId: action.approverId,
  });
}

function denyIncidentRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_REMEDIATION_DENY" }>,
): DemoOpsState {
  const incident = getIncident(state, action.incidentId);
  if (
    !incident ||
    incident.status !== INCIDENT_STATUS.AWAITING_APPROVAL ||
    !incident.approvalId ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }
  const approval = state.approvals.find((candidate) => candidate.id === incident.approvalId);
  if (!approval || approval.status !== APPROVAL_STATUS.PENDING) return state;

  const next = {
    ...state,
    approvals: replaceById(state.approvals, approval.id, (current) => ({
      ...current,
      status: APPROVAL_STATUS.DENIED,
      decidedAt: action.at,
      approverId: action.approverId,
      rationale: action.rationale.trim(),
    })),
    incidents: replaceById(state.incidents, incident.id, (current) => ({
      ...current,
      status: INCIDENT_STATUS.DIAGNOSED,
      chosenRemediationId: null,
      approvalId: null,
    })),
  };
  const scenario = getScenario(next, incident.scenarioKey);
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.APPROVAL_DENIED,
    severity: "WARNING",
    systemId: scenario?.systemId ?? null,
    message: action.rationale.trim(),
    actorId: action.approverId,
  });
}

function executeIncidentRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_REMEDIATION_EXECUTE" }>,
): DemoOpsState {
  const incident = getIncident(state, action.incidentId);
  if (!incident || !incident.chosenRemediationId) return state;
  const scenario = getScenario(state, incident.scenarioKey);
  const remediation = scenario?.remediation.find(
    (candidate) => candidate.id === incident.chosenRemediationId,
  );
  if (!scenario || !remediation) return state;

  let next = state;
  if (remediation.requiresApproval) {
    if (incident.status !== INCIDENT_STATUS.APPROVED || !incident.approvalId) return state;
    const approval = state.approvals.find((candidate) => candidate.id === incident.approvalId);
    if (
      !isApprovalUsable(
        approval,
        {
          targetType: "INCIDENT_REMEDIATION",
          targetId: incident.id,
          operation: "INCIDENT_REMEDIATION",
        },
        action.at,
      )
    ) {
      return state;
    }
    next = {
      ...next,
      approvals: replaceById(next.approvals, approval!.id, (current) =>
        consumeApproval(current, action.at),
      ),
    };
  } else if (incident.status !== INCIDENT_STATUS.REMEDIATION_PROPOSED) {
    return state;
  }

  next = {
    ...next,
    incidents: replaceById(next.incidents, incident.id, (current) => ({
      ...current,
      status: INCIDENT_STATUS.REMEDIATED,
    })),
  };
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.REMEDIATION_EXECUTED,
    severity: "WARNING",
    systemId: scenario.systemId,
    message: remediation.label,
    actorId: actor(action),
  });
}

function verifyIncident(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "INCIDENT_VERIFY" }>,
): DemoOpsState {
  const incident = getIncident(state, action.incidentId);
  if (
    !incident ||
    incident.status !== INCIDENT_STATUS.REMEDIATED ||
    !incident.chosenRemediationId
  ) {
    return state;
  }
  const scenario = getScenario(state, incident.scenarioKey);
  const remediation = scenario?.remediation.find(
    (candidate) => candidate.id === incident.chosenRemediationId,
  );
  if (!scenario || !remediation) return state;

  if (!remediation.correct) {
    const retry = {
      ...state,
      incidents: replaceById(state.incidents, incident.id, (current) => ({
        ...current,
        status: INCIDENT_STATUS.DIAGNOSED,
        verificationPassed: false,
        chosenRemediationId: null,
        approvalId: null,
      })),
    };
    return appendEvent(retry, {
      occurredAt: action.at,
      type: DOMAIN_EVENT_TYPE.VERIFICATION_FAILED,
      severity: "CRITICAL",
      systemId: scenario.systemId,
      message: remediation.feedback,
      actorId: actor(action),
    });
  }

  let next: DemoOpsState = {
    ...state,
    incidents: replaceById(state.incidents, incident.id, (current) => ({
      ...current,
      status: INCIDENT_STATUS.RESOLVED,
      verificationPassed: true,
      resolvedAt: action.at,
    })),
  };
  next = applyVerifiedRemediation(next, scenario, remediation.id, action.at);
  next = clearScenarioRisk(next, scenario);
  next = restoreSystemAfterResolution(next, scenario);

  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.REMEDIATION_VERIFIED,
    severity: "INFO",
    systemId: scenario.systemId,
    message: `${scenario.title} verified against ${scenario.verificationSteps.length} checks.`,
    actorId: actor(action),
  });
}

function inspectAccessRequest(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "ACCESS_REQUEST_INSPECT" }>,
): DemoOpsState {
  const request = state.accessRequests.find((candidate) => candidate.id === action.requestId);
  if (!request || request.status !== ACCESS_REQUEST_STATUS.PENDING) return state;
  return {
    ...state,
    accessRequests: replaceById(state.accessRequests, request.id, (current) => ({
      ...current,
      status: ACCESS_REQUEST_STATUS.INSPECTED,
    })),
  };
}

function submitAccessRequest(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "ACCESS_REQUEST_SUBMIT" }>,
): DemoOpsState {
  const request = state.accessRequests.find((candidate) => candidate.id === action.requestId);
  if (
    !request ||
    (request.status !== ACCESS_REQUEST_STATUS.PENDING &&
      request.status !== ACCESS_REQUEST_STATUS.INSPECTED)
  ) {
    return state;
  }

  if (!request.requiresApproval) {
    return {
      ...state,
      accessRequests: replaceById(state.accessRequests, request.id, (current) => ({
        ...current,
        status: ACCESS_REQUEST_STATUS.APPROVED,
      })),
    };
  }

  const allocated = allocateId(state, "approval");
  const approval: ApprovalReceipt = {
    id: allocated.id,
    status: APPROVAL_STATUS.PENDING,
    requestedAt: action.at,
    decidedAt: null,
    expiresAt: null,
    requestedBy: actor(action),
    approverId: null,
    rationale: request.detail,
    targetType: "ACCESS_REQUEST",
    targetId: request.id,
    operation: "ACCESS_REQUEST",
    agentId: null,
    consumedAt: null,
  };
  return {
    ...allocated.state,
    approvals: [approval, ...allocated.state.approvals],
    accessRequests: replaceById(allocated.state.accessRequests, request.id, (current) => ({
      ...current,
      status: ACCESS_REQUEST_STATUS.AWAITING_APPROVAL,
      approvalId: approval.id,
    })),
  };
}

function approveAccessRequest(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "ACCESS_REQUEST_APPROVE" }>,
): DemoOpsState {
  const request = state.accessRequests.find((candidate) => candidate.id === action.requestId);
  if (
    !request ||
    request.status !== ACCESS_REQUEST_STATUS.AWAITING_APPROVAL ||
    !request.approvalId ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }
  const approval = state.approvals.find((candidate) => candidate.id === request.approvalId);
  if (
    !approval
    || approval.status !== APPROVAL_STATUS.PENDING
    || approval.requestedBy === action.approverId
  ) return state;

  return {
    ...state,
    approvals: replaceById(state.approvals, approval.id, (current) => ({
      ...current,
      status: APPROVAL_STATUS.APPROVED,
      decidedAt: action.at,
      expiresAt: action.expiresAt ?? null,
      approverId: action.approverId,
      rationale: action.rationale.trim(),
    })),
    accessRequests: replaceById(state.accessRequests, request.id, (current) => ({
      ...current,
      status: ACCESS_REQUEST_STATUS.APPROVED,
    })),
  };
}

function denyAccessRequest(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "ACCESS_REQUEST_DENY" }>,
): DemoOpsState {
  const request = state.accessRequests.find((candidate) => candidate.id === action.requestId);
  if (
    !request ||
    request.status !== ACCESS_REQUEST_STATUS.AWAITING_APPROVAL ||
    !request.approvalId ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }
  const approval = state.approvals.find((candidate) => candidate.id === request.approvalId);
  if (!approval || approval.status !== APPROVAL_STATUS.PENDING) return state;
  return {
    ...state,
    approvals: replaceById(state.approvals, approval.id, (current) => ({
      ...current,
      status: APPROVAL_STATUS.DENIED,
      decidedAt: action.at,
      approverId: action.approverId,
      rationale: action.rationale.trim(),
    })),
    accessRequests: replaceById(state.accessRequests, request.id, (current) => ({
      ...current,
      status: ACCESS_REQUEST_STATUS.REJECTED,
    })),
  };
}

function executeAccessRequest(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "ACCESS_REQUEST_EXECUTE" }>,
): DemoOpsState {
  const request = state.accessRequests.find((candidate) => candidate.id === action.requestId);
  const isApprovedExecution = request?.status === ACCESS_REQUEST_STATUS.APPROVED;
  const isBoundedLowRiskExecution = Boolean(
    request
    && !request.requiresApproval
    && request.status === ACCESS_REQUEST_STATUS.INSPECTED,
  );
  if (!request || (!isApprovedExecution && !isBoundedLowRiskExecution)) return state;

  let approval: ApprovalReceipt | undefined;
  if (request.requiresApproval) {
    approval = state.approvals.find((candidate) => candidate.id === request.approvalId);
    if (
      !isApprovalUsable(
        approval,
        {
          targetType: "ACCESS_REQUEST",
          targetId: request.id,
          operation: "ACCESS_REQUEST",
        },
        action.at,
      )
    ) {
      return state;
    }
  }

  const effected = applyAccessRequestEffect(state, request, action.at);
  if (!effected) return state;
  let next = effected;
  if (approval) {
    next = {
      ...next,
      approvals: replaceById(next.approvals, approval.id, (current) =>
        consumeApproval(current, action.at),
      ),
    };
  }
  next = {
    ...next,
    accessRequests: replaceById(next.accessRequests, request.id, (current) => ({
      ...current,
      status: ACCESS_REQUEST_STATUS.PROCESSED,
      executedAt: action.at,
    })),
  };
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.ACCESS_REQUEST_UPDATED,
    severity: "INFO",
    systemId: "roles",
    message: request.requiresApproval
      ? `${request.type} processed with its exact-scope approval receipt consumed.`
      : `${request.type} processed inside its inspected low-risk boundary.`,
    actorId: actor(action),
  });
}

function applyAccessRequestEffect(
  state: DemoOpsState,
  request: AccessRequest,
  executedAt: string,
): DemoOpsState | null {
  const effect = request.effect;
  if (effect.type === "ALLOCATE_SEATS") {
    if (effect.count <= 0 || state.seats.used + effect.count > state.seats.total) return null;
    return {
      ...state,
      seats: { ...state.seats, used: state.seats.used + effect.count },
    };
  }

  if (effect.type === "GRANT_WORKSPACE") {
    if (!state.users.some((user) => user.id === effect.userId) || !effect.workspace.trim()) return null;
    return {
      ...state,
      users: replaceById(state.users, effect.userId, (user) => ({
        ...user,
        workspaces: unique([...user.workspaces, effect.workspace]),
      })),
    };
  }

  if (effect.type === "ENABLE_INTEGRATION") {
    if (!state.integrations.some((integration) => integration.id === effect.integrationId)) return null;
    return {
      ...state,
      integrations: replaceById(state.integrations, effect.integrationId, (integration) => ({
        ...integration,
        status: SYSTEM_STATUS.GREEN,
        lastCheckedAt: executedAt,
      })),
    };
  }

  if (effect.type === "ASSIGN_ROLE") {
    if (!state.users.some((user) => user.id === effect.userId) || !state.roles.some((role) => role.id === effect.roleId)) return null;
    return {
      ...state,
      users: replaceById(state.users, effect.userId, (user) => ({
        ...user,
        roleId: effect.roleId,
        temporaryRoleId: null,
        temporaryRoleExpiresAt: null,
      })),
    };
  }

  if (effect.type === "GRANT_TEMPORARY_ROLE") {
    const startedAt = Date.parse(executedAt);
    if (
      !Number.isFinite(startedAt)
      || effect.durationHours <= 0
      || !state.users.some((user) => user.id === effect.userId)
      || !state.roles.some((role) => role.id === effect.roleId)
    ) {
      return null;
    }
    const expiresAt = new Date(startedAt + effect.durationHours * 60 * 60 * 1_000).toISOString();
    return {
      ...state,
      users: replaceById(state.users, effect.userId, (user) => ({
        ...user,
        temporaryRoleId: effect.roleId,
        temporaryRoleExpiresAt: expiresAt,
      })),
    };
  }

  return null;
}

function proposeAgentAction(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "AGENT_ACTION_PROPOSE" }>,
): DemoOpsState {
  const agent = state.agents.find((candidate) => candidate.id === action.agentId);
  if (!agent || !action.rationale.trim()) return state;
  const proposalDecision = canAgentProposeOperation(agent, action.operation);
  if (!proposalDecision.allowed) return state;

  const allocated = allocateId(state, "agent-action");
  const proposal = {
    id: allocated.id,
    agentId: agent.id,
    operation: action.operation,
    targetId: action.targetId,
    rationale: action.rationale.trim(),
    status: "PROPOSED" as const,
    proposedAt: action.at,
    approvalId: null,
    executedAt: null,
    verifiedAt: null,
  };
  const next = {
    ...allocated.state,
    agentActionProposals: [proposal, ...allocated.state.agentActionProposals],
  };
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.AGENT_ACTION_PROPOSED,
    severity: "INFO",
    systemId: null,
    message: `${agent.name} proposed ${action.operation} for ${action.targetId}.`,
    actorId: agent.id,
  });
}

function approveAgentAction(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "AGENT_ACTION_APPROVE" }>,
): DemoOpsState {
  const proposal = state.agentActionProposals.find(
    (candidate) => candidate.id === action.proposalId,
  );
  if (
    !proposal ||
    proposal.status !== "PROPOSED" ||
    proposal.agentId === action.approverId ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }
  const allocated = allocateId(state, "approval");
  const approval: ApprovalReceipt = {
    id: allocated.id,
    status: APPROVAL_STATUS.APPROVED,
    requestedAt: proposal.proposedAt,
    decidedAt: action.at,
    expiresAt: action.expiresAt ?? null,
    requestedBy: proposal.agentId,
    approverId: action.approverId,
    rationale: action.rationale.trim(),
    targetType: "AGENT_ACTION",
    targetId: proposal.targetId,
    operation: proposal.operation,
    agentId: proposal.agentId,
    consumedAt: null,
  };
  return {
    ...allocated.state,
    approvals: [approval, ...allocated.state.approvals],
    agentActionProposals: replaceById(
      allocated.state.agentActionProposals,
      proposal.id,
      (current) => ({
        ...current,
        status: "APPROVED",
        approvalId: approval.id,
      }),
    ),
  };
}

function denyAgentAction(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "AGENT_ACTION_DENY" }>,
): DemoOpsState {
  const proposal = state.agentActionProposals.find(
    (candidate) => candidate.id === action.proposalId,
  );
  if (
    !proposal ||
    proposal.status !== "PROPOSED" ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }
  const next: DemoOpsState = {
    ...state,
    agentActionProposals: replaceById(
      state.agentActionProposals,
      proposal.id,
      (current) => ({ ...current, status: "DENIED" }),
    ),
  };
  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.AGENT_ACTION_DENIED,
    severity: "WARNING",
    systemId: null,
    message: action.rationale.trim(),
    actorId: action.approverId,
  });
}

function executeAgentAction(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "AGENT_ACTION_EXECUTE" }>,
): DemoOpsState {
  const proposal = state.agentActionProposals.find(
    (candidate) => candidate.id === action.proposalId,
  );
  if (!proposal || (proposal.status !== "PROPOSED" && proposal.status !== "APPROVED")) {
    return state;
  }
  if (!implementedAgentExecutions.has(proposal.operation)) return state;
  const agent = state.agents.find((candidate) => candidate.id === proposal.agentId);
  if (!agent) return state;
  const approval = proposal.approvalId
    ? state.approvals.find((candidate) => candidate.id === proposal.approvalId) ?? null
    : null;
  const decision = evaluateAgentAuthorization(
    agent,
    proposal.operation,
    proposal.targetId,
    approval,
    action.at,
  );
  if (!decision.allowed) return state;

  let next = state;
  if (approval) {
    next = {
      ...next,
      approvals: replaceById(next.approvals, approval.id, (current) =>
        consumeApproval(current, action.at),
      ),
    };
  }
  next = {
    ...next,
    agentActionProposals: replaceById(
      next.agentActionProposals,
      proposal.id,
      (current) => ({
        ...current,
        status: "EXECUTED",
        executedAt: action.at,
      }),
    ),
  };

  if (proposal.operation === AGENT_OPERATION_KIND.RUN_PREFLIGHT) {
    next = runPreflight(next, {
      type: "PREFLIGHT_RUN",
      demoId: proposal.targetId,
      at: action.at,
      actorId: agent.id,
    });
  }

  return appendEvent(next, {
    occurredAt: action.at,
    type: DOMAIN_EVENT_TYPE.AGENT_ACTION_EXECUTED,
    severity: "INFO",
    systemId: null,
    message: `${agent.name} executed ${proposal.operation} within its explicit authority.`,
    actorId: agent.id,
  });
}

function verifyAgentAction(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "AGENT_ACTION_VERIFY" }>,
): DemoOpsState {
  const proposal = state.agentActionProposals.find(
    (candidate) => candidate.id === action.proposalId,
  );
  if (!proposal || proposal.status !== "EXECUTED") return state;
  return {
    ...state,
    agentActionProposals: replaceById(
      state.agentActionProposals,
      proposal.id,
      (current) => ({
        ...current,
        status: "VERIFIED",
        verifiedAt: action.at,
      }),
    ),
  };
}

function startMission(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_START" }>,
): DemoOpsState {
  if (state.activeMission?.status === MISSION_STATUS.ACTIVE) return state;
  const mission = state.missionCatalog.find(
    (candidate) => candidate.id === action.missionId,
  );
  if (!mission) return state;
  const causalBaseline = captureMissionBaseline(state, mission.id);
  const allocated = allocateId(state, "mission-run");
  const seeded = seedMissionFault(allocated.state, mission.id);
  return {
    ...seeded,
    activeMission: createMissionRun(allocated.id, mission, action.mode, causalBaseline),
  };
}

function resetMission(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_RESET" }>,
): DemoOpsState {
  if (!state.activeMission) return state;
  const mission = state.missionCatalog.find(
    (candidate) => candidate.id === state.activeMission?.missionId,
  );
  if (!mission) return state;
  const causalBaseline = state.activeMission.causalBaseline
    ?? captureMissionBaseline(state, mission.id);
  const restored = restoreMissionBaseline(state, state.activeMission);
  const allocated = allocateId(restored, "mission-run");
  const seeded = seedMissionFault(allocated.state, mission.id);
  return {
    ...seeded,
    activeMission: createMissionRun(
      allocated.id,
      mission,
      state.activeMission.mode,
      causalBaseline,
    ),
  };
}

function exitMission(state: DemoOpsState): DemoOpsState {
  if (!state.activeMission) return state;
  const restored = state.activeMission.status === MISSION_STATUS.SUCCEEDED
    ? state
    : restoreMissionBaseline(state, state.activeMission);
  return { ...restored, activeMission: null };
}

function runMissionCommand(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_COMMAND_RUN" }>,
): DemoOpsState {
  const run = state.activeMission;
  if (!run || run.status !== MISSION_STATUS.ACTIVE) return state;
  const mission = getActiveMissionDefinition(state);
  const command = mission?.commands.find(
    (candidate) => candidate.id === action.commandId,
  );
  if (!mission || !command) return state;
  if (run.mode === MISSION_MODE.INTERVIEW && !action.rationale?.trim()) return state;

  const elapsedMinutes = run.elapsedMinutes + command.timeCostMinutes;
  let nextRun: MissionRun = {
    ...run,
    elapsedMinutes,
    status:
      elapsedMinutes > mission.deadlineMinutes
        ? MISSION_STATUS.FAILED
        : run.status,
    commandsUsed: [...run.commandsUsed, command.id],
    rationales: action.rationale?.trim()
      ? {
          ...run.rationales,
          [`command:${command.id}:${run.commandsUsed.length}`]: action.rationale.trim(),
        }
      : run.rationales,
  };
  return withMissionTimeline(
    state,
    nextRun,
    ACTION_PHASE.OBSERVE,
    `Ran ${command.label}`,
    command.reveal,
  );
}

function updateMissionHypothesis(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_HYPOTHESIS_UPDATE" }>,
): DemoOpsState {
  const run = state.activeMission;
  if (!run || run.status !== MISSION_STATUS.ACTIVE || run.hypothesis.committed) return state;
  return {
    ...state,
    activeMission: {
      ...run,
      hypothesis: {
        ...run.hypothesis,
        layer: action.layer === undefined ? run.hypothesis.layer : action.layer,
        confidence:
          action.confidence === undefined
            ? run.hypothesis.confidence
            : clamp(action.confidence, 0, 100),
        nextTest:
          action.nextTest === undefined
            ? run.hypothesis.nextTest
            : action.nextTest,
      },
    },
  };
}

function commitMissionHypothesis(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_HYPOTHESIS_COMMIT" }>,
): DemoOpsState {
  const run = state.activeMission;
  const mission = getActiveMissionDefinition(state);
  if (
    !run ||
    !mission ||
    run.status !== MISSION_STATUS.ACTIVE ||
    run.hypothesis.committed ||
    !run.hypothesis.layer ||
    (run.mode === MISSION_MODE.INTERVIEW && !action.rationale?.trim())
  ) {
    return state;
  }
  const elapsedMinutes = run.elapsedMinutes + MISSION_TIME_COST.HYPOTHESIS_COMMIT;
  const nextRun: MissionRun = {
    ...run,
    elapsedMinutes,
    status:
      elapsedMinutes > mission.deadlineMinutes
        ? MISSION_STATUS.FAILED
        : run.status,
    diagnosisRevealed: true,
    hypothesis: { ...run.hypothesis, committed: true },
    rationales: action.rationale?.trim()
      ? { ...run.rationales, "hypothesis:commit": action.rationale.trim() }
      : run.rationales,
  };
  return withMissionTimeline(
    state,
    nextRun,
    ACTION_PHASE.RECOMMEND,
    "Committed hypothesis",
    `${run.hypothesis.layer} — ${run.hypothesis.layer === mission.correctLayer ? "matches" : "does not match"} the blocking layer.`,
  );
}

function proposeMissionRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_REMEDIATION_PROPOSE" }>,
): DemoOpsState {
  const run = state.activeMission;
  const mission = getActiveMissionDefinition(state);
  if (
    !run ||
    !mission ||
    run.status !== MISSION_STATUS.ACTIVE ||
    !run.diagnosisRevealed ||
    run.chosenRemediationId ||
    ![action.rationale, action.expectedResult, action.rollback, action.verification].every(
      (value) => value.trim(),
    )
  ) {
    return state;
  }
  const remediation = mission.remediation.find(
    (candidate) => candidate.id === action.remediationId,
  );
  if (!remediation) return state;

  const elapsedMinutes = run.elapsedMinutes + MISSION_TIME_COST.REMEDIATION_PROPOSE;
  const nextRun: MissionRun = {
    ...run,
    elapsedMinutes,
    status:
      elapsedMinutes > mission.deadlineMinutes
        ? MISSION_STATUS.FAILED
        : run.status,
    chosenRemediationId: remediation.id,
    remediationApproved: !remediation.requiresApproval,
    rationales: {
      ...run.rationales,
      "remediation:rationale": action.rationale.trim(),
      "remediation:expected-result": action.expectedResult.trim(),
      "remediation:rollback": action.rollback.trim(),
      "remediation:verification": action.verification.trim(),
    },
  };
  return withMissionTimeline(
    state,
    nextRun,
    ACTION_PHASE.PROPOSE,
    `Proposed ${remediation.label}`,
    action.rationale.trim(),
  );
}

function approveMissionRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_REMEDIATION_APPROVE" }>,
): DemoOpsState {
  const run = state.activeMission;
  const mission = getActiveMissionDefinition(state);
  const remediation = mission?.remediation.find(
    (candidate) => candidate.id === run?.chosenRemediationId,
  );
  if (
    !run ||
    !mission ||
    !remediation ||
    !remediation.requiresApproval ||
    run.remediationApproved ||
    run.remediationExecuted ||
    actor(action) === action.approverId ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }

  const allocated = allocateId(state, "approval");
  const approval: ApprovalReceipt = {
    id: allocated.id,
    status: APPROVAL_STATUS.APPROVED,
    requestedAt: action.at,
    decidedAt: action.at,
    expiresAt: action.expiresAt ?? null,
    requestedBy: actor(action),
    approverId: action.approverId,
    rationale: action.rationale.trim(),
    targetType: "MISSION_REMEDIATION",
    targetId: run.id,
    operation: "MISSION_REMEDIATION",
    agentId: null,
    consumedAt: null,
  };
  const elapsedMinutes = run.elapsedMinutes + MISSION_TIME_COST.APPROVAL;
  const nextRun: MissionRun = {
    ...run,
    elapsedMinutes,
    status:
      elapsedMinutes > mission.deadlineMinutes
        ? MISSION_STATUS.FAILED
        : run.status,
    remediationApprovalId: approval.id,
    remediationApproved: true,
    rationales: {
      ...run.rationales,
      "remediation:approval": action.rationale.trim(),
    },
  };
  return withMissionTimeline(
    {
      ...allocated.state,
      approvals: [approval, ...allocated.state.approvals],
    },
    nextRun,
    ACTION_PHASE.APPROVE,
    "Remediation approved",
    action.rationale.trim(),
  );
}

function denyMissionRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_REMEDIATION_DENY" }>,
): DemoOpsState {
  const run = state.activeMission;
  const mission = getActiveMissionDefinition(state);
  const remediation = mission?.remediation.find(
    (candidate) => candidate.id === run?.chosenRemediationId,
  );
  if (
    !run ||
    !remediation?.requiresApproval ||
    run.remediationApproved ||
    !action.approverId.trim() ||
    !action.rationale.trim()
  ) {
    return state;
  }
  const nextRun: MissionRun = {
    ...run,
    chosenRemediationId: null,
    rationales: {
      ...run.rationales,
      "remediation:denial": action.rationale.trim(),
    },
  };
  return withMissionTimeline(
    state,
    nextRun,
    ACTION_PHASE.APPROVE,
    "Remediation denied",
    action.rationale.trim(),
  );
}

function executeMissionRemediation(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_REMEDIATION_EXECUTE" }>,
): DemoOpsState {
  const run = state.activeMission;
  const mission = getActiveMissionDefinition(state);
  const remediation = mission?.remediation.find(
    (candidate) => candidate.id === run?.chosenRemediationId,
  );
  if (
    !run ||
    !mission ||
    !remediation ||
    run.status !== MISSION_STATUS.ACTIVE ||
    run.remediationExecuted ||
    !run.remediationApproved
  ) {
    return state;
  }

  let next = state;
  if (remediation.requiresApproval) {
    const approval = state.approvals.find(
      (candidate) => candidate.id === run.remediationApprovalId,
    );
    if (
      !isApprovalUsable(
        approval,
        {
          targetType: "MISSION_REMEDIATION",
          targetId: run.id,
          operation: "MISSION_REMEDIATION",
        },
        action.at,
      )
    ) {
      return state;
    }
    next = {
      ...next,
      approvals: replaceById(next.approvals, approval!.id, (current) =>
        consumeApproval(current, action.at),
      ),
    };
  }

  return withMissionTimeline(
    next,
    { ...run, remediationExecuted: true },
    ACTION_PHASE.EXECUTE,
    "Remediation executed",
    remediation.label,
  );
}

function verifyMission(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_VERIFY" }>,
): DemoOpsState {
  const run = state.activeMission;
  const mission = getActiveMissionDefinition(state);
  const remediation = mission?.remediation.find(
    (candidate) => candidate.id === run?.chosenRemediationId,
  );
  if (
    !run ||
    !mission ||
    !remediation ||
    run.status !== MISSION_STATUS.ACTIVE ||
    !run.remediationExecuted ||
    run.verified ||
    (run.mode === MISSION_MODE.INTERVIEW && !action.rationale?.trim())
  ) {
    return state;
  }

  const elapsedMinutes = run.elapsedMinutes + MISSION_TIME_COST.VERIFICATION;
  const succeeded =
    remediation.correct &&
    remediation.id !== "r4" &&
    run.hypothesis.committed &&
    run.hypothesis.layer === mission.correctLayer &&
    elapsedMinutes <= mission.deadlineMinutes;
  const nextRun: MissionRun = {
    ...run,
    elapsedMinutes,
    verified: true,
    status: succeeded ? MISSION_STATUS.SUCCEEDED : MISSION_STATUS.FAILED,
    rationales: action.rationale?.trim()
      ? {
          ...run.rationales,
          "remediation:verify": action.rationale.trim(),
        }
      : run.rationales,
  };
  const verifiedState = succeeded
    ? applyMissionVerifiedOutcome(state, run, remediation.id)
    : state;
  return withMissionTimeline(
    verifiedState,
    nextRun,
    ACTION_PHASE.VERIFY,
    succeeded ? "Mission succeeded" : "Mission failed",
    mission.verificationSteps.join(" · "),
  );
}

const missionModelFaultReason = "Opus was removed from the Enterprise SE role for this mission.";

function captureMissionBaseline(
  state: DemoOpsState,
  missionId: string,
): MissionCausalBaseline | null {
  if (missionId !== "massive_dynamic_opus") return null;
  const role = state.roles.find((candidate) => candidate.id === "role_enterprise_se");
  const demo = state.demos.find((candidate) => candidate.id === "massive");
  const system = state.systems.find((candidate) => candidate.id === "model_governance");
  if (!role || !demo || !system) return null;

  return {
    roleId: role.id,
    roleModelPolicy: [...role.modelPolicy],
    demoId: demo.id,
    demoPresenterUserId: demo.presenterUserId,
    demoRequiredModel: demo.requiredModel,
    demoAtRisk: demo.atRisk,
    demoRiskReasons: [...demo.riskReasons],
    modelGovernanceStatus: system.status,
    modelGovernanceNote: system.note,
  };
}

function restoreMissionBaseline(state: DemoOpsState, run: MissionRun): DemoOpsState {
  const baseline = run.causalBaseline;
  if (!baseline) return state;
  return {
    ...state,
    roles: replaceById(state.roles, baseline.roleId, (role) => ({
      ...role,
      modelPolicy: [...baseline.roleModelPolicy],
    })),
    demos: replaceById(state.demos, baseline.demoId, (demo) => ({
      ...demo,
      presenterUserId: baseline.demoPresenterUserId,
      requiredModel: baseline.demoRequiredModel,
      atRisk: baseline.demoAtRisk,
      riskReasons: [...baseline.demoRiskReasons],
    })),
    systems: replaceById(state.systems, "model_governance", (system) => ({
      ...system,
      status: baseline.modelGovernanceStatus,
      note: baseline.modelGovernanceNote,
    })),
  };
}

function seedMissionFault(state: DemoOpsState, missionId: string): DemoOpsState {
  if (missionId !== "massive_dynamic_opus") return state;

  return {
    ...state,
    roles: replaceById(state.roles, "role_enterprise_se", (role) => ({
      ...role,
      modelPolicy: role.modelPolicy.filter((model) => model !== MODEL_ID.OPUS),
    })),
    demos: replaceById(state.demos, "massive", (demo) => ({
      ...demo,
      presenterUserId: "u_alexm",
      requiredModel: MODEL_ID.OPUS,
      atRisk: true,
      riskReasons: unique([...demo.riskReasons, missionModelFaultReason]),
    })),
    systems: replaceById(state.systems, "model_governance", (system) => ({
      ...system,
      status: system.status === SYSTEM_STATUS.RED ? SYSTEM_STATUS.RED : SYSTEM_STATUS.YELLOW,
      note: system.status === SYSTEM_STATUS.RED ? system.note : missionModelFaultReason,
    })),
  };
}

function applyMissionVerifiedOutcome(
  state: DemoOpsState,
  run: MissionRun,
  remediationId: string,
): DemoOpsState {
  if (run.missionId !== "massive_dynamic_opus") return state;

  const clearMissionRisk = (demo: DemoOpsState["demos"][number]) => {
    const riskReasons = demo.riskReasons.filter((reason) => reason !== missionModelFaultReason);
    return { ...demo, atRisk: riskReasons.length > 0, riskReasons };
  };

  let next = state;

  if (remediationId === "r1") {
    next = {
      ...state,
      demos: replaceById(state.demos, "massive", (demo) => ({
        ...clearMissionRisk(demo),
        requiredModel: MODEL_ID.SONNET,
      })),
    };
  } else if (remediationId === "r2") {
    next = {
      ...state,
      roles: replaceById(state.roles, "role_enterprise_se", (role) => ({
        ...role,
        modelPolicy: unique([MODEL_ID.OPUS, ...role.modelPolicy]),
      })),
      demos: replaceById(state.demos, "massive", clearMissionRisk),
    };
  } else if (remediationId === "r3") {
    next = {
      ...state,
      demos: replaceById(state.demos, "massive", (demo) => ({
        ...clearMissionRisk(demo),
        presenterUserId: "u_dana",
      })),
    };
  } else {
    return state;
  }

  return reconcileModelGovernanceSystem(next, run.causalBaseline);
}

function reconcileModelGovernanceSystem(
  state: DemoOpsState,
  baseline: MissionCausalBaseline | null,
): DemoOpsState {
  if (baseline?.modelGovernanceStatus === SYSTEM_STATUS.RED) {
    return {
      ...state,
      systems: replaceById(state.systems, "model_governance", (system) => ({
        ...system,
        status: baseline.modelGovernanceStatus,
        note: baseline.modelGovernanceNote,
      })),
    };
  }

  const enterpriseRole = state.roles.find((role) => role.id === "role_enterprise_se");
  const blockedDemo = state.demos.find((demo) => {
    const access = evaluateDemoAccess(state, demo.id);
    return access && !access.modelAllowed;
  });
  const roleDriftRemains = !enterpriseRole?.modelPolicy.includes(MODEL_ID.OPUS);
  const status = roleDriftRemains || blockedDemo ? SYSTEM_STATUS.YELLOW : SYSTEM_STATUS.GREEN;
  const note = roleDriftRemains
    ? "Enterprise SE still lacks Opus; the mission is deliverable through a bounded mitigation, but shared role drift remains."
    : blockedDemo
      ? `${blockedDemo.customer} remains blocked at the effective model-policy intersection.`
      : "Model policy intersections are healthy for every synthetic demo.";

  return {
    ...state,
    systems: replaceById(state.systems, "model_governance", (system) => ({
      ...system,
      status,
      note,
    })),
  };
}

function selectMissionPrevention(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_PREVENTION_SELECT" }>,
): DemoOpsState {
  const run = state.activeMission;
  if (!run || run.status === MISSION_STATUS.ACTIVE || !action.preventionId.trim()) {
    return state;
  }
  return withMissionTimeline(
    state,
    { ...run, preventionChoice: action.preventionId },
    ACTION_PHASE.RECOMMEND,
    "Prevention selected",
    action.preventionId,
  );
}

function fileMissionDebrief(
  state: DemoOpsState,
  action: Extract<DemoOpsAction, { type: "MISSION_DEBRIEF_FILE" }>,
): DemoOpsState {
  const run = state.activeMission;
  const mission = getActiveMissionDefinition(state);
  if (
    !run ||
    !mission ||
    run.status === MISSION_STATUS.ACTIVE ||
    !run.preventionChoice ||
    state.debriefs.some((debrief) => debrief.missionRunId === run.id)
  ) {
    return state;
  }
  const allocated = allocateId(state, "debrief");
  const debrief = scoreMissionDebrief(
    allocated.id,
    action.at,
    mission,
    run,
  );
  return {
    ...allocated.state,
    debriefs: [debrief, ...allocated.state.debriefs],
  };
}

function withMissionTimeline(
  state: DemoOpsState,
  run: MissionRun,
  phase: Parameters<typeof missionTimelineEntry>[2],
  label: string,
  detail: string,
): DemoOpsState {
  const allocated = allocateId(state, "mission-event");
  return {
    ...allocated.state,
    activeMission: {
      ...run,
      timeline: [
        ...run.timeline,
        missionTimelineEntry(
          allocated.id,
          run.elapsedMinutes,
          phase,
          label,
          detail,
        ),
      ],
    },
  };
}

function getIncident(state: DemoOpsState, id: string) {
  return state.incidents.find((incident) => incident.id === id);
}

function getScenario(state: DemoOpsState, key: ScenarioKey) {
  return state.incidentScenarios.find((scenario) => scenario.key === key);
}

function getActiveMissionDefinition(state: DemoOpsState) {
  return state.missionCatalog.find(
    (mission) => mission.id === state.activeMission?.missionId,
  );
}

function isDemoAffected(scenario: IncidentScenario, demoId: string): boolean {
  return (
    scenario.affectedDemoIds === "ALL" ||
    scenario.affectedDemoIds.includes(demoId)
  );
}

function clearScenarioRisk(
  state: DemoOpsState,
  scenario: IncidentScenario,
): DemoOpsState {
  return {
    ...state,
    demos: state.demos.map((demo) => {
      if (!isDemoAffected(scenario, demo.id)) return demo;
      const riskReasons = demo.riskReasons.filter(
        (reason) => reason !== scenario.title,
      );
      return { ...demo, riskReasons, atRisk: riskReasons.length > 0 };
    }),
  };
}

function applyVerifiedRemediation(
  state: DemoOpsState,
  scenario: IncidentScenario,
  remediationId: string,
  verifiedAt: string,
): DemoOpsState {
  let next = state;
  if (scenario.key === "CONNECTOR_CREDENTIAL_EXPIRED") {
    next = {
      ...next,
      integrations: replaceById(next.integrations, "salesforce", (integration) => ({
        ...integration,
        status: SYSTEM_STATUS.GREEN,
        lastCheckedAt: verifiedAt,
      })),
    };
  }
  if (scenario.key === "SCIM_REMOVED_PRESENTER") {
    next = {
      ...next,
      users: replaceById(next.users, "u_jordan", (user) => ({
        ...user,
        active: true,
        orgMember: true,
      })),
    };
  }
  if (scenario.key === "SEAT_WRONG_ROLE") {
    next = {
      ...next,
      users: replaceById(next.users, "u_alexr", (user) => ({
        ...user,
        roleId: "role_se",
      })),
    };
  }
  if (scenario.key === "MODEL_POLICY_MISMATCH") {
    if (remediationId === "r1") {
      next = {
        ...next,
        demos: replaceById(next.demos, "massive", (demo) => ({
          ...demo,
          requiredModel: MODEL_ID.SONNET,
          requiredEffort: EFFORT_LEVEL.STANDARD,
        })),
      };
    }
    if (remediationId === "r2") {
      next = {
        ...next,
        roles: replaceById(next.roles, "role_enterprise_se", (role) => ({
          ...role,
          modelPolicy: unique([...role.modelPolicy, MODEL_ID.OPUS]),
        })),
      };
    }
    if (remediationId === "r3") {
      next = {
        ...next,
        demos: replaceById(next.demos, "massive", (demo) => ({
          ...demo,
          presenterUserId: "u_dana",
        })),
      };
    }
  }
  return next;
}

function restoreSystemAfterResolution(
  state: DemoOpsState,
  scenario: IncidentScenario,
): DemoOpsState {
  let next = state;
  const hasAnotherActiveSystemIncident = state.incidents.some((incident) => {
    if (incident.status === INCIDENT_STATUS.RESOLVED) return false;
    return getScenario(state, incident.scenarioKey)?.systemId === scenario.systemId;
  });

  if (!hasAnotherActiveSystemIncident) {
    const connectorBaseline = scenario.systemId === "connectors";
    next = {
      ...next,
      systems: replaceById(next.systems, scenario.systemId, (system) => ({
        ...system,
        status: connectorBaseline ? SYSTEM_STATUS.YELLOW : SYSTEM_STATUS.GREEN,
        note: connectorBaseline
          ? "Synthetic Zendesk credential reaches its warning threshold in three days."
          : "Nominal synthetic state.",
      })),
    };
  }

  if (scenario.key === "CONNECTOR_CREDENTIAL_EXPIRED") {
    const environmentIncident = next.incidents.some((incident) => {
      if (incident.status === INCIDENT_STATUS.RESOLVED) return false;
      return getScenario(next, incident.scenarioKey)?.systemId === "environment";
    });
    if (!environmentIncident) {
      next = {
        ...next,
        systems: replaceById(next.systems, "environment", (system) => ({
          ...system,
          status: SYSTEM_STATUS.GREEN,
          note: "Nominal synthetic state.",
        })),
      };
    }
  }

  if (scenario.systemId === "model_governance") {
    const mismatches = next.demos
      .map((demo) => ({ demo, evaluation: evaluateDemoAccess(next, demo.id) }))
      .filter(({ evaluation }) => !evaluation?.ready);
    const hasImminentMismatch = mismatches.some(
      ({ demo }) => demo.minutesUntil <= 60,
    );
    next = {
      ...next,
      systems: replaceById(next.systems, "model_governance", (system) => ({
        ...system,
        status: hasImminentMismatch
          ? SYSTEM_STATUS.RED
          : mismatches.length > 0
            ? SYSTEM_STATUS.YELLOW
            : SYSTEM_STATUS.GREEN,
        note:
          mismatches.length > 0
            ? `${mismatches.length} upcoming demo(s) have an effective-access mismatch.`
            : "All upcoming demos have compatible model access.",
      })),
    };
  }

  return next;
}
