import { describe, expect, it } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';

import {
  formatRateLimitMessage,
  getRateLimitRetryAfterSeconds,
  isRateLimitError,
} from './rate-limit.ts';

describe('rate-limit helpers', () => {
  it('detects 429 HttpError', () => {
    const err = new HttpError('HTTP 429', 429, '/x', 'GET');
    expect(isRateLimitError(err)).toBe(true);
    expect(isRateLimitError(new Error('nope'))).toBe(false);
  });

  it('reads retry_after from the envelope', () => {
    const err = new HttpError('HTTP 429', 429, '/x', 'GET', {
      error: { retry_after: 30 },
    });
    expect(getRateLimitRetryAfterSeconds(err)).toBe(30);
    expect(formatRateLimitMessage(30)).toContain('30');
  });

  it('reads the Retry-After seconds the fetch client keeps on the error', () => {
    // clinozy-be names the wait in the `Retry-After` header only — the body carries none.
    const err = new HttpError('HTTP 429', 429, '/x', 'GET', undefined, 15);
    expect(getRateLimitRetryAfterSeconds(err)).toBe(15);
  });

  it('prefers the Retry-After header to an envelope retry_after', () => {
    const err = new HttpError(
      'HTTP 429',
      429,
      '/x',
      'GET',
      { error: { retry_after: 30 } },
      15,
    );
    expect(getRateLimitRetryAfterSeconds(err)).toBe(15);
  });
});
