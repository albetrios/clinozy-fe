import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationUserEdit,
  organizationUsersRoles,
} from '@/lib/routes/users-builders.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';

/** Where the Roles page sends the viewer. */
export interface RolesNavigation {
  /** Put a role on screen by its id — `?role=` on `/users/roles`, replacing the entry. */
  select: (roleId: string | undefined) => void;
  /** A "People with this role" pill: the member's drawer over this page (`?from=roles`, H:5188). */
  openMember: (member: TeamMember, roleId: string) => void;
  /** "Preview as <role>": View-as for the role, a custom one too (§3.7, H:4441). */
  preview: (role: RoleSummary, label: string) => void;
}

/**
 * The Roles page's moves (KICKOFF §6.12 Routes): the selected role lives in the
 * URL (`role`, its id; default Front desk), a member opens in their drawer with
 * the page kept behind it, and "Preview as" narrows the app to the role's codes
 * — any role but a locked one (Admin). A role that can't view Users is then taken to its first room by
 * the org layout (Q-U11).
 */
export function useRolesNavigation(): RolesNavigation {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const setPreviewRole = useUIStore((state) => state.setPreviewRole);
  const { t } = useTranslation(USERS_NS);

  const select = useCallback(
    (roleId: string | undefined) =>
      void navigate({
        ...organizationUsersRoles(organizationSlug),
        search: { role: roleId },
        hash: true,
        replace: true,
      }),
    [navigate, organizationSlug],
  );

  const openMember = useCallback(
    (member: TeamMember, roleId: string) =>
      void navigate({
        ...organizationUserEdit(organizationSlug, member.membershipId),
        search: { from: 'roles', role: roleId },
        hash: true,
      }),
    [navigate, organizationSlug],
  );

  const preview = useCallback(
    (role: RoleSummary, label: string) => {
      if (role.isLocked) return;
      setPreviewRole(role.id);
      notify.success(t(USERS_KEYS.roles.previewing, { role: label }));
    },
    [setPreviewRole, t],
  );

  return { select, openMember, preview };
}
