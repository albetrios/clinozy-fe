import { beforeEach, describe, expect, it } from 'vitest';

import { fetchMyPresence, resetPresenceFixture, saveMyPresence } from './presence-api.ts';

beforeEach(() => resetPresenceFixture());

describe('presence fixture', () => {
  it('starts Online and keeps what was set', async () => {
    expect(await fetchMyPresence()).toBe('online');
    await saveMyPresence('busy');
    expect(await fetchMyPresence()).toBe('busy');
  });
});
