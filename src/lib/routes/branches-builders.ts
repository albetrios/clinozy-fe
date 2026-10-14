/**
 * Route builders for the Branches room — the list and its drawers (KICKOFF §6.12;
 * `S:108–110`; its own room since change-branches-in-navbar) — `{ to, params }` for
 * TanStack Router's typed `navigate` / `Link`, like `builders.ts`. A module of their
 * own, imported by path and never through the `@/lib/routes/index.ts` barrel, which
 * rides the entry chunk: only the code that goes to these routes loads them.
 */

/** The Branches room (`S:108`) — every branch, open and closed. */
export function organizationBranches(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/branches',
    params: { organizationSlug },
  } as const;
}

/** The New branch drawer over Branches (`S:109`). */
export function organizationBranchCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/branches/create',
    params: { organizationSlug },
  } as const;
}

/** A branch's drawer over Branches (`S:110`). */
export function organizationBranchEdit(organizationSlug: string, branchId: string) {
  return {
    to: '/organization/$organizationSlug/branches/$branchId/edit',
    params: { organizationSlug, branchId },
  } as const;
}
