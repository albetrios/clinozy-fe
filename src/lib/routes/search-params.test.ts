import { describe, expect, it } from 'vitest';

import { listOf, oneOf, queryOf, sortOf, textOf } from './search-params.ts';

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
