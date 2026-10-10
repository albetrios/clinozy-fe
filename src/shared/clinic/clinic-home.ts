import { CLINIC_MODULES } from '@/core/config/clinic-modules.ts';
import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import {
  clinicRolesForMember,
  fetchClinicAccessMatrix,
  resolveMemberClinicAccess,
} from '@/shared/api/clinic/access-api.ts';
import {
  type ClinicRoleKey,
  isPresetRole,
} from '@/shared/api/clinic/access-contracts.ts';
import type { Role, Section } from '@/shared/api/clinic/clinic-schema.ts';
import { fetchMyStaffProfile } from '@/shared/api/clinic/users-api.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { CLINIC_SECTION_ORDER } from './clinic-sections.ts';

/**
 * Each room's route. `/medical` and `/stock` redirect to their first tab, so
 * a link to the room always lands somewhere real.
 */
export const CLINIC_SECTION_ROUTES = {
  today: '/organization/$organizationSlug/today',
  leads: '/organization/$organizationSlug/leads',
  appointments: '/organization/$organizationSlug/appointments',
  patients: '/organization/$organizationSlug/patients',
  medical: '/organization/$organizationSlug/medical',
  stock: '/organization/$organizationSlug/stock',
  payments: '/organization/$organizationSlug/payments',
  tasks: '/organization/$organizationSlug/tasks',
  offerings: '/organization/$organizationSlug/offerings',
  users: '/organization/$organizationSlug/users',
} as const satisfies Record<Section, string>;

/** The rooms D25 names as homes; every other role lands on Today. */
const ROLE_HOME: Readonly<Partial<Record<Role, Section>>> = {
  pharmacist: 'medical',
  accountant: 'payments',
  marketing: 'leads',
};

/**
 * Where a member lands (D25): their main role's home — Pharmacist Medical
 * (sales), Accountant Payments, Marketing Leads, everyone else (a custom role
 * included) Today — or, when that room is closed to them, the first open room
 * in nav order. Null when no clinic room is open at all.
 */
export function clinicHomeSection(
  roles: readonly ClinicRoleKey[],
  isOpen: (section: Section) => boolean,
): Section | null {
  const [mainRole] = roles;
  const preferred =
    (mainRole && isPresetRole(mainRole) && ROLE_HOME[mainRole]) || 'today';
  if (isOpen(preferred)) return preferred;
  return CLINIC_SECTION_ORDER.find(isOpen) ?? null;
}

/**
 * The signed-in member's home route in this organization — the org index and
 * an unknown in-org path send them here (`S:115`). Uses the access in force —
 * `resolveMemberClinicAccess`: a room on clinozy-be by their codes, a room on
 * fixtures by their staff profile's roles, View-as included — and the
 * deployment's enabled modules; null when no
 * clinic room is open, and the org home shows its "nothing is switched on"
 * state instead (L-63).
 */
export async function clinicHomeRoute(organizationSlug: string) {
  const { permissions } = useOrganizationStore.getState();
  const { previewRole } = useUIStore.getState();
  const email = useAuthStore.getState().user?.email ?? null;
  const roles = previewRole
    ? [previewRole]
    : clinicRolesForMember({
        staffRoles: (await fetchMyStaffProfile(email))?.roleKeys ?? null,
        permissions,
      });
  const access = resolveMemberClinicAccess({
    matrix: await fetchClinicAccessMatrix(),
    roleKeys: roles,
    permissions,
    previewing: Boolean(previewRole),
  });
  const section = clinicHomeSection(
    roles,
    (candidate) =>
      isModuleEnabled(CLINIC_MODULES[candidate]) && access.can(candidate, 'view'),
  );
  return section
    ? { to: CLINIC_SECTION_ROUTES[section], params: { organizationSlug } }
    : null;
}
