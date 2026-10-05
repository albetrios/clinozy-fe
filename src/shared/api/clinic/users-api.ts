import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import type { ListPage, ListPageParams } from '@/shared/api/fetch-list-page.ts';
import * as orgApi from '@/shared/api/organization-api.ts';
import type {
  Member,
  OrgRole,
  RoleSummary,
} from '@/shared/api/organization-contracts.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { ROLE_TONES, toneForLabel } from '@/shared/clinic/clinic-tones.ts';

import {
  abilitiesFor,
  type ClinicAccessMatrix,
  clinicRolesForMember,
  isFullAccessRole,
  matrixGrantsFor,
  membershipRoleIdFor,
  permsFromPlatformCodes,
  platformRoleForClinicRole,
  presetForPlatformRole,
  usersGrantsFromPlatformCodes,
} from './access-api.ts';
import {
  CLINIC_ABILITIES,
  CLINIC_ROLE_CATALOG,
  CLINIC_ROLE_PLATFORM_NAMES,
  type ClinicRoleKey,
  type ClinicRoleView,
  isPresetRole,
  type PlatformRoleRef,
} from './access-contracts.ts';
import { displayId } from './clinic-display-id.ts';
import { createdFilterMatches } from './clinic-filter-match.ts';
import { clinicHttpError, validateClinicInput } from './clinic-fixture-store.ts';
import type { CreatedFilter } from './clinic-list-filters.ts';
import type { DeleteReason, Role, Tone } from './clinic-schema.ts';
import {
  splitStaffName,
  staffInitials,
  type StaffProfile,
  type StaffProfileInput,
  staffProfileInputSchema,
  type TeamMember,
  type TeamSortKey,
} from './users-contracts.ts';

/*
 * The Users room's data (KICKOFF §6.12 Data, D17): clinozy-be's members and
 * roles — the real API, every page read up front — joined with the staff
 * profiles and the clinic matrix, which are fixtures until clinozy-be keeps
 * them (REPLACE_WITH_API). The fixture world is imported on demand, so its
 * seed data never lands in the shell's chunk.
 */

/** TanStack Query keys for the staff profiles. */
export const staffQueryKeys = {
  all: ['clinic', 'staff'] as const,
  /** Every live profile — the Team joins its members against this one entry. */
  profiles: () => [...staffQueryKeys.all, 'profiles'] as const,
  /** The signed-in member's own profile, by their sign-in email. */
  mine: (email: string | null) => [...staffQueryKeys.all, 'mine', email] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** clinozy-be's largest page — the roster and the roles are read whole. */
const PLATFORM_PAGE_SIZE = 100;

const sameEmail = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// ── clinozy-be reads ──

/** Every page of a clinozy-be list, the largest page at a time. */
function everyPage<T>(
  listPage: (params: ListPageParams) => Promise<ListPage<T>>,
  resource: string,
): Promise<T[]> {
  return collectAllPages(async (after) => {
    const page = await listPage({
      limit: PLATFORM_PAGE_SIZE,
      ...(after ? { after } : {}),
    });
    return { rows: page.rows, next: page.hasMore ? page.next : null };
  }, resource);
}

/**
 * Every membership of the active organisation, page after page: the Team reads
 * the whole roster and searches and sorts it in place (KICKOFF §6.12 Data,
 * AMBER). Requires `membership:read`.
 */
export function fetchAllMembers(): Promise<Member[]> {
  return everyPage(orgApi.listMembers, 'memberships');
}

/** Every role of the active organisation, page after page. Requires `role:read`. */
export function fetchAllRoles(): Promise<RoleSummary[]> {
  return everyPage(orgApi.listRoles, 'roles');
}

// ── The one clinozy-be role a membership holds (D17, D47) ──

/** The Owner role is never an invite target — an org has exactly one owner. */
export function isInvitableRole(role: Pick<RoleSummary, 'name'>): boolean {
  return role.name.trim().toLowerCase() !== 'owner';
}

/**
 * Least privilege first: the well-known roles every TEAM organisation is
 * provisioned with, which a new member may hold without anyone choosing more.
 */
const LEAST_PRIVILEGE_ROLE_NAMES = ['member', 'viewer'] as const;

/**
 * The least-privileged well-known role the organisation still has — Member,
 * then Viewer — or undefined. Never a custom role: the roles list carries no
 * permission set to rank one by, and a wrong guess here is a privilege grant.
 */
export function leastPrivilegeRoleId(
  roles: readonly Pick<RoleSummary, 'id' | 'name'>[],
): string | undefined {
  for (const name of LEAST_PRIVILEGE_ROLE_NAMES) {
    const match = roles.find((role) => role.name.trim().toLowerCase() === name);
    if (match) return match.id;
  }
  return undefined;
}

/**
 * The clinozy-be role a membership takes for a member's clinic roles (KICKOFF
 * §6.12 Save; D47): Admin when Admin is picked, else the main role's backend
 * role — and while clinozy-be has no role for it yet (it seeds Owner, Admin,
 * Member and Viewer today; Appendix F asks for the clinic roles), the
 * least-privileged well-known role. Every clinic role still lives on the staff
 * profile, which is what the clinic screens read. Undefined when the
 * organisation has none of these.
 */
export function membershipRoleIdForClinicRoles(
  keys: readonly ClinicRoleKey[],
  roles: readonly RoleSummary[],
): string | undefined {
  return membershipRoleIdFor(keys, roles) ?? leastPrivilegeRoleId(roles);
}

/** The coarse platform bucket a role name falls in — the members list's optimistic label only. */
export function orgRoleOfName(name: string): OrgRole {
  const role = name.trim().toLowerCase();
  return role === 'owner' || role === 'admin' || role === 'viewer' ? role : 'member';
}

// ── Staff profiles (fixture) ──

/**
 * Every live staff profile. REPLACE_WITH_API: the profile's fields on
 * clinozy-be's memberships (Appendix F) — `listUsers` (`S:1746`) until then.
 */
export async function fetchStaffProfiles(): Promise<StaffProfile[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.staff.snapshot();
}

/**
 * The signed-in member's staff profile, by their sign-in email; null without
 * one. REPLACE_WITH_API: the session carries the member's profile.
 */
export async function fetchMyStaffProfile(
  email: string | null,
): Promise<StaffProfile | null> {
  if (!email?.trim()) return null;
  const { clinicFixtures } = await fixtureWorld();
  return (
    clinicFixtures.staff.snapshot((profile) => sameEmail(profile.email, email))[0] ?? null
  );
}

const UNKNOWN_BRANCH = 'Pick branches the clinic has';
const EMAIL_TAKEN = 'A user with this email already exists';

/**
 * Save a member's staff profile (`createUser` / `updateUser`, `S:1752`;
 * REPLACE_WITH_API): the profile linked to `membershipId`, else the one with
 * the same email — a seeded or earlier profile is claimed, the email being the
 * sign-in id — else a new one with the next #ID. The contract's `roles` keeps
 * step with `roleKeys`, and Owner is never stored: clinozy-be decides who owns
 * the organisation (Q-U2). A 422 names a broken rule (unknown branches among
 * them); a 409 an email another member's profile has.
 */
export async function saveStaffProfile(input: StaffProfileInput): Promise<StaffProfile> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(staffProfileInputSchema, {
    ...input,
    roleKeys: input.roleKeys.filter((key) => key !== 'owner'),
  });
  const branches = new Set(clinicFixtures.branches.snapshot().map((branch) => branch.id));
  if (fields.branchIds.some((id) => !branches.has(id))) {
    throw clinicHttpError(422, 'validation', UNKNOWN_BRANCH, {
      branchIds: [UNKNOWN_BRANCH],
    });
  }
  const profiles = clinicFixtures.staff.snapshot();
  const linked = profiles.find((profile) => profile.membershipId === fields.membershipId);
  const byEmail = profiles.find((profile) => sameEmail(profile.email, fields.email));
  if (linked && byEmail && byEmail.id !== linked.id) {
    throw clinicHttpError(409, 'conflict', EMAIL_TAKEN, { email: [EMAIL_TAKEN] });
  }
  const { firstName, lastName } = splitStaffName(fields.name);
  const record = {
    firstName,
    lastName,
    initials: staffInitials(fields.name),
    email: fields.email,
    phone: fields.phone,
    roles: fields.roleKeys.filter(isPresetRole),
    roleKeys: fields.roleKeys,
    branchIds: fields.branchIds,
    tone: fields.tone,
    workingDays: fields.workingDays,
    startsAt: fields.startsAt,
    endsAt: fields.endsAt,
    commissionPct: fields.commissionPct,
    active: fields.active,
    membershipId: fields.membershipId,
  };
  const saved = linked ?? byEmail;
  if (saved) return clinicFixtures.staff.update(saved.id, record);
  // Away until the person signs in and sets their own presence (S:1571).
  return clinicFixtures.staff.create({ ...record, presence: 'away', lastActiveAt: null });
}

/**
 * Remove a member's staff profile with the Reason confirm's choice, once the
 * deferred membership removal lands (REPLACE_WITH_API: clinozy-be keeps no
 * reason or note for a membership, Appendix F). "Other" needs a note (422).
 */
export async function removeStaffProfile(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<StaffProfile> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.staff.remove(id, reason, note);
}

// ── The Team: members ⨝ staff profiles ──

const fullName = (profile: StaffProfile) =>
  [profile.firstName, profile.lastName].filter(Boolean).join(' ');

/** The Team's default order (H:5150): the newest #ID first, then members without a profile by name. */
function compareTeamDefault(a: TeamMember, b: TeamMember): number {
  if (a.seq !== null && b.seq !== null) return b.seq - a.seq;
  if (a.seq !== null) return -1;
  if (b.seq !== null) return 1;
  return a.name.localeCompare(b.name);
}

/** The Team row's fields only a staff profile knows — the membership's alone without one. */
function profileFields(
  member: Member,
  profile: StaffProfile | null,
): Pick<
  TeamMember,
  'name' | 'initials' | 'tone' | 'seq' | 'phone' | 'branchIds' | 'presence'
> {
  if (!profile) {
    return {
      name: member.name,
      initials: staffInitials(member.name),
      tone: toneForLabel(member.email),
      seq: null,
      phone: null,
      branchIds: [],
      presence: null,
    };
  }
  return {
    name: fullName(profile),
    initials: profile.initials,
    tone: profile.tone,
    seq: profile.seq,
    phone: profile.phone,
    branchIds: profile.branchIds,
    presence: profile.presence,
  };
}

/** One member's Team row: the membership, its profile's fields first. */
function teamMemberOf(
  member: Member,
  profile: StaffProfile | null,
  platformRole: RoleSummary | undefined,
  selfUserId: string | null,
): TeamMember {
  return {
    membershipId: member.id,
    userId: member.userId,
    email: member.email,
    status: member.status,
    invitation: member.status === 'invited' ? member.invitation : null,
    platformRoleId: member.roleId,
    platformRoleName: member.roleName,
    joinedAt: member.joinedAt || null,
    isOwner: member.role === 'owner',
    isSelf: selfUserId !== null && member.userId === selfUserId,
    ...profileFields(member, profile),
    roleKeys: clinicRolesForMember({
      staffRoles: profile?.roleKeys,
      // The system flag only when the viewer may read roles; unknown → least privilege.
      platformRole: {
        id: member.roleId,
        name: member.roleName,
        isSystem: platformRole?.isSystem,
      },
    }),
    lastActiveAt: member.lastActiveAt ?? profile?.lastActiveAt ?? null,
    profile,
  };
}

/**
 * The Team (KICKOFF §6.12 Data, D17): every clinozy-be membership joined with
 * its staff profile — by membership id, else by email for a profile no current
 * member has claimed — in the default order. A profile without a membership is
 * not on the Team: its person isn't a member (an invitation cancelled, a member
 * removed). An invited member's row carries the invitation and the name the
 * drawer gave the profile (clinozy-be only knows the email until they accept).
 */
export function joinTeam(input: {
  members: readonly Member[];
  profiles: readonly StaffProfile[];
  /** The roles list (`role:read`), for each platform role's system flag. */
  platformRoles?: readonly RoleSummary[];
  selfUserId?: string | null;
}): TeamMember[] {
  const memberIds = new Set(input.members.map((member) => member.id));
  const linked = new Map<string, StaffProfile>();
  for (const profile of input.profiles) {
    if (profile.membershipId !== null && memberIds.has(profile.membershipId)) {
      linked.set(profile.membershipId, profile);
    }
  }
  const claimed = new Set([...linked.values()].map((profile) => profile.id));
  const unclaimed = new Map<string, StaffProfile>();
  for (const profile of input.profiles) {
    const email = profile.email.trim().toLowerCase();
    if (!(claimed.has(profile.id) || unclaimed.has(email))) unclaimed.set(email, profile);
  }
  const rolesById = new Map((input.platformRoles ?? []).map((role) => [role.id, role]));

  return input.members
    .map((member) => {
      const email = member.email.trim().toLowerCase();
      const profile = linked.get(member.id) ?? unclaimed.get(email) ?? null;
      unclaimed.delete(email);
      return teamMemberOf(
        member,
        profile,
        rolesById.get(member.roleId),
        input.selfUserId ?? null,
      );
    })
    .sort(compareTeamDefault);
}

// ── The Team, searched and sorted in place ──

/** Whether a member matches the Team search: name, email, mobile or "#12" (`users.md:376`). */
export function teamMemberMatchesSearch(
  member: Pick<TeamMember, 'name' | 'email' | 'phone' | 'seq'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const phone = member.phone ? `${member.phone} ${formatClinicPhone(member.phone)}` : '';
  const id = member.seq === null ? '' : displayId.user(member.seq);
  return `${member.name} ${member.email} ${phone} ${id}`.toLowerCase().includes(needle);
}

/** When a member was added: their profile's creation, else when they joined; null for neither. */
export function teamMemberCreatedAt(member: TeamMember): string | null {
  return member.profile?.createdAt ?? member.joinedAt;
}

/** The Team's Status filter: Active, or Inactive (a suspended membership). */
type TeamStatusFilter = 'active' | 'inactive';

/** The Team's Filters (`users.md:204`), as the URL holds them. */
export interface TeamFilters {
  /** One clinic role — the member holds it, main role or not. */
  role?: ClinicRoleKey;
  /** Any of these branches. */
  branch?: readonly string[];
  /** Either status; an invited member is neither. */
  status?: readonly TeamStatusFilter[];
  created?: CreatedFilter;
}

/** A membership status as the Status filter reads it — an invitation is neither. */
const STATUS_FILTER_OF: Readonly<Record<TeamMember['status'], TeamStatusFilter | null>> =
  { active: 'active', suspended: 'inactive', invited: null };

/** Whether a member passes the Team's Filters on the clinic's `today` (`YYYY-MM-DD`). */
export function teamMemberMatchesFilters(
  member: TeamMember,
  filters: TeamFilters,
  today: string,
): boolean {
  if (filters.role && !member.roleKeys.includes(filters.role)) return false;
  const { branch, status, created } = filters;
  if (branch?.length && !branch.some((id) => member.branchIds.includes(id))) {
    return false;
  }
  if (status?.length) {
    const memberStatus = STATUS_FILTER_OF[member.status];
    if (memberStatus === null || !status.includes(memberStatus)) return false;
  }
  if (created) {
    const at = teamMemberCreatedAt(member);
    if (!(at && createdFilterMatches(at, created, today))) return false;
  }
  return true;
}

const STATUS_ORDER = { active: 0, invited: 1, suspended: 2 } as const;

type SortValue = { kind: 'number'; value: number } | { kind: 'text'; value: string };

/**
 * A Team column sort (H:5150): ascending or descending, a member without the
 * value last either way. `roleName` names a role for the Roles sort (by the
 * main role) — the screen passes its translated names; the key by default.
 */
export function compareTeamMembers(
  sort: TeamSortKey,
  order: 'asc' | 'desc',
  roleName: (key: ClinicRoleKey) => string = (key) => key,
): (a: TeamMember, b: TeamMember) => number {
  const sortValue = (member: TeamMember): SortValue | null => {
    switch (sort) {
      case 'seq':
        return member.seq === null ? null : { kind: 'number', value: member.seq };
      case 'name':
        return { kind: 'text', value: member.name };
      case 'email':
        return { kind: 'text', value: member.email };
      case 'role': {
        const [main] = member.roleKeys;
        return main === undefined ? null : { kind: 'text', value: roleName(main) };
      }
      case 'commission': {
        const pct = member.profile?.commissionPct;
        return pct === undefined ? null : { kind: 'number', value: pct };
      }
      case 'status':
        return { kind: 'number', value: STATUS_ORDER[member.status] };
      case 'updatedAt': {
        const at = member.profile?.updatedAt;
        return at === undefined ? null : { kind: 'number', value: Date.parse(at) };
      }
    }
  };
  const direction = order === 'desc' ? -1 : 1;
  return (a, b) => {
    const x = sortValue(a);
    const y = sortValue(b);
    if (x === null || y === null) return Number(x === null) - Number(y === null);
    if (x.kind === 'number' && y.kind === 'number')
      return direction * (x.value - y.value);
    return direction * String(x.value).localeCompare(String(y.value));
  };
}

// ── Roles & access: roles ⨝ the matrix ──

const platformRoleRef = (role: RoleSummary): PlatformRoleRef => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  memberCount: role.memberCount,
});

/** One role's view: the platform role ⨝ its matrix, abilities, tone and holders. */
function clinicRoleView(
  role: {
    key: ClinicRoleKey;
    preset: Role | null;
    name: string;
    platform: RoleSummary | null;
    tone: Tone;
  },
  matrix: ClinicAccessMatrix,
  team: readonly TeamMember[],
): ClinicRoleView {
  const full = isFullAccessRole(role.key);
  return {
    key: role.key,
    preset: role.preset,
    name: role.name,
    platformRole: role.platform ? platformRoleRef(role.platform) : null,
    tone: role.tone,
    grants: matrixGrantsFor(matrix, role.key),
    abilities: abilitiesFor(matrix, role.key),
    locked: full,
    platformBacked: role.platform !== null && !full,
    memberIds: team
      .filter((member) => member.roleKeys.includes(role.key))
      .map((member) => member.membershipId),
  };
}

/**
 * Roles & access (KICKOFF §6.12 Data): the contract's roles in the design's
 * order — each bound to the clinozy-be role of its name when there is one —
 * then the organisation's custom clinozy-be roles, each ⨝ the fixture matrix,
 * its abilities, its tone (the fixture's; a custom role made elsewhere takes
 * the design's hash) and the Team members holding it. Owner and the
 * platform-only system roles (Member, Viewer) are not clinic roles and are not
 * listed (Q-U2). A bound role's Users row and "Change roles & access" are its
 * clinozy-be codes — `withPlatformAccess` reads them in.
 */
export function joinClinicRoles(input: {
  platformRoles: readonly RoleSummary[];
  matrix: ClinicAccessMatrix;
  team: readonly TeamMember[];
}): ClinicRoleView[] {
  const presets = CLINIC_ROLE_CATALOG.map((preset) => {
    const platform = platformRoleForClinicRole(preset, input.platformRoles);
    return clinicRoleView(
      {
        key: preset,
        preset,
        name: platform?.name ?? CLINIC_ROLE_PLATFORM_NAMES[preset],
        platform,
        tone: ROLE_TONES[preset],
      },
      input.matrix,
      input.team,
    );
  });
  const custom = input.platformRoles
    .filter((role) => !role.isSystem && presetForPlatformRole(role) === null)
    .map((role) =>
      clinicRoleView(
        {
          key: role.id,
          preset: null,
          name: role.name,
          platform: role,
          tone: input.matrix.customRoleTones[role.id] ?? toneForLabel(role.name),
        },
        input.matrix,
        input.team,
      ),
    );
  return [...presets, ...custom];
}

/**
 * A role with its Users row and "Change roles & access" read from its
 * clinozy-be permission codes (D17) — for a role the platform backs; any other
 * role comes back as it is. A system role's codes are read-only: clinozy-be
 * refuses to edit one (`platformRole.isSystem`).
 */
export function withPlatformAccess(
  role: ClinicRoleView,
  codes: readonly string[],
): ClinicRoleView {
  if (!role.platformBacked) return role;
  const perms = permsFromPlatformCodes(codes);
  return {
    ...role,
    grants: { ...role.grants, users: usersGrantsFromPlatformCodes(codes) },
    abilities: CLINIC_ABILITIES.filter((ability) =>
      ability === 'perms' ? perms : role.abilities.includes(ability),
    ),
  };
}
