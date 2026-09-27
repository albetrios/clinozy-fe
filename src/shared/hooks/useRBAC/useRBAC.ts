import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { AUTH_ROUTES } from '@/core/config/constants.ts';
import { hasPermission, type OrganizationPermission } from '@/core/rbac/policies.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Hook-level RBAC guard. Redirects to `/unauthorized` if the user lacks the
 * required org-scoped permission in the active organization.
 *
 * @param permission - The required org-scoped permission code.
 *
 * @example
 * function OrgSettings() {
 *   useRequirePermission('organization:update');
 *   return <SettingsForm />;
 * }
 */
export function useRequirePermission(permission: OrganizationPermission): void {
  const user = useAuthStore((s) => s.user);
  const permissions = useOrganizationStore((s) => s.permissions);
  const navigate = useNavigate();

  useEffect(() => {
    if (!(user && hasPermission({ role: user.role, permissions }, permission))) {
      void navigate({ to: AUTH_ROUTES.UNAUTHORIZED, replace: true });
    }
  }, [user, permissions, permission, navigate]);
}

/**
 * Check a permission without redirecting — useful for conditional rendering.
 *
 * @param permission - The required org-scoped permission code.
 * @returns `true` if the user holds the permission in the active organization.
 *
 * @example
 * const canManage = useHasPermission('membership:manage');
 * {canManage && <InviteButton />}
 */
export function useHasPermission(permission: OrganizationPermission): boolean {
  const user = useAuthStore((s) => s.user);
  const permissions = useOrganizationStore((s) => s.permissions);
  if (!user) return false;
  return hasPermission({ role: user.role, permissions }, permission);
}
