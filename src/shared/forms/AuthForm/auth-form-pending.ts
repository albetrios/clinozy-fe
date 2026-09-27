/** Which unified-auth continue action is in flight (only one at a time). */
export type AuthContinuePending =
  | { method: 'oauth'; provider: string }
  | { method: 'passkey' }
  | { method: 'email-send' }
  | { method: 'email-verify' };

export function authMethodIsLoading(
  pending: AuthContinuePending | null,
  target: AuthContinuePending,
): boolean {
  if (!pending) return false;
  if (pending.method !== target.method) return false;
  if (pending.method === 'oauth' && target.method === 'oauth') {
    return pending.provider === target.provider;
  }
  return true;
}

/** True when another continue action is active — disables this target. */
export function authMethodIsDisabled(
  pending: AuthContinuePending | null,
  target: AuthContinuePending,
): boolean {
  return pending !== null && !authMethodIsLoading(pending, target);
}

/** Email panel is blocked when a non-email continue action is running. */
export function authEmailPanelIsBlocked(pending: AuthContinuePending | null): boolean {
  if (!pending) return false;
  return pending.method !== 'email-send' && pending.method !== 'email-verify';
}
