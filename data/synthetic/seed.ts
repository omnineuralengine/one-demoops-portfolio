import { DOMAIN_EVENT_TYPE } from "../../lib/domain/enums";
import type { DemoOpsState } from "../../lib/domain/types";
import { accessRequests, demos, integrations, organizationModelPolicy, roles, SYNTHETIC_AS_OF, systems, users } from "./catalog";
import { agents } from "./agents";
import { gateway } from "./gateway";
import { incidentScenarios } from "./incidents";
import { missionCatalog } from "./missions";

const baseState: DemoOpsState = {
  seedVersion: "one-demoops-v1",
  syntheticAsOf: SYNTHETIC_AS_OF,
  nextSequence: 100,
  systems,
  integrations,
  demos,
  users,
  roles,
  organizationModelPolicy,
  accessRequests,
  incidentScenarios,
  incidents: [],
  approvals: [],
  agents,
  agentActionProposals: [],
  gateway,
  missionCatalog,
  activeMission: null,
  debriefs: [],
  events: [
    {
      id: "event-0002",
      occurredAt: "2026-09-02T13:58:00.000Z",
      type: DOMAIN_EVENT_TYPE.DEMO_READY,
      severity: "INFO",
      systemId: "environment",
      message: "Acme Sandbox passed its deterministic readiness sweep.",
      actorId: "agent-demo-preflight",
    },
    {
      id: "event-0001",
      occurredAt: "2026-09-02T13:51:00.000Z",
      type: DOMAIN_EVENT_TYPE.ACCESS_REQUEST_UPDATED,
      severity: "INFO",
      systemId: "scim",
      message: "Synthetic SCIM sync completed with three updates and no anomaly.",
      actorId: "agent-scim-drift",
    },
  ],
  seats: { used: 342, total: 400 },
};

function cloneState(state: DemoOpsState): DemoOpsState {
  return JSON.parse(JSON.stringify(state)) as DemoOpsState;
}

/** Fresh, deterministic state for a reducer, test, or server render. */
export function createSyntheticState(): DemoOpsState {
  return cloneState(baseState);
}

/** Treat this export as immutable; use createSyntheticState for interactive state. */
export const syntheticSeed: DemoOpsState = createSyntheticState();
