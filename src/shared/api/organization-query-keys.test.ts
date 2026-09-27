import { describe, expect, it } from 'vitest';

import { orgQueryKeys } from './organization-query-keys.ts';

describe('orgQueryKeys', () => {
  it('namespaces every resource key under the organization root', () => {
    const resourceKeys = [
      orgQueryKeys.members('org_1'),
      orgQueryKeys.roles('org_1'),
      orgQueryKeys.apiKeys('org_1'),
    ];
    for (const key of resourceKeys) {
      expect(key[0]).toBe(orgQueryKeys.all[0]);
    }
  });

  it('keeps resource keys distinct (no cache collisions)', () => {
    const serialized = [
      orgQueryKeys.members('org_1'),
      orgQueryKeys.roles('org_1'),
      orgQueryKeys.apiKeys('org_1'),
    ].map((k) => JSON.stringify(k));
    expect(new Set(serialized).size).toBe(serialized.length);
  });

  it('scopes keys by organization id so two tenants never collide', () => {
    // The core of #4: the same resource in two orgs must produce different keys.
    expect(orgQueryKeys.members('org_1')).not.toEqual(orgQueryKeys.members('org_2'));
    expect(orgQueryKeys.members('org_1')).toEqual(['organization', 'org_1', 'members']);
    // The bare `all` prefix still matches every org for broad invalidation.
    expect(orgQueryKeys.members('org_1').slice(0, 1)).toEqual([...orgQueryKeys.all]);
  });

  it('treats personal mode (null org) as a distinct, valid scope', () => {
    expect(orgQueryKeys.members(null)).toEqual(['organization', null, 'members']);
    expect(orgQueryKeys.members(null)).not.toEqual(orgQueryKeys.members('org_1'));
  });
});
