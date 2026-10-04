import { z } from 'zod';

import {
  clockTimeSchema,
  phoneSchema,
  toneSchema,
  weekdaySchema,
} from './clinic-schema.ts';

/*
 * The Branches domain beyond the generated contract (KICKOFF §6.12 Branch
 * drawer, D6): what the branch drawer sends to save a branch, and how its
 * Team field moves people on and off the branch. REPLACE_WITH_API: the
 * contract's `createBranch` / `updateBranch` (`S:154–181`); the Team is each
 * person's `branchIds` (Appendix F).
 */

/** The branch drawer's limits (`users.md:179–193`): Name ≤ 60, the address ≤ 200, State ≤ 120. */
export const BRANCH_LIMITS = {
  name: 60,
  address: 200,
  state: 120,
  pin: 6,
  email: 254,
  gstNumber: 15,
} as const;

const NAME_MISSING = 'Name the branch';
const ADDRESS_MISSING = 'Add the address';
const CLOSES_AFTER_OPENS = 'Closes must be after Opens';

/**
 * A branch save — the contract's `Branch` minus its server-set fields. Phone
 * and Email may be left empty (`users.md:187–188`) although the contract
 * requires them: an empty one is stored as `''` and shown as "—" (Appendix F,
 * AMBER). `closesAt` must be after `opensAt` (`S:174`).
 */
export const branchInputSchema = z
  .object({
    name: z.string().trim().min(1, NAME_MISSING).max(BRANCH_LIMITS.name),
    tone: toneSchema,
    isMain: z.boolean(),
    active: z.boolean(),
    addressLine1: z.string().trim().min(1, ADDRESS_MISSING).max(BRANCH_LIMITS.address),
    addressLine2: z.string().trim().max(BRANCH_LIMITS.address).nullable(),
    area: z.string().trim().max(BRANCH_LIMITS.address),
    city: z.string().trim().max(BRANCH_LIMITS.address),
    state: z.string().trim().max(BRANCH_LIMITS.state),
    pin: z.string().regex(/^\d{0,6}$/, 'PIN code is 6 digits'),
    phone: z.union([phoneSchema, z.literal('')]),
    email: z.union([z.email().max(BRANCH_LIMITS.email), z.literal('')]),
    gstNumber: z.string().trim().toUpperCase().max(BRANCH_LIMITS.gstNumber).nullable(),
    workingDays: z.array(weekdaySchema).max(7),
    opensAt: clockTimeSchema,
    closesAt: clockTimeSchema,
    defaultDoctorId: z.uuid().nullable(),
    defaultDeskId: z.uuid().nullable(),
    defaultTherapistId: z.uuid().nullable(),
    defaultPharmacistId: z.uuid().nullable(),
  })
  .superRefine((branch, ctx) => {
    if (branch.closesAt <= branch.opensAt) {
      ctx.addIssue({ code: 'custom', path: ['closesAt'], message: CLOSES_AFTER_OPENS });
    }
  });

/** A branch save's fields. */
export type BranchInput = z.infer<typeof branchInputSchema>;

/**
 * Who the save moves on and off the branch: the staff profiles to add it to
 * and to take it off — the Team field's change, never anyone it did not show.
 */
export interface BranchTeamChange {
  add: readonly string[];
  remove: readonly string[];
}

/** What a branch save sends: a new branch (no `id`) or an edit, and its Team change. */
export interface BranchSave {
  id?: string;
  input: BranchInput;
  team: BranchTeamChange;
}
