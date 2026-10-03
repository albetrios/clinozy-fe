import { z } from 'zod';

import { clinicRoleKeySchema } from './access-contracts.ts';
import {
  clockTimeSchema,
  phoneSchema,
  presenceSchema,
  toneSchema,
  userSchema,
  weekdaySchema,
} from './clinic-schema.ts';

/*
 * The Users domain beyond the generated contract (KICKOFF §6.12 Data, D17):
 * the staff profile the clinic keeps for each member until clinozy-be stores
 * those fields on the membership (Appendix F, REPLACE_WITH_API), the Team's
 * member view — a clinozy-be membership joined with its profile — and what a
 * client sends to save a profile. Read by the Users room, `useClinicAccess`
 * (the signed-in member's clinic roles) and every person picker.
 */

// ── Records ──

/**
 * A staff profile: the contract's `User` (`S:184–209`) with the plan's fields
 * (Appendix F, REPLACE_WITH_API). `roles` keeps the contract's roles; the
 * plan's `roleKeys` holds every clinic role in pick order — the first is the
 * main role — custom roles included. A save keeps the two in step.
 */
export const staffProfileSchema = userSchema.extend({
  /** Every clinic role in pick order, custom roles included; `roles` is its contract subset. */
  roleKeys: z.array(clinicRoleKeySchema),
  /** The clinozy-be membership the profile belongs to; null until one claims it (a seeded profile). */
  membershipId: z.string().nullable(),
});

/** A staff profile. */
export type StaffProfile = z.infer<typeof staffProfileSchema>;

/** A clinozy-be membership's status. */
const membershipStatusSchema = z.enum(['active', 'invited', 'suspended']);

/** The live invitation behind an invited member (clinozy-be). */
const memberInvitationSchema = z.object({
  id: z.string(),
  /** ISO 8601 — "Invitation expires {{date}}" until then, "Invitation expired" after. */
  expiresAt: z.string(),
});

/**
 * A Team row (KICKOFF §6.12 Data, D17): the clinozy-be membership — email,
 * platform role, status, live invitation — joined with its staff profile. The
 * joined fields take the profile's value and fall back to the membership's;
 * `profile` is null for a member nobody has set up yet.
 */
export const teamMemberSchema = z.object({
  /** The membership id — the key of every member write and of `users/$userId/edit` (AMBER). */
  membershipId: z.string(),
  /** The clinozy-be user. */
  userId: z.string(),
  /** The sign-in id. */
  email: z.string(),
  status: membershipStatusSchema,
  /** The live invitation of an invited member; null for everyone who has joined. */
  invitation: memberInvitationSchema.nullable(),
  /** The membership's one platform role (clinozy-be holds one per membership). */
  platformRoleId: z.string(),
  platformRoleName: z.string(),
  /** ISO 8601; null until the invitation is accepted. */
  joinedAt: z.string().nullable(),
  /** The organisation's owner — no Delete on the row. */
  isOwner: z.boolean(),
  /** The signed-in member — no Delete on their own row. */
  isSelf: z.boolean(),
  /** The profile's full name, else the membership's (its name, or the email until the person sets one). */
  name: z.string(),
  initials: z.string(),
  /** The profile's tone, else the design's hash of the email. */
  tone: toneSchema,
  /** Clinic roles, the main role first: the profile's, and the one the platform role grants. */
  roleKeys: z.array(clinicRoleKeySchema),
  /** The display id "#12"; null without a profile. */
  seq: z.number().int().nonnegative().nullable(),
  phone: phoneSchema.nullable(),
  branchIds: z.array(z.uuid()),
  /** Null when unknown (no profile). */
  presence: presenceSchema.nullable(),
  /** The membership's last activity, else the profile's. */
  lastActiveAt: z.string().nullable(),
  /** The staff profile (fixture until the API keeps it, REPLACE_WITH_API). */
  profile: staffProfileSchema.nullable(),
});

/** A Team row. */
export type TeamMember = z.infer<typeof teamMemberSchema>;

// ── Names ──

const TITLE = /^Dr\.?$/i;

/**
 * One Name field as the contract's first and last names (Appendix F: "without
 * breaking Dr.") — the last word is the last name and a leading "Dr." stays
 * with the first: "Dr. Nisha Mavani" → "Dr. Nisha" · "Mavani"; "Riya" → "Riya".
 */
export function splitStaffName(name: string): {
  firstName: string;
  lastName: string | null;
} {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const tokens =
    words.length > 1 && TITLE.test(words[0] ?? '')
      ? [`${words[0]} ${words[1]}`, ...words.slice(2)]
      : words;
  if (tokens.length < 2) return { firstName: tokens[0] ?? '', lastName: null };
  return { firstName: tokens.slice(0, -1).join(' '), lastName: tokens.at(-1) ?? null };
}

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

// ── Writes ──

/**
 * What the user drawer saves (`createUser` / `updateUser`, `S:1752`, without a
 * password — D17): one Name field (split into the contract's first and last
 * names on save — AMBER), the clinic roles in pick order, the branches, the
 * working hours, the commission and the status. The membership itself is
 * clinozy-be's (`useInviteMember`, `useUpdateMemberRole`, `useUpdateMemberStatus`).
 */
export const staffProfileInputSchema = z
  .object({
    membershipId: z.string().min(1),
    name: z.string().trim().min(1, 'Add name and email').max(60),
    email: z.email('Enter a valid email address').max(120),
    phone: phoneSchema.nullable(),
    tone: toneSchema,
    roleKeys: z.array(clinicRoleKeySchema).min(1, 'Pick at least one role').max(7),
    branchIds: z.array(z.uuid()).max(20),
    workingDays: z.array(weekdaySchema).max(7),
    startsAt: clockTimeSchema,
    endsAt: clockTimeSchema,
    commissionPct: z.number().int().min(0).max(100),
    active: z.boolean(),
  })
  .superRefine((profile, ctx) => {
    if (profile.endsAt <= profile.startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'To must be after From',
      });
    }
  });

/** A staff profile save. */
export type StaffProfileInput = z.infer<typeof staffProfileInputSchema>;

/**
 * A new user's starting values (`users.md:362`; the contract's defaults,
 * `S:184–209`): Front desk, sky, Mon–Sat 10:00–19:00, 0%, Active. The drawer
 * adds the header's branch (or the only open one).
 */
export const STAFF_PROFILE_DEFAULTS: Readonly<
  Omit<StaffProfileInput, 'membershipId' | 'name' | 'email'>
> = {
  phone: null,
  tone: 'sky',
  roleKeys: ['front_desk'],
  branchIds: [],
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  startsAt: '10:00',
  endsAt: '19:00',
  commissionPct: 0,
  active: true,
};

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
