import { describe, expect, it } from 'vitest';

import { validateLeadsSearch } from '../../leads.search.ts';
import { leadListParamsOf } from './lead-list-params.ts';

const ME = 'mem_me0000000000000000000';

describe('leadListParamsOf — the URL as the list read', () => {
  it('applies the defaults: the viewer’s own leads, newest first', () => {
    expect(leadListParamsOf(validateLeadsSearch({}), ME)).toEqual({
      view: 'mine',
      viewerId: ME,
      q: undefined,
      status: undefined,
      source: undefined,
      hold: undefined,
      member: undefined,
      created: undefined,
      followUp: undefined,
      sort: undefined,
      order: undefined,
    });
  });

  it('splits the sort from its direction and keeps the one status and member', () => {
    expect(
      leadListParamsOf(
        validateLeadsSearch({
          view: 'all',
          status: 'new',
          member: ME,
          sort: 'activity:desc',
          q: 'rhea',
        }),
        null,
      ),
    ).toMatchObject({
      view: 'all',
      viewerId: null,
      status: 'new',
      member: ME,
      sort: 'activity',
      order: 'desc',
      q: 'rhea',
    });
  });
});
