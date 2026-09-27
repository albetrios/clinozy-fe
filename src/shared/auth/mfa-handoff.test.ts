import { afterEach, describe, expect, it } from 'vitest';

import { clearMfaHandoff, readMfaHandoff, stashMfaHandoff } from './mfa-handoff.ts';

describe('mfa-handoff', () => {
  afterEach(() => {
    clearMfaHandoff();
  });

  it('round-trips the MFA session token and redirect target', () => {
    stashMfaHandoff('mfa_sess_1', '/organization/acme/dashboard');
    expect(readMfaHandoff()).toEqual({
      mfaSessionToken: 'mfa_sess_1',
      redirect: '/organization/acme/dashboard',
    });
  });

  it('clears stored handoff data', () => {
    stashMfaHandoff('mfa_sess_2', '/');
    clearMfaHandoff();
    expect(readMfaHandoff()).toEqual({ mfaSessionToken: '' });
  });
});
