import { useTranslation } from 'react-i18next';

import { nextCustomRoleName, nextCustomRoleTone } from '@/shared/api/app/access-api.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useCreateRole } from '@/shared/hooks/useRoles/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { useRoleDirectory } from '../useRoleDirectory/index.ts';

/**
 * "New role" (KICKOFF §6.12; H:5187): one clinozy-be role (`POST …/roles`) named "New role",
 * then "New role 2" … — the first name no role has — holding only `organization:read`, every
 * row "None" and no special permission, in the next tone of plum · lime · mint · sky · peach ·
 * lav; then "Role added · name it and pick what it can do", and the caller selects it by its
 * id — once the roles are read, so the name is free. Without `role:create`: "You can’t add roles ·
 * ask an admin".
 */
export function useNewRole(onCreated: (roleId: string) => void) {
  const { t } = useTranslation(USERS_NS);
  const access = useAppAccess();
  const directory = useRoleDirectory();
  const create = useCreateRole({ suppressSuccessToast: true });

  return async () => {
    if (!(access.isResolved && access.canCode('role:create'))) {
      notify.info(t(USERS_KEYS.roles.locked.noAdd));
      return;
    }
    // The next free name needs every role's: nothing until they are read.
    if (directory.isPending) return;
    const custom = directory.roles.filter((role) => !role.isSystem).length;
    const name = nextCustomRoleName(
      t(USERS_KEYS.roles.newRoleName),
      directory.roles.map((role) => directory.label(role.id)),
    );
    try {
      const role = await create.mutateAsync({
        name,
        description: t(USERS_KEYS.roles.purposes.custom),
        permissions: ['organization:read'],
        tone: nextCustomRoleTone(custom),
      });
      notify.success(t(USERS_KEYS.roles.added));
      onCreated(role.id);
    } catch {
      // The write raised its own error toast; nothing was selected.
    }
  };
}
