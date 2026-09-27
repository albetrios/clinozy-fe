import { describe, expect, it } from 'vitest';

import { sortOAuthProviders } from './auth-form.constants.ts';

describe('sortOAuthProviders', () => {
  it('orders google before github and appends unknown providers', () => {
    expect(sortOAuthProviders(['github', 'google', 'gitlab'])).toEqual([
      'google',
      'github',
      'gitlab',
    ]);
  });
});
