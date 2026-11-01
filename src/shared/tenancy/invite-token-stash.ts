/**
 * The invitation's single-use token, kept in this tab across the sign-in hop — never in the
 * `/login?redirect=` URL. A redirect URL travels everywhere a URL does (history, the login
 * page's own telemetry, a copied link, an OAuth provider's `state` round trip), so the page sends
 * the visitor to sign in with `/accept-invite/<id>` alone and stashes the token here
 * (`sessionStorage`: this tab only, and it survives an OAuth redirect that a module variable
 * would not). The page reads it back on return and drops it once it accepts.
 *
 * Every storage call is guarded: a blocked or full storage just means the token is not carried —
 * the signed-in invitee can still accept without it (clinozy-be D84).
 */

const STASH_KEY = 'clinozy:accept-invite-token';

/** The `?token=` an invite link carries, from a parsed search object; `''` without one. */
export function inviteTokenOf(search: unknown): string {
  const token: unknown =
    typeof search === 'object' && search !== null
      ? Reflect.get(search, 'token')
      : undefined;
  return typeof token === 'string' ? token : '';
}

interface InviteTokenStash {
  invitationId: string;
  token: string;
}

function isStash(value: unknown): value is InviteTokenStash {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'invitationId') === 'string' &&
    typeof Reflect.get(value, 'token') === 'string'
  );
}

/** Keep `token` for `invitationId` until this tab comes back from signing in. */
export function stashInviteToken(invitationId: string, token: string): void {
  if (!token) return;
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ invitationId, token }));
  } catch {
    // Storage blocked: the token is not carried; accepting still works without it.
  }
}

/** The token stashed for `invitationId`, or `''` — another invitation's stash never answers. */
export function readStashedInviteToken(invitationId: string | undefined): string {
  if (!invitationId) return '';
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    const stash: unknown = raw ? JSON.parse(raw) : null;
    return isStash(stash) && stash.invitationId === invitationId ? stash.token : '';
  } catch {
    return '';
  }
}

/** Drop the stashed token — the page has it in memory and is accepting now. */
export function clearStashedInviteToken(): void {
  try {
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    // Nothing to clear.
  }
}
