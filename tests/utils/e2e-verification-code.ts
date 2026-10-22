import type { APIResponse } from '@playwright/test';

/**
 * What this helper needs from a response. Playwright's `APIResponse` satisfies
 * it; so does a plain object, which is how the unit test drives it without
 * loading Playwright's runner inside Vitest.
 */
type JsonResponse = Pick<APIResponse, 'json'>;

/**
 * The code clinozy-be echoes on `send-code` when it runs in its local/TEST mode
 * (`debug_verification_code` — the same field the sign-in form prefills from), or
 * `null` on a backend that does not echo.
 *
 * Prefer it to `mail_outbox`: the echo is the code that was just issued, in the
 * response already in hand, so there is no second system to poll and no window in
 * which the outbox row is "not there yet". The outbox stays as the fallback.
 *
 * Dependency-free on purpose (a type-only import): every spec's sign-in goes
 * through this, so it has a unit test — `tests/ci/e2e-echoed-code.policy.test.ts`.
 */
export async function echoedVerificationCode(
  response: JsonResponse,
): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as {
    data?: { debug_verification_code?: unknown };
  } | null;
  const code = body?.data?.debug_verification_code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

/**
 * The invitation accept token clinozy-be echoes on the add-member answer
 * (`POST /tenancy/organization/memberships` → `data.invitation.debug_invitation_token`)
 * when `MEMBERSHIP_INVITATION_TOKEN_ECHO_ENABLED` is on — local and development only —
 * or `null` on a backend that does not echo.
 *
 * Prefer it to `mail_outbox` for the reason above, and one more: a running mail
 * worker scrubs a sent row's HTML, so the emailed accept link can be gone before a
 * spec reads it. The outbox stays as the fallback (a stack with no worker keeps it).
 */
export async function echoedInvitationToken(
  response: JsonResponse,
): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as {
    data?: { invitation?: { debug_invitation_token?: unknown } | null };
  } | null;
  const token = body?.data?.invitation?.debug_invitation_token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}
