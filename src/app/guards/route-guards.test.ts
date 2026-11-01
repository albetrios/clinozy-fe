import { isNotFound, isRedirect } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from '@/core/http/queryClient.ts';
import {
  clearAccessToken,
  getAccessToken,
  organizationClaimOf,
  setAccessToken,
} from '@/shared/auth/token.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { type MeContext, meContextQueryKey } from '@/shared/tenancy/me-context.ts';
import type * as MyOrganizationSummariesModule from '@/shared/tenancy/my-organization-summaries.ts';
import { myOrganizationsQueryKey } from '@/shared/tenancy/my-organization-summaries.ts';
import { deriveOrgContext } from '@/shared/tenancy/organization-context.ts';
import { resetPermissionCacheForTests } from '@/shared/tenancy/organization-membership.ts';

import {
  requireActiveOrganization,
  requireOnboardingWorkspace,
  requireOrganizationContext,
  requireProvisionedTeamWorkspace,
  requireSuspendedOrganization,
  requireTeamOrganizationsDeployment,
} from './route-guards.ts';

vi.mock('@/shared/tenancy/session-context.ts', () => ({
  ensureSessionContext: vi.fn(),
}));

vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    disabledModules: new Set<string>(),
    deploymentOverrides: { personalOrganizations: null, teamOrganizations: null },
  },
}));

import { platformConfig } from '@/core/config/env.ts';
import { ensureSessionContext } from '@/shared/tenancy/session-context.ts';

/*
 * The guard chain resolves the caller's organizations from
 * `GET /users/me/organizations` now — not from a list embedded in me/context,
 * which was capped at the default page size and silently truncated anyone in
 * more than 25 organizations. Both legs are stubbed: `ensure*` calls `fetch*`
 * inside its own module, so mocking only the export would never intercept it.
 */
// `vi.hoisted`, because a `vi.mock` factory is hoisted above any top-level const.
const { ORG_ROWS } = vi.hoisted(() => ({
  ORG_ROWS: [
    {
      id: 'org_acme',
      name: 'Acme Inc.',
      slug: 'acme',
      type: 'TEAM' as const,
      status: 'ACTIVE' as const,
      logoUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
    },
  ],
}));
vi.mock('@/shared/tenancy/my-organization-summaries.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof MyOrganizationSummariesModule>();
  return {
    ...actual,
    ensureMyOrganizationSummaries: vi.fn().mockResolvedValue(ORG_ROWS),
    fetchMyOrganizationSummaries: vi.fn().mockResolvedValue(ORG_ROWS),
  };
});

vi.mock('@/shared/api/organization-api.ts', () => ({
  getMyPermissions: vi.fn().mockResolvedValue(['organization:read']),
  // The cache-first branch `ensurePermissionsFor` takes when me/context is
  // already loaded — which, in the guard chain these tests exercise, it is.
  toOrganizationPermissions: (codes: string[]) => codes,
}));

const { switchToOrganizationMock, switchInFlightToMock } = vi.hoisted(() => ({
  switchToOrganizationMock: vi.fn(),
  switchInFlightToMock: vi.fn((): string | null => null),
}));
vi.mock('@/shared/tenancy/switch.ts', () => ({
  switchToOrganization: switchToOrganizationMock,
  switchInFlightTo: switchInFlightToMock,
}));

/** A JWT-shaped access token whose signed `org` claim names `organizationId`. */
function tokenFor(organizationId: string): string {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/={1,2}$/, '');
  return `${encode({ alg: 'RS256' })}.${encode({ org: organizationId })}.c2ln`;
}

/** What a switch that lands does: the token is re-minted for the organization. */
function landSwitch(organizationId: string): void {
  setAccessToken(tokenFor(organizationId));
}

function seedActiveOrg(id: string) {
  // The token carries the active organization, and the guard chain's
  // `ensureSessionContext()` has derived the store from me/context.
  setAccessToken(tokenFor(id));
  queryClient.setQueryData(meContextQueryKey, {
    activeOrganization: { id, slug: null, type: 'PERSONAL', status: 'ACTIVE' },
    myPermissions: [],
    deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    personalOrganizationId: 'org_personal',
    organizations: [
      {
        id: 'org_acme',
        name: 'Acme Inc.',
        slug: 'acme',
        type: 'TEAM',
        status: 'ACTIVE',
        logoUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isActive: true,
      },
    ],
  } as unknown as MeContext);
  const context = queryClient.getQueryData<MeContext>(meContextQueryKey);
  if (context) deriveOrgContext(context);
}

function thrownBy(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('requireOrganizationContext', () => {
  beforeEach(() => {
    resetPermissionCacheForTests();
    useOrganizationStore.getState().clearOrganization();
    queryClient.removeQueries({ queryKey: meContextQueryKey });
    switchToOrganizationMock.mockReset();
    switchToOrganizationMock.mockImplementation(async (id: string) => landSwitch(id));
    switchInFlightToMock.mockReset();
    switchInFlightToMock.mockReturnValue(null);
    clearAccessToken();
    localStorage.clear();
  });

  it('throws notFound for a malformed slug — no fetch, no existence leak', async () => {
    await expect(requireOrganizationContext('NOT-A-SLUG')).rejects.toSatisfy(isNotFound);
  });

  it('throws notFound when the user is not a member of the organization', async () => {
    await expect(requireOrganizationContext('stranger')).rejects.toSatisfy(isNotFound);
  });

  it('syncs the derived store from the URL and loads permissions for members', async () => {
    const organization = await requireOrganizationContext('acme');

    expect(organization.slug).toBe('acme');
    expect(useOrganizationStore.getState().organizationId).toBe('org_acme');
    expect(useOrganizationStore.getState().organizationSlug).toBe('acme');
    expect(useOrganizationStore.getState().permissions).toEqual(['organization:read']);
  });

  it('switches the active org when the URL targets a different org (FE-24)', async () => {
    seedActiveOrg('org_personal');
    await requireOrganizationContext('acme');
    expect(switchToOrganizationMock).toHaveBeenCalledWith('org_acme');
  });

  it('does not switch when the URL org is already the active one', async () => {
    seedActiveOrg('org_acme');
    await requireOrganizationContext('acme');
    expect(switchToOrganizationMock).not.toHaveBeenCalled();
  });

  /*
   * E-1: every organization-scoped query key takes its organization from the
   * store. Written before the switch, the store made the mounted screens fetch
   * clinic B's keys with clinic A's still-valid token, and cache A's patients
   * under B's name.
   */
  describe('the store names the new clinic only once the switch has landed (E-1)', () => {
    it('keeps the store on the old clinic while the switch is in flight', async () => {
      seedActiveOrg('org_personal');
      let land: () => void = () => undefined;
      switchToOrganizationMock.mockImplementation(
        (id: string) =>
          new Promise<void>((resolve) => {
            land = () => {
              landSwitch(id);
              resolve();
            };
          }),
      );

      const guard = requireOrganizationContext('acme');
      await vi.waitFor(() => expect(switchToOrganizationMock).toHaveBeenCalled());

      expect(useOrganizationStore.getState().organizationId).toBe('org_personal');
      land();
      await guard;
      expect(useOrganizationStore.getState().organizationId).toBe('org_acme');
    });

    it('never names the new clinic in the store while the token carries the old one', async () => {
      seedActiveOrg('org_personal');
      // What the token named each time the store named a clinic — the token
      // every query keyed from the store goes out with.
      const tokenWhenStoreMoved: Array<[string | null, string | null]> = [];
      const unsubscribe = useOrganizationStore.subscribe((state, previous) => {
        if (state.organizationId === previous.organizationId) return;
        const token = getAccessToken();
        tokenWhenStoreMoved.push([
          state.organizationId,
          token ? organizationClaimOf(token) : null,
        ]);
      });

      await requireOrganizationContext('acme');
      unsubscribe();

      expect(tokenWhenStoreMoved).toEqual([['org_acme', 'org_acme']]);
    });

    it('leaves the store on the old clinic when the switch fails', async () => {
      seedActiveOrg('org_personal');
      switchToOrganizationMock.mockRejectedValue(
        new HttpError('Unavailable', 503, '/api/v1/auth/switch-to-organization', 'POST'),
      );

      await expect(requireOrganizationContext('acme')).rejects.toBeInstanceOf(HttpError);

      expect(useOrganizationStore.getState().organizationId).toBe('org_personal');
    });

    it('404s, store untouched, when a newer switch superseded this one', async () => {
      seedActiveOrg('org_personal');
      // Superseded: the switch resolves without its token ever being applied.
      switchToOrganizationMock.mockResolvedValue(undefined);

      await expect(requireOrganizationContext('acme')).rejects.toSatisfy(isNotFound);

      expect(useOrganizationStore.getState().organizationId).toBe('org_personal');
    });

    it('switches back when a switch away from the URL clinic is still in flight', async () => {
      // me/context still names Acme, but a switch to another clinic is out: its
      // late answer would leave the token on a clinic the URL no longer shows.
      seedActiveOrg('org_acme');
      switchInFlightToMock.mockReturnValue('org_elsewhere');

      await requireOrganizationContext('acme');

      expect(switchToOrganizationMock).toHaveBeenCalledWith('org_acme');
    });
  });

  describe('when clinozy-be refuses the switch', () => {
    const refusal = (reason?: string) =>
      new HttpError('Forbidden', 403, '/api/v1/auth/switch-to-organization', 'POST', {
        error: reason ? { reason } : {},
      });

    it('answers a revoked membership with the non-member 404, not a 403 page', async () => {
      // The cached list still names the clinic; the membership behind it is gone.
      seedActiveOrg('org_personal');
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      switchToOrganizationMock.mockRejectedValue(refusal());

      await expect(requireOrganizationContext('acme')).rejects.toSatisfy(isNotFound);

      // The stale list goes, so the switcher stops offering the clinic.
      expect(invalidate).toHaveBeenCalledWith({ queryKey: myOrganizationsQueryKey });
      // The store goes back to the organization the token still carries.
      expect(useOrganizationStore.getState().organizationId).toBe('org_personal');
      invalidate.mockRestore();
    });

    it('lets an mfa_required refusal through — it is not a membership answer', async () => {
      seedActiveOrg('org_personal');
      const mfaRequired = refusal('mfa_required');
      switchToOrganizationMock.mockRejectedValue(mfaRequired);

      await expect(requireOrganizationContext('acme')).rejects.toBe(mfaRequired);
    });

    it('lets any other failure through unchanged', async () => {
      seedActiveOrg('org_personal');
      const outage = new HttpError(
        'Unavailable',
        503,
        '/api/v1/auth/switch-to-organization',
        'POST',
      );
      switchToOrganizationMock.mockRejectedValue(outage);

      await expect(requireOrganizationContext('acme')).rejects.toBe(outage);
    });
  });
});

describe('requireActiveOrganization', () => {
  beforeEach(() => {
    useOrganizationStore.getState().clearOrganization();
  });

  it('passes for active organizations when the store matches the URL slug', () => {
    useOrganizationStore.getState().setOrganization('org_acme', 'acme', 'active');
    expect(() => requireActiveOrganization('acme')).not.toThrow();
  });

  it('throws notFound when org context is not synced for the URL slug', () => {
    useOrganizationStore.getState().setOrganization('org_acme', 'other', 'active');
    expect(() => requireActiveOrganization('acme')).toThrow();
  });

  it('redirects suspended organizations to the suspended page', () => {
    useOrganizationStore.getState().setOrganization('org_acme', 'acme', 'suspended');
    const thrown = thrownBy(() => requireActiveOrganization('acme'));
    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      options: {
        to: '/organization/$organizationSlug/suspended',
        params: { organizationSlug: 'acme' },
      },
    });
  });
});

describe('requireSuspendedOrganization', () => {
  beforeEach(() => {
    useOrganizationStore.getState().clearOrganization();
  });

  it('passes for a suspended organization — the blocked state must render', () => {
    useOrganizationStore.getState().setOrganization('org_acme', 'acme', 'suspended');
    expect(() => requireSuspendedOrganization('acme')).not.toThrow();
  });

  it('sends an ACTIVE organization back to its home', () => {
    // Regression: `suspended/` sat outside `requireOrgStatus` so it could
    // render its blocked state without looping — which also left it unguarded
    // in the other direction. Typing the URL told the owner of a demonstrably
    // active organization that it was suspended.
    useOrganizationStore.getState().setOrganization('org_acme', 'acme', 'active');
    const thrown = thrownBy(() => requireSuspendedOrganization('acme'));
    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      options: {
        to: '/organization/$organizationSlug',
        params: { organizationSlug: 'acme' },
      },
    });
  });

  it('treats an unresolved status as active, exactly as its twin does', () => {
    useOrganizationStore.getState().setOrganization('org_acme', 'acme', undefined);
    const thrown = thrownBy(() => requireSuspendedOrganization('acme'));
    expect(isRedirect(thrown)).toBe(true);
  });

  it('throws notFound when org context is not synced for the URL slug', () => {
    useOrganizationStore.getState().setOrganization('org_acme', 'other', 'suspended');
    const thrown = thrownBy(() => requireSuspendedOrganization('acme'));
    expect(isNotFound(thrown)).toBe(true);
  });

  it('partitions the status space with its twin, so neither can loop', () => {
    // active  -> suspended passes it on to the home, the home accepts it
    // suspended -> the home passes it on to suspended, suspended accepts it
    useOrganizationStore.getState().setOrganization('org_acme', 'acme', 'active');
    expect(() => requireActiveOrganization('acme')).not.toThrow();
    expect(() => requireSuspendedOrganization('acme')).toThrow();

    useOrganizationStore.getState().setOrganization('org_acme', 'acme', 'suspended');
    expect(() => requireActiveOrganization('acme')).toThrow();
    expect(() => requireSuspendedOrganization('acme')).not.toThrow();
  });
});

describe('deployment mode guards', () => {
  beforeEach(() => {
    useOrganizationStore.getState().clearOrganization();
    platformConfig.deploymentOverrides = {
      personalOrganizations: null,
      teamOrganizations: null,
    };
  });

  it('requireTeamOrganizationsDeployment sends personal-only to the organization picker', () => {
    useOrganizationStore
      .getState()
      .setDeploymentContext(
        { personalOrganizations: true, teamOrganizations: false },
        'org_personal',
      );
    const thrown = thrownBy(() => requireTeamOrganizationsDeployment());
    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: { to: '/organization' } });
  });

  it('passes when both deployment modes are enabled', () => {
    useOrganizationStore
      .getState()
      .setDeploymentContext(
        { personalOrganizations: true, teamOrganizations: true },
        'org_personal',
      );
    expect(() => requireTeamOrganizationsDeployment()).not.toThrow();
  });

  it('env override restricts pre-network even when the store holds permissive defaults', () => {
    // Cold navigation: store still has DEFAULT_DEPLOYMENT_FLAGS (both true) because
    // me/context has not hydrated yet — only the env override should restrict.
    platformConfig.deploymentOverrides = {
      personalOrganizations: null,
      teamOrganizations: false,
    };
    const thrown = thrownBy(() => requireTeamOrganizationsDeployment());
    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: { to: '/organization' } });
  });
});

describe('workspace provision guards', () => {
  beforeEach(() => {
    vi.mocked(ensureSessionContext).mockReset();
  });

  it('requireProvisionedTeamWorkspace redirects to onboarding when no orgs yet', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: false } as MeContext['user'],
      activeOrganization: null,
      organizations: [],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(requireProvisionedTeamWorkspace()).rejects.toMatchObject({
      options: { to: '/onboarding' },
    });
  });

  it('requireProvisionedTeamWorkspace lets a personal-active session into a team slug', async () => {
    // Regression: this used to throw redirect({ to: '/dashboard' }) BEFORE the
    // slug chain could run switch-on-navigation, so the org switcher, command
    // palette, and direct team URLs were all dead ends once the personal org
    // was active — the user could never re-enter any team workspace.
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: true } as MeContext['user'],
      activeOrganization: { id: 'org_p', type: 'PERSONAL', slug: null, status: 'ACTIVE' },
      organizations: [],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(requireProvisionedTeamWorkspace()).resolves.toBeUndefined();
  });

  it('lets a personal-active session onto the picker — where `/` sends it (D44)', async () => {
    // The picker used to bounce a personal-active session to `/dashboard`. The
    // personal space is gone, so the picker IS that session's landing: bouncing
    // it anywhere would loop.
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: true } as MeContext['user'],
      activeOrganization: { id: 'org_p', type: 'PERSONAL', slug: null, status: 'ACTIVE' },
      organizations: [],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(requireProvisionedTeamWorkspace()).resolves.toBeUndefined();
  });

  it('onboarding redirects carry the guarded deep link as ?redirect=', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: false } as MeContext['user'],
      activeOrganization: null,
      organizations: [],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(
      requireProvisionedTeamWorkspace({ redirectFrom: '/organization/acme/today' }),
    ).rejects.toMatchObject({
      options: {
        to: '/onboarding',
        search: { redirect: '/organization/acme/today' },
      },
    });
  });

  it('requireOnboardingWorkspace passes when onboarding is required (no orgs)', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: false } as MeContext['user'],
      activeOrganization: null,
      organizations: [],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(requireOnboardingWorkspace()).resolves.toBeUndefined();
  });

  // Regression (ONB-4): the wizard's persisted store is bound to the signed-in
  // user HERE, before the page renders. Done from an effect inside the page, a
  // store left by a different user on this browser painted their name and
  // workspace for a frame before the wipe.
  it('requireOnboardingWorkspace claims the wizard store before the page renders', async () => {
    const store = useOnboardingStore.getState();
    store.claimForUser('usr_previous');
    store.patch({ firstName: 'Prev' });
    store.setStepIndex(2);

    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { id: 'usr_next', onboardingCompleted: false } as MeContext['user'],
      activeOrganization: null,
      organizations: [],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await requireOnboardingWorkspace();

    const state = useOnboardingStore.getState();
    expect(state.forUserId).toBe('usr_next');
    expect(state.stepIndex).toBe(0);
    expect(state.data.firstName).toBe('');
  });

  it('requireOnboardingWorkspace redirects away when user already has org memberships', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: true } as MeContext['user'],
      activeOrganization: null,
      organizations: [
        {
          id: 'org_p',
          type: 'PERSONAL',
          slug: null,
          status: 'ACTIVE',
          name: 'Personal',
          logoUrl: null,
          createdAt: 't',
          updatedAt: 't',
          isActive: false,
        },
      ],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(requireOnboardingWorkspace()).rejects.toMatchObject({
      options: { to: '/organization' },
    });
  });

  it('requireOnboardingWorkspace sends a personal-active session to the picker', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: true } as MeContext['user'],
      activeOrganization: { id: 'org_p', type: 'PERSONAL', slug: null, status: 'ACTIVE' },
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(requireOnboardingWorkspace()).rejects.toMatchObject({
      options: { to: '/organization' },
    });
  });

  it('requireOnboardingWorkspace sends an active team org to its home', async () => {
    vi.mocked(ensureSessionContext).mockResolvedValue({
      user: { onboardingCompleted: true } as MeContext['user'],
      activeOrganization: {
        id: 'org_t',
        type: 'TEAM',
        slug: 'acme',
        status: 'ACTIVE',
      },
      // A member landing on the clinic's rooms can read the org.
      myPermissions: ['organization:read'],
      deploymentFlags: { personalOrganizations: true, teamOrganizations: true },
    } as MeContext);

    await expect(requireOnboardingWorkspace()).rejects.toMatchObject({
      options: {
        to: '/organization/$organizationSlug',
        params: { organizationSlug: 'acme' },
      },
    });
  });
});
