import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ORG_LIST_SORT,
  ORG_LIST_SORT_PRESETS,
  orgListSortToParams,
} from './org-list-sort.ts';

describe('orgListSortToParams', () => {
  it('maps every preset to a server sort/order pair', () => {
    for (const preset of Object.keys(ORG_LIST_SORT_PRESETS)) {
      expect(
        orgListSortToParams(preset as keyof typeof ORG_LIST_SORT_PRESETS),
      ).toMatchObject({
        sort: expect.any(String),
        order: expect.stringMatching(/^(asc|desc)$/),
      });
    }
  });

  it('defaults to name ascending', () => {
    expect(orgListSortToParams(DEFAULT_ORG_LIST_SORT)).toEqual({
      sort: 'name',
      order: 'asc',
    });
  });
});
