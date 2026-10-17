import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { apiClient } from '@/core/http/fetch-client.ts';
import { parseListTolerant } from '@/lib/parse-list-tolerant.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

/**
 * Step-up (re-authentication) API. clinozy-be gates sensitive credential
 * mutations — MFA enrollment, passkey registration, and the destructive
 * revoke/delete family — behind a short "recent step-up" window:
 *
 * - `POST /auth/step-up { password }` — password re-verification.
 * - `POST /auth/step-up { code }` — **bootstrap-only** 6-char email
 *   verification code, accepted only for passwordless accounts with no MFA.
 *   The window it opens can enroll a first factor but never satisfies the
 *   STRONG gate on destructive mutations.
 * - `POST /auth/me/mfa/verify { code }` — TOTP verification; the step-up path
 *   for MFA-enabled accounts (their password/email factors are rejected).
 *
 * All three answer a wrong password/code with **401** — a verdict on the
 * credential, not on the access token — so they are sent with `skip401`.
 * Without it the fetch client's reactive auth layer read the 401 as an expired
 * token: it refreshed, replayed the same wrong code, refreshed again, and after
 * the second rejection called `forceLogout()` on a perfectly live session
 * (QA AUTH-01). The caller (`StepUpDialog`) shows the 401 inline instead.
 */
const AUTH_API = `${API_BASE_PATH}/auth`;

/** A credential check's 401 is the answer, never a cue to refresh and replay. */
const CREDENTIAL_CHECK = { skip401: true } as const;

const authMethodWire = z.object({ id: z.string(), method_type: z.string() });

/** One row of `GET /auth/me/auth-methods` (id + type; rest is UI-irrelevant). */
export interface AuthMethodSummary {
  id: string;
  methodType: string;
}

/** The signed-in user's auth methods — drives which step-up factor to ask for. */
export async function listAuthMethods(): Promise<AuthMethodSummary[]> {
  const res = await apiClient.get<unknown>(`${AUTH_API}/me/auth-methods`);
  return parseListTolerant(authMethodWire, res.data, 'auth methods').map((row) => ({
    id: row.id,
    methodType: row.method_type,
  }));
}

/** Open a step-up window by re-verifying the account password. */
export async function stepUpWithPassword(password: string): Promise<void> {
  await apiClient.post<unknown>(`${AUTH_API}/step-up`, { password }, CREDENTIAL_CHECK);
}

/** Open a bootstrap step-up window with an emailed 6-char verification code. */
export async function stepUpWithEmailCode(code: string): Promise<void> {
  await apiClient.post<unknown>(`${AUTH_API}/step-up`, { code }, CREDENTIAL_CHECK);
}

/** Open a step-up window by verifying a TOTP code (MFA-enabled accounts). */
export async function stepUpWithTotp(code: string): Promise<void> {
  await apiClient.post<unknown>(`${AUTH_API}/me/mfa/verify`, { code }, CREDENTIAL_CHECK);
}

/**
 * Whether an error is clinozy-be's "Recent step-up authentication is required"
 * 403 — the signal to open the StepUpDialog and retry the original action.
 */
export function isStepUpRequiredError(error: unknown): boolean {
  if (!(error instanceof HttpError) || error.status !== 403) return false;
  const detail =
    (error.data as { error?: { detail?: string } } | undefined)?.error?.detail ??
    error.message;
  return /step-?up/i.test(detail);
}
