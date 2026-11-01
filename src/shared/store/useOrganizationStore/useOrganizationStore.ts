import { create } from 'zustand';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { DeploymentFlags } from '@/shared/tenancy/deployment-mode.ts';
import { DEFAULT_DEPLOYMENT_FLAGS } from '@/shared/tenancy/deployment-mode.ts';
import type {
  OrganizationSummary,
  OrganizationType,
} from '@/shared/tenancy/me-context.ts';

/** Map the me/context org status (uppercase) to the store's lowercase enum. */
function toStoreStatus(org: OrganizationSummary | null): 'active' | 'suspended' | null {
  if (!org) return null;
  return org.status === 'ACTIVE' ? 'active' : 'suspended';
}

interface OrganizationStore {
  organizationId: string | null;
  organizationSlug: string | null;
  /** Organization status from the membership response. */
  organizationStatus: 'active' | 'suspended' | null;
  /** Active organization type (PERSONAL vs TEAM) — gates team-only UI. */
  organizationType: OrganizationType | null;
  /** Org-scoped permission codes the user holds in the active organization. */
  permissions: OrganizationPermission[];
  /**
   * Whether {@link permissions} is an ANSWER or just the empty default. The
   * guard chain populates it a beat after the route renders, and an empty list
   * that means "we do not know yet" is indistinguishable from "you may do
   * nothing" — which is why gated controls appeared a moment late (SET-23).
   */
  permissionsResolved: boolean;
  /** Deployment-wide personal/team toggles (from me/context). */
  deploymentFlags: DeploymentFlags;
  personalOrganizationId: string | null;

  setOrganization: (id: string, slug: string, status?: 'active' | 'suspended') => void;
  /** Derive the full active-org context from me/context (the canonical source). */
  setActiveOrganization: (
    org: OrganizationSummary | null,
    permissions: OrganizationPermission[],
  ) => void;
  setDeploymentContext: (
    flags: DeploymentFlags,
    personalOrganizationId: string | null,
  ) => void;
  /** Replace the active org's permission set (from the membership response). */
  setPermissions: (permissions: OrganizationPermission[]) => void;
  /** Drop the current set and mark it unresolved (an org switch is starting). */
  clearPermissions: () => void;
  clearOrganization: () => void;
}

/** Same permission codes in the same order. */
function samePermissions(
  current: readonly OrganizationPermission[],
  next: readonly OrganizationPermission[],
): boolean {
  return current.length === next.length && current.every((code, i) => code === next[i]);
}

/** Whether every field of `next` already holds that value in `state`. */
function holdsAlready(
  state: OrganizationStore,
  next: Partial<OrganizationStore>,
): boolean {
  return (Object.keys(next) as Array<keyof OrganizationStore>).every((key) => {
    const value = next[key];
    const current = state[key];
    if (key === 'permissions') {
      return samePermissions(
        current as OrganizationPermission[],
        value as OrganizationPermission[],
      );
    }
    if (key === 'deploymentFlags') {
      const flags = value as DeploymentFlags;
      const held = current as DeploymentFlags;
      return (
        held.personalOrganizations === flags.personalOrganizations &&
        held.teamOrganizations === flags.teamOrganizations
      );
    }
    return Object.is(current, value);
  });
}

/**
 * Derived cache of organization context (canonical value: the URL) (active organization + its
 * permissions).
 *
 * Accessible outside React via `useOrganizationStore.getState()` — used by the HTTP
 * RBAC
 * guards to resolve org-scoped permissions.
 *
 * Every setter is a no-op when the store already holds those values: the guard chain
 * re-derives the same context on every navigation, and a write that changes nothing still
 * woke every subscriber — analytics re-identified the clinic and reloaded its flags on each
 * page change, and a fresh `permissions` array re-rendered everything gated on it (G-1).
 */
export const useOrganizationStore = create<OrganizationStore>((set) => {
  /** Write `next` unless the store already holds it — then nobody is notified. */
  const write = (next: Partial<OrganizationStore>) =>
    set((state) => (holdsAlready(state, next) ? state : next));

  return {
    organizationId: null,
    organizationSlug: null,
    organizationStatus: null,
    organizationType: null,
    permissions: [],
    permissionsResolved: false,
    deploymentFlags: DEFAULT_DEPLOYMENT_FLAGS,
    personalOrganizationId: null,

    setActiveOrganization: (org, permissions) =>
      write({
        organizationId: org?.id ?? null,
        organizationSlug: org?.slug ?? null,
        organizationStatus: toStoreStatus(org),
        organizationType: org?.type ?? null,
        permissions,
        permissionsResolved: true,
      }),

    setDeploymentContext: (deploymentFlags, personalOrganizationId) =>
      write({ deploymentFlags, personalOrganizationId }),

    setOrganization: (organizationId, organizationSlug, organizationStatus) =>
      write({
        organizationId,
        organizationSlug,
        organizationStatus: organizationStatus ?? null,
      }),
    setPermissions: (permissions) => write({ permissions, permissionsResolved: true }),
    clearPermissions: () => write({ permissions: [], permissionsResolved: false }),
    clearOrganization: () =>
      write({
        organizationId: null,
        organizationSlug: null,
        organizationStatus: null,
        organizationType: null,
        permissions: [],
        permissionsResolved: false,
        deploymentFlags: DEFAULT_DEPLOYMENT_FLAGS,
        personalOrganizationId: null,
      }),
  };
});

/**
 * The active organization's id — what every organization-scoped query key carries,
 * so a cached read never answers for another clinic; `null` outside one.
 */
export const useOrganizationId = (): string | null =>
  useOrganizationStore((state) => state.organizationId);
