import {
  EVIDENCE_QUALITY,
  RISK_LEVEL,
} from "../../lib/domain/enums";
import type {
  IncidentScenario,
  InvestigationOption,
  RemediationOption,
  ScenarioKey,
  SystemId,
} from "../../lib/domain/types";

const investigation = (
  id: string,
  label: string,
  quality: InvestigationOption["quality"],
  reveal: string,
  feedback: string,
): InvestigationOption => ({ id, label, quality, reveal, feedback });

const remediation = (
  id: string,
  label: string,
  correct: boolean,
  requiresApproval: boolean,
  risk: RemediationOption["risk"],
  blastRadius: string,
  customerImpact: string,
  feedback: string,
  kind: RemediationOption["kind"] = "ROOT_CAUSE_FIX",
): RemediationOption => ({
  id,
  label,
  kind,
  correct,
  requiresApproval,
  risk,
  speed: risk === RISK_LEVEL.LOW ? "FAST" : "MEDIUM",
  blastRadius,
  reversible: !label.toLowerCase().includes("delete"),
  customerImpact,
  feedback,
});

const learning = (
  whatHappened: string,
  whyItMatters: string,
  safeToAutomate: string,
  shouldStayHuman: string,
): IncidentScenario["learning"] => ({
  whatHappened,
  whyItMatters,
  safeToAutomate,
  shouldStayHuman,
});

const base = (
  key: ScenarioKey,
  title: string,
  systemId: SystemId,
  affectedDemoIds: IncidentScenario["affectedDemoIds"],
): Pick<IncidentScenario, "key" | "title" | "systemId" | "affectedDemoIds"> => ({
  key,
  title,
  systemId,
  affectedDemoIds,
});

export const incidentScenarios: IncidentScenario[] = [
  {
    ...base("SSO_FAILURE", "SSO Authentication Failure", "identity", "ALL"),
    detectEvidence: [
      "Twelve fictional users fail token exchange with invalid_client.",
      "The failures began when a scheduled secret rotation ran.",
      "All demos in the next three hours share this identity dependency.",
    ],
    investigation: [
      investigation("i1", "Inspect the identity audit log", EVIDENCE_QUALITY.DECISIVE, "The rotation created a new secret but did not update the application configuration.", "The timestamp, audit event, and error code form one causal story."),
      investigation("i2", "Compare impacted users", EVIDENCE_QUALITY.USEFUL, "Users span four teams and environments.", "This rules out a user- or environment-specific cause."),
      investigation("i3", "Restart demo environments", EVIDENCE_QUALITY.DISTRACTION, "Login still fails before any environment is reached.", "The action is outside the failing layer."),
    ],
    diagnosis: "A synthetic secret-rotation job failed between credential creation and configuration update.",
    remediation: [
      remediation("r1", "Rotate the app secret and update the identity configuration", true, true, RISK_LEVEL.HIGH, "One application registration", "Restores login for all presenters", "This corrects the failed rotation at its actual layer."),
      remediation("r2", "Disable SSO organization-wide", false, true, RISK_LEVEL.CRITICAL, "Entire organization", "Removes a security control", "This is disproportionate and weakens the system.", "MITIGATION"),
      remediation("r3", "Delete and recreate affected users", false, true, RISK_LEVEL.CRITICAL, "Twelve identity records", "Loses history without fixing the credential", "The users were never the cause."),
    ],
    verificationSteps: ["Validate the new secret", "Test login", "Confirm invalid_client errors stop"],
    learning: learning("A rotation stopped midway.", "Identity gates every downstream layer.", "Monitor expiry and rotation-job completion.", "Credential rotation and validation require a human."),
  },
  {
    ...base("SCIM_REMOVED_PRESENTER", "SCIM Accidentally Deprovisioned a Presenter", "scim", ["acme"]),
    detectEvidence: [
      "Jordan Lee is deprovisioned after a department transfer.",
      "The Acme demo starts in forty minutes.",
      "The source HR record still marks Jordan active.",
    ],
    investigation: [
      investigation("i1", "Review the SCIM sync diff", EVIDENCE_QUALITY.DECISIVE, "An unrecognized department string was treated as termination.", "This exposes the exact mapping defect."),
      investigation("i2", "Inspect the source record", EVIDENCE_QUALITY.USEFUL, "The user is active in the fictional source of truth.", "This places the error in SCIM interpretation."),
      investigation("i3", "Reboot the connector", EVIDENCE_QUALITY.DISTRACTION, "The committed deprovision decision remains.", "A restart cannot reverse the prior write."),
    ],
    diagnosis: "An overly literal SCIM mapping treated a legitimate department transfer as termination.",
    remediation: [
      remediation("r1", "Reactivate Jordan and verify groups and role", true, true, RISK_LEVEL.HIGH, "One user", "Presenter returns before the demo", "This restores the minimum required access."),
      remediation("r2", "Create a replacement account", false, true, RISK_LEVEL.HIGH, "One duplicate identity", "Loses saved state", "This creates identity debt and leaves the rule broken."),
      remediation("r3", "Wait for the next sync", false, false, RISK_LEVEL.LOW, "One user", "Likely misses the demo", "The unchanged rule will repeat the decision.", "MITIGATION"),
    ],
    verificationSteps: ["Confirm active status", "Confirm groups", "Test SSO", "Confirm presenter role"],
    learning: learning("A transfer was misclassified as termination.", "Lifecycle automation can cause damage at scale.", "Validate mapping rules and flag unknown values.", "Reactivation and mapping changes require review."),
  },
  {
    ...base("CONNECTOR_CREDENTIAL_EXPIRED", "Connector Credential Expired", "connectors", ["globex"]),
    detectEvidence: [
      "The Globex Salesforce connector returns a synthetic 401.",
      "Its refresh token reached the rotation boundary.",
      "Three upcoming demos depend on the connector.",
    ],
    investigation: [
      investigation("i1", "Inspect credential metadata", EVIDENCE_QUALITY.DECISIVE, "The token expired at the configured boundary and no reauthorization occurred.", "This directly explains the 401."),
      investigation("i2", "Test other connectors", EVIDENCE_QUALITY.USEFUL, "Data Cloud remains healthy.", "This isolates one credential."),
      investigation("i3", "Restart the demo organization", EVIDENCE_QUALITY.DISTRACTION, "The connector still returns 401.", "A restart cannot refresh an expired token."),
    ],
    diagnosis: "The fictional OAuth token expired without a completed reauthorization flow.",
    remediation: [
      remediation("r1", "Reauthorize the connector and confirm scopes", true, true, RISK_LEVEL.HIGH, "One connector", "Restores three dependent demos", "This is the smallest effective credential change."),
      remediation("r2", "Delete the connector", false, true, RISK_LEVEL.CRITICAL, "Three demos", "Removes a required capability", "Deletion moves farther from the intended state."),
      remediation("r3", "Grant permanent admin access", false, true, RISK_LEVEL.CRITICAL, "Standing external access", "Raises long-term exposure", "Over-privilege is not a rotation strategy."),
    ],
    verificationSteps: ["Validate reauthorization", "Run a test call", "Confirm connector GREEN", "Recheck linked demos"],
    learning: learning("A token expired without a renewal path.", "Connector failures often surface only in the live story.", "Alert before expiry.", "Scopes and reauthorization require human approval."),
  },
  {
    ...base("FEATURE_DISABLED", "Required Demo Feature Disabled", "feature_config", ["initech"]),
    detectEvidence: [
      "The required analytics flag is OFF.",
      "A stale template applied two hours ago.",
      "Two other environments share that template.",
    ],
    investigation: [
      investigation("i1", "Inspect flag audit history", EVIDENCE_QUALITY.DECISIVE, "The Q3 template overwrote the manual enablement.", "The audit trail identifies the writer and time."),
      investigation("i2", "Check template peers", EVIDENCE_QUALITY.USEFUL, "Two peers lost the same flag.", "This reveals template-level blast radius."),
      investigation("i3", "Check presenter role", EVIDENCE_QUALITY.DISTRACTION, "The role is valid.", "A feature flag is not a role symptom."),
    ],
    diagnosis: "A stale configuration template overwrote the runbook-required feature flag.",
    remediation: [
      remediation("r1", "Re-enable the flag and exclude the environment from the stale template", true, false, RISK_LEVEL.LOW, "One environment", "Restores the scripted feature", "This is reversible and scoped."),
      remediation("r2", "Rebuild the environment", false, true, RISK_LEVEL.HIGH, "Entire environment", "Unnecessary downtime", "A single flag does not justify a rebuild."),
      remediation("r3", "Proceed without the required feature", false, false, RISK_LEVEL.LOW, "No system change", "Leaves a visible gap", "The runbook declares the feature required.", "MITIGATION"),
    ],
    verificationSteps: ["Confirm flag ON", "Render the module", "Confirm template exclusion"],
    learning: learning("A stale template overwrote a valid local setting.", "Configuration gaps look like product failures.", "Run drift detection after sync.", "Template exemptions need human judgment."),
  },
  {
    ...base("SEAT_WRONG_ROLE", "User Has a Seat but the Wrong Role", "roles", ["wayne"]),
    detectEvidence: [
      "Alex Rivera has an active seat but the Viewer role.",
      "The roster expects Sales Engineer.",
      "The mismatch began with a bulk import.",
    ],
    investigation: [
      investigation("i1", "Compare role with roster", EVIDENCE_QUALITY.DECISIVE, "A blank import cell defaulted to Viewer.", "This identifies both expected state and mechanism."),
      investigation("i2", "Inspect the import cohort", EVIDENCE_QUALITY.USEFUL, "Two other rows share the same blank-field pattern.", "This establishes the real scope."),
      investigation("i3", "Check connector health", EVIDENCE_QUALITY.DISTRACTION, "All connectors are healthy.", "Connectors do not grant role permissions."),
    ],
    diagnosis: "A malformed bulk-import row silently defaulted the presenter to Viewer.",
    remediation: [
      remediation("r1", "Assign Sales Engineer and reject blank role imports", true, true, RISK_LEVEL.HIGH, "One user plus validation", "Restores expected capabilities", "The change matches the roster and prevents recurrence."),
      remediation("r2", "Grant Org Admin", false, true, RISK_LEVEL.CRITICAL, "Organization-wide administration", "Over-privileges the presenter", "The requested job does not require administration."),
      remediation("r3", "Remove and re-add the seat", false, true, RISK_LEVEL.HIGH, "One user", "Role remains wrong", "Seat state is not the blocking layer."),
    ],
    verificationSteps: ["Confirm Sales Engineer role", "Test environment launch", "Validate blank-field rule"],
    learning: learning("An import silently chose a restrictive default.", "Partial access failures are easy to overlook.", "Reject ambiguous import rows.", "Role changes remain human-approved."),
  },
  {
    ...base("ENV_CONFIG_DRIFT", "Environment Configuration Drift", "environment", ["umbrella"]),
    detectEvidence: [
      "Umbrella data is three versions behind.",
      "The last successful sync was six days ago.",
      "The alert targeted a deprovisioned on-call identity.",
    ],
    investigation: [
      investigation("i1", "Diff against the golden template", EVIDENCE_QUALITY.DECISIVE, "Six days of drift begin at the last successful sync.", "The diff shows exact divergence and timing."),
      investigation("i2", "Inspect alert delivery", EVIDENCE_QUALITY.DECISIVE, "The only recipient was inactive.", "This explains why the failure remained silent."),
      investigation("i3", "Check the presenter calendar", EVIDENCE_QUALITY.DISTRACTION, "The presenter is available.", "Availability does not explain configuration drift."),
    ],
    diagnosis: "A failed sync and invalid alert route allowed configuration drift to accumulate.",
    remediation: [
      remediation("r1", "Sync from the golden template and validate data", true, true, RISK_LEVEL.HIGH, "One environment", "Repairs the demo narrative", "This returns the environment to a known state."),
      remediation("r2", "Edit deprecated records individually", false, false, RISK_LEVEL.LOW, "Three records", "Leaves the failed sync unresolved", "This treats symptoms and will drift again.", "MITIGATION"),
      remediation("r3", "Cancel the demo", false, true, RISK_LEVEL.CRITICAL, "Customer-facing session", "Avoidable disruption", "The issue is recoverable before start.", "MITIGATION"),
    ],
    verificationSteps: ["Confirm data version", "Confirm no deprecated references", "Test alert delivery"],
    learning: learning("A job failed without a reachable alert recipient.", "Silent drift makes a demo quietly wrong.", "Automate drift checks and alert-route tests.", "Overwriting a customized environment needs review."),
  },
  {
    ...base("MODEL_POLICY_MISMATCH", "Model Policy Mismatch", "model_governance", ["massive"]),
    detectEvidence: [
      "Alex Morgan cannot select Opus for the executive briefing.",
      "Identity, seat, workspace, and connectors are healthy.",
      "The organization allowlist still includes Opus.",
    ],
    investigation: [
      investigation("i1", "Inspect organization policy", EVIDENCE_QUALITY.USEFUL, "Opus remains enabled at the organization layer.", "This rules out the broader layer."),
      investigation("i2", "Inspect custom-role policy", EVIDENCE_QUALITY.DECISIVE, "Enterprise SE no longer includes Opus.", "This is the effective-access intersection's blocking layer."),
      investigation("i3", "Inspect role history", EVIDENCE_QUALITY.DECISIVE, "Opus was removed three hours ago without an approval record.", "This establishes cause, timing, and missing governance."),
      investigation("i4", "Reset the presenter password", EVIDENCE_QUALITY.DISTRACTION, "Authentication succeeds but Opus remains unavailable.", "Authentication was already healthy."),
    ],
    diagnosis: "The Enterprise SE custom-role policy removed Opus while organization policy still allowed it.",
    remediation: [
      remediation("r1", "Use Sonnet for this session if the objective still holds", true, false, RISK_LEVEL.LOW, "One demo", "Preserves the session with reduced depth", "This is the fastest narrow mitigation.", "MITIGATION"),
      remediation("r2", "Restore Opus to Enterprise SE", true, true, RISK_LEVEL.HIGH, "Every Enterprise SE holder", "Restores intended access", "This is the scoped root-cause fix."),
      remediation("r3", "Reassign to the approved Executive SE backup", true, false, RISK_LEVEL.LOW, "One demo", "Requires a fast handoff", "This changes no policy.", "MITIGATION"),
      remediation("r4", "Broaden organization policy", false, true, RISK_LEVEL.CRITICAL, "Entire organization", "Does not remove the role block", "The organization already allows Opus."),
    ],
    verificationSteps: ["Recompute effective access", "Confirm required model", "Run demo governance check", "Attach approval receipt"],
    learning: learning("A role policy changed before an important demo.", "Access is the intersection of every policy layer.", "Compare required models with effective access during preflight.", "Role and organization policy changes require a human."),
  },
];
