import { z } from 'zod';

import { appointmentRowSchema } from './appointments-contracts.ts';
import {
  civilDateSchema,
  isoDateTimeSchema,
  leadInterestSchema,
  leadStatusSchema,
  paiseSchema,
} from './clinic-schema.ts';
import { leadRecordSourceSchema } from './leads-contracts.ts';
import { type VisitStage, visitStageSchema } from './visits-contracts.ts';

/**
 * Today's floor (KICKOFF §6.2; `schema-routes.md` S:1577–1578): today's
 * bookings with what the desk needs beside each — the visit's stage, the
 * money, the pack, the Rx still to fill — plus the open enquiries. The
 * Enquiries and Pharmacy lanes and the cards' flags are Appendix F requests;
 * `todayPulse` is derived from the floor on the client. REPLACE_WITH_API.
 */

/** How long the floor stays fresh while the tab is visible (S:1577: a 60 s poll). */
export const TODAY_REFETCH_MS = 60_000;

/**
 * The floor's lanes, in their fixed order (`today.md:19`; D20: seven lanes,
 * no Done lane). `today.search.ts` declares the same list for the URL.
 */
export const TODAY_LANES = [
  'enquiries',
  'arriving',
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
] as const;
/** One lane. */
export type TodayLane = (typeof TODAY_LANES)[number];

/** A read of the floor: the clinic day (today when omitted) and the header's branches (empty = all). */
export const todayFloorParamsSchema = z.object({
  date: civilDateSchema.optional(),
  branchIds: z.array(z.uuid()).max(20).default([]),
});
/** Floor params, defaults filled. */
export type TodayFloorParams = z.infer<typeof todayFloorParamsSchema>;
/** Floor params as callers write them. */
export type TodayFloorParamsInput = z.input<typeof todayFloorParamsSchema>;

/** The visit a checked-in booking is on, as the floor needs it. */
const todayVisitSchema = z.object({
  id: z.uuid(),
  stage: visitStageSchema,
  /** When the current stage began. */
  stageAt: isoDateTimeSchema,
});

/** The prescription a visit left for the pharmacy: approved, not yet sold (S:1577 "unfilled Rx"). */
const todayPrescriptionSchema = z.object({
  id: z.uuid(),
  /** When the doctor approved it — "Rx approved 10:05". */
  approvedAt: isoDateTimeSchema,
  /** "3 medicines prescribed". */
  items: z.number().int().nonnegative(),
});
/** A floor row's unfilled Rx. */
export type TodayPrescription = z.infer<typeof todayPrescriptionSchema>;

/**
 * One booking on today's floor: the appointment row every view reads, and the
 * facts its card shows — the visit (none until its first move: a checked-in
 * booking with no visit is waiting), a first visit, what the person owes, the
 * bill of this visit, their pack, the Rx to fill and their allergies (the
 * schema has none yet — Appendix F).
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const todayFloorRowSchema = appointmentRowSchema.extend({
  visit: todayVisitSchema.nullable(),
  /** No visit of theirs came before this one. */
  firstVisit: z.boolean(),
  /** What they owe the clinic across their invoices. */
  dueTotal: paiseSchema,
  /** What is still to pay on today's bill — the Checkout card's "₹<n> to pay". */
  toPay: paiseSchema,
  /** The package this visit uses a session of, or their open one. */
  pack: z
    .object({
      used: z.number().int().nonnegative(),
      total: z.number().int().positive(),
    })
    .nullable(),
  prescription: todayPrescriptionSchema.nullable(),
  allergies: z.array(z.string()),
});
/** A floor row. */
export type TodayFloorRow = z.infer<typeof todayFloorRowSchema>;

/**
 * An open enquiry that wrote in today (the Enquiries lane, Appendix F): a lead
 * that is not a contact thread, not closed and not yet a patient, with the
 * time and words of their latest message.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const todayEnquirySchema = z.object({
  id: z.uuid(),
  seq: z.number().int().nonnegative(),
  name: z.string(),
  status: leadStatusSchema,
  source: leadRecordSourceSchema.nullable(),
  interests: z.array(leadInterestSchema),
  /** When they last wrote in. */
  askedAt: isoDateTimeSchema,
  /** What they wrote. */
  message: z.string().nullable(),
});
/** An enquiry on the floor. */
export type TodayEnquiry = z.infer<typeof todayEnquirySchema>;

/** The in-clinic stages a checked-in booking's visit shows in (a stage of its own, else Waiting). */
const VISIT_LANES: Readonly<Record<VisitStage, TodayLane | null>> = {
  waiting: 'waiting',
  with_doctor: 'with_doctor',
  treatment: 'treatment',
  checkout: 'checkout',
  pharmacy: 'pharmacy',
  done: null,
};

/**
 * The lane a booking stands in (KICKOFF §6.2 Stage machine; the stage is
 * server-derived from the status, the visit and the Rx, S:352): booked and
 * not checked in → Arriving; checked in → its visit's stage (Waiting before
 * the first move); completed with an Rx still to fill → Pharmacy; anything
 * else is off the floor (null). One rule for the server's filter and the
 * room's lanes.
 */
export function todayLaneOf(
  row: Pick<TodayFloorRow, 'status' | 'visit' | 'prescription'>,
): TodayLane | null {
  switch (row.status) {
    case 'scheduled':
    case 'confirmed':
      return 'arriving';
    case 'checked_in':
      return row.visit ? VISIT_LANES[row.visit.stage] : 'waiting';
    case 'completed':
      return row.prescription && row.visit?.stage !== 'done' ? 'pharmacy' : null;
    default:
      return null;
  }
}
