import type { Tone, Weekday } from './app-schema.ts';

/*
 * The Branches domain as Users › Branches reads and writes it (KICKOFF §6.12 Branch drawer, D6;
 * clinozy-be `/app/branches`): a branch, what the branch drawer sends to save one, and its limits.
 * Who works at a branch is the branch's members (`PUT …/branches/:id/members`), each Team row's
 * `branchIds` on the read side.
 */

/** clinozy-be's branch limits: Name ≤ 60, an address line ≤ 120, Area, City and State ≤ 60. */
export const BRANCH_LIMITS = {
  name: 60,
  address: 120,
  place: 60,
  state: 60,
  pin: 6,
  email: 120,
  gstNumber: 15,
} as const;

/** One branch of the clinic (`GET /app/branches?include_inactive=true`). */
export interface AppBranch {
  /** `brn_…`. */
  id: string;
  name: string;
  tone: Tone;
  /** The clinic's main branch — one per clinic, set when it is provisioned. */
  isMain: boolean;
  /** Open; a closed branch is no longer offered anywhere but here. */
  active: boolean;
  addressLine1: string;
  addressLine2: string | null;
  area: string;
  city: string;
  state: string;
  /** Six digits. */
  pin: string;
  /** E.164 (`+91…`). */
  phone: string;
  email: string;
  gstNumber: string | null;
  /** `HH:mm`, clinic-local. */
  opensAt: string;
  closesAt: string;
  workingDays: Weekday[];
  /** The default people, by membership id (`mem_…`) — each one works at the branch. */
  defaultDoctorId: string | null;
  defaultDeskId: string | null;
  defaultTherapistId: string | null;
  defaultPharmacistId: string | null;
  createdAt: string;
  /** The read's `updated_at` — an edit's `expected_updated_at`. */
  updatedAt: string;
}

/**
 * A branch save's fields — clinozy-be's create body in the room's words. Name, the first address
 * line, Area, City, PIN code, Phone and Email are required; Closes is after Opens.
 */
export interface BranchInput {
  name: string;
  tone: Tone;
  active: boolean;
  addressLine1: string;
  addressLine2: string | null;
  area: string;
  city: string;
  /** Empty: not sent. */
  state: string;
  pin: string;
  /** E.164. */
  phone: string;
  email: string;
  gstNumber: string | null;
  workingDays: Weekday[];
  opensAt: string;
  closesAt: string;
  defaultDoctorId: string | null;
  defaultDeskId: string | null;
  defaultTherapistId: string | null;
  defaultPharmacistId: string | null;
}

/** What a branch save sends: a new branch, or an edit of the one read, and who works there. */
export interface BranchSave {
  /** The edited branch; none for a new one. */
  branch?: Pick<AppBranch, 'id' | 'updatedAt'>;
  input: BranchInput;
  /** Everyone who works at the branch after the save (membership ids). */
  memberIds: readonly string[];
  /** An edit's team as it was: the members are written only when they changed. */
  memberIdsBefore?: readonly string[];
}
