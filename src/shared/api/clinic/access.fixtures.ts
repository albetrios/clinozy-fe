import { fixtureUuid, seedCommon } from './clinic-fixture-seed.ts';
import type { Role, RolePermission, Section } from './clinic-schema.ts';

/**
 * The clinic access matrix the rooms gate on until clinozy-be issues clinic
 * permission codes (D9, REPLACE_WITH_API): the prototype's seeded matrix
 * (US_PERM0, H:3605–3606) with the plan's per-room decisions — Owner full,
 * Marketing on Leads (Q-L5), Payments for Front desk / Accountant / Counsellor
 * (Q-G4), Stock use for Therapist and Front desk (Q-K2), Tasks for every role
 * (S:95), Counsellor viewing Offerings (Q-O1). Today is always shown.
 */
type Grant = 'view' | 'create' | 'edit' | 'delete';
const FULL: readonly Grant[] = ['view', 'create', 'edit', 'delete'];
const WRITE: readonly Grant[] = ['view', 'create', 'edit'];

const GRANTS: Readonly<Record<Role, Partial<Record<Section, readonly Grant[]>>>> = {
  owner: {
    today: FULL,
    leads: FULL,
    appointments: FULL,
    patients: FULL,
    medical: FULL,
    stock: FULL,
    payments: FULL,
    tasks: FULL,
    offerings: FULL,
    users: FULL,
  },
  admin: {
    today: FULL,
    leads: FULL,
    appointments: FULL,
    patients: FULL,
    medical: FULL,
    stock: FULL,
    payments: FULL,
    tasks: FULL,
    offerings: FULL,
    users: FULL,
  },
  doctor: {
    today: ['view'],
    leads: WRITE,
    appointments: WRITE,
    patients: WRITE,
    tasks: WRITE,
  },
  therapist: {
    today: ['view'],
    appointments: ['view'],
    patients: ['view'],
    tasks: ['view'],
    stock: ['view', 'create'],
  },
  front_desk: {
    today: ['view'],
    leads: WRITE,
    appointments: WRITE,
    patients: WRITE,
    payments: WRITE,
    tasks: WRITE,
    stock: ['view', 'create'],
  },
  counsellor: {
    today: ['view'],
    leads: WRITE,
    appointments: WRITE,
    patients: WRITE,
    payments: WRITE,
    tasks: WRITE,
    offerings: ['view'],
  },
  pharmacist: {
    today: ['view'],
    medical: WRITE,
    stock: WRITE,
    patients: WRITE,
    tasks: ['view'],
  },
  accountant: {
    today: ['view'],
    payments: WRITE,
    medical: ['view'],
    stock: ['view'],
    tasks: ['view'],
  },
  marketing: { today: ['view'], leads: WRITE, tasks: ['view'] },
};

const SECTIONS: readonly Section[] = [
  'today',
  'leads',
  'appointments',
  'patients',
  'medical',
  'stock',
  'payments',
  'tasks',
  'offerings',
  'users',
];

/** The matrix as the contract's `RolePermission` rows (one per role × section). */
export const accessMatrixFixture: readonly RolePermission[] = (
  Object.keys(GRANTS) as Role[]
).flatMap((role) =>
  SECTIONS.map((section) => {
    const grants = GRANTS[role][section] ?? [];
    return {
      ...seedCommon('2026-01-01T00:00:00.000Z'),
      id: fixtureUuid('role-permission', `${role}:${section}`),
      role,
      section,
      canView: grants.includes('view'),
      canCreate: grants.includes('create'),
      canEdit: grants.includes('edit'),
      canDelete: grants.includes('delete'),
    };
  }),
);

/** Abilities per role (US_ABIL0, H:3577); Admin and Owner hold every one. */
export const abilitiesFixture = {
  doctor: ['disc', 'export', 'clinical', 'allbr'],
  therapist: ['clinical'],
  front_desk: ['dayclose', 'refund'],
  counsellor: ['disc', 'clinical'],
  pharmacist: ['export', 'void'],
  accountant: ['dayclose', 'reverse', 'export', 'floor', 'refund', 'allbr'],
  marketing: [],
} as const;
