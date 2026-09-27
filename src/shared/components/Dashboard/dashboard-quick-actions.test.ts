import { describe, expect, it } from 'vitest';

import type { MeContext } from '@/shared/tenancy/me-context.ts';

import { buildDashboardQuickActions } from './dashboard-quick-actions.ts';

const t = (key: string, opts?: { orgName?: string }) => {
  if (key.includes('inviteDescription') && opts?.orgName) {
    return `Invite to ${opts.orgName}`;
  }
  return key;
};

function ctx(overrides: Partial<MeContext> = {}): MeContext {
  return {
    user: {
      id: 'usr_x',
      email: 'a@b.test',
      isEmailVerified: true,
      isMfaEnabled: false,
      firstName: 'Ada',
      lastName: null,
      avatarUrl: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    activeOrganization: {
      id: 'org_x',
      name: 'Acme',
      slug: 'acme',
      type: 'TEAM',
      status: 'ACTIVE',
      logoUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    myPermissions: ['invitation:manage', 'role:manage'],
    globalRole: null,
    organizations: [],
    ...overrides,
  };
}

describe('buildDashboardQuickActions', () => {
  it('includes team management actions for team orgs', () => {
    const actions = buildDashboardQuickActions(ctx(), t);
    expect(actions.map((a) => a.testId)).toEqual(
      expect.arrayContaining([
        'dashboard-action-invite',
        'dashboard-action-roles',
        'dashboard-action-org-settings',
      ]),
    );
  });

  it('omits team actions for personal orgs', () => {
    const actions = buildDashboardQuickActions(
      ctx({
        activeOrganization: {
          id: 'org_p',
          name: 'Personal',
          slug: null,
          type: 'PERSONAL',
          status: 'ACTIVE',
          logoUrl: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        myPermissions: [],
      }),
      t,
    );
    expect(actions.map((a) => a.testId)).toEqual([
      'dashboard-action-billing',
      'dashboard-action-account',
    ]);
  });
});
