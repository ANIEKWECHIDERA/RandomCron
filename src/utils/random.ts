export function randomIntegerBetween(min: number, max: number): number {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

export function randomIntervalMs(minIntervalMs: number, maxIntervalMs: number): number {
  return randomIntegerBetween(minIntervalMs, maxIntervalMs);
}
