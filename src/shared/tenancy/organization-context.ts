import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import { organizationPermissionSchema } from '@/core/types/permissions.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import type { MeContext } from './me-context.ts';

/**
 * Organization context — **the URL is the single source of truth.**
 *
 * Inside `/organization/$organizationSlug/*` the route param is canonical; the
 * Zustand store is a derived cache synced FROM the route (never the other way
 * around), kept only so non-React code — the HTTP client, RBAC helpers — can
 * read the active organization synchronously. The `/` resolver picks its
 * redirect target from me/context (the active organization), not from storage.
 * Multi-tab correctness follows: each tab's URL carries its own organization.
 * (docs/reference/routing-and-tenancy.md §4)
 */
export function syncOrganizationFromRoute(
  organizationId: string,
  slug: string,
  status?: 'active' | 'suspended',
): void {
  const store = useOrganizationStore.getState();
  if (
    store.organizationId !== organizationId ||
    store.organizationStatus !== (status ?? null)
  ) {
    store.setOrganization(organizationId, slug, status);
  }
}

/** Active organization id (derived cache — canonical value is me/context). */
export function getActiveOrganizationId(): string | null {
  return useOrganizationStore.getState().organizationId;
}

const VALID_PERMISSIONS = new Set<string>(organizationPermissionSchema.options);

/**
 * Derive the org store from the authoritative me/context — the active org's
 * id / slug / type / status plus the resolved org-scoped
 * permissions. This is the context-driven source of org context (the URL no
 * longer sources it); call it wherever me/context loads or changes.
 */
export function deriveOrgContext(ctx: MeContext): void {
  const permissions = ctx.myPermissions.filter((p): p is OrganizationPermission =>
    VALID_PERMISSIONS.has(p),
  );
  const store = useOrganizationStore.getState();
  store.setDeploymentContext(ctx.deploymentFlags, ctx.personalOrganizationId);
  store.setActiveOrganization(ctx.activeOrganization, permissions);
}
