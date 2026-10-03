import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { CLINIC_SECTION_ORDER } from '@/shared/clinic/clinic-sections.ts';

import { abilitiesFixture, accessMatrixFixture } from './access.fixtures.ts';
import {
  CLINIC_ABILITIES,
  CLINIC_ACTIONS,
  CLINIC_ROLE_PLATFORM_NAMES,
  type ClinicAbility,
  clinicAbilitySchema,
  type ClinicAction,
  type ClinicRoleKey,
  type ClinicRolePermission,
  CUSTOM_ROLE_TONES,
  FULL_GRANTS,
  isPresetRole,
  MATRIX_SECTIONS,
  type MatrixGrants,
  type MatrixSection,
  NO_GRANTS,
  type SectionGrants,
} from './access-contracts.ts';
import { fixtureUuid, seedCommon } from './clinic-fixture-seed.ts';
import { clinicHttpError } from './clinic-fixture-store.ts';
import type { Role, Section, Tone } from './clinic-schema.ts';

/*
 * Clinic access (KICKOFF §3.7, D9, D17): the role × section matrix and the
 * abilities — a fixture until clinozy-be serves them (REPLACE_WITH_API) — the
 * matrix's toggle rules, the resolver the rooms gate on, and the mapping
 * between clinozy-be's roles and permission codes and the clinic's roles.
 */

/** The access matrix and the abilities granted per role. */
export interface ClinicAccessMatrix {
  /** One row per role and section: the presets', and each custom role's the fixture knows. */
  permissions: readonly ClinicRolePermission[];
  /** Abilities per role key. Admin and Owner hold every one without being listed. */
  abilities: Readonly<Record<string, readonly ClinicAbility[]>>;
  /** Each custom role's tone; a preset takes `ROLE_TONES` (backend roles carry none, Appendix F). */
  customRoleTones: Readonly<Record<string, Tone>>;
}

/** TanStack Query keys for the clinic access matrix. */
export const clinicAccessQueryKeys = {
  all: ['clinic', 'access'] as const,
  matrix: () => [...clinicAccessQueryKeys.all, 'matrix'] as const,
};

// REPLACE_WITH_API: the matrix lives on clinozy-be (`listRolePermissions`,
// `updateRolePermission`, S:1748, 1753; abilities and custom roles, Appendix
// F); until then, this session — seeded from US_PERM0 / US_ABIL0.
let stored: ClinicAccessMatrix | null = null;

function matrixInForce(): ClinicAccessMatrix {
  stored ??= structuredClone({
    permissions: accessMatrixFixture,
    abilities: abilitiesFixture,
    customRoleTones: {},
  });
  return stored;
}

/** Read the matrix. REPLACE_WITH_API: `listRolePermissions` (S:1748) and the abilities. */
export async function fetchClinicAccessMatrix(): Promise<ClinicAccessMatrix> {
  return structuredClone(matrixInForce());
}

/** Forget every change to the matrix (tests). */
export function resetClinicAccessFixture(): void {
  stored = null;
}

// ── Roles that are always full ──

const FULL_ACCESS_ROLES: ReadonlySet<string> = new Set<Role>(['owner', 'admin']);

/** Whether a role is always full — Admin and Owner can't be narrowed (`users.md:77`). */
export function isFullAccessRole(key: ClinicRoleKey): boolean {
  return FULL_ACCESS_ROLES.has(key);
}

// ── Reading one role ──

const GRANT_FIELD = {
  view: 'canView',
  create: 'canCreate',
  edit: 'canEdit',
  delete: 'canDelete',
} as const satisfies Record<ClinicAction, keyof ClinicRolePermission>;

/** A matrix row's four boxes. */
function grantsOfRow(row: ClinicRolePermission | undefined): SectionGrants {
  if (!row) return { ...NO_GRANTS };
  return {
    view: row.canView,
    create: row.canCreate,
    edit: row.canEdit,
    delete: row.canDelete,
  };
}

/** A role's grants on each of the nine sections — Admin and Owner everything, a role without rows nothing. */
export function matrixGrantsFor(
  matrix: ClinicAccessMatrix,
  key: ClinicRoleKey,
): MatrixGrants {
  const full = isFullAccessRole(key);
  return Object.fromEntries(
    MATRIX_SECTIONS.map((section) => [
      section,
      full
        ? { ...FULL_GRANTS }
        : grantsOfRow(
            matrix.permissions.find((row) => row.role === key && row.section === section),
          ),
    ]),
  ) as MatrixGrants;
}

/** A role's abilities in the switches' order — Admin and Owner every one. */
export function abilitiesFor(
  matrix: ClinicAccessMatrix,
  key: ClinicRoleKey,
): ClinicAbility[] {
  if (isFullAccessRole(key)) return [...CLINIC_ABILITIES];
  const held = new Set(matrix.abilities[key] ?? []);
  return CLINIC_ABILITIES.filter((ability) => held.has(ability));
}

// ── The matrix's toggle rules (H:5182–5183) ──

/** A box toggled the way the matrix toggles it: View off clears the other three; any other on turns View on. */
export function withGrantToggled(
  grants: SectionGrants,
  action: ClinicAction,
): SectionGrants {
  const on = !grants[action];
  if (action === 'view') return on ? { ...grants, view: true } : { ...NO_GRANTS };
  return { ...grants, [action]: on, view: on || grants.view };
}

/** The Row pill: "Full" (all four on), "None" (no View) or "Some". */
export function sectionRowState(grants: SectionGrants): 'full' | 'some' | 'none' {
  if (CLINIC_ACTIONS.every((action) => grants[action])) return 'full';
  return grants.view ? 'some' : 'none';
}

/** The Row pill clicked: all four on — or all four off when the row is already Full. */
export function withRowToggled(grants: SectionGrants): SectionGrants {
  return sectionRowState(grants) === 'full' ? { ...NO_GRANTS } : { ...FULL_GRANTS };
}

// ── Writes ──

/**
 * One change to the matrix: a section's boxes, a role's abilities, a copy of
 * another role's access ("Copy access from"), or a custom role's rows added
 * ("New role") or dropped (its role deleted).
 */
export type RoleMatrixChange =
  | { kind: 'section'; key: ClinicRoleKey; section: MatrixSection; grants: SectionGrants }
  | { kind: 'abilities'; key: ClinicRoleKey; abilities: readonly ClinicAbility[] }
  | { kind: 'copy'; key: ClinicRoleKey; from: ClinicRoleKey }
  | { kind: 'addCustom'; key: ClinicRoleKey; tone: Tone }
  | { kind: 'dropCustom'; key: ClinicRoleKey };

const rowId = (key: ClinicRoleKey, section: Section) =>
  fixtureUuid('role-permission', `${key}:${section}`);

/** The rows with one role's grants on one section set (a missing row is added). */
function withSectionRow(
  permissions: readonly ClinicRolePermission[],
  key: ClinicRoleKey,
  section: MatrixSection,
  grants: SectionGrants,
  now: string,
): ClinicRolePermission[] {
  const fields = {
    canView: grants.view,
    canCreate: grants.create,
    canEdit: grants.edit,
    canDelete: grants.delete,
  };
  const at = permissions.findIndex((row) => row.role === key && row.section === section);
  if (at < 0) {
    return [
      ...permissions,
      { ...seedCommon(now), id: rowId(key, section), role: key, section, ...fields },
    ];
  }
  return permissions.map((row, index) =>
    index === at ? { ...row, ...fields, updatedAt: now } : row,
  );
}

/** The rows with one role's whole matrix set. */
function withMatrix(
  permissions: readonly ClinicRolePermission[],
  key: ClinicRoleKey,
  grants: MatrixGrants,
  now: string,
): ClinicRolePermission[] {
  return MATRIX_SECTIONS.reduce<ClinicRolePermission[]>(
    (rows, section) => withSectionRow(rows, key, section, grants[section], now),
    [...permissions],
  );
}

/** A record without one key. */
const withoutKey = <T>(
  record: Readonly<Record<string, T>>,
  key: string,
): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

/** Abilities in the switches' order, each once. */
const orderedAbilities = (abilities: readonly ClinicAbility[]): ClinicAbility[] =>
  CLINIC_ABILITIES.filter((ability) => abilities.includes(ability));

const NONE_ANYWHERE = Object.fromEntries(
  MATRIX_SECTIONS.map((section) => [section, { ...NO_GRANTS }]),
) as MatrixGrants;

/**
 * The matrix after a change — pure, so the fixture server and the optimistic
 * cache apply exactly the same edit. `now` stamps the rows it touches.
 */
export function applyRoleMatrixChange(
  matrix: ClinicAccessMatrix,
  change: RoleMatrixChange,
  now: string = new Date().toISOString(),
): ClinicAccessMatrix {
  switch (change.kind) {
    case 'section':
      return {
        ...matrix,
        permissions: withSectionRow(
          matrix.permissions,
          change.key,
          change.section,
          change.grants,
          now,
        ),
      };
    case 'abilities':
      return {
        ...matrix,
        abilities: {
          ...matrix.abilities,
          [change.key]: orderedAbilities(change.abilities),
        },
      };
    case 'copy':
      return {
        ...matrix,
        permissions: withMatrix(
          matrix.permissions,
          change.key,
          matrixGrantsFor(matrix, change.from),
          now,
        ),
        abilities: {
          ...matrix.abilities,
          [change.key]: abilitiesFor(matrix, change.from),
        },
      };
    case 'addCustom':
      return {
        permissions: withMatrix(matrix.permissions, change.key, NONE_ANYWHERE, now),
        abilities: { ...matrix.abilities, [change.key]: [] },
        customRoleTones: { ...matrix.customRoleTones, [change.key]: change.tone },
      };
    case 'dropCustom':
      return {
        permissions: matrix.permissions.filter((row) => row.role !== change.key),
        abilities: withoutKey(matrix.abilities, change.key),
        customRoleTones: withoutKey(matrix.customRoleTones, change.key),
      };
  }
}

/** Refuse what clinozy-be will refuse: a full role narrowed, an action without View, a preset treated as custom. */
function refuseMatrixChange(change: RoleMatrixChange): void {
  if (isFullAccessRole(change.key)) {
    throw clinicHttpError(403, 'permission', 'Admins always have full access');
  }
  if (change.kind === 'section') {
    const { view, create, edit } = change.grants;
    if (!view && (create || edit || change.grants.delete)) {
      const message = 'Create, Edit and Delete need View';
      throw clinicHttpError(422, 'validation', message, { grants: [message] });
    }
  }
  if (change.kind === 'abilities') {
    const parsed = clinicAbilitySchema.array().safeParse(change.abilities);
    if (!parsed.success) {
      throw clinicHttpError(422, 'validation', 'Unknown ability', {
        abilities: ['Unknown ability'],
      });
    }
  }
  if (
    (change.kind === 'addCustom' || change.kind === 'dropCustom') &&
    isPresetRole(change.key)
  ) {
    throw clinicHttpError(
      422,
      'validation',
      'Only a custom role can be added or dropped',
    );
  }
}

/**
 * Save a matrix change — the contract's `updateRolePermission` (`S:1753`,
 * optimistic) and the plan's abilities, copies and custom roles
 * (REPLACE_WITH_API). Admin and Owner are refused (403, "Admins always have
 * full access"); an action without View is refused (422). The Users row and
 * "Change roles & access" of a role clinozy-be holds are its permission codes
 * instead (`platformCodesWithUsersAccess`, D17).
 */
export async function saveRoleMatrixChange(
  change: RoleMatrixChange,
): Promise<ClinicAccessMatrix> {
  refuseMatrixChange(change);
  stored = applyRoleMatrixChange(matrixInForce(), change);
  return structuredClone(stored);
}

/** A new custom role's tone: the next of plum · lime · mint · sky · peach · lav by how many exist (H:5187). */
export function nextCustomRoleTone(customRoleCount: number): Tone {
  const at = Math.max(0, Math.trunc(customRoleCount)) % CUSTOM_ROLE_TONES.length;
  return CUSTOM_ROLE_TONES[at] ?? 'plum';
}

/** A new role's name: `base` ("New role"), then `base 2`, `base 3` … — the first no role has, in any case (H:5187). */
export function nextCustomRoleName(base: string, takenNames: readonly string[]): string {
  const taken = new Set(takenNames.map((name) => name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

// ── clinozy-be codes ⇄ the matrix (D17) ──

/**
 * The clinozy-be permission codes behind the matrix's Users row (D17, §3.7):
 * View → `membership:read` + `role:read`; Create → `invitation:manage`; Edit
 * and Delete → `membership:manage` — one code, so the two read and write
 * together.
 */
export const USERS_ROW_PLATFORM_CODES: Readonly<
  Record<ClinicAction, readonly OrganizationPermission[]>
> = {
  view: ['membership:read', 'role:read'],
  create: ['invitation:manage'],
  edit: ['membership:manage'],
  delete: ['membership:manage'],
};

/** The code behind "Change roles & access" (the `perms` ability, D17). */
export const PERMS_PLATFORM_CODE: OrganizationPermission = 'role:manage';

/** Every code the matrix maps, in a fixed order. */
const MAPPED_CODES: readonly OrganizationPermission[] = [
  ...new Set([...CLINIC_ACTIONS.flatMap((action) => USERS_ROW_PLATFORM_CODES[action])]),
  PERMS_PLATFORM_CODE,
];

/** The Users row a set of clinozy-be codes grants — an action needs every code it maps to. */
export function usersGrantsFromPlatformCodes(codes: readonly string[]): SectionGrants {
  const held = new Set(codes);
  const grants = (action: ClinicAction) =>
    USERS_ROW_PLATFORM_CODES[action].every((code) => held.has(code));
  return {
    view: grants('view'),
    create: grants('create'),
    edit: grants('edit'),
    delete: grants('delete'),
  };
}

/** Whether a set of clinozy-be codes grants "Change roles & access". */
export function permsFromPlatformCodes(codes: readonly string[]): boolean {
  return codes.includes(PERMS_PLATFORM_CODE);
}

/**
 * A role's whole permission-code set with its Users row and "Change roles &
 * access" set as asked — the body of `useUpdateRole`'s full replace of
 * `permission_codes` (D17). Codes the matrix doesn't map are kept as they are;
 * the row is first normalised (no action without View), and Edit or Delete
 * grants `membership:manage`, so the two read back together.
 */
export function platformCodesWithUsersAccess(
  codes: readonly OrganizationPermission[],
  grants: SectionGrants,
  perms: boolean,
): OrganizationPermission[] {
  const row = grants.view ? grants : NO_GRANTS;
  const wanted = new Set<OrganizationPermission>(
    CLINIC_ACTIONS.flatMap((action) =>
      row[action] ? USERS_ROW_PLATFORM_CODES[action] : [],
    ),
  );
  if (perms) wanted.add(PERMS_PLATFORM_CODE);
  const kept = codes.filter((code) => !MAPPED_CODES.includes(code));
  return [...new Set(kept), ...MAPPED_CODES.filter((code) => wanted.has(code))];
}

/** A clinozy-be role as the mapping reads it (`isSystem` unknown when the viewer can't read roles). */
export interface PlatformRoleIdentity {
  id: string;
  name: string;
  isSystem?: boolean;
}

/**
 * The contract role a clinozy-be role is, by its name — Owner, Admin and the
 * clinic roles clinozy-be will seed (REPLACE_WITH_API: a stable key); null
 * for any other role.
 */
export function presetForPlatformRole(
  role: Pick<PlatformRoleIdentity, 'name'>,
): Role | null {
  const name = role.name.trim().toLowerCase();
  const match = (Object.entries(CLINIC_ROLE_PLATFORM_NAMES) as [Role, string][]).find(
    ([, platformName]) => platformName.toLowerCase() === name,
  );
  return match ? match[0] : null;
}

/**
 * The clinic role a clinozy-be role grants: its preset; a custom role's own
 * id; null for a platform-only system role (Member, Viewer) or a role whose
 * kind is unknown — least privilege.
 */
export function clinicRoleKeyForPlatformRole(
  role: PlatformRoleIdentity,
): ClinicRoleKey | null {
  const preset = presetForPlatformRole(role);
  if (preset) return preset;
  return role.isSystem === false ? role.id : null;
}

/** The clinozy-be role behind a clinic role — a preset's by name, a custom role's by id; null when there is none yet. */
export function platformRoleForClinicRole<T extends PlatformRoleIdentity>(
  key: ClinicRoleKey,
  roles: readonly T[],
): T | null {
  return (
    roles.find((role) =>
      isPresetRole(key) ? presetForPlatformRole(role) === key : role.id === key,
    ) ?? null
  );
}

/**
 * The one clinozy-be role a membership holds for a member's clinic roles
 * (KICKOFF §6.12 Save — clinozy-be holds one role per membership, the rest
 * live on the staff profile; AMBER): Admin when Admin is picked, else the main
 * role — and the org owner keeps Owner, which only an ownership transfer
 * changes. Null when clinozy-be has no such role yet (Appendix F asks it to
 * seed the clinic roles) — the caller decides the fallback.
 */
export function membershipRoleIdFor(
  keys: readonly ClinicRoleKey[],
  roles: readonly PlatformRoleIdentity[],
): string | null {
  const pick =
    (['owner', 'admin'] as const).find((role) => keys.includes(role)) ?? keys[0];
  if (pick === undefined) return null;
  return platformRoleForClinicRole(pick, roles)?.id ?? null;
}

/**
 * A member's clinic roles, the main role first: their staff profile's roles,
 * plus the clinic role their membership's platform role grants when it is
 * known (a Team row). Without either, least privilege from the platform codes
 * (L-25): the org owner (`organization:delete`) → Owner, a role or membership
 * manager → Admin, anyone else → no clinic role, so Today only. The org owner
 * keeps Owner on top of any other roles.
 */
export function clinicRolesForMember(input: {
  staffRoles?: readonly ClinicRoleKey[] | null;
  platformRole?: PlatformRoleIdentity | null;
  permissions?: readonly string[];
}): ClinicRoleKey[] {
  const codes = input.permissions ?? [];
  const fromPlatform = input.platformRole
    ? clinicRoleKeyForPlatformRole(input.platformRole)
    : null;
  const roles = [
    ...new Set([...(input.staffRoles ?? []), ...(fromPlatform ? [fromPlatform] : [])]),
  ];
  if (roles.length > 0) {
    if (codes.includes('organization:delete') && !roles.includes('owner')) {
      roles.push('owner');
    }
    return roles;
  }
  if (codes.includes('organization:delete')) return ['owner'];
  if (codes.includes('role:manage') || codes.includes('membership:manage')) {
    return ['admin'];
  }
  return [];
}

// ── Resolving ──

/** What a set of clinic roles may do — the union across the roles. */
export interface ResolvedClinicAccess {
  can: (section: Section, action: ClinicAction) => boolean;
  canAbility: (ability: ClinicAbility) => boolean;
  /** Sections with View, in nav order; Today always. */
  viewableSections: Section[];
}

/**
 * Resolve the access of `roles` against a matrix: the union across the roles,
 * Admin and Owner pass everything, Today is always viewable. With
 * `platformCodes` (the signed-in member, not a preview), the Users section and
 * "Change roles & access" follow those clinozy-be codes instead (D17, §3.7).
 */
export function resolveClinicAccess(
  matrix: ClinicAccessMatrix,
  roles: readonly ClinicRoleKey[],
  options: { platformCodes?: readonly string[] } = {},
): ResolvedClinicAccess {
  const full = roles.some(isFullAccessRole);
  const held = new Set<string>(roles);
  const rows = matrix.permissions.filter((row) => held.has(row.role));
  const platformUsers = options.platformCodes
    ? usersGrantsFromPlatformCodes(options.platformCodes)
    : null;
  const platformPerms = options.platformCodes
    ? permsFromPlatformCodes(options.platformCodes)
    : null;
  const can = (section: Section, action: ClinicAction): boolean => {
    if (section === 'users' && platformUsers) return platformUsers[action];
    if (full) return true;
    if (section === 'today' && action === 'view') return true;
    return rows.some((row) => row.section === section && row[GRANT_FIELD[action]]);
  };
  const abilities = new Set(roles.flatMap((role) => matrix.abilities[role] ?? []));
  return {
    can,
    canAbility: (ability) => {
      if (ability === 'perms' && platformPerms !== null) return platformPerms;
      return full || abilities.has(ability);
    },
    viewableSections: CLINIC_SECTION_ORDER.filter((section) => can(section, 'view')),
  };
}
