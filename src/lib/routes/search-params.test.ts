import { describe, expect, it } from 'vitest';

import {
  listOf,
  matchOf,
  oneOf,
  queryOf,
  RECORD_ID,
  sortOf,
  textOf,
} from './search-params.ts';

describe('search-param readers', () => {
  it('reads text from strings and numbers, trimmed; nothing else', () => {
    expect(textOf('  riya ')).toBe('riya');
    expect(textOf(2363)).toBe('2363');
    expect(textOf(null)).toBe('');
    expect(textOf(['a'])).toBe('');
  });

  it('keeps a value only when it is one of the allowed', () => {
    expect(oneOf(['mine', 'all'] as const, 'all')).toBe('all');
    expect(oneOf(['mine', 'all'] as const, 'everything')).toBeUndefined();
  });

  it('reads a list from an array or a comma list, filtered and de-duplicated', () => {
    const isSource = (entry: string) => ['google', 'instagram'].includes(entry);
    expect(listOf(['google', 'x', 'google'], isSource)).toEqual(['google']);
    expect(listOf('instagram, google', isSource)).toEqual(['instagram', 'google']);
    expect(listOf('x,y', isSource)).toBeUndefined();
  });

  it('keeps a single value only in its shape', () => {
    const DAY = /^\d{4}-\d{2}-\d{2}$/;
    expect(matchOf(DAY, ' 2026-10-05 ')).toBe('2026-10-05');
    expect(matchOf(DAY, '5 Oct')).toBeUndefined();
    expect(matchOf(DAY, '')).toBeUndefined();
    expect(matchOf(/^\d+$/, 2861)).toBe('2861');
  });

  it('knows a record id by its UUID shape, in either case', () => {
    expect(matchOf(RECORD_ID, '9F1C2B3A-4D5E-4F60-8A7B-1C2D3E4F5A6B')).toBeDefined();
    expect(matchOf(RECORD_ID, '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6')).toBeUndefined();
    expect(matchOf(RECORD_ID, '2861')).toBeUndefined();
  });

  it('cuts a query to its length and drops an empty one', () => {
    expect(queryOf('  hello  ', 3)).toBe('hel');
    expect(queryOf('   ', 80)).toBeUndefined();
  });

  it('accepts a sort only with a known key and a direction', () => {
    expect(sortOf(['name', 'updated'] as const, 'updated:desc')).toBe('updated:desc');
    expect(sortOf(['name'] as const, 'status:asc')).toBeUndefined();
    expect(sortOf(['name'] as const, 'name:up')).toBeUndefined();
  });
});
