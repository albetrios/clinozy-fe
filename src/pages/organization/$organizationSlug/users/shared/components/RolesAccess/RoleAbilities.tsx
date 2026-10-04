import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  CLINIC_ABILITIES,
  type ClinicRoleView,
} from '@/shared/api/clinic/access-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import type { RoleAccessWrites } from './use-role-access-writes.ts';

/**
 * "Special permissions" (`users.md:71`; H:1137–1141): the eleven switch cards
 * in `repeat(auto-fill, minmax(260px,1fr))` — a 32 × 18px track in the role's
 * tone with a 14px knob (150ms), the label and its description. Locked
 * switches stay pressable and say why (`aria-disabled`); "Change roles &
 * access" of a role bound to a clinozy-be system role is the platform's (D47).
 */
export function RoleAbilities({
  role,
  writes,
}: {
  role: ClinicRoleView;
  writes: RoleAccessWrites;
}) {
  const { t } = useTranslation(USERS_NS);
  const tone = TONE_CLASSES[role.tone];
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
      {CLINIC_ABILITIES.map((ability) => {
        const on = role.abilities.includes(ability);
        const locked =
          writes.lock !== null || (ability === 'perms' && writes.platformLocked);
        return (
          <button
            key={ability}
            type="button"
            role="switch"
            aria-checked={on}
            aria-disabled={locked || undefined}
            onClick={() => writes.toggleAbility(ability)}
            data-testid={`users-role-ability-${ability}`}
            className={cn(
              'bg-background hover:bg-canvas flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-start transition-colors',
              locked ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
          >
            <span
              aria-hidden="true"
              data-slot="pill"
              className={cn(
                'relative mt-px h-4.5 w-8 flex-none rounded-full transition-colors duration-150',
                on ? tone.fill : 'bg-border',
              )}
            >
              <span
                data-slot="pill"
                className={cn(
                  'bg-background absolute start-0.5 top-0.5 size-3.5 rounded-full shadow-xs transition-transform duration-150',
                  on && 'translate-x-3.5 rtl:-translate-x-3.5',
                )}
              />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 leading-[1.35]">
              <span className="text-body leading-[1.35] font-semibold">
                {t(USERS_KEYS.roles.abilities[ability].label)}
              </span>
              <span className="text-caption text-muted-foreground text-pretty">
                {t(USERS_KEYS.roles.abilities[ability].description)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
