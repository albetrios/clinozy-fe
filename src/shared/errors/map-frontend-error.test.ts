import { describe, expect, it } from 'vitest';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { AUTH_KEYS, AUTH_NS } from '@/shared/auth/auth-shell.constants.ts';

import { AppError } from './AppError.ts';
import { FRONTEND_ERROR_CODES } from './frontend-error-codes.ts';
import { HttpError } from './HttpError.ts';
import { mapFrontendError, resolveKnownFrontendError } from './map-frontend-error.ts';

describe('mapFrontendError', () => {
  // Each used to toast its bare code — or, for a storage write that never answered (a CORS
  // refusal, a dropped connection), the raw English "Network request failed".
  it.each([
    [
      FRONTEND_ERROR_CODES.UPLOAD_STORAGE_UNREACHABLE,
      "Couldn't send the file to storage. Check your connection and try again; if it keeps failing, contact support.",
    ],
    [
      FRONTEND_ERROR_CODES.UPLOAD_STORAGE_REJECTED,
      'Storage refused the file. Try uploading it again.',
    ],
    [
      FRONTEND_ERROR_CODES.UPLOAD_NOT_CONFIRMED,
      "The file couldn't be verified after upload. Try uploading it again.",
    ],
    [
      FRONTEND_ERROR_CODES.UPLOAD_INVALID_FILE_NAME,
      "Rename the file and try again: its name can't contain slashes, “..” or control characters.",
    ],
  ])('says the upload failure %s in words', (code, message) => {
    expect(mapFrontendError(new AppError(code, 0, code))).toBe(message);
  });

  // A dismissed device prompt and an authenticator that already holds one of the
  // account's passkeys are the user's own outcomes, not a server failure (AUTH-03).
  it.each([
    [FRONTEND_ERROR_CODES.AUTH_PASSKEY_CANCELLED, 'Passkey registration was cancelled.'],
    [
      FRONTEND_ERROR_CODES.AUTH_PASSKEY_ALREADY_REGISTERED,
      'This device already holds a passkey for your account.',
    ],
  ])('says the passkey outcome %s in words', (code, message) => {
    expect(mapFrontendError(new AppError(code, 400, code))).toBe(message);
  });

  // A write a clinic switch overtook — the fetch client's 401 or an upload stopped before its
  // confirm — used to read "Your session has expired. Please sign in again." (E-1).
  it('says a write the clinic switch overtook was not saved, from either source', () => {
    const notSaved = 'This change was not saved because you switched clinic.';
    const code = FRONTEND_ERROR_CODES.WORKSPACE_SWITCHED;
    expect(mapFrontendError(new AppError(code, 409, code))).toBe(notSaved);
    expect(
      mapFrontendError(
        new HttpError('Workspace switched', 401, '/api/v1/app/x', 'PATCH', {
          error: { reason: code },
        }),
      ),
    ).toBe(notSaved);
  });

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
      403,
      'organization_read_only',
      "Read-only — this clinic's plan isn't active. Choose a plan to make changes.",
    ],
    [
      409,
      'seat_limit_reached',
      'Your plan has no free seat. Add a seat in Settings › Billing, then invite again.',
    ],
    [409, 'membership_already_exists', 'This person is already in the clinic.'],
    [
      409,
      'organization_slug_exists',
      'That workspace URL is already taken. Choose another one.',
    ],
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
