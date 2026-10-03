import { describe, expect, it } from 'vitest';

import {
  CLINIC_ABILITIES,
  type ClinicAction,
  clinicRolesForMember,
  fetchClinicAccessMatrix,
  resolveClinicAccess,
} from './access-api.ts';
import type { Role, Section } from './clinic-schema.ts';
import { ROLE_VALUES, SECTION_VALUES } from './clinic-schema.ts';

const matrix = await fetchClinicAccessMatrix();
const accessOf = (...roles: Role[]) => resolveClinicAccess(matrix, roles);

describe('the access matrix fixture', () => {
  it('has one row per role and section, with unique ids', () => {
    expect(matrix.permissions).toHaveLength(ROLE_VALUES.length * SECTION_VALUES.length);
    expect(new Set(matrix.permissions.map((row) => row.id)).size).toBe(
      matrix.permissions.length,
    );
  });

  it('never grants an action without View', () => {
    for (const row of matrix.permissions) {
      if (row.canCreate || row.canEdit || row.canDelete) expect(row.canView).toBe(true);
    }
  });

  it('is a copy — a caller cannot edit the seed', async () => {
    const copy = await fetchClinicAccessMatrix();
    copy.permissions[0]!.canView = !copy.permissions[0]!.canView;
    expect((await fetchClinicAccessMatrix()).permissions[0]).toEqual(
      matrix.permissions[0],
    );
  });
});

describe('resolveClinicAccess — what each role views (KICKOFF §6, nav order)', () => {
  it.each<[Role, Section[]]>([
    ['owner', [...SECTION_VALUES]],
    ['admin', [...SECTION_VALUES]],
    ['doctor', ['today', 'leads', 'appointments', 'patients', 'tasks']],
    ['therapist', ['today', 'appointments', 'patients', 'stock', 'tasks']],
    [
      'front_desk',
      ['today', 'leads', 'appointments', 'patients', 'stock', 'payments', 'tasks'],
    ],
    [
      'counsellor',
      ['today', 'leads', 'appointments', 'patients', 'payments', 'tasks', 'offerings'],
    ],
    ['pharmacist', ['today', 'patients', 'medical', 'stock', 'tasks']],
    ['accountant', ['today', 'medical', 'stock', 'payments', 'tasks']],
    ['marketing', ['today', 'leads', 'tasks']],
  ])('%s', (role, sections) => {
    expect(accessOf(role).viewableSections).toEqual(sections);
  });

  it('shows Today alone to a member with no clinic role', () => {
    expect(accessOf().viewableSections).toEqual(['today']);
    expect(accessOf().can('today', 'create')).toBe(false);
  });
});

describe('resolveClinicAccess — create, edit and delete per room', () => {
  it.each<[Role, Section, ClinicAction, boolean]>([
    // Leads (§6.3): V/C/E Admin, Doctor, Front desk, Counsellor, Marketing; Delete Admin.
    ['marketing', 'leads', 'create', true],
    ['doctor', 'leads', 'edit', true],
    ['counsellor', 'leads', 'delete', false],
    // Appointments (§6.4): Therapist View only.
    ['therapist', 'appointments', 'view', true],
    ['therapist', 'appointments', 'edit', false],
    ['front_desk', 'appointments', 'create', true],
    // Patients (§6.5): create and edit without Therapist; no Accountant, no Marketing.
    ['pharmacist', 'patients', 'create', true],
    ['therapist', 'patients', 'create', false],
    ['accountant', 'patients', 'view', false],
    ['marketing', 'patients', 'view', false],
    ['doctor', 'patients', 'delete', false],
    // Medical (§6.7): C/E Admin, Pharmacist; Accountant View.
    ['pharmacist', 'medical', 'edit', true],
    ['accountant', 'medical', 'create', false],
    ['front_desk', 'medical', 'view', false],
    // Clinic stock (§6.8, Q-K2): Therapist and Front desk View and use.
    ['therapist', 'stock', 'create', true],
    ['front_desk', 'stock', 'edit', false],
    ['pharmacist', 'stock', 'edit', true],
    ['accountant', 'stock', 'create', false],
    // Payments (§6.9): Front desk, Accountant, Counsellor V/C/E; Delete Admin.
    ['accountant', 'payments', 'edit', true],
    ['counsellor', 'payments', 'create', true],
    ['front_desk', 'payments', 'delete', false],
    ['doctor', 'payments', 'view', false],
    // Tasks (§6.10): every role views; New task for Doctor, Front desk, Counsellor.
    ['pharmacist', 'tasks', 'view', true],
    ['therapist', 'tasks', 'create', false],
    ['doctor', 'tasks', 'create', true],
    // Offerings (§6.11, Q-O1): Counsellor View.
    ['counsellor', 'offerings', 'view', true],
    ['counsellor', 'offerings', 'edit', false],
    // Users (§6.12): Admin by default.
    ['doctor', 'users', 'view', false],
    ['admin', 'users', 'delete', true],
    ['owner', 'medical', 'delete', true],
  ])('%s · %s · %s → %s', (role, section, action, expected) => {
    expect(accessOf(role).can(section, action)).toBe(expected);
  });

  it('is the union across a member’s roles', () => {
    const access = accessOf('therapist', 'pharmacist');
    expect(access.can('patients', 'create')).toBe(true);
    expect(access.can('appointments', 'view')).toBe(true);
    expect(access.can('appointments', 'edit')).toBe(false);
    expect(access.viewableSections).toEqual([
      'today',
      'appointments',
      'patients',
      'medical',
      'stock',
      'tasks',
    ]);
  });
});

describe('resolveClinicAccess — abilities (US_ABIL0, Q-U8)', () => {
  it.each<[Role, string[]]>([
    ['doctor', ['allbr', 'clinical', 'disc', 'export']],
    ['therapist', ['clinical']],
    ['front_desk', ['dayclose', 'refund']],
    ['counsellor', ['clinical', 'disc']],
    ['pharmacist', ['export', 'void']],
    ['accountant', ['allbr', 'dayclose', 'export', 'floor', 'refund', 'reverse']],
    ['marketing', []],
  ])('%s', (role, abilities) => {
    const access = accessOf(role);
    expect(
      CLINIC_ABILITIES.filter((ability) => access.canAbility(ability)).sort(),
    ).toEqual(abilities);
  });

  it('gives Admin and Owner every ability, including perms and prices', () => {
    for (const role of ['admin', 'owner'] as const) {
      expect(
        CLINIC_ABILITIES.every((ability) => accessOf(role).canAbility(ability)),
      ).toBe(true);
    }
  });

  it('unions abilities across roles', () => {
    const access = accessOf('front_desk', 'counsellor');
    expect(access.canAbility('refund')).toBe(true);
    expect(access.canAbility('disc')).toBe(true);
    expect(access.canAbility('void')).toBe(false);
  });
});

describe('clinicRolesForMember', () => {
  it('uses the staff profile roles when there are some', () => {
    expect(clinicRolesForMember({ staffRoles: ['doctor'], permissions: [] })).toEqual([
      'doctor',
    ]);
  });

  it('keeps Owner on top of the profile roles for the org owner', () => {
    expect(
      clinicRolesForMember({
        staffRoles: ['doctor'],
        permissions: ['organization:delete'],
      }),
    ).toEqual(['doctor', 'owner']);
  });

  it.each<[string[], Role[]]>([
    [['organization:read', 'organization:delete'], ['owner']],
    [['organization:read', 'role:manage'], ['admin']],
    [['organization:read', 'membership:manage'], ['admin']],
    [['organization:read', 'membership:read'], []],
    [[], []],
  ])('maps platform permissions %j to %j without a profile', (permissions, roles) => {
    expect(clinicRolesForMember({ staffRoles: null, permissions })).toEqual(roles);
  });
});
