import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  __clearRegistry,
  getResource,
  listResources,
  registerResource,
} from './resource-registry.ts';
import type { Resource } from './types.ts';

const orgSchema = z.object({ id: z.string(), name: z.string() });

const orgResource: Resource<typeof orgSchema> = {
  name: 'organizations',
  schema: orgSchema,
  permissions: {
    list: null,
    show: 'organization:read',
    create: null,
    update: 'organization:update',
    delete: 'organization:delete',
  },
  ui: { label: 'Organizations', icon: 'Building', showInNav: true },
};

describe('resource-registry', () => {
  afterEach(() => __clearRegistry());

  it('registers and retrieves a resource', () => {
    registerResource(orgResource);
    expect(getResource('organizations')?.name).toBe('organizations');
  });

  it('returns undefined for an unknown resource', () => {
    expect(getResource('unknown')).toBeUndefined();
  });

  it('listResources returns all registered', () => {
    registerResource(orgResource);
    registerResource({ ...orgResource, name: 'members' });
    expect(
      listResources()
        .map((r) => r.name)
        .sort(),
    ).toEqual(['members', 'organizations']);
  });

  it('re-registering overwrites the previous manifest', () => {
    registerResource(orgResource);
    registerResource({ ...orgResource, ui: { label: 'Orgs' } });
    expect(getResource('organizations')?.ui?.label).toBe('Orgs');
  });
});
