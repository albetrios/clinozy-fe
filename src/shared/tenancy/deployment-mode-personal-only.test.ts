import { describe, expect, it } from 'vitest';

import {
  isPersonalOnlyDeployment,
  resolveDeploymentMode,
  shouldAllowCreateTeam,
  shouldShowOrganizationSwitcher,
} from './deployment-mode.ts';
import type { MeContext } from './me-context.ts';
import { resolveRootTarget } from './organization-resolver.ts';

const PERSONAL_ONLY = { personalOrganizations: true, teamOrganizations: false };

function meCtx(
  overrides: Partial<MeContext> & Pick<MeContext, 'activeOrganization'>,
  onboardingCompleted = true,
): MeContext {
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
    myPermissions: [],
    globalRole: null,
    organizations: [],
    deploymentFlags: PERSONAL_ONLY,
    personalOrganizationId: 'org_personal',
    ...overrides,
  };
}

describe('deployment-mode — personal-only', () => {
  it('resolves personal-only mode', () => {
    expect(resolveDeploymentMode(PERSONAL_ONLY)).toBe('personal-only');
    expect(isPersonalOnlyDeployment(PERSONAL_ONLY)).toBe(true);
  });

  it('hides org switcher and blocks create-team', () => {
    expect(shouldShowOrganizationSwitcher(PERSONAL_ONLY)).toBe(false);
    expect(shouldAllowCreateTeam(PERSONAL_ONLY)).toBe(false);
  });

  it('routes root to /dashboard when a personal org is active', () => {
    expect(
      resolveRootTarget(
        meCtx({
          activeOrganization: {
            id: 'org_p',
            name: 'Personal',
            slug: null,
            type: 'PERSONAL',
            status: 'ACTIVE',
            logoUrl: null,
            createdAt: 't',
            updatedAt: 't',
          },
        }),
      ),
    ).toEqual({ to: '/dashboard' });
  });

  it('routes a fresh (not-onboarded) user to /onboarding despite the auto-provisioned personal org', () => {
    expect(
      resolveRootTarget(
        meCtx(
          {
            activeOrganization: {
              id: 'org_p',
              name: 'Personal',
              slug: null,
              type: 'PERSONAL',
              status: 'ACTIVE',
              logoUrl: null,
              createdAt: 't',
              updatedAt: 't',
            },
          },
          false,
        ),
      ),
    ).toEqual({ to: '/onboarding' });
  });
});
