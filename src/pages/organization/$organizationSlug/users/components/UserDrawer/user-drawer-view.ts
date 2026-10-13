import { useQueries } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { resolveAccessFromCodes } from '@/shared/api/app/access-api.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import { getRolePermissions } from '@/shared/api/organization-api.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { formatAppPhoneDigits } from '@/shared/app/app-phone-field.ts';
import {
  type DrawerPeekItem,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

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
 * The picked roles' codes, together — each role's read once and kept under its key (an edit's
 * pre-fill and View-as read the same entry); undefined until every one has answered.
 */
function usePickedRoleCodes(roleIds: readonly string[]): string[] | undefined {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useQueries({
    queries: roleIds.map((roleId) => ({
      queryKey: orgQueryKeys.rolePermissions(organizationId, roleId),
      queryFn: () => getRolePermissions(roleId),
    })),
    combine: (results) =>
      results.every((result) => result.data !== undefined)
        ? results.flatMap((result) => result.data ?? [])
        : undefined,
  });
}

/**
 * "Gets access to" (`users.md:111`; research-users §5a): the rooms the picked roles' codes view,
 * together, in nav order, joined " · "; "Pick a role" when none is picked, nothing while their
 * codes load. Today stays out: everyone has it.
 */
function userAccessLine(
  codes: readonly string[] | undefined,
  roleIds: readonly string[],
  t: TFunction,
): string {
  if (roleIds.length === 0) return t(K.pickRole, { ns: USERS_NS });
  if (!codes) return '';
  return resolveAccessFromCodes(codes)
    .viewableSections.filter((section) => section !== 'today')
    .map((section) => t(APP_KEYS.sections[section].label, { ns: APP_NS }))
    .join(' · ');
}

/**
 * The user drawer's read-outs (`users.md:169–170, 276`; H:5163–5177): the
 * badge strip, the footer summary, each step's peek grid and head line, and
 * Step 1's missing fields.
 */
export function useUserDrawerView({
  values,
  rolePills,
  branches,
  multiBranch,
  format,
}: {
  values: UserFormValues;
  /** The picked roles as pills, in pick order. */
  rolePills: (roleIds: readonly string[]) => TeamPill[];
  branches: readonly BranchOption[];
  multiBranch: boolean;
  format: HoursFormat;
}): UserDrawerView {
  const { t } = useTranslation([USERS_NS, APP_NS]);
  const roles = rolePills(values.roleIds);
  const picked = branches.filter((branch) => values.branchIds.includes(branch.id));
  const access = userAccessLine(usePickedRoleCodes(values.roleIds), values.roleIds, t);
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
      value: values.phone ? formatAppPhoneDigits(values.phone) : undefined,
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
      name || values.email.trim() || t(K.summaryNew),
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
      missing: missingUserFields(values).map(() => t(K.fields.email)),
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
