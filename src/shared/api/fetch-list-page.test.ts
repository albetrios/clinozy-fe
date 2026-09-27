import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/core/http/fetch-client.ts', () => ({ apiClient: { get: getMock } }));

import { fetchListPage } from './fetch-list-page.ts';

const row = z.object({ id: z.string() });

describe('fetchListPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('fetches one page and returns rows + forward cursor from meta.pagination', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ id: 'a' }, { id: 'b' }],
      meta: { pagination: { has_more: true, next: 'cur1', per_page: 25 } },
    });

    const page = await fetchListPage('/things', row, 'things');

    expect(page).toEqual({
      rows: [{ id: 'a' }, { id: 'b' }],
      next: 'cur1',
      hasMore: true,
    });
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock.mock.calls[0]?.[0]).toContain('limit=25');
    expect(getMock.mock.calls[0]?.[0]).not.toContain('after=');
  });

  it('forwards q / sort / order / after / limit on the querystring', async () => {
    getMock.mockResolvedValueOnce({
      data: [],
      meta: { pagination: { has_more: false, next: null } },
    });

    await fetchListPage('/things', row, 'things', {
      q: 'ada byron',
      sort: 'name',
      order: 'desc',
      after: 'cur2',
      limit: 50,
    });

    const url = getMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('limit=50');
    expect(url).toContain('q=ada+byron');
    expect(url).toContain('sort=name');
    expect(url).toContain('order=desc');
    expect(url).toContain('after=cur2');
  });

  it('treats an absent pagination block as the last page', async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: 'a' }] });

    const page = await fetchListPage('/things', row, 'things');

    expect(page).toEqual({ rows: [{ id: 'a' }], next: null, hasMore: false });
  });

  it('drops malformed rows without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getMock.mockResolvedValueOnce({ data: [{ id: 'a' }, { nope: true }] });

    const page = await fetchListPage('/things', row, 'things');

    expect(page.rows).toEqual([{ id: 'a' }]);
    warn.mockRestore();
  });
});
