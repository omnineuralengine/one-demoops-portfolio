export function intersectInOrder<T>(left: readonly T[], right: readonly T[]): T[] {
  const allowed = new Set(right);
  return left.filter((item) => allowed.has(item));
}

export function replaceById<T extends { id: string }>(
  collection: readonly T[],
  id: string,
  update: (value: T) => T,
): T[] {
  return collection.map((value) => (value.id === id ? update(value) : value));
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
