import { describe, expect, it } from 'vitest';

import { validateBranchesSearch } from './branches.search.ts';

describe('validateBranchesSearch', () => {
  it('keeps a Created filter and drops anything else', () => {
    expect(validateBranchesSearch({ created: 'last_30' })).toEqual({
      created: 'last_30',
    });
    expect(validateBranchesSearch({ created: 'someday', q: 'vesu' })).toEqual({
      created: undefined,
    });
  });
});
