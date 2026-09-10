import type {
  GeneratedScenarioWorld,
  PersonaView,
  ScenarioAction,
  ScenarioObject,
  ScenarioPersonaId,
  ScenarioPersonaPermission,
} from "./types";

const ALL_OBJECTS: readonly ScenarioObject[] = ["ACCOUNT", "CONTACT", "OPPORTUNITY", "CASE", "ACTIVITY"];
const ALL_ACTIONS: readonly ScenarioAction[] = ["VIEW", "UPDATE_NEXT_STEP", "ACTIVATE_PACK", "APPROVE_PACK", "TEARDOWN_PACK"];
const PRIVILEGED_DETAIL_PERSONAS = new Set<ScenarioPersonaId>(["demoops-admin", "privacy-reviewer"]);

export const SCENARIO_PERMISSIONS: readonly ScenarioPersonaPermission[] = [
  {
    personaId: "demoops-admin", label: "DemoOps administrator", objectAccess: ALL_OBJECTS,
    hiddenFields: [], recordScope: "ALL_SYNTHETIC",
    allowedActions: ["VIEW", "ACTIVATE_PACK", "TEARDOWN_PACK"], approvalRequiredActions: ["ACTIVATE_PACK"],
    prohibitedDisclosures: ["Do not imply that any synthetic record came from Salesforce."],
  },
  {
    personaId: "requesting-se", label: "Requesting Solution Engineer", objectAccess: ALL_OBJECTS,
    hiddenFields: ["SyntheticCase.restricted", "SyntheticOpportunity.securityRisk", "SyntheticOpportunity.restrictedFields", "SyntheticActivity.restricted"], recordScope: "ALL_SYNTHETIC",
    allowedActions: ["VIEW"], approvalRequiredActions: ["UPDATE_NEXT_STEP"],
    prohibitedDisclosures: ["Restricted security-case detail", "Fields outside the active persona view"],
  },
  {
    personaId: "seller-owner", label: "Seller / account owner", objectAccess: ALL_OBJECTS,
    hiddenFields: ["SyntheticContact.email", "SyntheticCase.restricted", "SyntheticOpportunity.securityRisk", "SyntheticOpportunity.restrictedFields", "SyntheticActivity.restricted"], recordScope: "OWNED_TERRITORY",
    allowedActions: ["VIEW", "UPDATE_NEXT_STEP"], approvalRequiredActions: [],
    prohibitedDisclosures: ["Restricted security-case detail", "Contact email", "Records outside owned territory"],
  },
  {
    personaId: "executive-viewer", label: "Executive viewer", objectAccess: ["ACCOUNT", "OPPORTUNITY"],
    hiddenFields: ["SyntheticOpportunity.nextStep", "SyntheticOpportunity.restrictedFields"], recordScope: "AGGREGATES_ONLY",
    allowedActions: ["VIEW"], approvalRequiredActions: [],
    prohibitedDisclosures: ["Contact-level data", "Case detail", "Restricted opportunity fields"],
  },
  {
    personaId: "restricted-viewer", label: "Restricted viewer", objectAccess: ["ACCOUNT", "ACTIVITY"],
    hiddenFields: ["SyntheticAccount.renewalValueBand", "SyntheticAccount.openPipelineValueBand", "SyntheticActivity.summaryCode"], recordScope: "PUBLIC_ACCOUNT_ONLY",
    allowedActions: ["VIEW"], approvalRequiredActions: [],
    prohibitedDisclosures: ["Opportunity values", "Contact data", "Case data", "Restricted activity detail"],
  },
  {
    personaId: "privacy-reviewer", label: "Privacy / scenario reviewer", objectAccess: ALL_OBJECTS,
    hiddenFields: [], recordScope: "VALIDATION_ONLY",
    allowedActions: ["VIEW", "APPROVE_PACK"], approvalRequiredActions: [],
    prohibitedDisclosures: ["No record may be represented as customer or production truth."],
  },
];

export function permissionFor(permissions: readonly ScenarioPersonaPermission[], personaId: ScenarioPersonaId): ScenarioPersonaPermission {
  const permission = permissions.find((candidate) => candidate.personaId === personaId);
  if (!permission) throw new Error("UNKNOWN_SCENARIO_PERSONA");
  return permission;
}

export function canPersonaAct(world: GeneratedScenarioWorld, personaId: ScenarioPersonaId, action: ScenarioAction): { allowed: boolean; requiresApproval: boolean; reason: string } {
  const permission = permissionFor(world.permissions, personaId);
  const allowed = permission.allowedActions.includes(action);
  return {
    allowed,
    requiresApproval: permission.approvalRequiredActions.includes(action),
    reason: allowed ? "Allowed by the fictional scenario permission contract." : "Blocked by the fictional scenario permission contract.",
  };
}

export function personaView(world: GeneratedScenarioWorld, personaId: ScenarioPersonaId): PersonaView {
  const persona = permissionFor(world.permissions, personaId);
  const access = new Set(persona.objectAccess);
  const owner = "seller-user-01";
  const scopedAccounts = world.records.accounts.filter((account, index) => {
    if (persona.recordScope === "OWNED_TERRITORY") return account.ownerUserId === owner;
    if (persona.recordScope === "PUBLIC_ACCOUNT_ONLY") return index === 1;
    return true;
  });
  const accountIds = new Set(scopedAccounts.map((account) => account.id));
  const empty = [] as const;
  const hidden = new Set(persona.hiddenFields.map((field) => field.split(".").at(-1)!));
  const project = (record: object) => Object.fromEntries(Object.entries(record).filter(([key]) => !hidden.has(key))) as Readonly<Record<string, string | number | boolean | null | readonly string[]>>;
  const records: PersonaView["records"] = persona.recordScope === "AGGREGATES_ONLY"
    ? {
        accounts: access.has("ACCOUNT") ? [{
          scope: "ALL_SYNTHETIC",
          accountCount: scopedAccounts.length,
          openOpportunityCount: world.records.opportunities.length,
          highestOpenPipelineValueBand: world.records.opportunities.some((item) => item.valueBand === "STRATEGIC") ? "STRATEGIC" : "MID_VALUE",
        }] : empty,
        contacts: empty,
        opportunities: access.has("OPPORTUNITY") ? ["DISCOVERY", "VALIDATION", "NEGOTIATION"].map((stage) => ({ stage, count: world.records.opportunities.filter((item) => item.stage === stage).length })) : empty,
        cases: empty,
        activities: empty,
      }
    : {
        accounts: access.has("ACCOUNT") ? scopedAccounts.map(project) : empty,
        contacts: access.has("CONTACT") ? world.records.contacts.filter((record) => accountIds.has(record.accountId) && (PRIVILEGED_DETAIL_PERSONAS.has(personaId) || !record.restricted)).map(project) : empty,
        opportunities: access.has("OPPORTUNITY") ? world.records.opportunities.filter((record) => accountIds.has(record.accountId)).map(project) : empty,
        cases: access.has("CASE") ? world.records.cases.filter((record) => accountIds.has(record.accountId) && (PRIVILEGED_DETAIL_PERSONAS.has(personaId) || !record.restricted)).map(project) : empty,
        activities: access.has("ACTIVITY") ? world.records.activities.filter((record) => accountIds.has(record.accountId) && (PRIVILEGED_DETAIL_PERSONAS.has(personaId) || !record.restricted)).map(project) : empty,
      };
  return {
    persona,
    records,
    hiddenFieldNames: [...persona.hiddenFields],
    allowedActions: [...persona.allowedActions],
    blockedActions: ALL_ACTIONS.filter((action) => !persona.allowedActions.includes(action)),
  };
}

export function allPermissionChecks(world: GeneratedScenarioWorld) {
  const requiredPersonas: readonly ScenarioPersonaId[] = ["demoops-admin", "requesting-se", "seller-owner", "executive-viewer", "restricted-viewer", "privacy-reviewer"];
  const completeModel = world.permissions.length === requiredPersonas.length
    && new Set(world.permissions.map((permission) => permission.personaId)).size === requiredPersonas.length
    && requiredPersonas.every((personaId) => world.permissions.some((permission) => permission.personaId === personaId));
  if (!completeModel) {
    return [{ id: "permission:model-completeness", outcome: "FAIL" as const, evidence: "The generated world must contain exactly one bounded permission definition for every fictional persona." }];
  }
  return world.permissions.flatMap((permission) => {
    const view = personaView(world, permission.personaId);
    const boundary = permissionProjectionIsSafe(world, permission.personaId, view);
    const expected = SCENARIO_PERMISSIONS.find((candidate) => candidate.personaId === permission.personaId)!;
    const actionMatrixIsExact = ALL_ACTIONS.every((action) => canPersonaAct(world, permission.personaId, action).allowed === expected.allowedActions.includes(action));
    const approvalsAreExact = sameStrings(permission.approvalRequiredActions, expected.approvalRequiredActions);
    return [
      { id: `permission:${permission.personaId}:positive`, outcome: permission.allowedActions.includes("VIEW") && boundary.positive && actionMatrixIsExact ? "PASS" as const : "FAIL" as const, evidence: `${permission.label} receives every explicitly allowed record, aggregate fact, and action.` },
      { id: `permission:${permission.personaId}:negative`, outcome: boundary.negative && actionMatrixIsExact && approvalsAreExact && view.blockedActions.length > 0 ? "PASS" as const : "FAIL" as const, evidence: `${permission.label} is denied every explicitly forbidden record, field, and action; approval requirements match the authored fictional policy.` },
    ];
  });
}

function permissionProjectionIsSafe(world: GeneratedScenarioWorld, personaId: ScenarioPersonaId, view: PersonaView) {
  const hasRows = Object.values(view.records).some((records) => records.length > 0);
  if (personaId === "demoops-admin" || personaId === "privacy-reviewer") {
    return { positive: hasRows, negative: !view.allowedActions.includes("UPDATE_NEXT_STEP") };
  }
  if (personaId === "requesting-se") {
    const noRestrictedRecords = view.records.contacts.every((record) => record.restricted !== true)
      && view.records.cases.every((record) => record.restricted !== true)
      && view.records.activities.every((record) => record.restricted !== true && record.summaryCode !== "SECURITY_FOLLOWUP_OVERDUE");
    return { positive: hasRows, negative: noRestrictedRecords && !view.allowedActions.includes("APPROVE_PACK") };
  }
  if (personaId === "seller-owner") {
    const ownedAccounts = new Set(world.records.accounts.filter((record) => record.ownerUserId === "seller-user-01").map((record) => record.id));
    const rows = [...view.records.accounts, ...view.records.contacts, ...view.records.opportunities, ...view.records.cases, ...view.records.activities];
    const scoped = rows.every((record) => typeof record.accountId !== "string" || ownedAccounts.has(record.accountId));
    return { positive: view.allowedActions.includes("UPDATE_NEXT_STEP") && hasRows, negative: scoped && view.records.contacts.every((record) => !("email" in record)) && view.records.cases.every((record) => record.restricted !== true) && view.records.activities.every((record) => record.restricted !== true && record.summaryCode !== "SECURITY_FOLLOWUP_OVERDUE") };
  }
  if (personaId === "executive-viewer") {
    const aggregateOnly = view.records.accounts.every((record) => !("id" in record) && !("name" in record))
      && view.records.opportunities.every((record) => !("id" in record) && !("accountId" in record))
      && view.records.contacts.length === 0 && view.records.cases.length === 0 && view.records.activities.length === 0;
    return { positive: hasRows, negative: aggregateOnly };
  }
  const publicAccountId = world.records.accounts[1]?.id;
  const publicOnly = view.records.accounts.length === 1 && view.records.accounts[0]?.id === publicAccountId
    && view.records.activities.every((record) => record.accountId === publicAccountId && !("summaryCode" in record))
    && view.records.contacts.length === 0 && view.records.opportunities.length === 0 && view.records.cases.length === 0;
  return { positive: hasRows, negative: publicOnly };
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
