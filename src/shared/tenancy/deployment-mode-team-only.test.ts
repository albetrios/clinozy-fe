import { describe, expect, it } from 'vitest';

import {
  isPersonalOnlyDeployment,
  resolveDeploymentMode,
  shouldAllowCreateTeam,
  shouldShowOrganizationSwitcher,
} from './deployment-mode.ts';
import type { MeContext } from './me-context.ts';
import { resolveRootTarget } from './organization-resolver.ts';

const TEAM_ONLY = { personalOrganizations: false, teamOrganizations: true };

function meCtx(overrides: Partial<MeContext>, onboardingCompleted = true): MeContext {
  return {
    user: {
      id: 'usr_1',
      email: 'a@b.test',
      isEmailVerified: true,
      isMfaEnabled: false,
      firstName: 'A',
      lastName: null,
      avatarUrl: null,
      status: 'ACTIVE',
      onboardingCompleted,
      createdAt: 't',
      updatedAt: 't',
    },
    activeOrganization: null,
    myPermissions: [],
    globalRole: null,
    organizations: [],
    deploymentFlags: TEAM_ONLY,
    personalOrganizationId: null,
    ...overrides,
  };
}

describe('deployment-mode — team-only', () => {
  it('resolves team-only mode', () => {
    expect(resolveDeploymentMode(TEAM_ONLY)).toBe('team-only');
    expect(isPersonalOnlyDeployment(TEAM_ONLY)).toBe(false);
  });

  it('shows org switcher and allows create-team', () => {
    expect(shouldShowOrganizationSwitcher(TEAM_ONLY)).toBe(true);
    expect(shouldAllowCreateTeam(TEAM_ONLY)).toBe(true);
  });

  it('routes root to onboarding when user has no orgs yet', () => {
    expect(resolveRootTarget(meCtx({}, false))).toEqual({ to: '/onboarding' });
  });

  it('routes root to organization picker when memberships exist but none active', () => {
    expect(
      resolveRootTarget(
        meCtx({
          organizations: [
            {
              id: 'org_t',
              name: 'Acme',
              slug: 'acme',
              type: 'TEAM',
              status: 'ACTIVE',
              logoUrl: null,
              createdAt: 't',
              updatedAt: 't',
              isActive: false,
            },
          ],
        }),
      ),
    ).toEqual({ to: '/organization' });
  });
});
