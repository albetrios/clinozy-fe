import { z } from 'zod';

import { phoneSchema } from './clinic-schema.ts';
import { leadRecordSchema } from './leads-contracts.ts';

/**
 * Contact threads (D32, S:251–262): a person who is not a lead still chats in
 * a lead record of `kind = contact_thread` — hidden from every lead list,
 * count, filter and task rule (S:261). `ensureContactThread` finds the
 * person's thread or opens one, idempotently (Appendix F: one server op; the
 * prototype matched by name and opened a new thread on every task, H:4272).
 */

/** What opens the thread — it seeds the first system line. */
export const contactThreadContextSchema = z.discriminatedUnion('kind', [
  /** "Appointment #<seq> · <service>"; its service becomes the thread's interest. */
  z.object({ kind: z.literal('appointment'), appointmentId: z.uuid() }),
  /** "Task · <title>" (an appointment task seeds its appointment's line). */
  z.object({ kind: z.literal('task'), taskId: z.uuid() }),
]);
/** What opens a thread. */
export type ContactThreadContext = z.infer<typeof contactThreadContextSchema>;

/**
 * The person, by id — their own lead or thread, their patient record, or (for
 * a contact with neither) their mobile. Never by name.
 */
export const ensureContactThreadInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    patientId: z.uuid().nullable().default(null),
    leadId: z.uuid().nullable().default(null),
    phone: phoneSchema.nullable().default(null),
    context: contactThreadContextSchema.nullable().default(null),
  })
  .refine(
    (person) =>
      person.patientId !== null || person.leadId !== null || person.phone !== null,
    { message: 'Name the patient, the lead or a mobile number', path: ['phone'] },
  );
/** A lookup-or-create as callers write it. */
export type EnsureContactThreadInput = z.input<typeof ensureContactThreadInputSchema>;

/** The person's thread, and whether this call opened it. */
export const ensureContactThreadResultSchema = z.object({
  lead: leadRecordSchema,
  created: z.boolean(),
});
/** The person's thread, and whether this call opened it. */
export type EnsureContactThreadResult = z.infer<typeof ensureContactThreadResultSchema>;

/** TanStack Query keys for contact threads. */
export const contactThreadQueryKeys = {
  all: ['clinic', 'contact-threads'] as const,
};

/**
 * The person's thread: their lead, else their existing contact thread, else a
 * new contact thread (status and source empty, owner the signed-in member,
 * interest the visit's service), seeded with one system line. A second call
 * for the same person returns the same thread. REPLACE_WITH_API:
 * `ensureContactThread` (Appendix F); the fixture world loads on demand.
 */
export async function ensureContactThread(
  input: EnsureContactThreadInput,
): Promise<EnsureContactThreadResult> {
  const { ensureContactThreadInWorld } =
    await import('./fixtures/contact-threads.fixtures.ts');
  return ensureContactThreadInWorld(input);
}
