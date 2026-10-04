import { useTranslation } from 'react-i18next';

import {
  CLINIC_ABILITIES,
  type ClinicRoleView,
} from '@/shared/api/clinic/access-contracts.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { RoleSwitchCard } from './RoleSwitchCard.tsx';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/**
 * "Special permissions" (`users.md:71`; H:1137–1141): the eleven switch cards
 * in `repeat(auto-fill, minmax(260px,1fr))`. Locked switches stay pressable
 * and say why (`aria-disabled`); "Change roles & access" of a role bound to a
 * clinozy-be system role is the platform's (D47).
 */
export function RoleAbilities({
  role,
  writes,
}: {
  role: ClinicRoleView;
  writes: RoleAccessWrites;
}) {
  const { t } = useTranslation(USERS_NS);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
      {CLINIC_ABILITIES.map((ability) => (
        <RoleSwitchCard
          key={ability}
          tone={role.tone}
          on={role.abilities.includes(ability)}
          locked={writes.lock !== null || (ability === 'perms' && writes.platformLocked)}
          label={t(USERS_KEYS.roles.abilities[ability].label)}
          description={t(USERS_KEYS.roles.abilities[ability].description)}
          onToggle={() => writes.toggleAbility(ability)}
          testId={`users-role-ability-${ability}`}
        />
      ))}
    </div>
  );
}
