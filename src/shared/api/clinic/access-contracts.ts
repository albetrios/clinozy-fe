import type { Role, Tone } from './clinic-schema.ts';

/*
 * The clinic access domain: the four actions on a section, the names clinozy-be gives the presets
 * a clinic is provisioned with, and a new custom role's tones. What a member may do is their own
 * clinozy-be permission codes (`access-api.ts`) — the client keeps no role matrix: the roles are
 * named code sets on the server, and the server re-checks every request.
 */

/** The four actions on a clinic section, in the Roles & access grid's column order. */
export const CLINIC_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

/** An action on a section. */
export type ClinicAction = (typeof CLINIC_ACTIONS)[number];

/**
 * The name clinozy-be gives each preset role a clinic is provisioned with (`app-role-presets.ts`;
 * a preset's name never changes, T3). A system role with one of these names IS that preset — how
 * a screen labels it in the clinic's own words and keys a preset's purpose line or Today focus.
 */
export const PRESET_ROLE_NAMES: Readonly<Record<Role, string>> = {
  owner: 'Owner',
  admin: 'Admin',
  doctor: 'Doctor',
  therapist: 'Therapist',
  front_desk: 'Front desk',
  counsellor: 'Counsellor',
  pharmacist: 'Pharmacist',
  accountant: 'Accountant',
  marketing: 'Marketing',
};

/** The preset a role is — a system role named as one — or null for any other role. */
export function presetOfRole(role: { name: string; isSystem: boolean }): Role | null {
  if (!role.isSystem) return null;
  const match = (Object.entries(PRESET_ROLE_NAMES) as [Role, string][]).find(
    ([, name]) => name === role.name,
  );
  return match ? match[0] : null;
}

/** A new custom role's tone: the next of these by how many custom roles exist (H:5187). */
export const CUSTOM_ROLE_TONES = [
  'plum',
  'lime',
  'mint',
  'sky',
  'peach',
  'lav',
] as const satisfies readonly Tone[];
