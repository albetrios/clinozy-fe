import { beforeEach, describe, expect, it, vi } from 'vitest';

// The test setup swaps this module for a double; here it is the real one, over a mocked `api`.
vi.unmock('./branches-api.ts');
vi.mock('@/core/http/api.ts', () => ({ api: { get: vi.fn() } }));
import { api } from '@/core/http/api.ts';

import { fetchActiveBranches } from './branches-api.ts';

const branch = (id: string, name: string, isMain: boolean) => ({
  id,
  name,
  tone: 'sage',
  is_main: isMain,
  opens_at: '09:00',
  closes_at: '20:00',
  working_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchActiveBranches', () => {
  it('reads the member’s branches in the server’s order', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        branch('br_mainaaaaaaaaaaaaaaaaa', 'Satellite', true),
        branch('br_otheraaaaaaaaaaaaaaaa', 'Andheri', false),
      ],
      meta: { request_id: 'req_1' },
    } as never);

    const branches = await fetchActiveBranches();

    expect(api.get).toHaveBeenCalledWith('/app/branches/my');
    expect(branches).toEqual([
      {
        id: 'br_mainaaaaaaaaaaaaaaaaa',
        name: 'Satellite',
        tone: 'sage',
        isMain: true,
        opensAt: '09:00',
        closesAt: '20:00',
        workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        reviewLink: null,
      },
      expect.objectContaining({ id: 'br_otheraaaaaaaaaaaaaaaa', isMain: false }),
    ]);
  });

  it('refuses a row shaped differently', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [{ ...branch('br_x', 'X', true), opens_at: '9am' }],
      meta: { request_id: 'req_1' },
    } as never);

    await expect(fetchActiveBranches()).rejects.toThrow();
  });
});
