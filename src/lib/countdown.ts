/**
 * Whole seconds left until `deadline` (epoch ms), rounded up and never negative —
 * a countdown shows "0:01" until the deadline itself, then "0:00".
 */
export function secondsUntil(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** `m:ss` — the countdown shape the session warning and the update notice share. */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
