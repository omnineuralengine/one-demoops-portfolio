import {
  createFoundryAction,
  createInitialFoundryState,
  DEFAULT_SAFE_DEMO_SIGNALS,
  scenarioFoundryReducer,
  type FoundryAction,
  type ScenarioFoundryState,
} from "../../features/scenario-foundry";

export function reduce(state: ScenarioFoundryState, action: FoundryAction) {
  return scenarioFoundryReducer(state, action);
}

export function throughReviewRequired(): ScenarioFoundryState {
  let state = createInitialFoundryState();
  state = reduce(state, createFoundryAction(state, "ACCEPT_CONTEXT", "sofia", "HUMAN", { input: DEFAULT_SAFE_DEMO_SIGNALS }));
  state = reduce(state, createFoundryAction(state, "COMPILE_CONTRACT", "agent-demo-preflight", "AGENT"));
  state = reduce(state, createFoundryAction(state, "GENERATE_WORLD", "agent-demo-preflight", "AGENT"));
  state = reduce(state, createFoundryAction(state, "RUN_PRIVACY_VALIDATION", "agent-demo-preflight", "AGENT"));
  state = reduce(state, createFoundryAction(state, "RUN_QUALITY_VALIDATION", "agent-demo-preflight", "AGENT"));
  state = reduce(state, createFoundryAction(state, "SUBMIT_FOR_REVIEW", "sofia", "HUMAN"));
  return state;
}

export function throughActive(): ScenarioFoundryState {
  let state = throughReviewRequired();
  state = reduce(state, createFoundryAction(state, "APPROVE_PACK", "aisha", "HUMAN"));
  state = reduce(state, createFoundryAction(state, "ACTIVATE_PACK", "maya", "HUMAN"));
  return state;
}

export function throughReady(): ScenarioFoundryState {
  const active = throughActive();
  return reduce(active, createFoundryAction(active, "RUN_ORACLE_EVALUATIONS", "agent-demo-preflight", "AGENT"));
}
