import { describe, expect, it } from 'vitest';

import { validateLeadsSearch } from '../../leads.search.ts';
import { leadListParamsOf } from './lead-list-params.ts';

const STAFF = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';

describe('leadListParamsOf — the URL as the list read', () => {
  it('applies the defaults: the viewer’s own leads, newest first', () => {
    expect(leadListParamsOf(validateLeadsSearch({}), STAFF)).toEqual({
      view: 'mine',
      viewerId: STAFF,
      q: undefined,
      status: undefined,
      source: undefined,
      hold: undefined,
      owner: undefined,
      created: undefined,
      followUp: undefined,
      sort: undefined,
      order: undefined,
    });
  });

  it('hands the contract its shapes: one status as a list, the sort split from its direction', () => {
    expect(
      leadListParamsOf(
        validateLeadsSearch({
          view: 'all',
          status: 'new',
          sort: 'status:desc',
          q: 'rhea',
        }),
        null,
      ),
    ).toMatchObject({
      view: 'all',
      viewerId: null,
      status: ['new'],
      sort: 'status',
      order: 'desc',
      q: 'rhea',
    });
  });
});
