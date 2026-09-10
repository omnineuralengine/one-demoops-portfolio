import { FOUNDRY_UTC_ANCHOR } from "../fixture";
import type { FoundryAction, FoundryActionType, FoundryActorKind, ScenarioFoundryState } from "./types";

type BaseKeys = "type" | "eventId" | "requestId" | "packId" | "expectedRevision" | "actor" | "at" | "priorEventId";
export type FoundryActionPayload<T extends FoundryActionType> = Omit<Extract<FoundryAction, { type: T }>, BaseKeys>;
type PayloadArguments<T extends FoundryActionType> = keyof FoundryActionPayload<T> extends never ? [] : [payload: FoundryActionPayload<T>];

export function createFoundryAction<T extends FoundryActionType>(
  state: ScenarioFoundryState,
  type: T,
  actorId: string,
  kind: FoundryActorKind,
  ...payloadArguments: PayloadArguments<T>
): Extract<FoundryAction, { type: T }> {
  const sequence = state.processedEventIds.length + 1;
  const sequenceTime = Date.parse(FOUNDRY_UTC_ANCHOR) + sequence * 60_000;
  const priorTime = Date.parse(state.audit.at(-1)?.at ?? FOUNDRY_UTC_ANCHOR) + 60_000;
  const expiryTime = type === "EXPIRE_PACK" && state.contract ? Date.parse(state.contract.expirationPolicy.expiresAt) : Number.NEGATIVE_INFINITY;
  const base = {
    type,
    eventId: expectedFoundryEventId(state, type),
    requestId: state.requestId,
    packId: state.packId,
    expectedRevision: state.revision,
    actor: { id: actorId, kind },
    at: new Date(Math.max(sequenceTime, priorTime, expiryTime)).toISOString(),
    priorEventId: state.audit.at(-1)?.eventId ?? null,
  };
  return { ...base, ...(payloadArguments[0] ?? {}) } as Extract<FoundryAction, { type: T }>;
}

export function expectedFoundryEventId(state: ScenarioFoundryState, type: FoundryActionType): string {
  const sequence = state.processedEventIds.length + 1;
  return `${state.packId}:revision:${state.revision}:event:${String(sequence).padStart(3, "0")}:${type.toLowerCase()}`;
}
