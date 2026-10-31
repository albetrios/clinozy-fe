import type * as PostHogModule from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type { OrganizationSummary } from '@/shared/tenancy/me-context.ts';

import { ANALYTICS_ORG_GROUP_TYPE } from './analytics.constants.ts';
import { attachPostHogIdentitySync } from './capture.ts';

type PostHogClient = (typeof PostHogModule)['default'];

const CLINIC: OrganizationSummary = {
  id: 'org_clinicaaaaaaaaaaaaaaaa',
  name: 'Acme',
  slug: 'acme',
  type: 'TEAM',
  status: 'ACTIVE',
  logoUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const OTHER_CLINIC: OrganizationSummary = {
  ...CLINIC,
  id: 'org_clinicbbbbbbbbbbbbbbbb',
  slug: 'other',
};
const FLAGS = { personalOrganizations: false, teamOrganizations: true };

/** What one navigation does to the stores: the guard chain re-derives the same context. */
function navigateWithin(organization: OrganizationSummary): void {
  const store = useOrganizationStore.getState();
  store.setDeploymentContext({ ...FLAGS }, null);
  store.setActiveOrganization(organization, ['patient:read']);
  store.setOrganization(organization.id, organization.slug ?? '', 'active');
  store.setPermissions(['patient:read']);
}

/*
 * G-1: every navigation re-derived the same context into the stores, each write woke the
 * identity sync, and every `identify` / `group` made PostHog reload the feature flags.
 */
describe('attachPostHogIdentitySync', () => {
  let ph: { identify: ReturnType<typeof vi.fn>; group: ReturnType<typeof vi.fn> };
  let detach: () => void = () => undefined;

  beforeEach(() => {
    ph = { identify: vi.fn(), group: vi.fn() };
    useAuthStore
      .getState()
      .setUser({ id: 'usr_ada', email: 'ada@acme.test', role: 'user' });
    navigateWithin(CLINIC);
    detach = attachPostHogIdentitySync(ph as unknown as PostHogClient);
  });

  afterEach(() => {
    detach();
    useOrganizationStore.getState().clearOrganization();
    useAuthStore.getState().clearAuth();
  });

  it('tells PostHog the clinic and the user once, however often the same clinic is opened', () => {
    for (let navigation = 0; navigation < 5; navigation += 1) navigateWithin(CLINIC);
    useAuthStore.getState().setLoading(false);

    expect(ph.group).toHaveBeenCalledTimes(1);
    expect(ph.group).toHaveBeenCalledWith(ANALYTICS_ORG_GROUP_TYPE, CLINIC.id, {
      slug: 'acme',
      type: 'TEAM',
      status: 'active',
    });
    expect(ph.identify).toHaveBeenCalledTimes(1);
  });

  it('tells PostHog again when the clinic actually changes', () => {
    navigateWithin(OTHER_CLINIC);
    navigateWithin(OTHER_CLINIC);

    expect(ph.group).toHaveBeenCalledTimes(2);
    expect(ph.group).toHaveBeenLastCalledWith(
      ANALYTICS_ORG_GROUP_TYPE,
      OTHER_CLINIC.id,
      expect.objectContaining({ slug: 'other' }),
    );
  });

  it('identifies again when another user signs in', () => {
    useAuthStore
      .getState()
      .setUser({ id: 'usr_bob', email: 'bob@acme.test', role: 'user' });

    expect(ph.identify).toHaveBeenCalledTimes(2);
    expect(ph.identify).toHaveBeenLastCalledWith('usr_bob', expect.anything());
  });
});

describe('useOrganizationStore setters', () => {
  afterEach(() => {
    useOrganizationStore.getState().clearOrganization();
  });

  it('notify nobody when they would write what the store already holds', () => {
    navigateWithin(CLINIC);
    const listener = vi.fn();
    const unsubscribe = useOrganizationStore.subscribe(listener);

    navigateWithin(CLINIC);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});
