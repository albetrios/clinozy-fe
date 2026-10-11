import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { APP_SECTION_ORDER } from '@/shared/app/app-sections.ts';

import { type AppAction, CUSTOM_ROLE_TONES } from './access-contracts.ts';
import type { Section, Tone } from './app-schema.ts';

/*
 * Clinic access from permission codes (L-60, D148, research-users §7): what a member may do is the
 * set of clinozy-be codes in force — their own (`my_permissions`), or a previewed role's while
 * View-as runs. Every room asks the same two questions: an action on a section (`can`), or one
 * exact code (`canCode`) for what the four actions do not name (`payment:delete`, `lead:export`).
 */

/**
 * The clinozy-be code behind each action on a clinic section — the per-resource codes of its
 * catalog (`GET /tenancy/permissions`). Offerings have no read code: reading them is
 * `organization:read`. The Users room is its Team (`membership:*`); its Roles and Branches tabs
 * ask their own codes. Today has none: every member sees it, and each lane asks its own read.
 */
export const SECTION_ACTION_CODES: Readonly<
  Record<Exclude<Section, 'today'>, Readonly<Record<AppAction, OrganizationPermission>>>
> = {
  leads: {
    view: 'lead:read',
    create: 'lead:create',
    edit: 'lead:update',
    delete: 'lead:delete',
  },
  appointments: {
    view: 'appointment:read',
    create: 'appointment:create',
    edit: 'appointment:update',
    delete: 'appointment:delete',
  },
  patients: {
    view: 'patient:read',
    create: 'patient:create',
    edit: 'patient:update',
    delete: 'patient:delete',
  },
  medical: {
    view: 'medicine:read',
    create: 'medicine:create',
    edit: 'medicine:update',
    delete: 'medicine:delete',
  },
  stock: {
    view: 'stock_item:read',
    create: 'stock_item:create',
    edit: 'stock_item:update',
    delete: 'stock_item:delete',
  },
  payments: {
    view: 'payment:read',
    create: 'payment:create',
    edit: 'payment:update',
    delete: 'payment:delete',
  },
  tasks: {
    view: 'task:read',
    create: 'task:create',
    edit: 'task:update',
    delete: 'task:delete',
  },
  offerings: {
    view: 'organization:read',
    create: 'offering:create',
    edit: 'offering:update',
    delete: 'offering:delete',
  },
  users: {
    view: 'membership:read',
    create: 'membership:create',
    edit: 'membership:update',
    delete: 'membership:delete',
  },
};

/** What a set of codes may do in the clinic. */
export interface ResolvedAppAccess {
  can: (section: Section, action: AppAction) => boolean;
  /** Sections with View, in nav order; Today always. */
  viewableSections: Section[];
}

/**
 * What a set of clinozy-be permission codes may do in the clinic — the member's own, or a
 * previewed role's. Today is always viewable; every other section by its action's code.
 *
 * @remarks
 * The server re-checks every request, so this decides only what the screens offer.
 */
export function resolveAccessFromCodes(codes: readonly string[]): ResolvedAppAccess {
  const held = new Set(codes);
  const can = (section: Section, action: AppAction): boolean => {
    if (section === 'today') return action === 'view';
    return held.has(SECTION_ACTION_CODES[section][action]);
  };
  return {
    can,
    viewableSections: APP_SECTION_ORDER.filter((section) => can(section, 'view')),
  };
}

/** A new role's name: `base` ("New role"), then `base 2`, `base 3` … — the first no role has, in any case (H:5187). */
export function nextCustomRoleName(base: string, takenNames: readonly string[]): string {
  const taken = new Set(takenNames.map((name) => name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

/** A new custom role's tone: the next of plum · lime · mint · sky · peach · lav by how many exist (H:5187). */
export function nextCustomRoleTone(customRoleCount: number): Tone {
  const at = Math.max(0, Math.trunc(customRoleCount)) % CUSTOM_ROLE_TONES.length;
  return CUSTOM_ROLE_TONES[at] ?? 'plum';
}
