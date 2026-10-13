import { useEffect, useState } from 'react';

/** The clock's default step: a minute — what due labels and the calendars' now line read. */
const MINUTE_MS = 60_000;

/**
 * The real clock (D15 — never the prototype's simulated one), moving on every
 * `intervalMs`: the calendars' now line and past veil, the Tasks list's due
 * labels and groups re-read it as it moves.
 */
export function useNow(intervalMs: number = MINUTE_MS): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
