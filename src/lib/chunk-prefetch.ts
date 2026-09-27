import { useEffect } from 'react';

import { afterPaint } from '@/lib/app-splash.ts';

export const IDLE_PREFETCH_TIMEOUT_MS = 10_000;

/** Auth funnels where heavy modal chunks must not idle-prefetch. */
const AUTH_FUNNEL_PREFIXES = [
  '/login',
  '/onboarding',
  '/callback',
  '/mfa',
  '/accept-invite',
] as const;

/** Signed-in app surfaces (not auth funnels) — safe to idle-prefetch heavy chunks. */
export function isAuthenticatedAppSurface(
  pathname: string,
  isAuthenticated: boolean,
  isAuthLoading: boolean,
): boolean {
  if (isAuthLoading || !isAuthenticated) return false;
  return !AUTH_FUNNEL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Prefetch a lazy chunk after first paint + idle. Returns a cancel function.
 * Used for Settings / Appearance / Language shells on authenticated routes.
 */
export function scheduleIdleChunkPrefetch(importFn: () => Promise<unknown>): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

  const run = () => {
    if (cancelled) return;
    importFn().catch(() => undefined);
  };

  const scheduleIdle = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: IDLE_PREFETCH_TIMEOUT_MS });
    } else {
      timeoutId = globalThis.setTimeout(run, 2000);
    }
  };

  afterPaint(() => {
    if (cancelled) return;
    requestAnimationFrame(scheduleIdle);
  });

  return () => {
    cancelled = true;
    if (idleId != null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
    if (timeoutId != null) globalThis.clearTimeout(timeoutId);
  };
}

/** Idle-prefetch hook — `enabled` gates auth + route surface checks at call site. */
export function useAuthenticatedIdleChunkPrefetch(
  importFn: () => Promise<unknown>,
  enabled: boolean,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: callers pass `() => import('…')` — a stable module path; only re-run when `enabled` flips
  useEffect(() => {
    if (!enabled) return;
    return scheduleIdleChunkPrefetch(importFn);
    // Callers pass `() => import('…')`; only re-run when `enabled` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable module path
  }, [enabled]);
}
