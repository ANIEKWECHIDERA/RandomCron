import { randomIntegerBetween } from "./random.js";

export interface BackoffOptions {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
}

export function calculateBackoffDelayMs({
  attempt,
  baseDelayMs,
  maxDelayMs,
  jitterRatio = 0.2,
}: BackoffOptions): number {
  const exponentialDelay = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Jitter spreads retries out so multiple workers do not hammer the endpoint in lockstep.
  const jitter = Math.floor(cappedDelay * jitterRatio);
  return randomIntegerBetween(Math.max(1, cappedDelay - jitter), cappedDelay);
}
