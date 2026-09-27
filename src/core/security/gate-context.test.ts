import { describe, expect, it } from 'vitest';

import { toGateContext } from './gate-context.ts';

describe('toGateContext', () => {
  it('maps router location and filters undefined params', () => {
    const ctx = toGateContext(
      {
        pathname: '/organization/acme/dashboard',
        search: '',
        hash: '',
        href: '/organization/acme/dashboard',
      },
      { organizationSlug: 'acme', optional: undefined },
    );

    expect(ctx.location.pathname).toBe('/organization/acme/dashboard');
    expect(ctx.params).toEqual({ organizationSlug: 'acme' });
    expect(ctx.params).not.toHaveProperty('optional');
  });

  it('normalizes object search to empty string', () => {
    const ctx = toGateContext(
      {
        pathname: '/x',
        search: { foo: 'bar' },
        hash: '#settings',
        href: '/x#settings',
      },
      {},
    );

    expect(ctx.location.search).toBe('');
    expect(ctx.location.hash).toBe('#settings');
  });
});
