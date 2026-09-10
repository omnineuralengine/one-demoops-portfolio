import { EFFORT_LEVEL, SYSTEM_STATUS } from "../domain/enums";
import type {
  DemoOpsState,
  EffectiveModelAccess,
  EffortLevel,
  User,
} from "../domain/types";
import { intersectInOrder } from "../utils/collections";
import { memoizeLast } from "../utils/memoize";

const effortRank: Record<EffortLevel, number> = {
  [EFFORT_LEVEL.STANDARD]: 0,
  [EFFORT_LEVEL.HIGH]: 1,
};

export function minimumEffortLimit(
  organizationLimit: EffortLevel,
  roleLimit: EffortLevel,
): EffortLevel {
  return effortRank[organizationLimit] <= effortRank[roleLimit]
    ? organizationLimit
    : roleLimit;
}

export function isEffortAllowed(
  requested: EffortLevel,
  limit: EffortLevel | null,
): boolean {
  return limit !== null && effortRank[requested] <= effortRank[limit];
}

export function computeEffectiveModelAccess(
  state: DemoOpsState,
  userId: string,
): EffectiveModelAccess {
  const user = state.users.find((candidate) => candidate.id === userId);
  const effectiveRoleId = user && isTemporaryRoleActive(user, state.syntheticAsOf)
    ? user.temporaryRoleId
    : user?.roleId;
  const role = user
    ? state.roles.find((candidate) => candidate.id === effectiveRoleId)
    : undefined;
  const organizationModels = [...state.organizationModelPolicy.enabledModels];

  if (!user) {
    return {
      userId,
      roleId: null,
      organizationModels,
      roleModels: [],
      effectiveModels: [],
      organizationMaximumEffort: state.organizationModelPolicy.maximumEffort,
      roleEffortLimit: null,
      effectiveEffortLimit: null,
      effectiveToolPermissions: [],
      blockingLayers: ["USER_NOT_FOUND"],
      canAccessOrganization: false,
    };
  }

  const blockingLayers: string[] = [];
  const identitySystem = state.systems.find((system) => system.id === "identity");
  if (identitySystem?.status === SYSTEM_STATUS.RED) blockingLayers.push("IDENTITY_SYSTEM");
  if (!user.active) blockingLayers.push("USER_INACTIVE");
  if (!user.orgMember) blockingLayers.push("ORGANIZATION_MEMBERSHIP");
  if (!user.seatActive || !user.seatType) blockingLayers.push("SEAT");
  if (!role) blockingLayers.push("CUSTOM_ROLE_POLICY");

  const roleModels = role ? [...role.modelPolicy] : [];
  const upstreamAccess = blockingLayers.length === 0;
  const effectiveModels = upstreamAccess
    ? intersectInOrder(organizationModels, roleModels)
    : [];
  const effectiveToolPermissions = upstreamAccess && role
    ? intersectInOrder(
        state.organizationModelPolicy.toolPermissions,
        role.toolPermissions,
      )
    : [];

  if (upstreamAccess && organizationModels.length > 0 && effectiveModels.length === 0) {
    blockingLayers.push("MODEL_POLICY_INTERSECTION");
  }

  return {
    userId,
    roleId: role?.id ?? null,
    organizationModels,
    roleModels,
    effectiveModels,
    organizationMaximumEffort: state.organizationModelPolicy.maximumEffort,
    roleEffortLimit: role?.effortLimit ?? null,
    effectiveEffortLimit: upstreamAccess && role
      ? minimumEffortLimit(
          state.organizationModelPolicy.maximumEffort,
          role.effortLimit,
        )
      : null,
    effectiveToolPermissions,
    blockingLayers,
    canAccessOrganization: upstreamAccess,
  };
}

export function isTemporaryRoleActive(user: User, evaluatedAt: string): boolean {
  if (!user.temporaryRoleId || !user.temporaryRoleExpiresAt) return false;

  const evaluationTime = Date.parse(evaluatedAt);
  const expirationTime = Date.parse(user.temporaryRoleExpiresAt);
  return (
    Number.isFinite(evaluationTime) &&
    Number.isFinite(expirationTime) &&
    evaluationTime < expirationTime
  );
}

export function createEffectiveModelAccessSelector() {
  return memoizeLast(computeEffectiveModelAccess);
}

export const selectEffectiveModelAccess = createEffectiveModelAccessSelector();

export interface DemoAccessEvaluation {
  demoId: string;
  presenterUserId: string;
  ready: boolean;
  modelAllowed: boolean;
  effortAllowed: boolean;
  workspaceAllowed: boolean;
  blockingLayers: string[];
}

export function evaluateDemoAccess(
  state: DemoOpsState,
  demoId: string,
): DemoAccessEvaluation | null {
  const demo = state.demos.find((candidate) => candidate.id === demoId);
  if (!demo) return null;

  const access = computeEffectiveModelAccess(state, demo.presenterUserId);
  const modelAllowed = access.effectiveModels.includes(demo.requiredModel);
  const effortAllowed = isEffortAllowed(
    demo.requiredEffort,
    access.effectiveEffortLimit,
  );
  const blockingLayers = [...access.blockingLayers];
  const user = state.users.find((candidate) => candidate.id === demo.presenterUserId);
  const workspaceAllowed = Boolean(user?.workspaces.includes(demo.environment));

  if (!modelAllowed) {
    const organizationAllows = access.organizationModels.includes(demo.requiredModel);
    blockingLayers.push(
      organizationAllows ? "CUSTOM_ROLE_MODEL_POLICY" : "ORGANIZATION_MODEL_POLICY",
    );
  }
  if (!effortAllowed) blockingLayers.push("EFFORT_LIMIT");
  if (!workspaceAllowed) blockingLayers.push("WORKSPACE_POLICY");

  return {
    demoId,
    presenterUserId: demo.presenterUserId,
    ready:
      access.canAccessOrganization &&
      modelAllowed &&
      effortAllowed &&
      workspaceAllowed &&
      !demo.atRisk,
    modelAllowed,
    effortAllowed,
    workspaceAllowed,
    blockingLayers: [...new Set(blockingLayers)],
  };
}
