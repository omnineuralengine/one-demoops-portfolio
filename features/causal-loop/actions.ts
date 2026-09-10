import type { ActorKind, LoopAction, LoopRun } from "./types";

const REHEARSAL_EPOCH = Date.parse("2026-09-02T18:00:00.000Z");

export function createDeterministicLoopAction(
  run: LoopRun,
  type: LoopAction["type"],
  actorId: string,
  kind: ActorKind,
): LoopAction {
  const sequence = run.processedActionIds.length + 1;
  return {
    type,
    actionId: `${run.id}:action:${String(sequence).padStart(2, "0")}:${type.toLowerCase()}`,
    actor: { id: actorId, kind },
    at: new Date(REHEARSAL_EPOCH + sequence * 60_000).toISOString(),
  } as LoopAction;
}
