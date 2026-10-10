import { CLINIC_MODULES } from '@/core/config/clinic-modules.ts';
import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import { SECTION_ACTION_CODES } from '@/shared/api/clinic/access-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Whether the Users room is this member's members surface (D17): the deployment has it
 * (`clinic-users`) and their own codes open its Team (`membership:read`). Otherwise the Members
 * and Roles panels stay in Settings, so nothing anyone could do there is lost.
 */
export function useUsersRoomOpen(): boolean {
  const permissions = useOrganizationStore((state) => state.permissions);
  return (
    isModuleEnabled(CLINIC_MODULES.users) &&
    permissions.includes(SECTION_ACTION_CODES.users.view)
  );
}
