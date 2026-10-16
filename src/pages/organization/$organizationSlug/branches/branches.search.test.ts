import { describe, expect, it } from 'vitest';

import { validateBranchesSearch } from './branches.search.ts';

describe('validateBranchesSearch', () => {
  it('keeps a Created filter and drops anything else', () => {
    expect(validateBranchesSearch({ created: 'last_30' })).toEqual({
      created: 'last_30',
      step: undefined,
    });
    expect(validateBranchesSearch({ created: 'someday', q: 'vesu' })).toEqual({
      created: undefined,
      step: undefined,
    });
  });

  it('passes ?step= through as the link wrote it — the drawer reads it, off the first paint', () => {
    expect(validateBranchesSearch({ step: 'contact' }).step).toBe('contact');
    expect(validateBranchesSearch({ step: 'billing' }).step).toBe('billing');
  });
});
