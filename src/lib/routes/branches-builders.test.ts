import { describe, expect, it } from 'vitest';

import {
  organizationBranchCreate,
  organizationBranchEdit,
  organizationBranches,
} from './branches-builders.ts';

describe('the Branches room builders', () => {
  const slug = { organizationSlug: 'acme' };

  it('build Branches and the branch drawers (S:108–110)', () => {
    expect(organizationBranches('acme')).toEqual({
      to: '/organization/$organizationSlug/branches',
      params: slug,
    });
    expect(organizationBranchCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/branches/create',
      params: slug,
    });
    expect(organizationBranchEdit('acme', 'B1')).toEqual({
      to: '/organization/$organizationSlug/branches/$branchId/edit',
      params: { ...slug, branchId: 'B1' },
    });
  });
});
