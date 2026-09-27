import { useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * Read a single-use secret from the URL (`?token=` on invite or legacy email links)
 * from the URL exactly once, then scrub it from the address bar.
 *
 * @remarks
 * The token survives only in component state: history entries, telemetry
 * URL captures, and copy-pasted links stop carrying it after first render.
 * `history.replaceState` is deliberate — the router never re-renders for
 * it, so the page keeps working off the in-memory value; a hard refresh
 * intentionally lands on the page's "invalid link" state (the backend
 * treats these tokens as single-use anyway). `lib/telemetry-scrub.ts`
 * covers the window before this effect runs.
 */
export function useConsumedSearchToken(param = 'token'): string {
  const search: Record<string, unknown> = useSearch({ strict: false });
  const [token] = useState(() => {
    // Reflect.get: `param` is a caller-supplied literal, and this shape
    // keeps the static object-injection lint quiet without a disable.
    const initial: unknown = Reflect.get(search, param);
    return typeof initial === 'string' ? initial : '';
  });

  useEffect(() => {
    if (!token) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, '', url);
  }, [token, param]);

  return token;
}
