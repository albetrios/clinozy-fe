import { describe, expect, it } from 'vitest';

import { pageOf, toPaginated } from './pagination.ts';

describe('toPaginated', () => {
  it('maps meta.pagination into a UI page descriptor', () => {
    const res = {
      data: [{ id: 1 }, { id: 2 }],
      meta: {
        request_id: 'req_1',
        pagination: { per_page: 2, next: 'cur_2', has_more: true, estimated_total: 10 },
      },
    };

    expect(toPaginated(res)).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      pageInfo: { perPage: 2, next: 'cur_2', hasMore: true, estimatedTotal: 10 },
    });
  });

  it('falls back to a single page when meta.pagination is absent', () => {
    const res = { data: [{ id: 1 }], meta: { request_id: 'req_1' } };

    expect(toPaginated(res)).toEqual({
      items: [{ id: 1 }],
      pageInfo: { perPage: 1, next: null, hasMore: false, estimatedTotal: undefined },
    });
  });

  it('omits estimatedTotal when the backend does not provide it', () => {
    const res = {
      data: [{ id: 1 }],
      meta: { pagination: { per_page: 25, next: null, has_more: false } },
    };

    expect(toPaginated(res).pageInfo.estimatedTotal).toBeUndefined();
  });

  it('tolerates a non-array data payload (defensive)', () => {
    const res = { data: undefined as unknown as unknown[], meta: undefined };

    expect(toPaginated(res)).toEqual({
      items: [],
      pageInfo: { perPage: 0, next: null, hasMore: false, estimatedTotal: undefined },
    });
  });
});

describe('pageOf', () => {
  it('reads the cursor and the estimated total of a page with more to come', () => {
    const pagination = {
      per_page: 2,
      next: 'cur_2',
      has_more: true,
      estimated_total: 10,
    };
    expect(pageOf(pagination)).toEqual({ next: 'cur_2', total: 10 });
  });

  it('drops a stray cursor on the last page', () => {
    expect(pageOf({ next: 'cur_2', has_more: false })).toEqual({
      next: null,
      total: null,
    });
  });

  it('reads null for a missing cursor, total or pagination block', () => {
    expect(pageOf({ has_more: true })).toEqual({ next: null, total: null });
    expect(pageOf(undefined)).toEqual({ next: null, total: null });
    expect(pageOf({ has_more: false, estimated_total: 0 })).toEqual({
      next: null,
      total: 0,
    });
  });
});
