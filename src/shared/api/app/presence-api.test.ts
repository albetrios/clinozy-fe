import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({ api: { get: vi.fn(), put: vi.fn() } }));
import { api } from '@/core/http/api.ts';

import { fetchMyPresence, saveMyPresence } from './presence-api.ts';

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.put).mockReset();
});

describe('my presence on clinozy-be', () => {
  it('reads it from my own user, Online when it names none', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { presence: 'busy' } } as never);
    expect(await fetchMyPresence()).toBe('busy');
    expect(api.get).toHaveBeenCalledWith('/users/me');

    vi.mocked(api.get).mockResolvedValue({ data: {} } as never);
    expect(await fetchMyPresence()).toBe('online');
  });

  it('saves it with PUT /users/me/presence and answers what was saved', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { presence: 'away' } } as never);
    expect(await saveMyPresence('away')).toBe('away');
    expect(api.put).toHaveBeenCalledWith('/users/me/presence', {
      body: { presence: 'away' },
    });
  });
});
