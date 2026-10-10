import { z } from 'zod';

import { userSchema } from './clinic-schema.ts';

/*
 * The fixture world's staff (REPLACE_WITH_API): the people a room still on fixtures shows — a
 * Medical sale's "Prescribed by", the fixture leads' viewer. The live team is clinozy-be's
 * memberships (`useTeam`, `useTeamDirectory`); nothing here is read by a room on the API.
 */

/** A fixture staff member: the contract's `User` (`S:184–209`) and the membership it stands for. */
export const staffProfileSchema = userSchema.extend({
  /** The clinozy-be membership it stands for; null for a seeded member. */
  membershipId: z.string().nullable(),
});

/** A fixture staff member. */
export type StaffProfile = z.infer<typeof staffProfileSchema>;
