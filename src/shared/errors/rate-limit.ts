import { isHttpError } from '@/shared/errors/HttpError.ts';

/** Whether the error is an HTTP 429 rate-limit response. */
export function isRateLimitError(error: unknown): boolean {
  return isHttpError(error) && error.status === 429;
}

/** A positive `retry_after` the body carries (at the top or under `error`), in whole seconds. */
function retryAfterInBody(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const body = data as {
    error?: { retry_after?: unknown; retryAfter?: unknown };
    retry_after?: unknown;
    retryAfter?: unknown;
  };
  const raw =
    body.error?.retry_after ??
    body.error?.retryAfter ??
    body.retry_after ??
    body.retryAfter;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : undefined;
}

/**
 * Best-effort retry delay (seconds) for a 429: the `Retry-After` header the server sent (kept on
 * the error by the fetch client), else a `retry_after` in the body.
 */
export function getRateLimitRetryAfterSeconds(error: unknown): number | undefined {
  if (!isRateLimitError(error) || !isHttpError(error)) return undefined;
  const header = error.retryAfterSeconds ?? 0;
  return header > 0 ? header : retryAfterInBody(error.data);
}

/** User-facing rate-limit copy with optional countdown. */
export function formatRateLimitMessage(retryAfterSeconds?: number): string {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return `Too many requests. Try again in ${retryAfterSeconds} seconds.`;
  }
  return 'Too many requests. Please wait a moment and try again.';
}
