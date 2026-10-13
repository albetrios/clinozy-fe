import { describe, expect, it } from 'vitest';

import { defaultBranchId } from './app-branch.ts';

describe('defaultBranchId', () => {
  const branches = [
    { id: 'adajan', isMain: true },
    { id: 'vesu', isMain: false },
  ];

  it('starts at the header’s one branch, else the main one', () => {
    expect(defaultBranchId(branches, [])).toBe('adajan');
    expect(defaultBranchId(branches, ['vesu'])).toBe('vesu');
    expect(defaultBranchId(branches, ['vesu', 'adajan'])).toBe('adajan');
  });

  it('ignores a header branch that is no longer open', () => {
    expect(defaultBranchId(branches, ['gone'])).toBe('adajan');
    expect(defaultBranchId(branches, ['gone', 'vesu'])).toBe('vesu');
  });

  it('falls back to the first branch without a main one, and to none before they load', () => {
    expect(defaultBranchId([{ id: 'vesu', isMain: false }], [])).toBe('vesu');
    expect(defaultBranchId([], [])).toBeNull();
  });
});
