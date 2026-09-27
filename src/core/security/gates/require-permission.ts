import { type DenyMode, requirePermission } from '@/core/rbac/guards.ts';
import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { Gate } from '@/core/security/gate.types.ts';

/**
 * **L5 — RBAC permission.** Factory: binds a route's required org-scoped
 * permission (from its manifest) into a gate. Redirects to `/login` when
 * unauthenticated; otherwise denies per `onDeny` — `/unauthorized` by default,
 * or a 404 that hides the surface's existence (FE-52).
 *
 * @example gateway(requireSession, requirePermissionGate(manifest.permission, manifest.onDeny))
 */
export function requirePermissionGate(
  permission: OrganizationPermission,
  onDeny?: DenyMode,
): Gate {
  return async (ctx) => {
    // Bind the route's org (when org-scoped) so the gate fails closed on a
    // tenant mismatch instead of trusting an upstream guard to have synced it.
    await requirePermission(permission, onDeny, ctx.params.organizationSlug);
  };
}
