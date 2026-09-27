import type { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';

/** Status codes that may clear after brief backoff when clinozy-be is under parallel E2E load. */
export const TRANSIENT_API_STATUSES = [429, 502, 503] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
