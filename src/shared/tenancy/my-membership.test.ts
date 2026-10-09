import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({ api: { get: vi.fn() } }));
import { api } from '@/core/http/api.ts';

import { findMyMembershipId } from './my-membership.ts';

const row = (id: string, userId: string) => ({ id, user_id: userId, display_name: id });
const page = (rows: unknown[], next: string | null) => ({
  data: rows,
  meta: { pagination: { per_page: 100, next, has_more: next !== null } },
});

describe('findMyMembershipId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads the member picker page by page until the caller’s row', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        page([row('mem_a', 'usr_a'), row('mem_b', 'usr_b')], 'cursor-2') as never,
      )
      .mockResolvedValueOnce(page([row('mem_me', 'usr_me')], null) as never);

    await expect(findMyMembershipId('usr_me')).resolves.toBe('mem_me');

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/memberships', {
      query: { limit: 100, include_ended: 'false', after: undefined },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/memberships', {
      query: { limit: 100, include_ended: 'false', after: 'cursor-2' },
    });
  });

  it('answers null when no row is the caller’s', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([row('mem_a', 'usr_a')], null) as never,
    );

    await expect(findMyMembershipId('usr_me')).resolves.toBeNull();
  });

  it('refuses a row the API shapes differently', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([{ id: 'mem_a' }], null) as never);

    await expect(findMyMembershipId('usr_me')).rejects.toThrow();
  });
});
