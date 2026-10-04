import { useTranslation } from 'react-i18next';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import {
  platformCodesWithUsersAccess,
  withGrantToggled,
  withRowToggled,
} from '@/shared/api/clinic/access-api.ts';
import type {
  ClinicAbility,
  ClinicAction,
  ClinicRoleView,
  MatrixSection,
  SectionGrants,
} from '@/shared/api/clinic/access-contracts.ts';
import { CLINIC_ABILITIES } from '@/shared/api/clinic/access-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import {
  useUpdateRoleCodes,
  useUpdateRoleMatrix,
} from '@/shared/hooks/useClinicRoles/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';

/** Why the boxes and switches can't change: Admin is always full, or the viewer may not. */
export type RoleLock = 'admin' | 'noPerms' | null;

/** What a role page may write, and how. */
export interface RoleAccessWrites {
  /** Null when the boxes and switches are live. */
  lock: RoleLock;
  /** The role's Users row and "Change roles & access" are clinozy-be's system codes (D47). */
  platformLocked: boolean;
  toggleCell: (section: MatrixSection, action: ClinicAction) => void;
  toggleRow: (section: MatrixSection) => void;
  toggleAbility: (ability: ClinicAbility) => void;
  /** A workspace permission — one clinozy-be code the matrix doesn't map — on or off. */
  toggleCode: (code: OrganizationPermission) => void;
  copyFrom: (source: ClinicRoleView, sourceLabel: string, label: string) => void;
}

/**
 * A role page's writes (KICKOFF §6.12 Roles & access; Q-U6): every box, Row
 * pill and switch is instant — optimistic, rolled back with the save-error
 * toast when refused. The fixture matrix holds the clinic sections and the
 * abilities (REPLACE_WITH_API); a role clinozy-be backs keeps its Users row and
 * "Change roles & access" as its permission codes (D17) — written there and
 * mirrored on the matrix, so a View-as preview reads the same row — and its
 * workspace permissions are its other codes, written the same way. Admin, and
 * a viewer without "Change roles & access", get the lock's toast instead; a
 * role clinozy-be keeps as a system role has its codes read-only (D47).
 */
export function useRoleAccessWrites(
  role: ClinicRoleView | null,
  codes: readonly OrganizationPermission[] | undefined,
): RoleAccessWrites {
  const { t } = useTranslation(USERS_NS);
  const access = useClinicAccess();
  const updateMatrix = useUpdateRoleMatrix();
  const updateCodes = useUpdateRoleCodes(
    role?.platformBacked ? role.platformRole?.id : undefined,
  );
  const canEdit = access.isResolved && access.canAbility('perms');
  let lock: RoleLock = null;
  if (role?.locked) lock = 'admin';
  else if (!canEdit) lock = 'noPerms';
  const platformLocked = Boolean(role?.platformBacked && role.platformRole?.isSystem);

  /** Toast why nothing changed; true when the role may not be written. */
  const refused = (): boolean => {
    if (!lock) return false;
    notify.info(
      t(
        lock === 'admin'
          ? USERS_KEYS.roles.locked.admin
          : USERS_KEYS.roles.locked.noPerms,
      ),
    );
    return true;
  };

  /** The Users row and "Change roles & access" as clinozy-be codes; false when they can't be written. */
  const writeCodes = (users: SectionGrants, perms: boolean): boolean => {
    if (!role?.platformBacked) return true;
    if (platformLocked) {
      notify.info(t(USERS_KEYS.roles.locked.platform));
      return false;
    }
    const platformRole = role.platformRole;
    if (!(platformRole && codes)) return false;
    updateCodes.mutate({
      role: platformRole,
      codes: platformCodesWithUsersAccess(codes, users, perms),
    });
    return true;
  };

  const writeSection = (section: MatrixSection, grants: SectionGrants) => {
    if (!role || refused()) return;
    if (section === 'users' && !writeCodes(grants, role.abilities.includes('perms'))) {
      return;
    }
    updateMatrix.mutate({ kind: 'section', key: role.key, section, grants });
  };

  return {
    lock,
    platformLocked,
    toggleCell: (section, action) => {
      if (role) writeSection(section, withGrantToggled(role.grants[section], action));
    },
    toggleRow: (section) => {
      if (role) writeSection(section, withRowToggled(role.grants[section]));
    },
    toggleAbility: (ability) => {
      if (!role || refused()) return;
      const on = role.abilities.includes(ability);
      const abilities = on
        ? role.abilities.filter((held) => held !== ability)
        : CLINIC_ABILITIES.filter(
            (each) => each === ability || role.abilities.includes(each),
          );
      if (ability === 'perms' && !writeCodes(role.grants.users, !on)) return;
      updateMatrix.mutate({ kind: 'abilities', key: role.key, abilities });
    },
    toggleCode: (code) => {
      if (!role?.platformBacked || refused()) return;
      if (platformLocked) {
        notify.info(t(USERS_KEYS.roles.workspace.locked));
        return;
      }
      const platformRole = role.platformRole;
      if (!(platformRole && codes)) return;
      updateCodes.mutate({
        role: platformRole,
        codes: codes.includes(code)
          ? codes.filter((held) => held !== code)
          : [...codes, code],
      });
    },
    copyFrom: (source, sourceLabel, label) => {
      if (!role || refused()) return;
      if (
        !writeCodes(
          source.grants.users,
          source.locked || source.abilities.includes('perms'),
        )
      ) {
        return;
      }
      updateMatrix.mutate({ kind: 'copy', key: role.key, from: source.key });
      notify.success(t(USERS_KEYS.roles.copied, { role: label, from: sourceLabel }));
    },
  };
}
