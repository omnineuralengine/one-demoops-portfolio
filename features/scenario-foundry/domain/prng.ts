export interface SeededRandom {
  next(): number;
  pick<T>(values: readonly T[]): T;
}

/** Mulberry32: compact, deterministic, and unsuitable for secrets by design. */
export function createSeededRandom(seed: number): SeededRandom {
  if (!Number.isSafeInteger(seed) || seed <= 0 || seed > 0xffff_ffff) throw new Error("INVALID_DETERMINISTIC_SEED");
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
    pick<T>(values: readonly T[]) {
      if (values.length === 0) throw new Error("EMPTY_DETERMINISTIC_CHOICE");
      return values[Math.floor(this.next() * values.length)];
    },
  };
}

export function shuffled<T>(values: readonly T[], random: SeededRandom): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random.next() * (index + 1));
    [copy[index], copy[selected]] = [copy[selected], copy[index]];
  }
  return copy;
}
