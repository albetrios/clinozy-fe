/**
 * Route builders for the Users room — the Team, Roles & access, Branches and their
 * drawers (KICKOFF §6.12; `S:104–110`) — `{ to, params }` for TanStack Router's
 * typed `navigate` / `Link`, like `builders.ts`. A module of their own, imported
 * by path and never through the `@/lib/routes/index.ts` barrel, which rides the
 * entry chunk: only the code that goes to these routes loads them.
 */

/** The Users room — its first tab, the Team, which the user drawers open over. */
export function organizationUsers(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/users',
    params: { organizationSlug },
  } as const;
}

/** The New user drawer (an invitation, D17) over the Team (`S:105`). */
export function organizationUserCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/users/create',
    params: { organizationSlug },
  } as const;
}

/** Users › Roles & access (`S:107`); `?role=` names the role on screen. */
export function organizationUsersRoles(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/users/roles',
    params: { organizationSlug },
  } as const;
}

/** Users › Branches (`S:108`) — every branch, open and closed. */
export function organizationUsersBranches(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/users/branches',
    params: { organizationSlug },
  } as const;
}

/** The New branch drawer over Branches (`S:109`). */
export function organizationUsersBranchCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/users/branches/create',
    params: { organizationSlug },
  } as const;
}

/** A branch's drawer over Branches (`S:110`). */
export function organizationUsersBranchEdit(organizationSlug: string, branchId: string) {
  return {
    to: '/organization/$organizationSlug/users/branches/$branchId/edit',
    params: { organizationSlug, branchId },
  } as const;
}

/** A member's drawer over the Team, keyed by membership id (`S:106`). */
export function organizationUserEdit(organizationSlug: string, userId: string) {
  return {
    to: '/organization/$organizationSlug/users/$userId/edit',
    params: { organizationSlug, userId },
  } as const;
}
