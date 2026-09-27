import { describe, expect, it } from 'vitest';

import {
  authEmailPanelIsBlocked,
  authMethodIsDisabled,
  authMethodIsLoading,
} from './auth-form-pending.ts';

describe('auth-form-pending', () => {
  it('marks only the active oauth provider as loading', () => {
    const pending = { method: 'oauth' as const, provider: 'google' };
    expect(authMethodIsLoading(pending, { method: 'oauth', provider: 'google' })).toBe(
      true,
    );
    expect(authMethodIsLoading(pending, { method: 'oauth', provider: 'github' })).toBe(
      false,
    );
    expect(authMethodIsDisabled(pending, { method: 'oauth', provider: 'github' })).toBe(
      true,
    );
    expect(authMethodIsDisabled(pending, { method: 'passkey' })).toBe(true);
  });

  it('blocks the email panel while oauth or passkey is pending', () => {
    expect(authEmailPanelIsBlocked({ method: 'passkey' })).toBe(true);
    expect(authEmailPanelIsBlocked({ method: 'email-send' })).toBe(false);
    expect(authEmailPanelIsBlocked(null)).toBe(false);
  });
});
