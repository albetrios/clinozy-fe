import { useTranslation } from 'react-i18next';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { formatClinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';
import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';

import type { HoursFormat } from '../../../shared/hooks/useHoursFormat/index.ts';
import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import {
  BRANCH_DEFAULT_ROLES,
  teamMemberByProfileId,
} from '../../hooks/useBranchRows/index.ts';
import { type BranchFormValues, missingBranchFields } from './branch-form.ts';

const K = USERS_KEYS.branches.drawer;

/** The first four filled values of a step, " · "-joined — its head's sub line. */
function stepSummary(parts: readonly (string | undefined)[], empty: string): string {
  return (
    parts
      .filter((part): part is string => Boolean(part))
      .slice(0, 4)
      .join(' · ') || empty
  );
}

/** What the drawer shows of its form outside the fields: header, footer and step heads. */
export interface BranchDrawerView {
  /** The name ("New branch") in its tone · "Main branch" (grey) when main. */
  badges: DrawerBadge[];
  /** "New branch · Surat · 1 person" / "Vesu · Surat · 6 people". */
  summary: string;
  place: { peek: DrawerPeekItem[]; summary: string; missing: string[] };
  contact: { peek: DrawerPeekItem[]; summary: string };
  people: { peek: DrawerPeekItem[]; summary: string };
}

/**
 * The branch drawer's read-outs (`users.md:226–236`; H:5223–5230): the badge
 * strip, the footer summary — a plural count, never "1 people" (§7.3) — and
 * each step's peek grid, head line and missing fields.
 */
export function useBranchDrawerView({
  values,
  members,
  format,
}: {
  values: BranchFormValues;
  /** The Team, for the people the form names by profile id. */
  members: readonly TeamMember[];
  format: HoursFormat;
}): BranchDrawerView {
  const { t } = useTranslation([USERS_NS, RECORD_DRAWER_NS]);
  const name = values.name.trim();
  const notFilled = t(RECORD_DRAWER_KEYS.step.notFilled, { ns: RECORD_DRAWER_NS });
  const nobody = t(K.nobody);
  const memberOf = teamMemberByProfileId(members);
  const team = values.teamIds.flatMap((id) => {
    const member = memberOf(id);
    return member ? [member] : [];
  });
  const mainLabel = values.isMain ? t(K.toggles.mainOn) : t(K.toggles.mainOff);
  const statusLabel = values.active ? t(K.toggles.openOn) : t(K.toggles.openOff);
  const phone = values.phone ? formatClinicPhoneDigits(values.phone) : undefined;
  const defaultName = (role: (typeof BRANCH_DEFAULT_ROLES)[number]) =>
    memberOf(values.defaults[role])?.name;

  return {
    badges: [
      { id: 'name', label: name || t(K.summaryNew), tone: values.tone },
      ...(values.isMain ? [{ id: 'main', label: t(K.mainBadge) }] : []),
    ],
    summary: [
      name || t(K.summaryNew),
      values.city.trim(),
      team.length > 0 ? t(K.people, { count: team.length }) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    place: {
      peek: [
        { kind: 'value', label: t(K.fields.name), value: name },
        { kind: 'value', label: t(K.fields.main), value: mainLabel },
        { kind: 'value', label: t(K.fields.status), value: statusLabel },
        {
          kind: 'value',
          label: t(K.fields.line1),
          value: values.addressLine1.trim(),
        },
        {
          kind: 'value',
          label: t(K.fields.line2),
          value: values.addressLine2.trim(),
        },
        { kind: 'value', label: t(K.fields.area), value: values.area.trim() },
        { kind: 'value', label: t(K.fields.city), value: values.city.trim() },
        { kind: 'value', label: t(K.fields.pin), value: values.pin },
      ],
      // The first four filled values in the fields' order (H:5225).
      summary: stepSummary(
        [
          name,
          mainLabel,
          statusLabel,
          values.addressLine1.trim(),
          values.addressLine2.trim(),
          values.area.trim(),
          values.city.trim(),
          values.pin,
          values.state.trim(),
        ],
        notFilled,
      ),
      missing: missingBranchFields(values).map((field) =>
        field === 'name' ? t(K.fields.name) : t(K.fields.line1),
      ),
    },
    contact: {
      peek: [
        { kind: 'value', label: t(K.fields.phone), value: phone },
        { kind: 'value', label: t(K.fields.email), value: values.email.trim() },
        {
          kind: 'value',
          label: t(K.fields.gstin),
          value: values.gstNumber.trim().toUpperCase(),
        },
        {
          kind: 'value',
          label: t(K.fields.days),
          value: format.days(values.workingDays),
        },
        { kind: 'value', label: t(K.fields.opens), value: values.opensAt },
        { kind: 'value', label: t(K.fields.closes), value: values.closesAt },
      ],
      summary: stepSummary(
        [
          phone,
          values.email.trim(),
          values.gstNumber.trim().toUpperCase(),
          format.days(values.workingDays),
          values.opensAt,
          values.closesAt,
        ],
        notFilled,
      ),
    },
    people: {
      peek: [
        {
          kind: 'multi',
          label: t(K.fields.team),
          values: team.map((member) => ({ label: member.name, tone: member.tone })),
        },
        ...BRANCH_DEFAULT_ROLES.map((role): DrawerPeekItem => ({
          kind: 'value',
          label: t(K.fields[role]),
          value: defaultName(role) ?? nobody,
        })),
      ],
      // The team, then each default or "Nobody" (H:5229).
      summary: stepSummary(
        [
          team.map((member) => member.name).join(', '),
          ...BRANCH_DEFAULT_ROLES.map((role) => defaultName(role) ?? nobody),
        ],
        notFilled,
      ),
    },
  };
}
