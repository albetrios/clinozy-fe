import { describe, expect, it } from 'vitest';

import { HttpError, isHttpError, isUnauthorized } from './HttpError.ts';

describe('HttpError', () => {
  it('creates error with status, url, method, data', () => {
    const err = new HttpError('Bad request', 400, '/api/test', 'POST', {
      message: 'Validation failed',
    });
    expect(err.message).toBe('Bad request');
    expect(err.status).toBe(400);
    expect(err.url).toBe('/api/test');
    expect(err.method).toBe('POST');
    expect(err.data).toEqual({ message: 'Validation failed' });
    expect(err.name).toBe('HttpError');
  });

  it('isHttpError returns true for HttpError', () => {
    expect(isHttpError(new HttpError('x', 500, '/', 'GET'))).toBe(true);
  });

  it('isHttpError returns false for other values', () => {
    expect(isHttpError(new Error('x'))).toBe(false);
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError('string')).toBe(false);
  });

  it('isUnauthorized returns true for 401 HttpError', () => {
    expect(isUnauthorized(new HttpError('Unauthorized', 401, '/', 'GET'))).toBe(true);
  });

  it('isUnauthorized returns false for non-401', () => {
    expect(isUnauthorized(new HttpError('Forbidden', 403, '/', 'GET'))).toBe(false);
    expect(isUnauthorized(new Error('x'))).toBe(false);
  });
});
