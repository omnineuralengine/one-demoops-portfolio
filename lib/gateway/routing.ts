import type {
  DemoOpsState,
  GatewayCapability,
  GatewayCandidateEvaluation,
  GatewayCostBand,
  GatewayRouteDecision,
  GatewayRouteInput,
  ModelId,
} from "@/lib/domain/types";
import { computeEffectiveModelAccess } from "@/lib/selectors/effective-access";

interface ModelProfile {
  costBand: GatewayCostBand;
  estimatedLatencyMs: number;
  capabilities: GatewayCapability[];
  qualityRank: number;
}

export const GATEWAY_MODEL_PROFILES: Record<ModelId, ModelProfile> = {
  haiku: {
    costBand: "LOW",
    estimatedLatencyMs: 450,
    capabilities: ["FAST_CLASSIFICATION"],
    qualityRank: 1,
  },
  sonnet: {
    costBand: "MEDIUM",
    estimatedLatencyMs: 1_200,
    capabilities: ["FAST_CLASSIFICATION", "BALANCED_REASONING", "DEEP_ANALYSIS"],
    qualityRank: 2,
  },
  opus: {
    costBand: "HIGH",
    estimatedLatencyMs: 3_500,
    capabilities: ["BALANCED_REASONING", "DEEP_ANALYSIS"],
    qualityRank: 3,
  },
};

const modelLabels: Record<ModelId, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};

const costRank: Record<GatewayCostBand, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

const preferenceByCapability: Record<GatewayCapability, ModelId[]> = {
  FAST_CLASSIFICATION: ["haiku", "sonnet", "opus"],
  BALANCED_REASONING: ["sonnet", "opus", "haiku"],
  DEEP_ANALYSIS: ["opus", "sonnet", "haiku"],
};

export function evaluateGatewayRoute(
  state: DemoOpsState,
  input: GatewayRouteInput,
): GatewayRouteDecision {
  const user = state.users.find((candidate) => candidate.id === input.requesterUserId);
  const demo = state.demos.find((candidate) => candidate.id === input.demoId);
  const access = computeEffectiveModelAccess(state, input.requesterUserId);
  const commonRejections: string[] = [];

  if (!user) commonRejections.push("The selected presenter does not exist in the synthetic directory.");
  if (!demo) commonRejections.push("The selected demo environment is not in the allowlisted catalog.");
  if (!access.canAccessOrganization) commonRejections.push("Identity, membership, seat, or role policy blocks organization access.");
  if (user && demo && !user.workspaces.includes(demo.environment)) {
    commonRejections.push(`${user.name} is not assigned to ${demo.environment}.`);
  }
  if (
    input.sensitivity === "INTERNAL_LAB"
    && state.organizationModelPolicy.sensitiveDataTier === "SYNTHETIC_ONLY"
  ) {
    commonRejections.push("Internal-lab data is outside the organization policy tier; only synthetic data is permitted.");
  }

  const preference = preferenceByCapability[input.capability];
  const candidates = preference.map((model) => evaluateCandidate(
    model,
    state,
    input,
    demo?.requiredModel ?? null,
    access.effectiveModels,
    commonRejections,
  ));
  const eligible = candidates.filter((candidate) => candidate.eligible);
  const selected = eligible[0] ?? null;
  const fallback = eligible[1] ?? null;

  if (!selected) {
    const conciseRejections = uniqueReasons(candidates.flatMap((candidate) => candidate.rejectionReasons));
    return {
      outcome: "DENIED",
      selectedModel: null,
      fallbackModel: null,
      selectedCostBand: null,
      estimatedLatencyMs: null,
      reasons: [
        `${user?.name ?? "Unknown presenter"} cannot be routed into ${demo?.environment ?? "the unknown environment"} under the current intersection.`,
        ...conciseRejections,
        `Effective model allowlist: ${formatModelSet(access.effectiveModels)}.`,
      ],
      candidates,
    };
  }

  const selectedProfile = GATEWAY_MODEL_PROFILES[selected.model];
  const preferred = candidates[0];
  const selectionReason = preferred.model === selected.model
    ? `${modelLabels[selected.model]} is the first policy-eligible model for ${formatCapability(input.capability)}.`
    : `${modelLabels[preferred.model]} was rejected (${preferred.rejectionReasons.join(" ")}); ${modelLabels[selected.model]} is the first fallback that independently satisfies every constraint.`;

  return {
    outcome: "ELIGIBLE",
    selectedModel: selected.model,
    fallbackModel: fallback?.model ?? null,
    selectedCostBand: selectedProfile.costBand,
    estimatedLatencyMs: selectedProfile.estimatedLatencyMs,
    reasons: [
      `${user?.name ?? "Unknown presenter"} is active and assigned to ${demo?.environment ?? "the selected environment"}.`,
      `${demo?.customer ?? "The environment"} requires ${demo ? modelLabels[demo.requiredModel] : "an allowlisted model"} quality or higher.`,
      selectionReason,
      `${modelLabels[selected.model]} is ${selectedProfile.costBand} cost with an estimated ${selectedProfile.estimatedLatencyMs.toLocaleString("en-US")} ms policy latency, within the requested ${input.maximumCostBand} / ${input.latencyTargetMs.toLocaleString("en-US")} ms envelope.`,
      `Organization and role policy intersect to ${formatModelSet(access.effectiveModels)}.`,
      fallback
        ? `${modelLabels[fallback.model]} is the only recorded fallback because it also passes the full policy intersection.`
        : "No second model passes every constraint, so no fallback is advertised.",
    ],
    candidates,
  };
}

function evaluateCandidate(
  model: ModelId,
  state: DemoOpsState,
  input: GatewayRouteInput,
  environmentRequiredModel: ModelId | null,
  effectiveModels: ModelId[],
  commonRejections: string[],
): GatewayCandidateEvaluation {
  const profile = GATEWAY_MODEL_PROFILES[model];
  const rejectionReasons = [...commonRejections];

  if (!state.organizationModelPolicy.enabledModels.includes(model)) {
    rejectionReasons.push(`${modelLabels[model]} is outside the organization allowlist.`);
  }
  if (!effectiveModels.includes(model)) {
    rejectionReasons.push(`${modelLabels[model]} is outside the presenter's effective role allowlist.`);
  }
  if (!profile.capabilities.includes(input.capability)) {
    rejectionReasons.push(`${modelLabels[model]} does not satisfy ${formatCapability(input.capability)}.`);
  }
  if (costRank[profile.costBand] > costRank[input.maximumCostBand]) {
    rejectionReasons.push(`${modelLabels[model]}'s ${profile.costBand} cost exceeds the ${input.maximumCostBand} ceiling.`);
  }
  if (profile.estimatedLatencyMs > input.latencyTargetMs) {
    rejectionReasons.push(`${modelLabels[model]}'s ${profile.estimatedLatencyMs.toLocaleString("en-US")} ms estimate exceeds the ${input.latencyTargetMs.toLocaleString("en-US")} ms target.`);
  }
  if (
    environmentRequiredModel
    && profile.qualityRank < GATEWAY_MODEL_PROFILES[environmentRequiredModel].qualityRank
  ) {
    rejectionReasons.push(`${modelLabels[model]} is below the environment's ${modelLabels[environmentRequiredModel]} quality floor.`);
  }

  return {
    model,
    eligible: rejectionReasons.length === 0,
    rejectionReasons: uniqueReasons(rejectionReasons),
  };
}

function formatCapability(capability: GatewayCapability): string {
  return capability.toLowerCase().replaceAll("_", " ");
}

function formatModelSet(models: ModelId[]): string {
  return models.length > 0
    ? `{${models.map((model) => modelLabels[model]).join(", ")}}`
    : "{}";
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}
