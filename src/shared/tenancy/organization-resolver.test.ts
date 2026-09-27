import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeContext, OrganizationType } from './me-context.ts';
import {
  resolveRootRedirect,
  resolveRootTarget,
  workspaceRedirectForPersonalDashboard,
  workspaceRedirectForTeamEntry,
} from './organization-resolver.ts';
import { ensureSessionContext } from './session-context.ts';

vi.mock('./session-context.ts', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, ensureSessionContext: vi.fn() };
});

function meCtx(
  activeOrganization: MeContext['activeOrganization'],
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
    activeOrganization,
    // A member landing on a team dashboard can read the org — the realistic
    // default. Tests for the "can't read the active team org" fallback override
    // this to [].
    myPermissions: ['organization:read'],
    globalRole: null,
    organizations: [],
    deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    personalOrganizationId: null,
  };
}

function activeOrg(type: OrganizationType, slug: string | null) {
  return {
    id: 'org_x',
    name: 'X',
    slug,
    type,
    status: 'ACTIVE' as const,
    logoUrl: null,
    createdAt: 't',
    updatedAt: 't',
  };
}

describe('resolveRootRedirect (`/` → active org from me/context)', () => {
  beforeEach(() => {
    vi.mocked(ensureSessionContext).mockReset();
  });

  it('redirects to onboarding when there is no active org and no memberships', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue(meCtx(null, false));
    await expect(resolveRootRedirect()).resolves.toEqual({ to: '/onboarding' });
  });

  it('redirects to organization picker when there is no active org but user has orgs (team-only)', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      ...meCtx(null),
      organizations: [{ ...activeOrg('TEAM', 'acme'), isActive: false }],
      deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
    });
    await expect(resolveRootRedirect()).resolves.toEqual({ to: '/organization' });
  });

  it('routes a personal active org to the root /dashboard', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue(meCtx(activeOrg('PERSONAL', null)));
    await expect(resolveRootRedirect()).resolves.toEqual({ to: '/dashboard' });
  });

  it('routes a team active org to its $organizationSlug dashboard', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue(meCtx(activeOrg('TEAM', 'acme')));
    await expect(resolveRootRedirect()).resolves.toEqual({
      to: '/organization/$organizationSlug/dashboard',
      params: { organizationSlug: 'acme' },
    });
  });

  it('routes a team active org WITHOUT a slug to organization picker when not onboarding', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      ...meCtx(activeOrg('TEAM', null)),
      organizations: [{ ...activeOrg('TEAM', null), isActive: true }],
      deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
    });
    await expect(resolveRootRedirect()).resolves.toEqual({ to: '/organization' });
  });
});

describe('resolveRootTarget (dual-URL `/` decision — slug variant)', () => {
  it('routes to onboarding when there is no active org and no memberships', () => {
    expect(resolveRootTarget(meCtx(null, false))).toEqual({ to: '/onboarding' });
  });

  it('routes to organization picker when there is no active org but memberships exist (team-only)', () => {
    expect(
      resolveRootTarget({
        ...meCtx(null),
        organizations: [{ ...activeOrg('TEAM', 'acme'), isActive: false }],
        deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
      }),
    ).toEqual({ to: '/organization' });
  });

  it('routes a personal org to the root /dashboard', () => {
    expect(resolveRootTarget(meCtx(activeOrg('PERSONAL', null)))).toEqual({
      to: '/dashboard',
    });
  });

  it('routes a team org to its slug space', () => {
    expect(resolveRootTarget(meCtx(activeOrg('TEAM', 'acme')))).toEqual({
      to: '/organization/$organizationSlug/dashboard',
      params: { organizationSlug: 'acme' },
    });
  });

  it('lands on the picker (not a dead-end) when the active team org is unreadable', () => {
    // Regression: a member whose role lacks organization:read used to resolve to
    // the team dashboard, get bounced to /unauthorized, and loop on "Go Home".
    expect(
      resolveRootTarget({ ...meCtx(activeOrg('TEAM', 'acme')), myPermissions: [] }),
    ).toEqual({ to: '/organization' });
  });

  it('routes a slugless team to organization picker when not onboarding', () => {
    expect(
      resolveRootTarget({
        ...meCtx(activeOrg('TEAM', null)),
        organizations: [{ ...activeOrg('TEAM', null), isActive: true }],
        deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
      }),
    ).toEqual({ to: '/organization' });
  });
});

describe('workspace surface guards (URL vs me/context)', () => {
  it('blocks personal /dashboard when onboarding is required', () => {
    expect(workspaceRedirectForPersonalDashboard(meCtx(null, false))).toEqual({
      to: '/onboarding',
    });
  });

  it('allows personal /dashboard when the active org is personal', () => {
    expect(
      workspaceRedirectForPersonalDashboard(meCtx(activeOrg('PERSONAL', null))),
    ).toBeNull();
  });

  it('redirects personal /dashboard to team slug when that is the active org', () => {
    expect(
      workspaceRedirectForPersonalDashboard(meCtx(activeOrg('TEAM', 'acme'))),
    ).toEqual({
      to: '/organization/$organizationSlug/dashboard',
      params: { organizationSlug: 'acme' },
    });
  });

  it('allows slug-targeted team entry when there is no active org but memberships exist', () => {
    // The slug chain (requireOrganizationContext) validates membership and
    // performs the switch — bouncing to the picker here would break deep links.
    expect(
      workspaceRedirectForTeamEntry({
        ...meCtx(null),
        organizations: [{ ...activeOrg('TEAM', 'acme'), isActive: false }],
        deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
      }),
    ).toBeNull();
  });

  it('allows organization picker when resolver target is organization picker', () => {
    expect(
      workspaceRedirectForTeamEntry(
        {
          ...meCtx(null),
          organizations: [{ ...activeOrg('TEAM', 'acme'), isActive: false }],
          deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
        },
        { organizationPicker: true },
      ),
    ).toBeNull();
  });

  it('sends team entry to onboarding when there are no orgs yet', () => {
    expect(workspaceRedirectForTeamEntry(meCtx(null, false))).toEqual({
      to: '/onboarding',
    });
  });

  it('allows slug-targeted team entry when the active org is personal (switch-on-navigation)', () => {
    // Regression: this used to redirect to /dashboard, which made every team
    // entry point (org switcher, command palette, direct URL) a dead end once
    // the personal org was active — the user could never switch back to a team.
    expect(workspaceRedirectForTeamEntry(meCtx(activeOrg('PERSONAL', null)))).toBeNull();
  });

  it('still routes personal-active sessions off the bare /organization picker', () => {
    expect(
      workspaceRedirectForTeamEntry(meCtx(activeOrg('PERSONAL', null)), {
        organizationPicker: true,
      }),
    ).toEqual({ to: '/dashboard' });
  });

  it('still sends slug-targeted team entry to onboarding when the user has not onboarded', () => {
    expect(workspaceRedirectForTeamEntry(meCtx(null, false))).toEqual({
      to: '/onboarding',
    });
  });

  it('allows team entry when a team org is active', () => {
    expect(workspaceRedirectForTeamEntry(meCtx(activeOrg('TEAM', 'acme')))).toBeNull();
  });
});
