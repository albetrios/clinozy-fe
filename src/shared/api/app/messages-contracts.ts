import { z } from 'zod';

import {
  appointmentStatusSchema,
  type Channel,
  checkinFeelSchema,
  civilDateSchema,
  clockTimeSchema,
  invoiceTypeSchema,
  isoDateTimeSchema,
  leadKindSchema,
  leadMessageSchema,
  paiseSchema,
  paymentModeSchema,
  phoneSchema,
  reviewSourceSchema,
  roleSchema,
  taskOutcomeSchema,
  toneSchema,
} from './app-schema.ts';
import { leadRecordSourceSchema } from './leads-fixture-contracts.ts';

/*
 * The messaging domain beyond the generated contract (KICKOFF §3.5 Chat column,
 * §3.6; `S:268–286`, `S:1589`, `S:1595`): whose thread a chat column shows, what
 * the composer sends, and the reads the column needs — the thread with its
 * messages and their authors, the person's contact history, the channel
 * status and the template values. A chat reads a contact's stream on
 * clinozy-be; the contact-history feed is a backend request (Appendix F
 * "Messaging") the column draws once clinozy-be serves it — REPLACE_WITH_API.
 */

// ── Who and what ──

/**
 * The channels the composer sends on (`sendMessage`, `S:1595`): WhatsApp,
 * Instagram, a logged call and a team note. SMS and e-mail are read-only in
 * the thread.
 */
const COMPOSER_MODES = [
  'whatsapp',
  'instagram',
  'call',
  'note',
] as const satisfies readonly Channel[];
/** Zod enum of {@link COMPOSER_MODES}. */
const composerModeSchema = z.enum(COMPOSER_MODES);
/** One composer mode — a sendable channel. */
export type ComposerMode = z.infer<typeof composerModeSchema>;

/**
 * Whose conversation a chat column shows — one thread per person (D32): a
 * contact's stream on clinozy-be (`/app/contacts/:contact_id/activities`).
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const chatPersonSchema = z.object({
  kind: z.literal('contact'),
  contactId: z.string(),
});
/** A contact on clinozy-be, by id. */
export type ChatPerson = z.infer<typeof chatPersonSchema>;

/** A stable key per person — the thread's query keys, its draft and its outbox. */
export function chatPersonKey(person: ChatPerson): string {
  return `contact:${person.contactId}`;
}

/** The composer's limit (`S:279`, the textarea's `maxLength`). */
export const MESSAGE_MAX_LENGTH = 1000;

/** What `sendMessage` takes (`S:1595`): the thread, the channel and a 1–1000 character body. */
export const sendMessageInputSchema = z.object({
  leadId: z.uuid(),
  channel: composerModeSchema,
  body: z
    .string()
    .trim()
    .min(1, 'Type a message first')
    .max(MESSAGE_MAX_LENGTH, 'Keep it under 1,000 characters'),
});
/** A `sendMessage` request. */
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

// ── The thread ──

/** The thread a person's chat lives in: the lead (`kind` enquiry / retarget) or a contact thread. */
const chatThreadSchema = z.object({
  leadId: z.uuid(),
  kind: leadKindSchema,
  /** When the lead came in — "Lead created · <time> · via <source>". */
  createdAt: isoDateTimeSchema,
  /** The contract's sources and the plan's "Phone call" (`LEAD_RECORD_SOURCE_VALUES`). */
  source: leadRecordSourceSchema.nullable(),
  /** Set once the person is a patient (a converted lead, or a patient's contact thread). */
  patientId: z.uuid().nullable(),
});
/** A person's thread. */
export type ChatThread = z.infer<typeof chatThreadSchema>;

/**
 * A team member as the thread shows them — the sender line and its "Sent this"
 * card (REPLACE_WITH_API: the staff profile read, `S:184–210`).
 */
const chatAuthorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  initials: z.string(),
  tone: toneSchema,
  roles: z.array(roleSchema),
  phone: phoneSchema.nullable(),
  email: z.string().nullable(),
  /** Absent when the room cannot know it (a contact's stream). */
  online: z.boolean().optional(),
});
/** A message's author. */
export type ChatAuthor = z.infer<typeof chatAuthorSchema>;

/**
 * A message as the chat column reads it — a fixture thread's `LeadMessage`, or an entry of a
 * contact's stream on clinozy-be (`contact-activities-api.ts`).
 */
const chatMessageSchema = leadMessageSchema.pick({
  id: true,
  channel: true,
  direction: true,
  body: true,
  deliveryStatus: true,
  isSystem: true,
  authorId: true,
  taskId: true,
  sentAt: true,
});
/** One message of a chat thread. */
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * The chat's read of `getLead` (`S:1589`): the thread — `null` while a patient
 * has none yet — its messages oldest first, and the authors they name.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const chatThreadReadSchema = z.object({
  thread: chatThreadSchema.nullable(),
  messages: z.array(chatMessageSchema),
  authors: z.record(z.string(), chatAuthorSchema),
});
/** A thread with its messages and authors. */
export type ChatThreadRead = z.infer<typeof chatThreadReadSchema>;

/**
 * Channel health the composer warns about (Q-L10: hidden until the backend signals it).
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const messagingStatusSchema = z.object({
  /** WhatsApp is down: WhatsApp replies queue, and the composer says so. */
  whatsappDown: z.boolean(),
  /**
   * A messaging service delivers this thread's messages. False for a contact's stream on
   * clinozy-be: delivery is a separate service, not built yet (backend D87), so every message waits
   * `queued` in the outbox — the thread labels it "Queued", the composer says why.
   */
  isConnected: z.boolean(),
});
/** The channels' status. */
export type MessagingStatus = z.infer<typeof messagingStatusSchema>;

// ── Contact history ──

/**
 * When something happened: an instant (shown with its clock time) or a
 * calendar date the contract stores without one (shown as the day alone).
 */
const chatWhenSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('instant'), at: isoDateTimeSchema }),
  z.object({ kind: z.literal('day'), date: civilDateSchema }),
]);
/** An instant or a day. */
export type ChatWhen = z.infer<typeof chatWhenSchema>;

const historyBase = {
  /** The record's id (a reminder carries its appointment's). */
  id: z.uuid(),
  when: chatWhenSchema,
  /** Where it sorts among the messages, oldest first (ISO instant). */
  sortAt: isoDateTimeSchema,
};

/**
 * One line of a person's contact history (KICKOFF §3.5; `_patterns.md:184–193`),
 * merged with the conversation oldest → newest: their appointments and the
 * reminders sent for them, prescriptions, treatments, invoices, payments,
 * check-ins, reviews and task outcomes — joined by id, never by name (§7.3).
 * Names are display names; money is paise.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const contactHistoryEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    ...historyBase,
    kind: z.literal('appointment'),
    seq: z.number().int().nonnegative(),
    service: z.string(),
    status: appointmentStatusSchema,
    doctorName: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('reminder'),
    service: z.string(),
    /** The visit the reminder was for. */
    visitAt: isoDateTimeSchema,
  }),
  z.object({
    ...historyBase,
    kind: z.literal('prescription'),
    patientId: z.uuid(),
    seq: z.number().int().nonnegative(),
    medicines: z.array(z.string()),
    doctorName: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('treatment'),
    patientId: z.uuid(),
    name: z.string(),
    session: z.number().int().nonnegative(),
    therapistName: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('invoice'),
    patientId: z.uuid(),
    seq: z.number().int().nonnegative(),
    type: invoiceTypeSchema,
    bill: paiseSchema,
    due: paiseSchema,
  }),
  z.object({
    ...historyBase,
    kind: z.literal('payment'),
    patientId: z.uuid(),
    refund: z.boolean(),
    amount: paiseSchema,
    modes: z.array(paymentModeSchema),
    invoiceSeq: z.number().int().nonnegative().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('checkIn'),
    patientId: z.uuid(),
    feel: checkinFeelSchema,
    score: z.number().int().nonnegative().nullable(),
    /** What the check-in followed ("Consultation", "Day-2 call after LHR"). */
    context: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('review'),
    patientId: z.uuid(),
    source: reviewSourceSchema,
    rating: z.number().int().nonnegative().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('task'),
    title: z.string(),
    outcome: taskOutcomeSchema,
    /**
     * What the server wrote when the task closed ("Booked a visit"; Appendix F,
     * `TaskRecord.result`) — null where only the contract's outcome is known.
     */
    result: z.string().nullable(),
  }),
]);
/** One contact-history line. */
export type ContactHistoryEntry = z.infer<typeof contactHistoryEntrySchema>;

// ── Composer values ──

/** A clinic-local slot, `YYYY-MM-DD` + `HH:mm`. */
const chatSlotSchema = z.object({ date: civilDateSchema, time: clockTimeSchema });
/** A free slot. */
export type ChatSlot = z.infer<typeof chatSlotSchema>;

/**
 * What the starters, templates and "Fill in" chips put in a message — from the
 * organisation and the thread's branch, never literals (§7.3): the clinic's
 * name, the branch address, its maps and review links (Appendix F
 * "Branches"), and the next two free slots (REPLACE_WITH_API: the slot read).
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const chatTemplateValuesSchema = z.object({
  clinicName: z.string(),
  address: z.string(),
  mapsLink: z.string(),
  reviewLink: z.string(),
  freeSlots: z.array(chatSlotSchema),
});
/** The clinic's template values. */
export type ChatTemplateValues = z.infer<typeof chatTemplateValuesSchema>;
