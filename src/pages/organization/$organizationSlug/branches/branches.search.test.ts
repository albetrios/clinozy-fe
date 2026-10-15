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

  it("keeps a drawer step a link opens on, and drops one the drawer doesn't have", () => {
    expect(validateBranchesSearch({ step: 'contact' }).step).toBe('contact');
    expect(validateBranchesSearch({ step: 'billing' }).step).toBeUndefined();
  });
});
