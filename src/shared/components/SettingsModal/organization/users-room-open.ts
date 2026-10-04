import { CLINIC_MODULES } from '@/core/config/clinic-modules.ts';
import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import { usersGrantsFromPlatformCodes } from '@/shared/api/clinic/access-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Whether the Users room is this member's members surface (D17): the
 * deployment has it (`clinic-users`; production keeps it off until its API
 * lands, D8) and their clinozy-be codes view it (`membership:read` +
 * `role:read`). Otherwise the Members and Roles panels stay in Settings, so
 * nothing anyone could do there is lost.
 */
export function useUsersRoomOpen(): boolean {
  const permissions = useOrganizationStore((state) => state.permissions);
  return (
    isModuleEnabled(CLINIC_MODULES.users) &&
    usersGrantsFromPlatformCodes(permissions).view
  );
}
