import { CLINIC_SECTION_ORDER } from '@/shared/clinic/clinic-sections.ts';

import { abilitiesFixture, accessMatrixFixture } from './access.fixtures.ts';
import type { Role, RolePermission, Section } from './clinic-schema.ts';

/** The eleven clinic abilities (US_ABIL, H:3576; plan addition, Appendix F). */
export const CLINIC_ABILITIES = [
  'disc',
  'floor',
  'prices',
  'dayclose',
  'reverse',
  'refund',
  'void',
  'allbr',
  'clinical',
  'export',
  'perms',
] as const;

/** One clinic ability (Q-U8 lists where each is enforced). */
export type ClinicAbility = (typeof CLINIC_ABILITIES)[number];

/** A matrix action on a section. */
export type ClinicAction = 'view' | 'create' | 'edit' | 'delete';

/** The access matrix and the abilities granted per role. */
export interface ClinicAccessMatrix {
  permissions: readonly RolePermission[];
  abilities: Readonly<Partial<Record<Role, readonly ClinicAbility[]>>>;
}

/** TanStack Query keys for the clinic access matrix. */
export const clinicAccessQueryKeys = {
  all: ['clinic', 'access'] as const,
  matrix: () => [...clinicAccessQueryKeys.all, 'matrix'] as const,
};

/** Read the matrix. REPLACE_WITH_API: `getSession` returns RolePermission rows. */
export async function fetchClinicAccessMatrix(): Promise<ClinicAccessMatrix> {
  return structuredClone({
    permissions: accessMatrixFixture,
    abilities: abilitiesFixture,
  });
}

/** What a set of clinic roles may do — the union across the roles. */
export interface ResolvedClinicAccess {
  can: (section: Section, action: ClinicAction) => boolean;
  canAbility: (ability: ClinicAbility) => boolean;
  /** Sections with View, in nav order; Today always. */
  viewableSections: Section[];
}

const FULL_ACCESS_ROLES: ReadonlySet<Role> = new Set<Role>(['owner', 'admin']);

const GRANT_FIELD = {
  view: 'canView',
  create: 'canCreate',
  edit: 'canEdit',
  delete: 'canDelete',
} as const satisfies Record<ClinicAction, keyof RolePermission>;

/** Resolve the access of `roles` against a matrix (Admin and Owner pass everything). */
export function resolveClinicAccess(
  matrix: ClinicAccessMatrix,
  roles: readonly Role[],
): ResolvedClinicAccess {
  const full = roles.some((role) => FULL_ACCESS_ROLES.has(role));
  const rows = matrix.permissions.filter((row) => roles.includes(row.role));
  const can = (section: Section, action: ClinicAction): boolean => {
    if (full) return true;
    if (section === 'today' && action === 'view') return true;
    return rows.some((row) => row.section === section && row[GRANT_FIELD[action]]);
  };
  const abilities = new Set(roles.flatMap((role) => matrix.abilities[role] ?? []));
  return {
    can,
    canAbility: (ability) => full || abilities.has(ability),
    viewableSections: CLINIC_SECTION_ORDER.filter((section) => can(section, 'view')),
  };
}

/**
 * A member's clinic roles: their staff profile's roles when the Users room has
 * joined one (L-31), else least privilege from the platform permissions — the
 * org owner (`organization:delete`) → Owner, role or membership managers →
 * Admin, anyone else → no clinic role, so Today only. The org owner keeps Owner
 * on top of any profile roles.
 */
export function clinicRolesForMember(input: {
  staffRoles?: readonly Role[] | null;
  permissions: readonly string[];
}): Role[] {
  if (input.staffRoles && input.staffRoles.length > 0) {
    const roles = [...input.staffRoles];
    if (input.permissions.includes('organization:delete') && !roles.includes('owner')) {
      roles.push('owner');
    }
    return roles;
  }
  if (input.permissions.includes('organization:delete')) return ['owner'];
  if (
    input.permissions.includes('role:manage') ||
    input.permissions.includes('membership:manage')
  ) {
    return ['admin'];
  }
  return [];
}
