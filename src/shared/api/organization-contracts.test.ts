import { describe, expect, it } from 'vitest';

import { isInvitationExpired } from './organization-contracts.ts';

describe('isInvitationExpired', () => {
  const now = Date.parse('2026-10-03T04:30:00.000Z');

  it('expires an invitation at its time, not before', () => {
    expect(isInvitationExpired({ expiresAt: '2026-10-03T04:29:00.000Z' }, now)).toBe(
      true,
    );
    expect(isInvitationExpired({ expiresAt: '2026-10-03T04:30:00.000Z' }, now)).toBe(
      true,
    );
    expect(isInvitationExpired({ expiresAt: '2026-10-03T04:31:00.000Z' }, now)).toBe(
      false,
    );
  });

  it('reads the clock when no time is given', () => {
    expect(isInvitationExpired({ expiresAt: '2000-01-01T00:00:00.000Z' })).toBe(true);
    expect(isInvitationExpired({ expiresAt: '2999-01-01T00:00:00.000Z' })).toBe(false);
  });
});
