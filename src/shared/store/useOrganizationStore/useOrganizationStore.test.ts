import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_DEPLOYMENT_FLAGS } from '@/shared/tenancy/deployment-mode.ts';
import type { OrganizationSummary } from '@/shared/tenancy/me-context.ts';

import { useOrganizationStore } from './useOrganizationStore.ts';

const TEAM: OrganizationSummary = {
  id: 'org_abcdefghij0123456789x',
  name: 'Acme',
  slug: 'acme',
  type: 'TEAM',
  status: 'ACTIVE',
  logoUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useOrganizationStore', () => {
  afterEach(() => {
    useOrganizationStore.getState().clearOrganization();
  });

  it('clearOrganization wipes every field (no org/permission bleed to the next sign-in)', () => {
    const store = useOrganizationStore.getState();
    // Populate the full active-org context the way a signed-in session would.
    store.setActiveOrganization(TEAM, ['organization:read', 'membership:manage']);
    store.setDeploymentContext(
      { personalOrganizations: false, teamOrganizations: true },
      'org_personal000000000x',
    );

    const populated = useOrganizationStore.getState();
    expect(populated.organizationId).toBe(TEAM.id);
    expect(populated.permissions).toHaveLength(2);

    useOrganizationStore.getState().clearOrganization();

    // Teardown must leave NOTHING behind — the RBAC `permissions` in particular
    // (read by `useCan`) must reset so one user's grants never survive into the
    // next sign-in on the same tab (see auth `clearLocalAuthState`).
    expect(useOrganizationStore.getState()).toMatchObject({
      organizationId: null,
      organizationSlug: null,
      organizationStatus: null,
      organizationType: null,
      permissions: [],
      deploymentFlags: DEFAULT_DEPLOYMENT_FLAGS,
      personalOrganizationId: null,
    });
  });
});
