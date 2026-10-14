/*
 * A branch's places and days as the branch drawer's "Places & days" step reads and writes them
 * (KICKOFF §6.6 Places & days, D3, D23; clinozy-be `/app/branches/{branch_id}/rooms`,
 * `…/machines`, `…/holidays`): the rooms and machines a booking can take — each switched on or
 * off — and the days the branch is closed. Every member reads them (`organization:read`); adding
 * one needs `branch:create`, renaming or switching one off `branch:update`, removing one
 * `branch:delete`.
 */

/** A room or a machine — the two places a booking can take, one shape on the wire. */
export type BranchPlaceKind = 'room' | 'machine';

/** clinozy-be's limits: a room's or machine's name and a holiday's label, each 1–60 characters. */
export const BRANCH_PLACE_LIMITS = { name: 60, label: 60 } as const;

/** One room (`brm_…`) or machine of a branch. */
export interface BranchPlace {
  id: string;
  branchId: string;
  name: string;
  /** Switched on — offered to bookings; a switched-off one stays listed here. */
  active: boolean;
  createdAt: string;
  /** The read's `updated_at` — a change's `expected_updated_at`. */
  updatedAt: string;
}

/** One day a branch is closed — no slots are offered. */
export interface BranchHoliday {
  id: string;
  branchId: string;
  /** `YYYY-MM-DD`, clinic-local. */
  date: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

/** A room's or machine's change: a new name, or switched on or off. */
export type BranchPlaceChange = { name: string } | { active: boolean };
