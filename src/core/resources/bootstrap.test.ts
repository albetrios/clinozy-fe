import { beforeEach, describe, expect, it } from 'vitest';

import { __resetBootstrapForTests, bootstrapResources } from './bootstrap.ts';
import { __clearRegistry, getResource, listResources } from './resource-registry.ts';

describe('bootstrapResources', () => {
  beforeEach(() => {
    __clearRegistry();
    __resetBootstrapForTests();
  });

  it('registers the reference members resource once', () => {
    bootstrapResources();
    bootstrapResources();
    expect(listResources().map((r) => r.name)).toEqual(['members']);
    expect(getResource('members')?.permissions.list).toBe('membership:read');
  });
});
