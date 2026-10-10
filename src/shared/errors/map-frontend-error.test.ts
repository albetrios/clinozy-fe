import { describe, expect, it } from 'vitest';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
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

  it('says a stale save (record_changed) in our own words, not the server’s detail', () => {
    const err = new HttpError('HTTP 409', 409, '/app/leads/lead_x', 'PATCH', {
      error: {
        reason: 'record_changed',
        detail:
          'This record was changed by usr_kb5tlncpzg38oat3s7nv7 at 2026-10-10T11:45:34.719Z',
      },
    });
    expect(mapFrontendError(err)).toBe(
      i18n.t(ERRORS_KEYS.api.recordChanged, { ns: ERRORS_NS }),
    );
    expect(resolveKnownFrontendError(err)).toBe(
      'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
    );
  });

  it('maps clinozy-be invalid verification code detail to localized message', () => {
    expect(
      resolveKnownFrontendError(new Error('errors:invalidOrExpiredVerificationCode')),
    ).toBe(i18n.t(AUTH_KEYS.login.errors.invalidVerificationCode, { ns: AUTH_NS }));
  });
});
