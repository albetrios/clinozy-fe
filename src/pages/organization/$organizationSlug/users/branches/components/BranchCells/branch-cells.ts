import type { TFunction } from 'i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';

import { USERS_KEYS } from '../../../users.constants.ts';
import type { BranchRow } from '../../hooks/useBranchRows/index.ts';

/** The Address cell's sub-line: line 2, area, city and PIN ("VIP Road, Vesu, Surat 395007"). */
export function branchAddressLine(branch: Branch): string {
  const city = [branch.city, branch.pin].filter(Boolean).join(' ');
  return [branch.addressLine2, branch.area, city].filter(Boolean).join(', ');
}

/** The Contact cell's value: "+91 74900 20099", or "—" with no phone. */
export function branchPhone(branch: Branch): string {
  return branch.phone ? formatClinicPhone(branch.phone) : '—';
}

/**
 * The Default people cell's lines (H:5199): "Doctor · Dr. Nisha Mavani" over
 * "Desk · Riya Shah · Therapist · Ridhi Sohaliya"; null when nobody is set.
 */
export function branchDefaultsLines(
  row: Pick<BranchRow, 'defaults'>,
  t: TFunction,
): { value: string; sub: string } | null {
  // The member's name isolated: it stays whole beside a right-to-left role.
  const lines = row.defaults.map(({ role, member }) =>
    t(USERS_KEYS.branches.defaults[role], { name: isolateText(member.name) }),
  );
  const [first, ...rest] = lines;
  return first ? { value: first, sub: rest.join(' · ') } : null;
}
