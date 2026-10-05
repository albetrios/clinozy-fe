/**
 * URL search-param schemas for the Users room (consumed by routeTree's
 * `validateSearch`): the Team's search, filters and sort (KICKOFF §6.12,
 * `S:104` — `role`, `branch`, `q`; the plan adds `status`, `created` and
 * `sort`). A value the URL can't hold — an
 * unknown role, a bad date — is dropped, never an error; defaults stay out of
 * the URL (`/users` is the whole Team, newest #ID first).
 *
 * Dependency-free on purpose: `routeTree.tsx` is the entry chunk. The role
 * keys are declared here, not imported (the test pins them to the catalog).
 */
import {
  listIn,
  listOf,
  matchOf,
  queryOf,
  RECORD_ID,
  sortOf,
} from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';

/** The Team's Status filter values (`users.md:204`). */
export const TEAM_STATUS_VALUES = ['active', 'inactive'] as const;

/** One Status filter value. */
type TeamStatusValue = (typeof TEAM_STATUS_VALUES)[number];

/** The Team's sortable columns (H:5150) — the column ids and the URL's sort keys. */
export const TEAM_SORT_KEYS = [
  'seq',
  'name',
  'email',
  'role',
  'commission',
  'status',
  'updatedAt',
] as const;

/** One Team sort key. */
export type TeamSortColumn = (typeof TEAM_SORT_KEYS)[number];

/** A column sort in the URL: `name:asc`, `seq:desc` (the shared table's form). */
export type TeamSort = `${TeamSortColumn}:${'asc' | 'desc'}`;

/**
 * A clinic role in the URL: one of the catalog's preset keys, or a custom
 * role's clinozy-be id (`rol_` + 21).
 */
const ROLE_KEY =
  /^(?:admin|doctor|therapist|front_desk|counsellor|pharmacist|accountant|marketing|rol_[a-z0-9]{21})$/;

/** Validated `?…` search params for `/users` and its dialog routes. */
export interface UsersSearch {
  /** Name, email, mobile or "#ID" (≤ 80 characters). */
  q?: string;
  /** One clinic role — "All" is none. */
  role?: string;
  /** Any of these branches (only offered with two or more open). */
  branch?: string[];
  /** Active, Inactive or both. */
  status?: TeamStatusValue[];
  created?: CreatedFilter;
  sort?: TeamSort;
}

/**
 * Parse `/users` search params. Every key is answered, `undefined` included:
 * the router keeps a raw value the schema omits, so dropping one means saying so.
 */
export function validateUsersSearch(search: Record<string, unknown>): UsersSearch {
  return {
    q: queryOf(search.q, 80),
    role: matchOf(ROLE_KEY, search.role),
    branch: listOf(search.branch, (entry) => RECORD_ID.test(entry)),
    status: listIn(TEAM_STATUS_VALUES, search.status),
    created: readCreatedFilter(search.created),
    sort: sortOf(TEAM_SORT_KEYS, search.sort),
  };
}

/** Validated `?…` search params for `/users/roles`. */
export interface RolesSearch {
  /** The role on screen — Front desk when absent (H:5179). */
  role?: string;
}

/** Parse `/users/roles` search params: the selected role, when it is one. */
export function validateRolesSearch(search: Record<string, unknown>): RolesSearch {
  return { role: matchOf(ROLE_KEY, search.role) };
}
