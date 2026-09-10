"use client";

import { useReducer } from "react";
import { GitBranch, LockKeyhole } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill } from "@/components/ui/StatusPill";

const loopDefinitions = [
  {
    id: "provisioning",
    name: "Provisioning loop",
    trigger: "A new hire, role change, or bulk access request arrives.",
    goal: "Grant only the seat, role, and workspace access the job requires.",
    verify: "Login and a scoped permission test both pass.",
    checkpoint: "A person approves any role above Viewer.",
    terminal: "Access works, or the request closes with an explicit reason.",
  },
  {
    id: "preflight",
    name: "Demo preflight loop",
    trigger: "A demo enters its T−60 minute readiness window.",
    goal: "Find identity, connector, policy, environment, and model blockers early.",
    verify: "Every required dependency is PASS, WARN, or FAIL with an explanation.",
    checkpoint: "The presenter reviews every WARN or FAIL before go-live.",
    terminal: "The demo is READY, AT RISK, or NOT READY.",
  },
  {
    id: "drift",
    name: "Configuration drift loop",
    trigger: "A schedule, failed preflight, or unexpected policy change starts a diff.",
    goal: "Keep synthetic environments and effective model access aligned.",
    verify: "A re-diff finds no unreviewed delta.",
    checkpoint: "A person decides whether a delta is a mistake or intentional variation.",
    terminal: "No drift remains, or the variation is explicitly accepted.",
  },
  {
    id: "incident",
    name: "Incident recovery loop",
    trigger: "A health signal or manually injected failure creates an incident.",
    goal: "Restore readiness with root cause and blast radius understood.",
    verify: "Post-fix checks pass and linked demos recalculate.",
    checkpoint: "Identity, entitlement, credential, and policy changes require approval.",
    terminal: "The fix is verified or escalated to a human operator.",
  },
  {
    id: "learning",
    name: "Continuous learning loop",
    trigger: "A recurring incident pattern crosses its review threshold.",
    goal: "Turn repeat work into a safe detection rule, preflight, or runbook.",
    verify: "The next occurrence is prevented or detected earlier.",
    checkpoint: "A person approves automation that can change access or policy.",
    terminal: "Recurrence falls or the proposal closes with rationale.",
  },
] as const;

type LoopStatus = "IDLE" | "CHECKING" | "WAITING_FOR_HUMAN" | "VERIFIED";
type LoopState = Record<string, { status: LoopStatus; runs: number }>;

function loopReducer(state: LoopState, action: { type: "RUN" | "APPROVE"; id: string }): LoopState {
  const current = state[action.id] ?? { status: "IDLE", runs: 0 };
  if (action.type === "RUN") {
    const needsApproval = action.id === "provisioning" || action.id === "incident";
    return {
      ...state,
      [action.id]: {
        runs: current.runs + 1,
        status: needsApproval ? "WAITING_FOR_HUMAN" : "VERIFIED",
      },
    };
  }
  return { ...state, [action.id]: { ...current, status: "VERIFIED" } };
}

export function BoundedLoops() {
  const [loopState, dispatch] = useReducer(loopReducer, {});

  return (
    <section>
      <SectionHeading
        icon={GitBranch}
        title="Bounded operational loops"
        description="Every loop has a checkpoint, verification step, and a reason to stop."
      />
      <div className="loop-grid">
        {loopDefinitions.map((loop) => {
          const state = loopState[loop.id] ?? { status: "IDLE", runs: 0 };
          return (
            <Panel as="article" className="loop-card" key={loop.id}>
              <div className="card-title-row">
                <h3>{loop.name}</h3>
                <StatusPill
                  tone={
                    state.status === "VERIFIED"
                      ? "success"
                      : state.status === "WAITING_FOR_HUMAN"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {state.status.replaceAll("_", " ")}
                </StatusPill>
              </div>
              <dl className="compact-definition-list">
                <div><dt>Trigger</dt><dd>{loop.trigger}</dd></div>
                <div><dt>Goal</dt><dd>{loop.goal}</dd></div>
                <div><dt>Verify</dt><dd>{loop.verify}</dd></div>
                <div><dt>Stop when</dt><dd>{loop.terminal}</dd></div>
              </dl>
              <p className="human-checkpoint">
                <LockKeyhole size={13} aria-hidden="true" />
                <span><strong>Human checkpoint:</strong> {loop.checkpoint}</span>
              </p>
              {state.status === "WAITING_FOR_HUMAN" ? (
                <ActionButton compact tone="positive" onClick={() => dispatch({ type: "APPROVE", id: loop.id })}>
                  Approve this synthetic iteration
                </ActionButton>
              ) : (
                <ActionButton compact tone="quiet" onClick={() => dispatch({ type: "RUN", id: loop.id })}>
                  Run iteration {state.runs > 0 ? `· ${state.runs} complete` : ""}
                </ActionButton>
              )}
            </Panel>
          );
        })}
      </div>
    </section>
  );
}
