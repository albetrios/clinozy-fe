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

  it.each([
    [
      403,
      'missing_permission',
      "You don't have permission to do this. Ask the clinic's owner or an admin.",
    ],
    [
      403,
      'owner_membership_fixed',
      "The clinic owner's roles and status can't be changed. Transfer ownership first.",
    ],
    [
      403,
      'owner_cannot_leave',
      "The clinic owner can't leave. Transfer ownership first.",
    ],
    [
      403,
      'owner_role_fixed',
      "The access of the role the clinic owner holds can't be changed.",
    ],
    [403, 'system_role_fixed', "A preset role can't be renamed or deleted."],
    [403, 'role_locked', "This role's access is fixed and can't be changed."],
    [
      409,
      'seat_limit_reached',
      'Your plan has no free seat. Add a seat in Settings › Billing, then invite again.',
    ],
    [409, 'membership_already_exists', 'This person is already in the clinic.'],
    [
      400,
      'disposable_email',
      "Use a permanent email address — disposable ones aren't accepted.",
    ],
  ])('says a %i %s in our own words', (status, reason, message) => {
    const err = new HttpError(`HTTP ${status}`, status, '/x', 'POST', {
      error: { reason, detail: "The server's own English" },
    });
    expect(mapFrontendError(err)).toBe(message);
  });

  it('maps clinozy-be invalid verification code detail to localized message', () => {
    expect(
      resolveKnownFrontendError(new Error('errors:invalidOrExpiredVerificationCode')),
    ).toBe(i18n.t(AUTH_KEYS.login.errors.invalidVerificationCode, { ns: AUTH_NS }));
  });
});
