import type {
  MemberInvitation,
  MembershipStatus,
} from '@/shared/api/organization-contracts.ts';

import type { Tone, Weekday } from './app-schema.ts';

/*
 * The Users domain beyond clinozy-be's wire (KICKOFF §6.12 Data; research-users §2–§3): the
 * Team's member view — a clinozy-be membership as the room reads it, with who is the owner and
 * who is "you" — its sort keys, and how a name makes avatar initials. Read by the Users room.
 */

// ── Records ──

/**
 * A Team row: one clinozy-be membership (`GET /tenancy/organization/memberships`) — the staff
 * profile lives on the membership: number, phone, tone, roles, branches, hours and commission.
 */
export interface TeamMember {
  /** The membership id — the key of every member write and of `users/$userId/edit`. */
  membershipId: string;
  userId: string;
  /** The sign-in id; read-only once invited (an edit sends no email). */
  email: string;
  status: MembershipStatus;
  /** The live invitation of an invited member; null for everyone who has joined. */
  invitation: MemberInvitation | null;
  /** ISO 8601; null until the invitation is accepted. */
  joinedAt: string | null;
  /** When the membership was made (the Created filter). */
  createdAt: string;
  /** The read's `updated_at` — the Updated column, and an edit's `expected_updated_at`. */
  updatedAt: string;
  /** The organization's owner — never edited, suspended or removed from here. */
  isOwner: boolean;
  /** The signed-in member — no Status change and no Delete on their own row. */
  isSelf: boolean;
  /** The name the person set on their profile; their email until they set one. */
  name: string;
  initials: string;
  tone: Tone;
  /** Every role the member holds (`rol_…`), the main role first. */
  roleIds: string[];
  /** The clinic's running number — "#12". */
  seq: number;
  phone: string | null;
  branchIds: string[];
  workingDays: Weekday[];
  /** `HH:MM`. */
  startsAt: string;
  /** `HH:MM`. */
  endsAt: string;
  /** 0–100, up to two decimals. */
  commissionPercent: number;
}

// ── Names ──

/**
 * Avatar initials as the Team makes them (`usIni`, H:3607): a leading "Dr."
 * dropped, then the first letters of the first and last words. Only a title
 * followed by a space is dropped — the prototype's pattern also ate the "Dr"
 * of a name like "Drishti".
 */
export function staffInitials(name: string): string {
  const words = name
    .replace(/^Dr\.?\s+/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const head = words[0]?.[0] ?? '';
  const tail = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return `${head}${tail}`.toUpperCase();
}

// ── List reads ──

/**
 * The Team's sort keys (H:5150): ID, User, Email, Roles (by the main role),
 * Commission, Status, Updated. Branches and Working hours don't sort.
 */
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
export type TeamSortKey = (typeof TEAM_SORT_KEYS)[number];
