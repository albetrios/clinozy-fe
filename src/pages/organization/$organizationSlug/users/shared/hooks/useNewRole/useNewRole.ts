import { useTranslation } from 'react-i18next';

import {
  nextCustomRoleName,
  nextCustomRoleTone,
} from '@/shared/api/clinic/access-api.ts';
import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useUpdateRoleMatrix } from '@/shared/hooks/useClinicRoles/index.ts';
import { useCreateRole } from '@/shared/hooks/useRoles/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { useRoleDirectory } from '../useRoleDirectory/index.ts';

/**
 * "New role" (KICKOFF §6.12; H:5187): a clinozy-be role named "New role", then
 * "New role 2" … — the first name no role has — holding only
 * `organization:read`, in the next tone of plum · lime · mint · sky · peach ·
 * lav, with every section "None" and no special permission; then "Role added
 * · name it and pick what it can do", and the caller selects it. Without
 * "Change roles & access": "You can’t add roles · ask an admin".
 */
export function useNewRole(onCreated: (key: ClinicRoleKey) => void) {
  const { t } = useTranslation(USERS_NS);
  const access = useClinicAccess();
  const directory = useRoleDirectory();
  const create = useCreateRole({ suppressSuccessToast: true });
  const updateMatrix = useUpdateRoleMatrix();

  return async () => {
    if (!(access.isResolved && access.canAbility('perms'))) {
      notify.info(t(USERS_KEYS.roles.locked.noAdd));
      return;
    }
    const custom = directory.roles.filter((role) => role.preset === null).length;
    const name = nextCustomRoleName(
      t(USERS_KEYS.roles.newRoleName),
      directory.roles.map((role) => directory.label(role.key)),
    );
    try {
      const role = await create.mutateAsync({
        name,
        description: t(USERS_KEYS.roles.purposes.custom),
        permissions: ['organization:read'],
      });
      // A custom role's key IS its clinozy-be id (`rol_…`, Appendix F).
      const key = role.id;
      await updateMatrix.mutateAsync({
        kind: 'addCustom',
        key,
        tone: nextCustomRoleTone(custom),
      });
      notify.success(t(USERS_KEYS.roles.added));
      onCreated(key);
    } catch {
      // The write raised its own error toast; nothing was selected.
    }
  };
}
