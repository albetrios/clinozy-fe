import { describe, expect, it, vi } from 'vitest';

import { AppError } from './AppError.ts';
import { apiErrorReason, mapApiError, notifyError, reportError } from './errorHandler.ts';
import { HttpError } from './HttpError.ts';

vi.mock('@sentry/react', () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) => {
    const scope = {
      setUser: vi.fn(),
      setTag: vi.fn(),
      setExtra: vi.fn(),
      setExtras: vi.fn(),
    };
    cb(scope);
  }),
  captureException: vi.fn(),
}));

vi.mock('@/shared/store/useAuthStore/index.ts', () => ({
  useAuthStore: { getState: () => ({ user: null }) },
}));

vi.mock('@/shared/store/useOrganizationStore/index.ts', () => ({
  useOrganizationStore: {
    getState: () => ({ organizationId: null, organizationSlug: null }),
  },
}));

const { notifyErrorMock } = vi.hoisted(() => ({ notifyErrorMock: vi.fn() }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    error: notifyErrorMock,
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('mapApiError', () => {
  it('returns AppError message as-is', () => {
    const err = new AppError('Custom error', 400, 'BAD_REQUEST');
    expect(mapApiError(err)).toBe('Custom error');
  });

  it('returns sanitized server message for HttpError', () => {
    const err = new HttpError('Bad Request', 400, '/api/test', 'POST', {
      message: 'Email is required',
    });
    expect(mapApiError(err)).toBe('Email is required');
  });

  it('rejects server messages containing SQL keywords', () => {
    const err = new HttpError('Bad Request', 400, '/api/test', 'POST', {
      message: 'SELECT * FROM users WHERE id = 1',
    });
    expect(mapApiError(err)).toBe(
      'The request was invalid. Please check your input and try again.',
    );
  });

  it('rejects server messages containing stack traces', () => {
    const err = new HttpError('Server Error', 500, '/api/test', 'GET', {
      message: 'TypeError: cannot read property at handler.ts:42',
    });
    expect(mapApiError(err)).toBe(
      'An internal server error occurred. Please try again later.',
    );
  });

  it('rejects server messages longer than 200 characters', () => {
    const err = new HttpError('Bad Request', 400, '/api/test', 'POST', {
      message: 'x'.repeat(201),
    });
    expect(mapApiError(err)).toBe(
      'The request was invalid. Please check your input and try again.',
    );
  });

  it('returns status-based fallback for HttpError without data.message', () => {
    const err = new HttpError('Not Found', 404, '/api/test', 'GET');
    expect(mapApiError(err)).toBe('The requested resource was not found.');
  });

  it('returns generic fallback for unknown HTTP status', () => {
    const err = new HttpError('Teapot', 418, '/api/test', 'GET');
    expect(mapApiError(err)).toBe('Something went wrong. Please try again.');
  });

  it('returns Error.message for generic errors', () => {
    expect(mapApiError(new Error('Network failure'))).toBe('Network failure');
  });

  it('returns fallback for non-Error values', () => {
    expect(mapApiError('string error')).toBe('An unexpected error occurred');
    expect(mapApiError(null)).toBe('An unexpected error occurred');
    expect(mapApiError(42)).toBe('An unexpected error occurred');
  });
});

describe('mapApiError / apiErrorReason (clinozy-be envelope)', () => {
  it('prefers the human error.detail from the envelope', () => {
    const err = new HttpError('HTTP 422', 422, '/x', 'POST', {
      error: { reason: 'validation_failed', detail: 'Email already in use' },
    });
    expect(mapApiError(err)).toBe('Email already in use');
  });

  it('falls back to a bare { message } when no envelope detail', () => {
    const err = new HttpError('HTTP 400', 400, '/x', 'POST', { message: 'Bad input' });
    expect(mapApiError(err)).toBe('Bad input');
  });

  it('exposes the machine reason for branching', () => {
    const err = new HttpError('HTTP 401', 401, '/x', 'POST', {
      error: { reason: 'invalid_credentials', detail: 'Bad email or password' },
    });
    expect(apiErrorReason(err)).toBe('invalid_credentials');
    expect(mapApiError(err)).toBe('Invalid email or password.');
  });

  it('returns undefined reason for non-HTTP errors', () => {
    expect(apiErrorReason(new Error('boom'))).toBeUndefined();
    expect(apiErrorReason('nope')).toBeUndefined();
  });

  it('mapApiError remains an alias of mapApiError', () => {
    expect(mapApiError).toBe(mapApiError);
  });
});

describe('notifyError', () => {
  it('toasts the mapped message via the notify surface', () => {
    notifyErrorMock.mockClear();
    const err = new HttpError('HTTP 422', 422, '/x', 'POST', {
      error: { detail: 'Email taken' },
    });
    notifyError(err, { id: 'q:1' });
    expect(notifyErrorMock).toHaveBeenCalledWith('Email taken', { id: 'q:1' });
  });
});

describe('reportError', () => {
  it('calls Sentry.captureException without throwing', () => {
    expect(() => reportError(new Error('test'))).not.toThrow();
  });

  it('handles AppError with code and statusCode', () => {
    expect(() => reportError(new AppError('fail', 500, 'INTERNAL'))).not.toThrow();
  });

  it('handles HttpError with request context', () => {
    expect(() =>
      reportError(new HttpError('Not Found', 404, '/api/x', 'GET')),
    ).not.toThrow();
  });
});
