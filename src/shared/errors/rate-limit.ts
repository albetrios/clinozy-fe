import { isHttpError } from '@/shared/errors/HttpError.ts';

/** Whether the error is an HTTP 429 rate-limit response. */
export function isRateLimitError(error: unknown): boolean {
  return isHttpError(error) && error.status === 429;
}

/** Best-effort retry delay (seconds) from a 429 body or `Retry-After` hint. */
export function getRateLimitRetryAfterSeconds(error: unknown): number | undefined {
  if (!isRateLimitError(error)) return undefined;

  if (isHttpError(error) && error.data && typeof error.data === 'object') {
    const body = error.data as {
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
    if (Number.isFinite(parsed) && parsed > 0) return Math.ceil(parsed);
  }

  return undefined;
}

/** User-facing rate-limit copy with optional countdown. */
export function formatRateLimitMessage(retryAfterSeconds?: number): string {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return `Too many requests. Try again in ${retryAfterSeconds} seconds.`;
  }
  return 'Too many requests. Please wait a moment and try again.';
}
