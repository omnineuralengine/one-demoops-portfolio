import type {
  AccessRequestStatus,
  ActionPhase,
  AgentOperationKind,
  AgentPermissionMode,
  AgentStatus,
  ApprovalStatus,
  DemoReadiness,
  DomainEventType,
  EffortLevel,
  EvidenceQuality,
  IncidentStatus,
  MissionMode,
  MissionStatus,
  ModelId,
  RiskLevel,
  SystemStatus,
} from "./enums";

export type {
  AccessRequestStatus,
  ActionPhase,
  AgentOperationKind,
  AgentPermissionMode,
  AgentStatus,
  ApprovalStatus,
  DemoReadiness,
  DomainEventType,
  EffortLevel,
  EvidenceQuality,
  IncidentStatus,
  MissionMode,
  MissionStatus,
  ModelId,
  RiskLevel,
  SystemStatus,
} from "./enums";

export type SystemId =
  | "identity"
  | "scim"
  | "users"
  | "roles"
  | "seats"
  | "feature_config"
  | "connectors"
  | "api_health"
  | "demo_data"
  | "environment"
  | "model_governance";

export type ScenarioKey =
  | "SSO_FAILURE"
  | "SCIM_REMOVED_PRESENTER"
  | "CONNECTOR_CREDENTIAL_EXPIRED"
  | "FEATURE_DISABLED"
  | "SEAT_WRONG_ROLE"
  | "ENV_CONFIG_DRIFT"
  | "MODEL_POLICY_MISMATCH";

export interface SystemHealth {
  id: SystemId;
  name: string;
  blurb: string;
  description: string;
  whyItMatters: string;
  troubleshooting: string[];
  status: SystemStatus;
  note: string;
}

export interface Integration {
  id: string;
  name: string;
  status: SystemStatus;
  lastCheckedAt: string;
}

export interface PreflightCheck {
  id: string;
  label: string;
  systemId: SystemId;
  result: "PASS" | "WARN" | "FAIL";
  explanation: string;
}

export interface PreflightResult {
  checkedAt: string;
  overall: DemoReadiness;
  checks: PreflightCheck[];
}

export interface Demo {
  id: string;
  customer: string;
  presenterUserId: string;
  environment: string;
  minutesUntil: number;
  integrationIds: string[];
  requiredModel: ModelId;
  requiredEffort: EffortLevel;
  atRisk: boolean;
  riskReasons: string[];
  lastPreflight: PreflightResult | null;
}

export type ToolPermission =
  | "READ_DIAGNOSTICS"
  | "RUN_PREFLIGHT"
  | "DRAFT_ARTIFACT"
  | "PROPOSE_CHANGE"
  | "WRITE_CONFIGURATION"
  | "MANAGE_IDENTITIES";

export interface Role {
  id: string;
  name: string;
  modelPolicy: ModelId[];
  effortLimit: EffortLevel;
  toolPermissions: ToolPermission[];
}

export interface User {
  id: string;
  name: string;
  identityProvider: string;
  provisioning: "JIT" | "SCIM" | "SCIM_BULK_IMPORT";
  groups: string[];
  seatType: string | null;
  seatActive: boolean;
  roleId: string;
  temporaryRoleId: string | null;
  temporaryRoleExpiresAt: string | null;
  orgMember: boolean;
  active: boolean;
  workspaces: string[];
}

export type AccessRequestEffect =
  | { type: "ALLOCATE_SEATS"; count: number }
  | { type: "GRANT_WORKSPACE"; userId: string; workspace: string }
  | { type: "ENABLE_INTEGRATION"; integrationId: string }
  | { type: "ASSIGN_ROLE"; userId: string; roleId: string }
  | { type: "GRANT_TEMPORARY_ROLE"; userId: string; roleId: string; durationHours: number };

export interface OrganizationModelPolicy {
  enabledModels: ModelId[];
  defaultModel: ModelId;
  maximumEffort: EffortLevel;
  toolPermissions: ToolPermission[];
  sensitiveDataTier: "SYNTHETIC_ONLY";
}

export interface AccessRequest {
  id: string;
  type: string;
  requester: string;
  target: string;
  detail: string;
  risk: RiskLevel;
  requiresApproval: boolean;
  kind:
    | "PROVISION"
    | "WORKSPACE_ACCESS"
    | "CONNECTOR"
    | "ROLE_CHANGE"
    | "ELEVATION"
    | "BULK_PROVISION";
  status: AccessRequestStatus;
  approvalId: string | null;
  effect: AccessRequestEffect;
  executedAt: string | null;
}

export interface InvestigationOption {
  id: string;
  label: string;
  quality: EvidenceQuality;
  reveal: string;
  feedback: string;
}

export interface RemediationOption {
  id: string;
  label: string;
  kind: "MITIGATION" | "ROOT_CAUSE_FIX";
  correct: boolean;
  requiresApproval: boolean;
  risk: RiskLevel;
  speed: "FAST" | "MEDIUM" | "SLOW";
  blastRadius: string;
  reversible: boolean;
  customerImpact: string;
  feedback: string;
}

export interface IncidentScenario {
  key: ScenarioKey;
  title: string;
  systemId: SystemId;
  affectedDemoIds: "ALL" | string[];
  detectEvidence: string[];
  investigation: InvestigationOption[];
  diagnosis: string;
  remediation: RemediationOption[];
  verificationSteps: string[];
  learning: {
    whatHappened: string;
    whyItMatters: string;
    safeToAutomate: string;
    shouldStayHuman: string;
  };
}

export interface Incident {
  id: string;
  scenarioKey: ScenarioKey;
  status: IncidentStatus;
  createdAt: string;
  investigationLog: string[];
  chosenRemediationId: string | null;
  approvalId: string | null;
  verificationPassed: boolean | null;
  resolvedAt: string | null;
}

export interface ApprovalReceipt {
  id: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
  requestedBy: string;
  approverId: string | null;
  rationale: string;
  targetType: "INCIDENT_REMEDIATION" | "ACCESS_REQUEST" | "AGENT_ACTION" | "MISSION_REMEDIATION";
  targetId: string;
  operation: AgentOperationKind | "INCIDENT_REMEDIATION" | "ACCESS_REQUEST" | "MISSION_REMEDIATION";
  agentId: string | null;
  consumedAt: string | null;
}

export interface AgentOperationDefinition {
  kind: AgentOperationKind;
  label: string;
  phase: ActionPhase;
  risk: RiskLevel;
  reversible: boolean;
  consequential: boolean;
  requiresHumanApproval: boolean;
}

export interface OperationalAgent {
  id: string;
  name: string;
  monitoredDomain: string;
  status: AgentStatus;
  confidence: number;
  lastCheckedAt: string;
  inputs: string[];
  mostRecentFinding: string;
  proposedNextAction: string;
  permissionMode: AgentPermissionMode;
  escalationPolicy: string;
  requiresApproval: boolean;
  allowedOperations: AgentOperationKind[];
  linkedDemoIds: string[];
  linkedIncidentIds: string[];
  linkedPolicyIds: string[];
  linkedDocumentationChangeIds: string[];
}

export interface AgentActionProposal {
  id: string;
  agentId: string;
  operation: AgentOperationKind;
  targetId: string;
  rationale: string;
  status: "PROPOSED" | "APPROVED" | "DENIED" | "EXECUTED" | "VERIFIED";
  proposedAt: string;
  approvalId: string | null;
  executedAt: string | null;
  verifiedAt: string | null;
}

export interface RoutedGatewayRequest {
  id: string;
  occurredAt: string;
  requesterUserId: string;
  provenance: "PREFLIGHT" | "MISSION" | "AGENT_DIAGNOSTIC" | "PRESENTER";
  capability: string;
  sensitivity: "SYNTHETIC" | "INTERNAL_LAB";
  selectedModel: ModelId;
  fallbackModel: ModelId | null;
  effort: EffortLevel;
  latencyMs: number;
  outcome: "SUCCEEDED" | "FAILED" | "FALLBACK_SUCCEEDED" | "DENIED";
  policyExplanation: string[];
}

export type GatewayCapability =
  | "FAST_CLASSIFICATION"
  | "BALANCED_REASONING"
  | "DEEP_ANALYSIS";

export type GatewaySensitivity = "SYNTHETIC" | "INTERNAL_LAB";
export type GatewayCostBand = "LOW" | "MEDIUM" | "HIGH";

export interface GatewayRouteInput {
  requesterUserId: string;
  demoId: string;
  capability: GatewayCapability;
  sensitivity: GatewaySensitivity;
  latencyTargetMs: number;
  maximumCostBand: GatewayCostBand;
}

export interface GatewayCandidateEvaluation {
  model: ModelId;
  eligible: boolean;
  rejectionReasons: string[];
}

export interface GatewayRouteDecision {
  outcome: "ELIGIBLE" | "DENIED";
  selectedModel: ModelId | null;
  fallbackModel: ModelId | null;
  selectedCostBand: GatewayCostBand | null;
  estimatedLatencyMs: number | null;
  reasons: string[];
  candidates: GatewayCandidateEvaluation[];
}

export interface GatewayRouteAudit extends GatewayRouteInput, GatewayRouteDecision {
  id: string;
  evaluatedAt: string;
  ownerUserId: string;
}

export interface GatewayState {
  requestCount: number;
  successRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  fallbackCount: number;
  budgetUsed: number;
  budgetLimit: number;
  modelMix: Record<ModelId, number>;
  recentRequests: RoutedGatewayRequest[];
  routeAudits: GatewayRouteAudit[];
}

export interface MissionCommand {
  id: string;
  label: string;
  description: string;
  timeCostMinutes: number;
  reveal: string;
  layer: string;
  quality: EvidenceQuality;
}

export interface MissionDefinition {
  id: string;
  seed: string;
  title: string;
  role: string;
  customer: string;
  presenterUserId: string;
  deadlineMinutes: number;
  requiredModel: ModelId;
  requiredEffort: EffortLevel;
  briefing: string;
  objectives: string[];
  initialEvidence: string[];
  customerImpactConstraints: string[];
  securityConstraints: string[];
  correctLayer: string;
  diagnosis: string;
  terminalConditions: { success: string; failure: string };
  commands: MissionCommand[];
  remediation: RemediationOption[];
  verificationSteps: string[];
}

export interface MissionTimelineEntry {
  id: string;
  atMinute: number;
  phase: ActionPhase;
  label: string;
  detail: string;
}

export interface MissionCausalBaseline {
  roleId: string;
  roleModelPolicy: ModelId[];
  demoId: string;
  demoPresenterUserId: string;
  demoRequiredModel: ModelId;
  demoAtRisk: boolean;
  demoRiskReasons: string[];
  modelGovernanceStatus: SystemStatus;
  modelGovernanceNote: string;
}

export interface MissionRun {
  id: string;
  missionId: string;
  mode: MissionMode;
  status: MissionStatus;
  elapsedMinutes: number;
  commandsUsed: string[];
  hypothesis: {
    layer: string | null;
    confidence: number;
    nextTest: string;
    committed: boolean;
  };
  rationales: Record<string, string>;
  diagnosisRevealed: boolean;
  chosenRemediationId: string | null;
  remediationApprovalId: string | null;
  remediationApproved: boolean;
  remediationExecuted: boolean;
  verified: boolean;
  preventionChoice: string | null;
  timeline: MissionTimelineEntry[];
  causalBaseline: MissionCausalBaseline | null;
}

export interface DebriefDimension {
  key:
    | "TIME_TO_RESTORE"
    | "DIAGNOSTIC_RIGOR"
    | "LEAST_PRIVILEGE"
    | "BLAST_RADIUS"
    | "VERIFICATION"
    | "AUDITABILITY"
    | "CUSTOMER_IMPACT"
    | "RECURRENCE_PREVENTION";
  label: string;
  score: number;
  rating: string;
  explanation: string;
  alternativePath: string;
}

export interface MissionDebrief {
  id: string;
  missionRunId: string;
  missionId: string;
  completedAt: string;
  status: MissionStatus;
  dimensions: DebriefDimension[];
  timeline: MissionTimelineEntry[];
}

export interface DomainEvent {
  id: string;
  occurredAt: string;
  type: DomainEventType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  systemId: SystemId | null;
  message: string;
  actorId: string;
}

export interface DemoOpsState {
  seedVersion: string;
  syntheticAsOf: string;
  nextSequence: number;
  systems: SystemHealth[];
  integrations: Integration[];
  demos: Demo[];
  users: User[];
  roles: Role[];
  organizationModelPolicy: OrganizationModelPolicy;
  accessRequests: AccessRequest[];
  incidentScenarios: IncidentScenario[];
  incidents: Incident[];
  approvals: ApprovalReceipt[];
  agents: OperationalAgent[];
  agentActionProposals: AgentActionProposal[];
  gateway: GatewayState;
  missionCatalog: MissionDefinition[];
  activeMission: MissionRun | null;
  debriefs: MissionDebrief[];
  events: DomainEvent[];
  seats: { used: number; total: number };
}

export interface ReadinessDeduction {
  key: string;
  label: string;
  points: number;
  source: "SYSTEM" | "INCIDENT" | "DEMO";
  sourceId: string;
}

export interface ReadinessSummary {
  score: number;
  status: DemoReadiness;
  deductions: ReadinessDeduction[];
  atRiskDemoIds: string[];
  activeIncidentIds: string[];
}

export interface EffectiveModelAccess {
  userId: string;
  roleId: string | null;
  organizationModels: ModelId[];
  roleModels: ModelId[];
  effectiveModels: ModelId[];
  organizationMaximumEffort: EffortLevel;
  roleEffortLimit: EffortLevel | null;
  effectiveEffortLimit: EffortLevel | null;
  effectiveToolPermissions: ToolPermission[];
  blockingLayers: string[];
  canAccessOrganization: boolean;
}

export interface AgentAuthorizationDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  operation: AgentOperationDefinition;
  approvalId: string | null;
}
