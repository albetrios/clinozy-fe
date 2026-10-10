import { useTranslation } from 'react-i18next';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { SPECIAL_PERMISSIONS, type SpecialPermission } from './roles-matrix.ts';
import { RoleSwitchCard } from './RoleSwitchCard.tsx';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/**
 * "Special permissions" (`users.md:71`; H:1137–1141; Q-U-B): the codes no box
 * holds, each a switch card in `repeat(auto-fill, minmax(260px,1fr))` — every
 * section's export ("Export · Leads"), seeing the lowest price, the clinical
 * record and the private album. Locked switches stay pressable and say why
 * (`aria-disabled`).
 */
export function RoleSpecials({
  tone,
  codes,
  writes,
}: {
  /** The role's tone: each track's fill when on. */
  tone: Tone;
  codes: readonly string[];
  writes: RoleAccessWrites;
}) {
  const { t } = useTranslation(USERS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const words = (special: SpecialPermission) => {
    const keys = USERS_KEYS.roles.specials[special.kind];
    return {
      label: t(keys.label, {
        section: tClinic(CLINIC_KEYS.sections[special.section].label),
      }),
      description: t(keys.description),
    };
  };
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
      {SPECIAL_PERMISSIONS.map((special) => {
        const on = codes.includes(special.code);
        return (
          <RoleSwitchCard
            key={special.code}
            tone={tone}
            on={on}
            locked={writes.lock !== null || !(on || writes.canGive(special.code))}
            {...words(special)}
            title={special.code}
            onToggle={() => writes.toggleCode(special.code)}
            testId={`users-role-code-${special.code}`}
          />
        );
      })}
    </div>
  );
}
