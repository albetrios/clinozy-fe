import { useTranslation } from 'react-i18next';

import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { formatAppPhoneDigits } from '@/shared/app/app-phone-field.ts';
import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import type { HoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS } from '../../branches.constants.ts';
import { BRANCH_DEFAULT_ROLES, teamMemberById } from '../../hooks/useBranchRows/index.ts';
import {
  type BranchFormValues,
  isBranchEmailInvalid,
  isBranchPhoneIncomplete,
  isBranchPinIncomplete,
  isBranchReviewLinkInvalid,
  missingContactFields,
  missingPlaceFields,
  type RequiredBranchField,
} from './branch-form.ts';

const K = BRANCHES_KEYS.drawer;

/** What the drawer shows of its form outside the fields: header, footer and step heads. */
export interface BranchDrawerView {
  /** The name ("New branch") in its tone · "Main branch" (grey) when main. */
  badges: DrawerBadge[];
  /** "New branch · Surat · 1 person" / "Vesu · Surat · 6 people". */
  summary: string;
  /** `problems`: the save's own checks (`useBranchSave`), so a step never reads done on a bad PIN. */
  place: { peek: DrawerPeekItem[]; missing: string[]; problems: string[] };
  /** `problems`: the save's phone, email and review-link checks, in its words. */
  contact: { peek: DrawerPeekItem[]; missing: string[]; problems: string[] };
  people: { peek: DrawerPeekItem[] };
}

/**
 * The branch drawer's read-outs (`users.md:226–236`; H:5223–5230): the badge
 * strip, the footer summary — a plural count, never "1 people" (§7.3) — and
 * each step's peek grid, missing fields and problems: what a filled field breaks
 * of the save's own checks, so a step never reads done while Save would stop on it.
 */
export function useBranchDrawerView({
  values,
  members,
  format,
}: {
  values: BranchFormValues;
  /** The Team, for the people the form names by membership id. */
  members: readonly TeamMember[];
  format: HoursFormat;
}): BranchDrawerView {
  const { t } = useTranslation(BRANCHES_NS);
  const name = values.name.trim();
  const nobody = t(K.nobody);
  const memberOf = teamMemberById(members);
  const fieldLabel: Readonly<Record<RequiredBranchField, string>> = {
    name: t(K.fields.name),
    addressLine1: t(K.fields.line1),
    area: t(K.fields.area),
    city: t(K.fields.city),
    pin: t(K.fields.pin),
    phone: t(K.fields.phone),
    email: t(K.fields.email),
  };
  const team = values.teamIds.flatMap((id) => {
    const member = memberOf(id);
    return member ? [member] : [];
  });
  const mainLabel = values.isMain ? t(K.toggles.mainOn) : t(K.toggles.mainOff);
  const statusLabel = values.active ? t(K.toggles.openOn) : t(K.toggles.openOff);
  const phone = values.phone ? formatAppPhoneDigits(values.phone) : undefined;
  const defaultName = (role: (typeof BRANCH_DEFAULT_ROLES)[number]) =>
    memberOf(values.defaults[role])?.name;

  return {
    badges: [
      { id: 'name', label: name || t(K.summaryNew), tone: values.tone },
      ...(values.isMain ? [{ id: 'isMain', label: t(K.mainBadge) }] : []),
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
      missing: missingPlaceFields(values).map((field) => fieldLabel[field]),
      problems: isBranchPinIncomplete(values.pin) ? [t(K.pinInvalid)] : [],
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
          label: t(K.fields.reviewLink),
          value: values.reviewLink.trim(),
        },
        {
          kind: 'value',
          label: t(K.fields.days),
          value: format.days(values.workingDays),
        },
        { kind: 'value', label: t(K.fields.opens), value: values.opensAt },
        { kind: 'value', label: t(K.fields.closes), value: values.closesAt },
      ],
      missing: missingContactFields(values).map((field) => fieldLabel[field]),
      problems: [
        ...(isBranchPhoneIncomplete(values.phone) ? [t(K.phoneInvalid)] : []),
        ...(isBranchEmailInvalid(values.email) ? [t(K.emailInvalid)] : []),
        ...(isBranchReviewLinkInvalid(values.reviewLink) ? [t(K.reviewLinkInvalid)] : []),
      ],
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
    },
  };
}
