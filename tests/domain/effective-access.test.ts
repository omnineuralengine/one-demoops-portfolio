import { describe, expect, it } from "vitest";
import { createSyntheticState } from "../../data/synthetic/seed";
import { MODEL_ID } from "../../lib/domain/enums";
import {
  computeEffectiveModelAccess,
  createEffectiveModelAccessSelector,
  evaluateDemoAccess,
} from "../../lib/selectors/effective-access";

describe("effective model access", () => {
  it("intersects organization and role policy without mutating either", () => {
    const state = createSyntheticState();
    const alex = state.users.find((user) => user.id === "u_alexm")!;
    const originalRoleModels = [
      ...state.roles.find((role) => role.id === alex.roleId)!.modelPolicy,
    ];
    const narrowed = {
      ...state,
      organizationModelPolicy: {
        ...state.organizationModelPolicy,
        enabledModels: [MODEL_ID.SONNET, MODEL_ID.HAIKU],
      },
    };

    const access = computeEffectiveModelAccess(narrowed, alex.id);

    expect(access.effectiveModels).toEqual([MODEL_ID.SONNET, MODEL_ID.HAIKU]);
    expect(access.effectiveModels).not.toContain(MODEL_ID.OPUS);
    expect(
      state.roles.find((role) => role.id === alex.roleId)!.modelPolicy,
    ).toEqual(originalRoleModels);
  });

  it("honors upstream identity, seat, role, model, and effort boundaries", () => {
    const state = createSyntheticState();
    const wayne = evaluateDemoAccess(state, "wayne");

    expect(wayne).toMatchObject({
      ready: false,
      modelAllowed: false,
      effortAllowed: true,
    });
    expect(wayne?.blockingLayers).toContain("CUSTOM_ROLE_MODEL_POLICY");

    const inactive = {
      ...state,
      users: state.users.map((user) =>
        user.id === "u_alexm" ? { ...user, active: false } : user,
      ),
    };
    const access = computeEffectiveModelAccess(inactive, "u_alexm");
    expect(access.effectiveModels).toEqual([]);
    expect(access.effectiveToolPermissions).toEqual([]);
    expect(access.effectiveEffortLimit).toBeNull();
    expect(access.blockingLayers).toContain("USER_INACTIVE");
  });

  it("returns a stable memoized result for identical inputs", () => {
    const state = createSyntheticState();
    const selector = createEffectiveModelAccessSelector();
    expect(selector(state, "u_alexm")).toBe(selector(state, "u_alexm"));
  });
});
