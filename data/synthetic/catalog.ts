import {
  ACCESS_REQUEST_STATUS,
  EFFORT_LEVEL,
  MODEL_ID,
  RISK_LEVEL,
  SYSTEM_STATUS,
} from "../../lib/domain/enums";
import type {
  AccessRequest,
  Demo,
  Integration,
  OrganizationModelPolicy,
  Role,
  SystemHealth,
  User,
} from "../../lib/domain/types";

export const SYNTHETIC_AS_OF = "2026-09-02T14:00:00.000Z";

export const systems: SystemHealth[] = [
  system(
    "identity",
    "Identity / SSO",
    "SAML/OIDC login for every demo-org user.",
    "Authenticates every synthetic user through the lab identity provider before any other layer is reachable.",
    "A global identity failure can block every presenter at once.",
    ["Check provider health", "Inspect certificate and secret expiry", "Correlate error codes with audit events"],
  ),
  system(
    "scim",
    "SCIM Provisioning",
    "Automated user lifecycle synchronization.",
    "Models create, update, and deprovision events from a fictional directory source of truth.",
    "A flawed mapping rule can quickly remove a valid presenter.",
    ["Review the sync diff", "Validate group mappings", "Compare with the source-of-truth record"],
  ),
  system(
    "users",
    "Users",
    "Directory of demo-org identities.",
    "Tracks synthetic presenters, administrators, and their lifecycle state.",
    "Every access decision relies on an accurate identity record.",
    ["Look for duplicates", "Confirm active state", "Validate identifier formatting"],
  ),
  system(
    "roles",
    "Roles & Permissions",
    "Role-based control for demo operations.",
    "Defines model, tool, and environment capabilities granted to each persona.",
    "Under-privilege blocks work; over-privilege increases risk.",
    ["Compare role with roster", "Inspect assignment history", "Verify least privilege"],
  ),
  system(
    "seats",
    "Seats",
    "Licensed synthetic capacity.",
    "Tracks whether active users have the seat required to enter the demo organization.",
    "A role is not usable without an active seat.",
    ["Check utilization", "Find stale allocations", "Confirm seat and role alignment"],
  ),
  system(
    "feature_config",
    "Feature Configuration",
    "Per-environment scenario flags.",
    "Models capabilities required by each synthetic demo runbook.",
    "A template sync can silently remove a required feature.",
    ["Inspect flag history", "Identify the last template", "Compare with the runbook"],
  ),
  {
    ...system(
      "connectors",
      "Connectors",
      "Fictional CRM, chat, and data integrations.",
      "Models OAuth and API dependencies without contacting real providers.",
      "A credential can expire immediately before a dependent demo.",
      ["Check expiry metadata", "Run a synthetic test call", "Review requested scopes"],
    ),
    status: SYSTEM_STATUS.YELLOW,
    note: "Synthetic Zendesk credential reaches its warning threshold in three days.",
  },
  system(
    "api_health",
    "API Health",
    "Synthetic latency and error-rate signals.",
    "Provides an aggregate view of fictional request performance.",
    "Degradation is often an earlier signal than a visible demo failure.",
    ["Review error trend", "Correlate with changes", "Determine scope"],
  ),
  system(
    "demo_data",
    "Demo Data",
    "Versioned fictional customer records.",
    "Keeps each demonstration coherent without using real customer data.",
    "Stale references can make a healthy environment tell the wrong story.",
    ["Check dataset version", "Find deprecated references", "Confirm refresh time"],
  ),
  system(
    "environment",
    "Environment Configuration",
    "Provisioned synthetic sandboxes.",
    "Tracks template alignment and configuration state for each demo environment.",
    "Unobserved drift becomes visible at the worst possible moment.",
    ["Diff with the golden template", "Inspect sync history", "Check failed jobs"],
  ),
  {
    ...system(
      "model_governance",
      "Model Governance",
      "Layered model and effort policy.",
      "Computes effective access as the intersection of organization and custom-role policy.",
      "A valid identity can still be unable to run the model a demo needs.",
      ["Check the organization allowlist", "Check role policy", "Inspect the blocking layer"],
    ),
    status: SYSTEM_STATUS.YELLOW,
    note: "Wayne Enterprises needs Sonnet, but its presenter currently has the Viewer role.",
  },
];

function system(
  id: SystemHealth["id"],
  name: string,
  blurb: string,
  description: string,
  whyItMatters: string,
  troubleshooting: string[],
): SystemHealth {
  return {
    id,
    name,
    blurb,
    description,
    whyItMatters,
    troubleshooting,
    status: SYSTEM_STATUS.GREEN,
    note: "Nominal synthetic state.",
  };
}

export const integrations: Integration[] = [
  integration("salesforce", "Salesforce"),
  integration("slack", "Slack"),
  {
    ...integration("data_cloud", "Data Cloud"),
    status: SYSTEM_STATUS.RED,
  },
  integration("analytics_module", "Analytics Module"),
  integration("product_catalog", "Product Catalog"),
  integration("sso_bridge", "SSO Bridge"),
];

function integration(id: string, name: string): Integration {
  return {
    id,
    name,
    status: SYSTEM_STATUS.GREEN,
    lastCheckedAt: "2026-09-02T13:55:00.000Z",
  };
}

export const roles: Role[] = [
  {
    id: "role_exec_se",
    name: "Executive SE",
    modelPolicy: [MODEL_ID.OPUS, MODEL_ID.SONNET, MODEL_ID.HAIKU],
    effortLimit: EFFORT_LEVEL.HIGH,
    toolPermissions: ["READ_DIAGNOSTICS", "RUN_PREFLIGHT", "DRAFT_ARTIFACT", "PROPOSE_CHANGE"],
  },
  {
    id: "role_enterprise_se",
    name: "Enterprise SE",
    modelPolicy: [MODEL_ID.OPUS, MODEL_ID.SONNET, MODEL_ID.HAIKU],
    effortLimit: EFFORT_LEVEL.HIGH,
    toolPermissions: ["READ_DIAGNOSTICS", "RUN_PREFLIGHT", "DRAFT_ARTIFACT", "PROPOSE_CHANGE"],
  },
  {
    id: "role_se",
    name: "Sales Engineer",
    modelPolicy: [MODEL_ID.SONNET, MODEL_ID.HAIKU],
    effortLimit: EFFORT_LEVEL.STANDARD,
    toolPermissions: ["READ_DIAGNOSTICS", "RUN_PREFLIGHT", "DRAFT_ARTIFACT"],
  },
  {
    id: "role_viewer",
    name: "Viewer",
    modelPolicy: [MODEL_ID.HAIKU],
    effortLimit: EFFORT_LEVEL.STANDARD,
    toolPermissions: ["READ_DIAGNOSTICS"],
  },
  {
    id: "role_admin",
    name: "Org Admin",
    modelPolicy: [MODEL_ID.OPUS, MODEL_ID.SONNET, MODEL_ID.HAIKU],
    effortLimit: EFFORT_LEVEL.HIGH,
    toolPermissions: [
      "READ_DIAGNOSTICS",
      "RUN_PREFLIGHT",
      "DRAFT_ARTIFACT",
      "PROPOSE_CHANGE",
      "WRITE_CONFIGURATION",
      "MANAGE_IDENTITIES",
    ],
  },
];

export const users: User[] = [
  user("u_alexm", "Alex Morgan", "JIT", ["GTM-SE", "Executive-Briefing-Team"], "role_enterprise_se", ["Massive Dynamic Executive Sandbox"]),
  user("u_jordan", "Jordan Lee", "SCIM", ["GTM-SE", "Acme-Demo-Team"], "role_se", ["Acme Sandbox"]),
  user("u_sam", "Sam Ortiz", "SCIM", ["GTM-SE"], "role_se", ["Globex Environment"]),
  user("u_priya", "Priya Nair", "SCIM", ["GTM-SE"], "role_viewer", ["Initech Demo Org"]),
  user("u_chen", "Chen Wu", "SCIM", ["GTM-SE"], "role_se", []),
  user("u_dana", "Dana Kim", "SCIM", ["GTM-SE"], "role_exec_se", ["Stark Sandbox"]),
  user("u_alexr", "Alex Rivera", "SCIM_BULK_IMPORT", ["GTM-SE"], "role_viewer", ["Wayne Demo Org"]),
];

function user(
  id: string,
  name: string,
  provisioning: User["provisioning"],
  groups: string[],
  roleId: string,
  workspaces: string[],
): User {
  return {
    id,
    name,
    identityProvider: "ONE Synthetic IdP",
    provisioning,
    groups,
    seatType: "SE Seat",
    seatActive: true,
    roleId,
    temporaryRoleId: null,
    temporaryRoleExpiresAt: null,
    orgMember: true,
    active: true,
    workspaces,
  };
}

export const organizationModelPolicy: OrganizationModelPolicy = {
  enabledModels: [MODEL_ID.OPUS, MODEL_ID.SONNET, MODEL_ID.HAIKU],
  defaultModel: MODEL_ID.SONNET,
  maximumEffort: EFFORT_LEVEL.HIGH,
  toolPermissions: [
    "READ_DIAGNOSTICS",
    "RUN_PREFLIGHT",
    "DRAFT_ARTIFACT",
    "PROPOSE_CHANGE",
    "WRITE_CONFIGURATION",
    "MANAGE_IDENTITIES",
  ],
  sensitiveDataTier: "SYNTHETIC_ONLY",
};

export const demos: Demo[] = [
  demo("massive", "Massive Dynamic — Executive Briefing", "u_alexm", "Massive Dynamic Executive Sandbox", 24, ["salesforce"], MODEL_ID.OPUS, EFFORT_LEVEL.HIGH),
  demo("acme", "Acme Corp", "u_jordan", "Acme Sandbox", 40, ["salesforce", "slack"], MODEL_ID.SONNET, EFFORT_LEVEL.STANDARD),
  demo("globex", "Globex Corporation", "u_sam", "Globex Environment", 135, ["salesforce", "data_cloud"], MODEL_ID.SONNET, EFFORT_LEVEL.STANDARD),
  demo("initech", "Initech", "u_priya", "Initech Demo Org", 240, ["analytics_module"], MODEL_ID.HAIKU, EFFORT_LEVEL.STANDARD),
  demo("umbrella", "Umbrella Corp", "u_chen", "Umbrella Corp Demo", 990, ["product_catalog"], MODEL_ID.SONNET, EFFORT_LEVEL.STANDARD),
  demo("stark", "Stark Industries", "u_dana", "Stark Sandbox", 1_620, ["sso_bridge", "slack"], MODEL_ID.OPUS, EFFORT_LEVEL.STANDARD),
  demo("wayne", "Wayne Enterprises", "u_alexr", "Wayne Demo Org", 2_880, ["salesforce"], MODEL_ID.SONNET, EFFORT_LEVEL.STANDARD),
];

function demo(
  id: string,
  customer: string,
  presenterUserId: string,
  environment: string,
  minutesUntil: number,
  integrationIds: string[],
  requiredModel: Demo["requiredModel"],
  requiredEffort: Demo["requiredEffort"],
): Demo {
  return {
    id,
    customer,
    presenterUserId,
    environment,
    minutesUntil,
    integrationIds,
    requiredModel,
    requiredEffort,
    atRisk: false,
    riskReasons: [],
    lastPreflight: null,
  };
}

export const accessRequests: AccessRequest[] = [
  request("ar1", "Provision Sales Engineer", "Maria Gonzalez (Manager)", "New hire: Tom Baker", "New hire needs the standard SE bundle.", RISK_LEVEL.MEDIUM, true, "PROVISION", { type: "ALLOCATE_SEATS", count: 1 }),
  request("ar2", "Workspace Access Issue", "Chen Wu (SE)", "Umbrella Corp Demo", "Seat and role are valid; the workspace ACL is stale.", RISK_LEVEL.LOW, false, "WORKSPACE_ACCESS", { type: "GRANT_WORKSPACE", userId: "u_chen", workspace: "Umbrella Corp Demo" }),
  request("ar3", "Add Connector", "Sam Ortiz (SE)", "Globex Environment", "Adding Data Cloud requires new OAuth scopes.", RISK_LEVEL.HIGH, true, "CONNECTOR", { type: "ENABLE_INTEGRATION", integrationId: "data_cloud" }),
  request("ar4", "Seat / Role Mismatch", "System reconciliation", "Priya Nair", "The expected Sales Engineer role differs from Viewer.", RISK_LEVEL.MEDIUM, true, "ROLE_CHANGE", { type: "ASSIGN_ROLE", userId: "u_priya", roleId: "role_se" }),
  request("ar5", "Temporary Elevated Access", "Dana Kim (SE)", "Org Admin for 24 hours", "Time-bounded elevation requested for SAML diagnostics.", RISK_LEVEL.HIGH, true, "ELEVATION", { type: "GRANT_TEMPORARY_ROLE", userId: "u_dana", roleId: "role_admin", durationHours: 24 }),
  request("ar6", "Bulk Group Provisioning", "Maria Gonzalez (Manager)", "Eight-person APAC cohort", "Bulk seat, role, and group assignment.", RISK_LEVEL.HIGH, true, "BULK_PROVISION", { type: "ALLOCATE_SEATS", count: 8 }),
];

function request(
  id: string,
  type: string,
  requester: string,
  target: string,
  detail: string,
  risk: AccessRequest["risk"],
  requiresApproval: boolean,
  kind: AccessRequest["kind"],
  effect: AccessRequest["effect"],
): AccessRequest {
  return {
    id,
    type,
    requester,
    target,
    detail,
    risk,
    requiresApproval,
    kind,
    status: ACCESS_REQUEST_STATUS.PENDING,
    approvalId: null,
    effect,
    executedAt: null,
  };
}
