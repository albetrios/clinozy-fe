import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type OrganizationPermission,
  organizationPermissionSchema,
} from '@/core/types/permissions.ts';

import {
  abilitiesFor,
  applyRoleMatrixChange,
  type ClinicAccessMatrix,
  clinicRoleKeyForPlatformRole,
  clinicRolesForMember,
  fetchClinicAccessMatrix,
  matrixGrantsFor,
  membershipRoleIdFor,
  nextCustomRoleName,
  nextCustomRoleTone,
  permsFromPlatformCodes,
  platformCodesWithUsersAccess,
  platformRoleForClinicRole,
  presetForPlatformRole,
  resetClinicAccessFixture,
  resolveClinicAccess,
  saveRoleMatrixChange,
  sectionRowState,
  usersGrantsFromPlatformCodes,
  withGrantToggled,
  withRowToggled,
} from './access-api.ts';
import {
  CLINIC_ABILITIES,
  type ClinicAction,
  type ClinicRoleKey,
  FULL_GRANTS,
  MATRIX_SECTIONS,
  NO_GRANTS,
  type SectionGrants,
} from './access-contracts.ts';
import type { Role, Section } from './clinic-schema.ts';
import { ROLE_VALUES, SECTION_VALUES } from './clinic-schema.ts';

beforeEach(() => resetClinicAccessFixture());
afterEach(() => resetClinicAccessFixture());

const matrix = await fetchClinicAccessMatrix();
const accessOf = (...roles: ClinicRoleKey[]) => resolveClinicAccess(matrix, roles);

/** A custom role's clinozy-be id (`rol_` + 21). */
const CUSTOM = 'rol_customaaaaaaaaaaaaaaa';

/**
 * The permission codes clinozy-be seeds its built-in roles with
 * (`organization-provisioning.ts` › `DEFAULT_TEAM_ROLES`): Owner holds every
 * code, Admin every code but `organization:delete`.
 */
const EVERY_CODE = [...organizationPermissionSchema.options];
const SEEDED_CODES: Record<
  'Owner' | 'Admin' | 'Member' | 'Viewer',
  OrganizationPermission[]
> = {
  Owner: EVERY_CODE,
  Admin: EVERY_CODE.filter((code) => code !== 'organization:delete'),
  Member: ['organization:read', 'membership:read', 'role:read'],
  Viewer: ['organization:read', 'membership:read'],
};

const grants = (view: boolean, create: boolean, edit: boolean, del: boolean) => ({
  view,
  create,
  edit,
  delete: del,
});

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

describe('resolveClinicAccess — custom roles (Appendix F: the matrix keyed by role id)', () => {
  it('gives a custom role nothing but Today until its rows are set', () => {
    expect(accessOf(CUSTOM).viewableSections).toEqual(['today']);
  });

  it('reads a custom role’s own rows and abilities, unioned with a preset', async () => {
    await saveRoleMatrixChange({ kind: 'addCustom', key: CUSTOM, tone: 'plum' });
    await saveRoleMatrixChange({
      kind: 'section',
      key: CUSTOM,
      section: 'offerings',
      grants: grants(true, true, false, false),
    });
    await saveRoleMatrixChange({ kind: 'abilities', key: CUSTOM, abilities: ['prices'] });
    const current = await fetchClinicAccessMatrix();
    const access = resolveClinicAccess(current, ['marketing', CUSTOM]);
    expect(access.viewableSections).toEqual(['today', 'leads', 'tasks', 'offerings']);
    expect(access.can('offerings', 'create')).toBe(true);
    expect(access.can('offerings', 'edit')).toBe(false);
    expect(access.canAbility('prices')).toBe(true);
  });
});

describe('resolveClinicAccess — Users gates on clinozy-be codes (D17, §3.7)', () => {
  it.each<[keyof typeof SEEDED_CODES, SectionGrants, boolean]>([
    ['Owner', FULL_GRANTS, true],
    ['Admin', FULL_GRANTS, true],
    ['Member', grants(true, false, false, false), false],
    ['Viewer', NO_GRANTS, false],
  ])(
    'a %s’s codes decide the Users room, whatever the matrix says',
    (name, users, perms) => {
      const codes = SEEDED_CODES[name];
      for (const roles of [['doctor'], ['admin']] as Role[][]) {
        const access = resolveClinicAccess(matrix, roles, { platformCodes: codes });
        for (const action of ['view', 'create', 'edit', 'delete'] as const) {
          expect(access.can('users', action), `${roles} ${action}`).toBe(users[action]);
        }
        expect(access.viewableSections.includes('users')).toBe(users.view);
        expect(access.canAbility('perms')).toBe(perms);
      }
    },
  );

  it('leaves every other room to the matrix', () => {
    const access = resolveClinicAccess(matrix, ['doctor'], {
      platformCodes: SEEDED_CODES.Owner,
    });
    expect(access.can('medical', 'view')).toBe(false);
    expect(access.canAbility('clinical')).toBe(true);
    expect(access.canAbility('void')).toBe(false);
  });

  it('reads the matrix for Users without codes — a View-as preview', () => {
    expect(accessOf('doctor').can('users', 'view')).toBe(false);
    expect(accessOf('admin').can('users', 'create')).toBe(true);
    expect(accessOf('doctor').canAbility('perms')).toBe(false);
  });
});

describe('the matrix’s toggle rules (H:5182–5183)', () => {
  it('turns View on alone, and View off clears the other three', () => {
    expect(withGrantToggled(NO_GRANTS, 'view')).toEqual(
      grants(true, false, false, false),
    );
    expect(withGrantToggled(FULL_GRANTS, 'view')).toEqual(NO_GRANTS);
  });

  it.each<ClinicAction>(['create', 'edit', 'delete'])(
    'turns View on with %s, and leaves it on when %s goes off',
    (action) => {
      const on = withGrantToggled(NO_GRANTS, action);
      expect(on).toEqual({ ...NO_GRANTS, view: true, [action]: true });
      expect(withGrantToggled(on, action)).toEqual({ ...NO_GRANTS, view: true });
    },
  );

  it('reads the Row pill: Full, Some or None', () => {
    expect(sectionRowState(FULL_GRANTS)).toBe('full');
    expect(sectionRowState(grants(true, true, true, false))).toBe('some');
    expect(sectionRowState(grants(true, false, false, false))).toBe('some');
    expect(sectionRowState(NO_GRANTS)).toBe('none');
  });

  it('sets all four with the Row pill, or clears them when already Full', () => {
    expect(withRowToggled(NO_GRANTS)).toEqual(FULL_GRANTS);
    expect(withRowToggled(grants(true, false, true, false))).toEqual(FULL_GRANTS);
    expect(withRowToggled(FULL_GRANTS)).toEqual(NO_GRANTS);
  });
});

describe('saveRoleMatrixChange — the fixture’s updateRolePermission (S:1753)', () => {
  it('saves a row that every later read and resolve sees', async () => {
    await saveRoleMatrixChange({
      kind: 'section',
      key: 'doctor',
      section: 'medical',
      grants: grants(true, false, false, false),
    });
    const current = await fetchClinicAccessMatrix();
    expect(matrixGrantsFor(current, 'doctor').medical).toEqual(
      grants(true, false, false, false),
    );
    expect(resolveClinicAccess(current, ['doctor']).can('medical', 'view')).toBe(true);
    expect(current.permissions).toHaveLength(matrix.permissions.length);
  });

  it('saves the abilities in the switches’ order, each once', async () => {
    await saveRoleMatrixChange({
      kind: 'abilities',
      key: 'therapist',
      abilities: ['export', 'clinical', 'export'],
    });
    expect(abilitiesFor(await fetchClinicAccessMatrix(), 'therapist')).toEqual([
      'clinical',
      'export',
    ]);
  });

  it('copies another role’s access and abilities — Admin copies everything', async () => {
    await saveRoleMatrixChange({ kind: 'copy', key: 'front_desk', from: 'counsellor' });
    let current = await fetchClinicAccessMatrix();
    expect(matrixGrantsFor(current, 'front_desk')).toEqual(
      matrixGrantsFor(current, 'counsellor'),
    );
    expect(abilitiesFor(current, 'front_desk')).toEqual(['disc', 'clinical']);

    await saveRoleMatrixChange({ kind: 'copy', key: 'front_desk', from: 'admin' });
    current = await fetchClinicAccessMatrix();
    for (const section of MATRIX_SECTIONS) {
      expect(matrixGrantsFor(current, 'front_desk')[section]).toEqual(FULL_GRANTS);
    }
    expect(abilitiesFor(current, 'front_desk')).toEqual([...CLINIC_ABILITIES]);
  });

  it('adds a custom role with every row None and its tone, and drops it again', async () => {
    await saveRoleMatrixChange({ kind: 'addCustom', key: CUSTOM, tone: 'lime' });
    let current = await fetchClinicAccessMatrix();
    expect(Object.values(matrixGrantsFor(current, CUSTOM))).toEqual(
      MATRIX_SECTIONS.map(() => NO_GRANTS),
    );
    expect(current.permissions.filter((row) => row.role === CUSTOM)).toHaveLength(9);
    expect(current.customRoleTones[CUSTOM]).toBe('lime');
    expect(abilitiesFor(current, CUSTOM)).toEqual([]);

    await saveRoleMatrixChange({ kind: 'dropCustom', key: CUSTOM });
    current = await fetchClinicAccessMatrix();
    expect(current.permissions.some((row) => row.role === CUSTOM)).toBe(false);
    expect(current.customRoleTones).toEqual({});
    expect(current.abilities[CUSTOM]).toBeUndefined();
  });

  it.each<[string, Parameters<typeof saveRoleMatrixChange>[0], number]>([
    [
      'narrowing Admin',
      { kind: 'section', key: 'admin', section: 'leads', grants: NO_GRANTS },
      403,
    ],
    ['narrowing Owner', { kind: 'abilities', key: 'owner', abilities: [] }, 403],
    [
      'an action without View',
      {
        kind: 'section',
        key: 'doctor',
        section: 'leads',
        grants: grants(false, true, false, false),
      },
      422,
    ],
    [
      'an unknown ability',
      { kind: 'abilities', key: 'doctor', abilities: ['teleport' as never] },
      422,
    ],
    ['a preset added as custom', { kind: 'addCustom', key: 'doctor', tone: 'plum' }, 422],
    ['a preset dropped', { kind: 'dropCustom', key: 'doctor' }, 422],
  ])('refuses %s', async (_label, change, status) => {
    await expect(saveRoleMatrixChange(change)).rejects.toMatchObject({ status });
    expect(await fetchClinicAccessMatrix()).toEqual(matrix);
  });

  it('applies the same edit the optimistic cache does', () => {
    const change = {
      kind: 'section',
      key: 'pharmacist',
      section: 'payments',
      grants: FULL_GRANTS,
    } as const;
    const next: ClinicAccessMatrix = applyRoleMatrixChange(
      matrix,
      change,
      matrix.permissions[0]!.updatedAt,
    );
    expect(matrixGrantsFor(next, 'pharmacist').payments).toEqual(FULL_GRANTS);
    expect(matrixGrantsFor(matrix, 'pharmacist').payments).toEqual(NO_GRANTS);
  });

  it('forgets every change on reset', async () => {
    await saveRoleMatrixChange({
      kind: 'abilities',
      key: 'marketing',
      abilities: ['export'],
    });
    resetClinicAccessFixture();
    expect(await fetchClinicAccessMatrix()).toEqual(matrix);
  });
});

describe('a new custom role’s tone and name (H:5187)', () => {
  it('takes the next of plum · lime · mint · sky · peach · lav', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 13].map(nextCustomRoleTone)).toEqual([
      'plum',
      'lime',
      'mint',
      'sky',
      'peach',
      'lav',
      'plum',
      'lime',
    ]);
    expect(nextCustomRoleTone(-1)).toBe('plum');
  });

  it('is "New role", then "New role 2", "New role 3" … — the first free, any case', () => {
    expect(nextCustomRoleName('New role', ['Admin', 'Doctor'])).toBe('New role');
    expect(nextCustomRoleName('New role', ['new role'])).toBe('New role 2');
    expect(nextCustomRoleName('New role', ['New role', 'New Role 2', 'Front desk'])).toBe(
      'New role 3',
    );
  });
});

describe('clinozy-be codes ⇄ the matrix’s Users row (D17)', () => {
  it.each<[keyof typeof SEEDED_CODES, SectionGrants, boolean]>([
    ['Owner', FULL_GRANTS, true],
    ['Admin', FULL_GRANTS, true],
    ['Member', grants(true, false, false, false), false],
    ['Viewer', NO_GRANTS, false],
  ])('reads the Users row and perms of clinozy-be’s %s role', (name, users, perms) => {
    expect(usersGrantsFromPlatformCodes(SEEDED_CODES[name])).toEqual(users);
    expect(permsFromPlatformCodes(SEEDED_CODES[name])).toBe(perms);
  });

  it.each<[ClinicAction, OrganizationPermission[]]>([
    ['view', ['membership:read', 'role:read']],
    ['create', ['invitation:manage']],
    ['edit', ['membership:manage']],
    ['delete', ['membership:manage']],
  ])('maps %s to %j and nothing else', (action, codes) => {
    expect(usersGrantsFromPlatformCodes(codes)[action]).toBe(true);
    const lone = usersGrantsFromPlatformCodes(codes);
    expect(
      Object.entries(lone)
        .filter(([, on]) => on)
        .map(([key]) => key),
    ).toEqual(action === 'edit' || action === 'delete' ? ['edit', 'delete'] : [action]);
  });

  it('needs both View codes for View', () => {
    expect(usersGrantsFromPlatformCodes(['membership:read']).view).toBe(false);
    expect(usersGrantsFromPlatformCodes(['role:read']).view).toBe(false);
  });

  it('writes a row as codes, keeping every code the matrix doesn’t map', () => {
    const next = platformCodesWithUsersAccess(
      SEEDED_CODES.Admin,
      grants(true, false, false, false),
      true,
    );
    expect(new Set(next)).toEqual(
      new Set(
        SEEDED_CODES.Admin.filter(
          (code) => code !== 'invitation:manage' && code !== 'membership:manage',
        ),
      ),
    );
    expect(next).toContain('api-key:manage');
    expect(next).toContain('subscription:manage');
  });

  it('turns "Change roles & access" into role:manage, and only that', () => {
    const on = platformCodesWithUsersAccess(SEEDED_CODES.Viewer, NO_GRANTS, true);
    expect(on).toEqual(['organization:read', 'role:manage']);
    const off = platformCodesWithUsersAccess(SEEDED_CODES.Admin, FULL_GRANTS, false);
    expect(off).not.toContain('role:manage');
    expect(off).toContain('role:read');
  });

  it('clears every Users code when View goes off, whatever else is asked', () => {
    const next = platformCodesWithUsersAccess(
      SEEDED_CODES.Admin,
      grants(false, true, true, true),
      false,
    );
    for (const code of [
      'membership:read',
      'role:read',
      'invitation:manage',
      'membership:manage',
      'role:manage',
    ] as const) {
      expect(next).not.toContain(code);
    }
    expect(next).toContain('organization:read');
  });

  it('writes Edit or Delete as membership:manage, so the two read back together', () => {
    const editOnly = platformCodesWithUsersAccess(
      ['organization:read'],
      grants(true, false, true, false),
      false,
    );
    expect(editOnly).toEqual([
      'organization:read',
      'membership:read',
      'role:read',
      'membership:manage',
    ]);
    expect(usersGrantsFromPlatformCodes(editOnly)).toEqual(
      grants(true, false, true, true),
    );
  });

  it.each<SectionGrants>([
    NO_GRANTS,
    grants(true, false, false, false),
    grants(true, true, false, false),
    grants(true, false, true, true),
    FULL_GRANTS,
  ])('round-trips the Users row %j', (row) => {
    for (const perms of [true, false]) {
      const codes = platformCodesWithUsersAccess(['organization:read'], row, perms);
      expect(usersGrantsFromPlatformCodes(codes)).toEqual(row);
      expect(permsFromPlatformCodes(codes)).toBe(perms);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});

describe('clinozy-be roles ⇄ clinic roles', () => {
  it.each<[string, Role | null]>([
    ['Owner', 'owner'],
    ['Admin', 'admin'],
    ['Doctor', 'doctor'],
    ['Therapist', 'therapist'],
    ['Front desk', 'front_desk'],
    ['  front DESK ', 'front_desk'],
    ['Counsellor', 'counsellor'],
    ['Pharmacist', 'pharmacist'],
    ['Accountant', 'accountant'],
    ['Marketing', 'marketing'],
    ['Member', null],
    ['Viewer', null],
    ['Senior desk', null],
  ])('reads the clinozy-be role "%s" as %s', (name, preset) => {
    expect(presetForPlatformRole({ name })).toBe(preset);
  });

  it.each<[string, { name: string; isSystem?: boolean }, ClinicRoleKey | null]>([
    ['a preset by name', { name: 'Doctor', isSystem: false }, 'doctor'],
    ['the system Admin', { name: 'Admin', isSystem: true }, 'admin'],
    ['the system Owner', { name: 'Owner', isSystem: true }, 'owner'],
    ['a custom role, by its id', { name: 'Senior desk', isSystem: false }, CUSTOM],
    ['the platform-only Member', { name: 'Member', isSystem: true }, null],
    ['the platform-only Viewer', { name: 'Viewer', isSystem: true }, null],
    ['an unknown kind — least privilege', { name: 'Senior desk' }, null],
  ])('grants %s', (_label, role, key) => {
    expect(clinicRoleKeyForPlatformRole({ id: CUSTOM, ...role })).toBe(key);
  });

  const platformRoles = [
    { id: 'rol_owneraaaaaaaaaaaaaaaa', name: 'Owner', isSystem: true },
    { id: 'rol_adminaaaaaaaaaaaaaaaa', name: 'Admin', isSystem: true },
    { id: 'rol_memberaaaaaaaaaaaaaaa', name: 'Member', isSystem: true },
    { id: 'rol_doctoraaaaaaaaaaaaaaa', name: 'Doctor', isSystem: false },
    { id: CUSTOM, name: 'Senior desk', isSystem: false },
  ];

  it('finds the clinozy-be role behind a clinic role, and none for an unseeded one', () => {
    expect(platformRoleForClinicRole('admin', platformRoles)?.id).toBe(
      'rol_adminaaaaaaaaaaaaaaaa',
    );
    expect(platformRoleForClinicRole('doctor', platformRoles)?.id).toBe(
      'rol_doctoraaaaaaaaaaaaaaa',
    );
    expect(platformRoleForClinicRole(CUSTOM, platformRoles)?.name).toBe('Senior desk');
    expect(platformRoleForClinicRole('front_desk', platformRoles)).toBeNull();
    expect(
      platformRoleForClinicRole('rol_goneaaaaaaaaaaaaaaaaa', platformRoles),
    ).toBeNull();
  });

  it.each<[ClinicRoleKey[], string | null]>([
    [['front_desk', 'admin'], 'rol_adminaaaaaaaaaaaaaaaa'],
    [['admin'], 'rol_adminaaaaaaaaaaaaaaaa'],
    [['doctor', 'therapist'], 'rol_doctoraaaaaaaaaaaaaaa'],
    [[CUSTOM, 'doctor'], CUSTOM],
    [['front_desk', 'admin', 'owner'], 'rol_owneraaaaaaaaaaaaaaaa'],
    [['front_desk', 'doctor'], null],
    [[], null],
  ])(
    'holds %j on the membership as %s (the owner keeps Owner; Admin when picked; else the main role)',
    (keys, id) => {
      expect(membershipRoleIdFor(keys, platformRoles)).toBe(id);
    },
  );
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

  it.each<[string, { name: string; isSystem?: boolean }, ClinicRoleKey[]]>([
    ['Owner', { name: 'Owner', isSystem: true }, ['owner']],
    ['Admin', { name: 'Admin', isSystem: true }, ['admin']],
    ['a seeded Pharmacist', { name: 'Pharmacist', isSystem: false }, ['pharmacist']],
    ['a custom role', { name: 'Senior desk', isSystem: false }, [CUSTOM]],
    ['Member', { name: 'Member', isSystem: true }, []],
    ['Viewer', { name: 'Viewer', isSystem: true }, []],
  ])(
    'reads a member whose platform role is %s, without a profile',
    (_label, role, keys) => {
      expect(clinicRolesForMember({ platformRole: { id: CUSTOM, ...role } })).toEqual(
        keys,
      );
    },
  );

  it('adds the platform role’s clinic role after the profile’s, once', () => {
    const admin = { id: 'rol_adminaaaaaaaaaaaaaaaa', name: 'Admin', isSystem: true };
    expect(
      clinicRolesForMember({ staffRoles: ['front_desk', 'admin'], platformRole: admin }),
    ).toEqual(['front_desk', 'admin']);
    expect(clinicRolesForMember({ staffRoles: ['doctor'], platformRole: admin })).toEqual(
      ['doctor', 'admin'],
    );
    expect(
      clinicRolesForMember({
        staffRoles: [CUSTOM],
        platformRole: {
          id: 'rol_memberaaaaaaaaaaaaaaa',
          name: 'Member',
          isSystem: true,
        },
      }),
    ).toEqual([CUSTOM]);
  });
});
