import { describe, expect, it } from 'vitest';

import { resolveAuthMethods } from './auth-methods.ts';

describe('resolveAuthMethods', () => {
  it('returns per-provider oauth flags', () => {
    const methods = resolveAuthMethods();
    expect(methods).toMatchObject({
      email: expect.any(Boolean),
      oauth: {
        google: expect.any(Boolean),
        github: expect.any(Boolean),
        apple: expect.any(Boolean),
      },
      passkey: expect.any(Boolean),
      oauthAutoGoogle: expect.any(Boolean),
    });
  });
});
