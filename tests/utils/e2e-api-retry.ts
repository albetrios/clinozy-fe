import type { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';

/** Status codes that may clear after brief backoff when clinozy-be is under parallel E2E load. */
export const TRANSIENT_API_STATUSES = [429, 502, 503] as const;

/** clinozy-be's readiness probe — the one `global-setup.ts` gates the run on. */
const BACKEND_READY_URL = 'http://localhost:3000/readyz';

/** How long a restart of clinozy-be may take before the request gives up. */
const BACKEND_RESTART_BUDGET_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A 502 or 503 through the dev proxy means clinozy-be did not answer — locally,
 * usually `tsx watch` restarting it after a source edit, which takes longer than
 * the short backoff. Waits until its readiness probe answers again (or the
 * budget runs out) so the retry lands on a running server.
 */
async function waitForBackendReady(): Promise<void> {
  const deadline = Date.now() + BACKEND_RESTART_BUDGET_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BACKEND_READY_URL, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
    } catch {
      // Still restarting — poll again.
    }
    await sleep(500);
  }
}

export type ApiRetryOptions = {
  /** Total attempts including the first (default 4). */
  attempts?: number;
  /** Base delay between retries in ms (default 250). */
  baseDelayMs?: number;
};

/**
 * Re-runs an API request when clinozy-be returns a transient status (429/502/503).
 * Use for contract assertions that must not flake under parallel Playwright workers.
 */
export async function withApiRetry(
  request: () => Promise<APIResponse>,
  options?: ApiRetryOptions,
): Promise<APIResponse> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 250;

  let last: APIResponse | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await request();
    const status = last.status();
    if (
      !TRANSIENT_API_STATUSES.includes(status as (typeof TRANSIENT_API_STATUSES)[number])
    ) {
      return last;
    }
    if (attempt < attempts - 1) {
      if (status !== 429) await waitForBackendReady();
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  return last!;
}

/**
 * Asserts an HTTP status after {@link withApiRetry}. Pass a single code or an allowed set.
 */
export async function expectApiStatus(
  request: () => Promise<APIResponse>,
  expected: number | readonly number[],
  options?: ApiRetryOptions,
): Promise<APIResponse> {
  const allowed = Array.isArray(expected) ? expected : [expected];
  const res = await withApiRetry(request, options);
  expect(allowed).toContain(res.status());
  return res;
}
