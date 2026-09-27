import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/core/http/fetch-client.ts', () => ({ apiClient: { get: getMock } }));

import { fetchAllPages } from './fetch-all-pages.ts';

const row = z.object({ id: z.string() });

describe('fetchAllPages', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('follows the cursor across pages and accumulates every row', async () => {
    getMock
      .mockResolvedValueOnce({
        data: [{ id: 'a' }, { id: 'b' }],
        meta: { pagination: { has_more: true, next: 'cur1' } },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'c' }],
        meta: { pagination: { has_more: false, next: null } },
      });

    const rows = await fetchAllPages('/things', row, 'things');

    expect(rows).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls[0]?.[0]).toContain('limit=100');
    expect(getMock.mock.calls[0]?.[0]).not.toContain('after=');
    expect(getMock.mock.calls[1]?.[0]).toContain('after=cur1');
  });

  it('stops after one page when has_more is false or meta is absent', async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: 'a' }] });
    const rows = await fetchAllPages('/things', row, 'things');
    expect(rows).toEqual([{ id: 'a' }]);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('respects the page cap so a looping cursor cannot fetch unbounded pages', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getMock.mockResolvedValue({
      data: [{ id: 'x' }],
      meta: { pagination: { has_more: true, next: 'loop' } },
    });

    const rows = await fetchAllPages('/things', row, 'things');

    expect(getMock.mock.calls.length).toBeLessThanOrEqual(50);
    expect(rows.length).toBeLessThanOrEqual(50);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
