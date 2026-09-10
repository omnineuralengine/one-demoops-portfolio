export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function roundTo(value: number, decimalPlaces = 0): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}
