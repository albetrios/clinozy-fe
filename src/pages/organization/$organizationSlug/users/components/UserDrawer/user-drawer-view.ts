import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import {
  type ClinicAccessMatrix,
  resolveClinicAccess,
} from '@/shared/api/clinic/access-api.ts';
import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';
import {
  type DrawerPeekItem,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';

import type { HoursFormat } from '../../shared/hooks/useHoursFormat/index.ts';
import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import type { TeamPill } from '../TeamCells/index.ts';
import { missingUserFields, type UserFormValues } from './user-form.ts';

const K = USERS_KEYS.drawer;

/** What the drawer shows of its form outside the fields: header, footer and step heads. */
export interface UserDrawerView {
  /** The roles in pick order, as pills. */
  roles: TeamPill[];
  /** "Leads · Appointments · Patients · Payments · Tasks" — or "Pick a role". */
  access: string;
  /** Roles in their tones · the hours (grey) · "Active" / "Inactive". */
  badges: DrawerBadge[];
  /** "New user · Front desk · Adajan" / "<name> · <roles joined ' + '> · <branches>". */
  summary: string;
  profile: { peek: DrawerPeekItem[]; summary: string; missing: string[] };
  hours: { peek: DrawerPeekItem[]; summary: string };
}

/**
 * "Gets access to" (`users.md:111`): the sections any picked role can View,
 * in the matrix's order — Admin all nine — joined " · "; "Pick a role" when
 * none is picked. Today stays out: every role has it (`S:1012`).
 */
export function userAccessLine(
  matrix: ClinicAccessMatrix | undefined,
  roleKeys: readonly ClinicRoleKey[],
  t: TFunction,
): string {
  if (roleKeys.length === 0) return t(K.pickRole, { ns: USERS_NS });
  if (!matrix) return '';
  return resolveClinicAccess(matrix, roleKeys)
    .viewableSections.filter((section) => section !== 'today')
    .map((section) => t(CLINIC_KEYS.sections[section].label, { ns: CLINIC_NS }))
    .join(' · ');
}

/**
 * The user drawer's read-outs (`users.md:169–170, 276`; H:5163–5177): the
 * badge strip, the footer summary, each step's peek grid and head line, and
 * Step 1's missing fields.
 */
export function useUserDrawerView({
  values,
  matrix,
  rolePills,
  branches,
  multiBranch,
  format,
}: {
  values: UserFormValues;
  matrix: ClinicAccessMatrix | undefined;
  /** The picked roles as pills, in pick order. */
  rolePills: (keys: readonly ClinicRoleKey[]) => TeamPill[];
  branches: readonly Branch[];
  multiBranch: boolean;
  format: HoursFormat;
}): UserDrawerView {
  const { t } = useTranslation([USERS_NS, CLINIC_NS]);
  const roles = rolePills(values.roleKeys);
  const picked = branches.filter((branch) => values.branchIds.includes(branch.id));
  const access = userAccessLine(matrix, values.roleKeys, t);
  const hours = format.hours(values.workingDays, values.startsAt, values.endsAt);
  const statusLabel = values.active
    ? t(USERS_KEYS.status.active)
    : t(USERS_KEYS.status.inactive);
  const name = values.name.trim();
  const branchNames = multiBranch ? picked.map((branch) => branch.name) : [];
  const notFilled = t(RECORD_DRAWER_KEYS.step.notFilled, { ns: RECORD_DRAWER_NS });

  const profilePeek: DrawerPeekItem[] = [
    { kind: 'value', label: t(K.fields.name), value: name },
    {
      kind: 'value',
      label: t(K.fields.mobile),
      value: values.phone ? formatClinicPhoneDigits(values.phone) : undefined,
    },
    { kind: 'value', label: t(K.fields.email), value: values.email.trim() },
    {
      kind: 'multi',
      label: t(K.fields.roles),
      values: roles.map((role) => ({ label: role.label, tone: role.tone })),
    },
    ...(multiBranch
      ? [
          {
            kind: 'multi' as const,
            label: t(K.fields.branches),
            values: picked.map((branch) => ({ label: branch.name, tone: branch.tone })),
          },
        ]
      : []),
  ];
  const hoursPeek: DrawerPeekItem[] = [
    { kind: 'value', label: t(K.fields.days), value: format.days(values.workingDays) },
    { kind: 'value', label: t(K.fields.from), value: values.startsAt },
    { kind: 'value', label: t(K.fields.to), value: values.endsAt },
    {
      kind: 'value',
      label: t(K.fields.commission),
      value: t(USERS_KEYS.table.commission, { value: values.commissionPct }),
    },
    { kind: 'value', label: t(K.fields.status), value: statusLabel },
  ];

  return {
    roles,
    access,
    badges: [
      ...roles.map((role) => ({
        id: `role-${role.id}`,
        label: role.label,
        tone: role.tone,
      })),
      { id: 'hours', label: hours },
      {
        id: 'status',
        label: statusLabel,
        ...(values.active ? { tone: 'sage' as const } : {}),
      },
    ],
    summary: [
      name || t(K.summaryNew),
      roles.map((role) => role.label).join(' + '),
      branchNames.join(', '),
    ]
      .filter(Boolean)
      .join(' · '),
    profile: {
      peek: profilePeek,
      summary: drawerStepSummary(
        [roles.map((role) => role.label).join(' · '), access, branchNames.join(' · ')],
        notFilled,
      ),
      missing: missingUserFields(values).map((field) =>
        field === 'name' ? t(K.fields.name) : t(K.fields.email),
      ),
    },
    hours: {
      peek: hoursPeek,
      summary: drawerStepSummary(
        [
          hours,
          t(USERS_KEYS.table.commission, { value: values.commissionPct }),
          statusLabel,
        ],
        notFilled,
      ),
    },
  };
}
