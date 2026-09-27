import { useEffect, useRef, useState } from 'react';

/**
 * Bumps `now` on an interval while `cooldownUntil` is set (for countdown UI).
 * Defers the first tick to avoid sync setState inside an effect (react-hooks plugin).
 */
export function useCooldownClock(cooldownUntil: number | null) {
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldownUntil !== null) {
      const tick = () => {
        setNow(Date.now());
      };
      const first = window.setTimeout(tick, 0);
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        window.clearTimeout(first);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [cooldownUntil]);

  return now;
}
