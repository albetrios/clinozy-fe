import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationUserEdit, organizationUsersRoles } from '@/lib/routes/index.ts';
import type {
  ClinicRoleKey,
  ClinicRoleView,
} from '@/shared/api/clinic/access-contracts.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';

/** Where the Roles page sends the viewer. */
export interface RolesNavigation {
  /** Put a role on screen — `?role=` on `/users/roles`, replacing the entry. */
  select: (role: ClinicRoleKey) => void;
  /** A "People with this role" pill: the member's drawer over this page (`?from=roles`, H:5188). */
  openMember: (member: TeamMember, role: ClinicRoleKey) => void;
  /** "Preview as <role>": View-as for the role, a custom one too (§3.7, H:4441). */
  preview: (role: ClinicRoleView, label: string) => void;
}

/**
 * The Roles page's moves (KICKOFF §6.12 Routes): the selected role lives in the
 * URL (`role`, default Front desk), a member opens in their drawer with the
 * page kept behind it, and "Preview as" narrows the app to the role — any role
 * but Admin. A role that can't view Users is then taken to its first room by
 * the org layout (Q-U11).
 */
export function useRolesNavigation(): RolesNavigation {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const setPreviewRole = useUIStore((state) => state.setPreviewRole);
  const { t } = useTranslation(USERS_NS);

  const select = useCallback(
    (role: ClinicRoleKey) =>
      void navigate({
        ...organizationUsersRoles(organizationSlug),
        search: { role },
        hash: true,
        replace: true,
      }),
    [navigate, organizationSlug],
  );

  const openMember = useCallback(
    (member: TeamMember, role: ClinicRoleKey) =>
      void navigate({
        ...organizationUserEdit(organizationSlug, member.membershipId),
        search: { from: 'roles', role },
        hash: true,
      }),
    [navigate, organizationSlug],
  );

  const preview = useCallback(
    (role: ClinicRoleView, label: string) => {
      if (role.locked) return;
      setPreviewRole(role.key);
      notify.success(t(USERS_KEYS.roles.previewing, { role: label }));
    },
    [setPreviewRole, t],
  );

  return { select, openMember, preview };
}
