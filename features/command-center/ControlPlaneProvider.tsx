"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import {
  causalLoopReducer,
  createGoldenLoopRun,
  type LoopAction,
  type LoopRun,
} from "@/features/causal-loop";
import {
  createInitialFoundryState,
  scenarioFoundryReducer,
  type FoundryAction,
  type ScenarioFoundryState,
} from "@/features/scenario-foundry";
import type { PublicChangeEvent } from "@/lib/change-radar/types";
import { demoOpsReducer, type DemoOpsAction } from "@/lib/domain/reducer";
import type { DemoOpsState, EffectiveModelAccess, ReadinessSummary } from "@/lib/domain/types";
import { computeEffectiveModelAccess } from "@/lib/selectors/effective-access";
import { computeReadiness } from "@/lib/selectors/readiness";
import { computeCausalAgents } from "@/lib/selectors/agents";

interface ControlPlaneContextValue {
  state: DemoOpsState;
  loop: LoopRun;
  foundry: ScenarioFoundryState;
  readiness: ReadinessSummary;
  effectiveAccess: EffectiveModelAccess[];
  dispatch: Dispatch<DemoOpsAction>;
  loopDispatch: Dispatch<LoopAction>;
  foundryDispatch: Dispatch<FoundryAction>;
}

const ControlPlaneContext = createContext<ControlPlaneContextValue | null>(null);

export function ControlPlaneProvider({
  initialState,
  publicChanges,
  children,
}: {
  initialState: DemoOpsState;
  publicChanges: readonly PublicChangeEvent[];
  children: ReactNode;
}) {
  const [baseState, dispatch] = useReducer(demoOpsReducer, initialState);
  const [loop, loopDispatch] = useReducer(causalLoopReducer, undefined, createGoldenLoopRun);
  const [foundry, foundryDispatch] = useReducer(scenarioFoundryReducer, undefined, createInitialFoundryState);
  const causalAgents = useMemo(
    () => computeCausalAgents(baseState, { publicChanges, loop }),
    [baseState, publicChanges, loop],
  );
  const state = useMemo(() => ({ ...baseState, agents: causalAgents }), [baseState, causalAgents]);
  const readiness = useMemo(() => computeReadiness(state), [state]);
  const effectiveAccess = useMemo(
    () => state.users.map((user) => computeEffectiveModelAccess(state, user.id)),
    [state],
  );
  const value = useMemo(
    () => ({ state, loop, foundry, readiness, effectiveAccess, dispatch, loopDispatch, foundryDispatch }),
    [state, loop, foundry, readiness, effectiveAccess],
  );

  return <ControlPlaneContext.Provider value={value}>{children}</ControlPlaneContext.Provider>;
}

export function useControlPlane(): ControlPlaneContextValue {
  const context = useContext(ControlPlaneContext);
  if (!context) throw new Error("useControlPlane must be used inside ControlPlaneProvider.");
  return context;
}
