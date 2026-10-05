import { describe, expect, it } from 'vitest';

import {
  organizationUserCreate,
  organizationUserEdit,
  organizationUsers,
  organizationUsersBranchCreate,
  organizationUsersBranchEdit,
  organizationUsersBranches,
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

  it('build Roles & access, Branches and the branch drawers (S:107–110)', () => {
    expect(organizationUsersRoles('acme')).toEqual({
      to: '/organization/$organizationSlug/users/roles',
      params: slug,
    });
    expect(organizationUsersBranches('acme')).toEqual({
      to: '/organization/$organizationSlug/users/branches',
      params: slug,
    });
    expect(organizationUsersBranchCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/users/branches/create',
      params: slug,
    });
    expect(organizationUsersBranchEdit('acme', 'B1')).toEqual({
      to: '/organization/$organizationSlug/users/branches/$branchId/edit',
      params: { ...slug, branchId: 'B1' },
    });
  });
});
