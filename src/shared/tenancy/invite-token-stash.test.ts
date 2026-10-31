import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearStashedInviteToken,
  inviteTokenOf,
  readStashedInviteToken,
  stashInviteToken,
} from './invite-token-stash.ts';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('invite-token-stash', () => {
  it('keeps one invitation’s token in this tab until it is cleared', () => {
    stashInviteToken('inv_a', 'tok-a');
    expect(readStashedInviteToken('inv_a')).toBe('tok-a');
    expect(readStashedInviteToken('inv_b')).toBe('');
    expect(readStashedInviteToken(undefined)).toBe('');
    clearStashedInviteToken();
    expect(readStashedInviteToken('inv_a')).toBe('');
  });

  it('reads the token off an invite link’s search, and nothing else', () => {
    expect(inviteTokenOf({ token: 'tok-a' })).toBe('tok-a');
    expect(inviteTokenOf({ token: 7 })).toBe('');
    expect(inviteTokenOf({})).toBe('');
    expect(inviteTokenOf(undefined)).toBe('');
  });

  it('stashes nothing for a link without a token', () => {
    stashInviteToken('inv_a', '');
    expect(sessionStorage).toHaveLength(0);
  });

  it('reads a malformed stash as none', () => {
    sessionStorage.setItem('clinozy:accept-invite-token', '{not json');
    expect(readStashedInviteToken('inv_a')).toBe('');
    sessionStorage.setItem('clinozy:accept-invite-token', JSON.stringify({ token: 1 }));
    expect(readStashedInviteToken('inv_a')).toBe('');
  });

  it('survives blocked storage — the token is just not carried', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => stashInviteToken('inv_a', 'tok-a')).not.toThrow();
    expect(readStashedInviteToken('inv_a')).toBe('');
    expect(() => clearStashedInviteToken()).not.toThrow();
  });
});
