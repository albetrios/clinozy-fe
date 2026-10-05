import { describe, expect, it } from 'vitest';

import {
  LEAD_SOURCE_VALUES,
  LEAD_STATUS_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  LEAD_HOLD_FILTER_VALUES,
  LEAD_RECORD_SOURCE_VALUES,
  LEAD_SORT_KEYS,
  LEAD_VIEW_VALUES,
} from '@/shared/api/clinic/leads-contracts.ts';

import { LEADS_SEARCH_DEFAULTS, validateLeadsSearch } from './leads.search.ts';

const STAFF = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';
const OTHER_STAFF = '0a1b2c3d-4e5f-4a6b-9c8d-7e6f5a4b3c2d';

describe('validateLeadsSearch — the list URL (S:22)', () => {
  it('answers every key, undefined when the URL says nothing — the defaults stay out of the URL', () => {
    expect(validateLeadsSearch({})).toEqual({
      view: undefined,
      q: undefined,
      status: undefined,
      source: undefined,
      hold: undefined,
      owner: undefined,
      created: undefined,
      followUp: undefined,
      sort: undefined,
    });
    expect(LEADS_SEARCH_DEFAULTS).toEqual({ view: 'mine' });
  });

  it('keeps every valid value', () => {
    expect(
      validateLeadsSearch({
        view: 'unread',
        q: ' Rhea ',
        status: 'follow_up',
        source: ['instagram', 'phone_call'],
        hold: 'soon',
        owner: [STAFF, OTHER_STAFF],
        created: 'last_7',
        followUp: '2026-10-01..2026-10-07',
        sort: 'updated:desc',
      }),
    ).toEqual({
      view: 'unread',
      q: 'Rhea',
      status: 'follow_up',
      source: ['instagram', 'phone_call'],
      hold: 'soon',
      owner: [STAFF, OTHER_STAFF],
      created: 'last_7',
      followUp: '2026-10-01..2026-10-07',
      sort: 'updated:desc',
    });
  });

  it('drops invalid values instead of failing', () => {
    expect(
      validateLeadsSearch({
        view: 'everyone',
        q: '   ',
        status: 'won',
        source: ['tiktok'],
        hold: 'any',
        owner: ['not-an-id'],
        created: 'last_90',
        followUp: '2026-10-07..2026-10-01',
        sort: 'phone:asc',
      }),
    ).toEqual(validateLeadsSearch({}));
    expect(validateLeadsSearch({ sort: 'name:up' }).sort).toBeUndefined();
    expect(validateLeadsSearch({ status: ['new', 'lost'] }).status).toBeUndefined();
  });

  it('reads a list as a JSON array or a comma list, keeping the valid entries once', () => {
    expect(
      validateLeadsSearch({ source: 'instagram, google,tiktok,google' }).source,
    ).toEqual(['instagram', 'google']);
    expect(validateLeadsSearch({ owner: `${STAFF},bogus` }).owner).toEqual([STAFF]);
  });

  it('reads a numeric search as text and keeps it to the contract’s 80 characters', () => {
    // The router parses `?q=2363` into a number.
    expect(validateLeadsSearch({ q: 2363 }).q).toBe('2363');
    expect(validateLeadsSearch({ q: '#2363' }).q).toBe('#2363');
    expect(validateLeadsSearch({ q: 'x'.repeat(90) }).q).toHaveLength(80);
  });

  it('accepts exactly the contract’s values (pinned: the lists are declared locally for the entry chunk)', () => {
    for (const view of LEAD_VIEW_VALUES)
      expect(validateLeadsSearch({ view }).view).toBe(view);
    for (const status of LEAD_STATUS_VALUES) {
      expect(validateLeadsSearch({ status }).status).toBe(status);
    }
    expect(
      validateLeadsSearch({ source: [...LEAD_RECORD_SOURCE_VALUES] }).source,
    ).toEqual([...LEAD_RECORD_SOURCE_VALUES]);
    expect(LEAD_RECORD_SOURCE_VALUES).toEqual([...LEAD_SOURCE_VALUES, 'phone_call']);
    for (const hold of LEAD_HOLD_FILTER_VALUES)
      expect(validateLeadsSearch({ hold }).hold).toBe(hold);
    for (const key of LEAD_SORT_KEYS) {
      expect(validateLeadsSearch({ sort: `${key}:asc` }).sort).toBe(`${key}:asc`);
    }
  });
});
