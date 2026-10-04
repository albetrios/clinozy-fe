import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ClinicRoleKey,
  type ClinicRoleView,
  isPresetRole,
} from '@/shared/api/clinic/access-contracts.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { ROLE_TONES, toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import { useClinicRoles } from '@/shared/hooks/useClinicRoles/index.ts';

/** A role as a pill: its key, its name and its tone. */
export interface RolePill {
  id: ClinicRoleKey;
  label: string;
  tone: Tone;
}

/** The room's roles and how each is named and toned. */
export interface RoleDirectory {
  /** The roles the room lists: the catalog's presets (Owner aside), then the custom ones. */
  roles: ClinicRoleView[];
  /** Every listed role as a pill, in the list's order — the drawer's Roles chips. */
  options: RolePill[];
  /** A role's name: a preset's from the clinic vocabulary, a custom role's own. */
  label: (key: ClinicRoleKey) => string;
  tone: (key: ClinicRoleKey) => Tone;
  /** These roles as pills, in the order given (the main role first). */
  pills: (keys: readonly ClinicRoleKey[]) => RolePill[];
  isPending: boolean;
}

/**
 * The Users room's role directory (KICKOFF §6.12): the roles from
 * `useClinicRoles` — clinozy-be's roles ⨝ the fixture matrix — named and
 * toned the way every Users screen shows them: a preset by its clinic name
 * and tone (Owner too, for the org owner's row), a custom role by its own
 * name and the matrix's tone (the design's hash before it has one).
 */
export function useRoleDirectory(): RoleDirectory {
  const { t } = useTranslation(CLINIC_NS);
  const { roles, isPending } = useClinicRoles();

  const byKey = useMemo(() => new Map(roles.map((role) => [role.key, role])), [roles]);

  const label = useCallback(
    (key: ClinicRoleKey) => {
      if (isPresetRole(key)) return t(CLINIC_KEYS.roles[key]);
      return byKey.get(key)?.name ?? key;
    },
    [byKey, t],
  );
  const tone = useCallback(
    (key: ClinicRoleKey): Tone => {
      if (isPresetRole(key)) return ROLE_TONES[key];
      return byKey.get(key)?.tone ?? toneForLabel(key);
    },
    [byKey],
  );
  const pills = useCallback(
    (keys: readonly ClinicRoleKey[]) =>
      keys.map((key) => ({ id: key, label: label(key), tone: tone(key) })),
    [label, tone],
  );

  return useMemo(
    () => ({
      roles,
      options: pills(roles.map((role) => role.key)),
      label,
      tone,
      pills,
      isPending,
    }),
    [roles, pills, label, tone, isPending],
  );
}
