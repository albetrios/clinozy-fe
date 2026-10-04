import { z } from 'zod';

import { publicId } from '@/core/types/wire.ts';

import {
  type Role,
  ROLE_VALUES,
  rolePermissionSchema,
  roleSchema,
  type Section,
  type Tone,
  toneSchema,
} from './clinic-schema.ts';

/*
 * The clinic access domain beyond the generated contract (KICKOFF §3.7, §6.12;
 * D9, D17): the role keys (the contract's roles plus custom roles), the eleven
 * abilities, the matrix's sections and grants, and the role view the Users
 * room reads. The matrix, its rules and the clinozy-be permission-code mapping
 * live in `access-api.ts`.
 */

// ── Roles ──

/** A custom role's key — the clinozy-be role it is (`rol_…`; custom roles are a plan addition, Appendix F). */
const customRoleIdSchema = publicId('rol');

/**
 * A clinic role's key: one of the contract's roles (`S:996–1007`) — the seeded
 * catalog — or a custom role's clinozy-be id (Appendix F: custom roles, the
 * matrix keyed by role id). The two never collide: role ids carry `rol_`.
 */
export const clinicRoleKeySchema = z.union([roleSchema, customRoleIdSchema]);

/** One clinic role key. */
export type ClinicRoleKey = z.infer<typeof clinicRoleKeySchema>;

/** Whether a role key is one of the contract's roles (a preset) rather than a custom role. */
export function isPresetRole(key: string): key is Role {
  return (ROLE_VALUES as readonly string[]).includes(key);
}

/**
 * The name clinozy-be gives each contract role: Owner, Admin and the seeded
 * clinic roles (Appendix F asks it to seed the seven and Marketing). A backend
 * role with one of these names IS that clinic role — the only link today's API
 * offers (REPLACE_WITH_API: a stable key on the seeded roles).
 */
export const CLINIC_ROLE_PLATFORM_NAMES: Readonly<Record<Role, string>> = {
  admin: 'Admin',
  doctor: 'Doctor',
  therapist: 'Therapist',
  front_desk: 'Front desk',
  counsellor: 'Counsellor',
  pharmacist: 'Pharmacist',
  accountant: 'Accountant',
  marketing: 'Marketing',
  owner: 'Owner',
};

/**
 * The preset roles the Users room lists, in the design's order (H:3565) with
 * Marketing (Q-U2). Owner is the platform's org owner and is not listed.
 */
export const CLINIC_ROLE_CATALOG: readonly Role[] = ROLE_VALUES.filter(
  (role) => role !== 'owner',
);

/** A new custom role's tone: the next of these by how many custom roles exist (H:5187). */
export const CUSTOM_ROLE_TONES = [
  'plum',
  'lime',
  'mint',
  'sky',
  'peach',
  'lav',
] as const satisfies readonly Tone[];

// ── Abilities and actions ──

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

/** Zod enum of the abilities. */
export const clinicAbilitySchema = z.enum(CLINIC_ABILITIES);

/** One clinic ability (Q-U8 lists where each is enforced). */
export type ClinicAbility = z.infer<typeof clinicAbilitySchema>;

/** The matrix's four actions on a section, in the matrix's column order. */
export const CLINIC_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

/** A matrix action on a section. */
export type ClinicAction = (typeof CLINIC_ACTIONS)[number];

// ── The matrix ──

/**
 * The matrix's nine rows in their fixed order (`users.md:63`). Today has no
 * row: it stays viewable for every role (`S:1012`).
 */
export const MATRIX_SECTIONS = [
  'leads',
  'appointments',
  'patients',
  'medical',
  'stock',
  'payments',
  'tasks',
  'offerings',
  'users',
] as const satisfies readonly Section[];

/** Zod enum of the matrix's sections. */
const matrixSectionSchema = z.enum(MATRIX_SECTIONS);

/** A section with a matrix row. */
export type MatrixSection = z.infer<typeof matrixSectionSchema>;

/** What a role may do on one section — a matrix row's four boxes. */
const sectionGrantsSchema = z.object({
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
});

/** A matrix row's four boxes. */
export type SectionGrants = z.infer<typeof sectionGrantsSchema>;

/** Every box off — a new custom role's rows (H:5187). */
export const NO_GRANTS: Readonly<SectionGrants> = {
  view: false,
  create: false,
  edit: false,
  delete: false,
};

/** Every box on — Admin and Owner on every row. */
export const FULL_GRANTS: Readonly<SectionGrants> = {
  view: true,
  create: true,
  edit: true,
  delete: true,
};

/** A role's whole matrix: the grants on each of the nine sections. */
export const matrixGrantsSchema = z.record(matrixSectionSchema, sectionGrantsSchema);

/** A role's grants per matrix section. */
export type MatrixGrants = z.infer<typeof matrixGrantsSchema>;

/**
 * A matrix row: the contract's `RolePermission` (`S:211–225`) keyed by role
 * key, so a custom role has rows too (Appendix F: "the matrix keyed by role
 * id"). REPLACE_WITH_API: `listRolePermissions` (`S:1748`).
 */
export const clinicRolePermissionSchema = rolePermissionSchema.extend({
  role: clinicRoleKeySchema,
});

/** One matrix row. */
export type ClinicRolePermission = z.infer<typeof clinicRolePermissionSchema>;

// ── The role view ──

/** A clinozy-be role as the clinic reads it (the roles API: name, description, member count, system flag). */
const platformRoleRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  isSystem: z.boolean(),
  /** Memberships holding it as their one platform role (clinozy-be counts active and invited). */
  memberCount: z.number().int().nonnegative(),
});

/** A clinozy-be role reference. */
export type PlatformRoleRef = z.infer<typeof platformRoleRefSchema>;

/**
 * A role as Users › Roles & access shows it (KICKOFF §6.12 Data): the platform
 * role ⨝ the fixture matrix and abilities, its tone (the fixture's — backend
 * roles carry none, Appendix F) and who holds it.
 */
export const clinicRoleViewSchema = z.object({
  key: clinicRoleKeySchema,
  /** The contract role it is; null for a custom role. A preset is labelled by its i18n key, never `name`. */
  preset: roleSchema.nullable(),
  /** The backend role's name, or the name a preset will have once clinozy-be seeds it. */
  name: z.string(),
  /** The clinozy-be role it binds to; null while the backend has no such role. */
  platformRole: platformRoleRefSchema.nullable(),
  tone: toneSchema,
  grants: matrixGrantsSchema,
  abilities: z.array(clinicAbilitySchema),
  /** Admin: always full, never narrowed (`users.md:77`). */
  locked: z.boolean(),
  /**
   * Whether its Users row and "Change roles & access" are clinozy-be permission
   * codes (D17) — every bound role but Admin. A role bound to a clinozy-be
   * system role keeps them read-only: the API refuses to edit one (D47).
   */
  platformBacked: z.boolean(),
  /** The members holding it (membership ids), main role or not — "People with this role". */
  memberIds: z.array(z.string()),
});

/** A role as the Roles & access page reads it. */
export type ClinicRoleView = z.infer<typeof clinicRoleViewSchema>;
