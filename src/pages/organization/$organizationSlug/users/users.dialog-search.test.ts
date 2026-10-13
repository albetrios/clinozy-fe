import { describe, expect, it } from 'vitest';

import { validateUserEditSearch } from './users.dialog-search.ts';

describe('validateUserEditSearch', () => {
  it('reads where the drawer was opened from, never a stray origin', () => {
    expect(validateUserEditSearch({ from: 'roles' })).toEqual({ from: 'roles' });
    expect(validateUserEditSearch({ from: 'invoices' })).toEqual({ from: undefined });
    expect(validateUserEditSearch({})).toEqual({ from: undefined });
  });
});
