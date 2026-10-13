import { z } from 'zod';

import { appointmentSchema, deliveryStatusSchema } from './app-schema.ts';

/*
 * The fixture world's bookings beyond the generated contract (KICKOFF §6.4, D22): the record the
 * fixture world and its servers store — the tasks server's booking outcomes among them — for the
 * rooms still on fixtures. Appointments, Today and the patient file read clinozy-be
 * (`appointments-contracts.ts`, D151, D152).
 */

/**
 * An appointment as the fixture world stores it: the contract's `Appointment` (`S:321–353`) plus
 * the "Latest update" data and the package link the plan asks for (Appendix F, REPLACE_WITH_API).
 */
export const appointmentRecordSchema = appointmentSchema.extend({
  /**
   * The latest WhatsApp message about this slot — the confirm request, then
   * the reminder — by its delivery state ("✓ Reminder sent / delivered /
   * read"); null until one goes out. A booking or a move starts it again.
   */
  reminder: deliveryStatusSchema.nullable(),
  /** Confirmed automatically by a WhatsApp "Yes" ("✓ Replied Yes"). */
  repliedYes: z.boolean(),
  /** How many times the booking moved to another slot ("✓ Moved ×<n>"). */
  moveCount: z.number().int().nonnegative(),
  /** The package a Package session uses a session of (C19). */
  patientPackageId: z.uuid().nullable(),
});
/** An appointment record — the contract's fields and the plan's. */
export type AppointmentRecord = z.infer<typeof appointmentRecordSchema>;
