import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { AUTH_KEYS, AUTH_NS } from '@/shared/auth/auth-shell.constants.ts';

import { AppError } from './AppError.ts';
import { FRONTEND_ERROR_CODES } from './frontend-error-codes.ts';
import { HttpError } from './HttpError.ts';
import { mapFrontendError, resolveKnownFrontendError } from './map-frontend-error.ts';

describe('mapFrontendError', () => {
  it('maps invalid credentials AppError to localized auth message', () => {
    const err = new AppError(
      FRONTEND_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      401,
      FRONTEND_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    );
    expect(mapFrontendError(err)).toBe(
      i18n.t(AUTH_KEYS.login.errors.invalidCredentials, { ns: AUTH_NS }),
    );
  });

  it('maps HttpError invalid_credentials reason to localized message', () => {
    const err = new HttpError('HTTP 401', 401, '/auth/login', 'POST', {
      error: { reason: 'invalid_credentials', detail: 'Bad email or password' },
    });
    expect(mapFrontendError(err)).toBe(
      i18n.t(AUTH_KEYS.login.errors.invalidCredentials, { ns: AUTH_NS }),
    );
  });

  it('maps clinozy-be invalid verification code detail to localized message', () => {
    expect(
      resolveKnownFrontendError(new Error('errors:invalidOrExpiredVerificationCode')),
    ).toBe(i18n.t(AUTH_KEYS.login.errors.invalidVerificationCode, { ns: AUTH_NS }));
  });
});
