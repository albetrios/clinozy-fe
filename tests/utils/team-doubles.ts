import { PRESET_ROLE_NAMES } from '@/shared/api/app/access-contracts.ts';
import type { Role } from '@/shared/api/app/app-schema.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';

// The clinic's people as clinozy-be returns them — the provisioned roles, members and the
// signed-in member — shared by the Users and Branches room tests.

/** A public id: the prefix and 21 characters, as clinozy-be makes them. */
const publicId = (prefix: string, key: string) =>
  `${prefix}_${key
    .replaceAll(/[^a-z0-9]/g, '')
    .padEnd(21, '0')
    .slice(0, 21)}`;

/** A clinozy-be role, as `listRoles` maps it. */
export function platformRole(
  key: string,
  name: string,
  isSystem: boolean,
  overrides: Partial<RoleSummary> = {},
): RoleSummary {
  return {
    id: publicId('rol', key),
    name,
    description: '',
    permissions: [],
    memberCount: 0,
    isSystem,
    isLocked: false,
    tone: 'sky',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

/** A preset role, named as clinozy-be provisions it. */
const preset = (role: Role, overrides: Partial<RoleSummary> = {}) =>
  platformRole(role, PRESET_ROLE_NAMES[role], true, overrides);

/** The roles a clinic is provisioned with (Owner and Admin locked), and one custom role. */
export const PLATFORM_ROLES = {
  owner: preset('owner', { isLocked: true, tone: 'slate' }),
  admin: preset('admin', { isLocked: true, tone: 'plum' }),
  doctor: preset('doctor', { tone: 'sky' }),
  therapist: preset('therapist', { tone: 'butter' }),
  front_desk: preset('front_desk', { tone: 'mint' }),
  counsellor: preset('counsellor', { tone: 'peach' }),
  pharmacist: preset('pharmacist', { tone: 'blush' }),
  accountant: preset('accountant', { tone: 'sage' }),
  marketing: preset('marketing', { tone: 'lav' }),
  senior: platformRole('senior', 'Senior desk', false, {
    tone: 'lime',
    description: 'Runs the desk on weekends',
  }),
};

/** A clinozy-be membership, as `listMembers` maps it. */
export function member(
  key: string,
  email: string,
  roles: RoleSummary | readonly RoleSummary[] = PLATFORM_ROLES.front_desk,
  overrides: Partial<Member> = {},
): Member {
  const roleIds = (Array.isArray(roles) ? roles : [roles]).map(
    (role: RoleSummary) => role.id,
  );
  return {
    id: publicId('mem', key),
    userId: `usr_${key}`,
    name: email,
    email,
    status: 'active',
    roleIds,
    roleId: roleIds[0] ?? '',
    isOwner: roleIds.includes(PLATFORM_ROLES.owner.id),
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
    staffNumber: 1,
    phone: null,
    tone: 'sky',
    branchIds: [],
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    workStartsAt: '10:00',
    workEndsAt: '19:00',
    commissionPercent: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

/** The signed-in member of the harness: Riya (#12). */
export const SELF = { userId: 'usr_riya', email: 'riya@cresence.skin' };
