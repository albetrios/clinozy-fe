import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import type { ListPage, ListPageParams } from '@/shared/api/fetch-list-page.ts';
import * as orgApi from '@/shared/api/organization-api.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';

import { displayId } from './clinic-display-id.ts';
import { createdFilterMatches } from './clinic-filter-match.ts';
import type { CreatedFilter } from './clinic-list-filters.ts';
import { staffInitials, type TeamMember, type TeamSortKey } from './users-contracts.ts';

/*
 * The Users room's data (KICKOFF §6.12 Data; research-users §2): clinozy-be's members and roles —
 * every page read up front, a clinic has tens of members (K5) — and the Team searched, filtered
 * and sorted in place (the extra sorts have no server parameter).
 */

/** clinozy-be's largest page — the roster and the roles are read whole. */
const PLATFORM_PAGE_SIZE = 100;

/** Every page of a clinozy-be list, the largest page at a time. */
function everyPage<T>(
  listPage: (params: ListPageParams) => Promise<ListPage<T>>,
  resource: string,
  params: ListPageParams = {},
): Promise<T[]> {
  return collectAllPages(async (after) => {
    const page = await listPage({
      ...params,
      limit: PLATFORM_PAGE_SIZE,
      ...(after ? { after } : {}),
    });
    return { rows: page.rows, next: page.hasMore ? page.next : null };
  }, resource);
}

/**
 * Every membership of the active organization, page after page: the Team reads the whole roster
 * and searches and sorts it in place. Requires `membership:read`.
 */
export function fetchAllMembers(): Promise<Member[]> {
  return everyPage(orgApi.listMembers, 'memberships');
}

/**
 * Every role of the active organization, page after page, in creation order — the presets as the
 * clinic was provisioned (Owner, Admin, Doctor, … Marketing), then the clinic's own. Requires
 * `role:read`.
 */
export function fetchAllRoles(): Promise<RoleSummary[]> {
  return everyPage(orgApi.listRoles, 'roles', { sort: 'created_at', order: 'asc' });
}

// ── The Team ──

/** One membership as a Team row. */
export function teamMemberOf(member: Member, selfUserId: string | null): TeamMember {
  return {
    membershipId: member.id,
    userId: member.userId,
    email: member.email,
    status: member.status,
    invitation: member.status === 'invited' ? member.invitation : null,
    joinedAt: member.joinedAt || null,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    isOwner: member.isOwner,
    isSelf: selfUserId !== null && member.userId === selfUserId,
    name: member.name,
    initials: staffInitials(member.name),
    tone: member.tone,
    roleIds: member.roleIds,
    seq: member.staffNumber,
    phone: member.phone,
    branchIds: member.branchIds,
    workingDays: member.workingDays,
    startsAt: member.workStartsAt,
    endsAt: member.workEndsAt,
    commissionPercent: member.commissionPercent,
  };
}

/** The Team (KICKOFF §6.12 Data): every membership as a row, the newest #ID first (H:5150). */
export function joinTeam(
  members: readonly Member[],
  selfUserId: string | null = null,
): TeamMember[] {
  return members
    .map((member) => teamMemberOf(member, selfUserId))
    .sort((a, b) => b.seq - a.seq);
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
  return `${member.name} ${member.email} ${phone} ${displayId.user(member.seq)}`
    .toLowerCase()
    .includes(needle);
}

/** The Team's Status filter: Active, or Inactive (a suspended membership). */
type TeamStatusFilter = 'active' | 'inactive';

/** The Team's Filters (`users.md:204`), as the URL holds them. */
export interface TeamFilters {
  /** One role (`rol_…`) — the member holds it, main role or not. */
  role?: string;
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
  if (filters.role && !member.roleIds.includes(filters.role)) return false;
  const { branch, status, created } = filters;
  if (branch?.length && !branch.some((id) => member.branchIds.includes(id))) {
    return false;
  }
  if (status?.length) {
    const memberStatus = STATUS_FILTER_OF[member.status];
    if (memberStatus === null || !status.includes(memberStatus)) return false;
  }
  if (created && !createdFilterMatches(member.createdAt, created, today)) return false;
  return true;
}

const STATUS_ORDER = { active: 0, invited: 1, suspended: 2 } as const;

type SortValue = { kind: 'number'; value: number } | { kind: 'text'; value: string };

/**
 * A Team column sort (H:5150): ascending or descending, a member without the value last either
 * way. `roleName` names a role (`rol_…`) for the Roles sort (by the main role) — the screen
 * passes the role directory's names; the id by default.
 */
export function compareTeamMembers(
  sort: TeamSortKey,
  order: 'asc' | 'desc',
  roleName: (roleId: string) => string = (roleId) => roleId,
): (a: TeamMember, b: TeamMember) => number {
  const sortValue = (member: TeamMember): SortValue | null => {
    switch (sort) {
      case 'seq':
        return { kind: 'number', value: member.seq };
      case 'name':
        return { kind: 'text', value: member.name };
      case 'email':
        return { kind: 'text', value: member.email };
      case 'role': {
        const [main] = member.roleIds;
        return main === undefined ? null : { kind: 'text', value: roleName(main) };
      }
      case 'commission':
        return { kind: 'number', value: member.commissionPercent };
      case 'status':
        return { kind: 'number', value: STATUS_ORDER[member.status] };
      case 'updatedAt':
        return { kind: 'number', value: Date.parse(member.updatedAt) };
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
