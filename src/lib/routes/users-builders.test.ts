import { describe, expect, it } from 'vitest';

import {
  organizationUserCreate,
  organizationUserEdit,
  organizationUsers,
  organizationUsersRoles,
} from './users-builders.ts';

describe('the Users room builders', () => {
  const slug = { organizationSlug: 'acme' };

  it('build the Team and its user drawers (S:104–106)', () => {
    expect(organizationUsers('acme')).toEqual({
      to: '/organization/$organizationSlug/users',
      params: slug,
    });
    expect(organizationUserCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/users/create',
      params: slug,
    });
    expect(organizationUserEdit('acme', 'M1')).toEqual({
      to: '/organization/$organizationSlug/users/$userId/edit',
      params: { ...slug, userId: 'M1' },
    });
  });

  it('build Roles & access (S:107)', () => {
    expect(organizationUsersRoles('acme')).toEqual({
      to: '/organization/$organizationSlug/users/roles',
      params: slug,
    });
  });
});
