import { z } from 'zod';

import {
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from './clinic-list-filters.ts';
import {
  APPOINTMENT_STATUS_VALUES,
  appointmentSchema,
  type AppointmentStatus,
  type AppointmentType,
  appointmentTypeSchema,
  cancelReasonSchema,
  civilDateSchema,
  clockTimeSchema,
  deliveryStatusSchema,
  type ImageAlbum,
  isoDateTimeSchema,
  type LeadKind,
  type LeadStatus,
  type PatientType,
  type Presence,
  type Role,
  roomSchema,
  type Tone,
} from './clinic-schema.ts';
import type { LeadRecordSource } from './leads-fixture-contracts.ts';

/*
 * The Appointments domain beyond the generated contract (KICKOFF §6.4, D22):
 * the plan's fields the screens show — each a fixture field until clinozy-be
 * serves it (Appendix F, REPLACE_WITH_API) — the rows the views read (the
 * person and the doctor joined, the plan counts), the Agenda / range / slot
 * reads' params, and what a client sends to book, edit, move, cancel and
 * restore. Read by Appointments, Today, the patient file, Tasks and the
 * appointment form wherever it is stacked.
 */

// ── Records ──

/**
 * An appointment as the rooms read it: the contract's `Appointment`
 * (`S:321–353`) plus the "Latest update" data and the package link the plan
 * asks for (Appendix F, REPLACE_WITH_API).
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

/** Who a booking is for: a patient, a lead, or a contact (a contact-thread lead, D32). */
export type AppointmentPersonKind = 'patient' | 'lead' | 'contact';

/** The booked person as every view shows them (avatar, name, mobile, "P" badge). */
export interface AppointmentPerson {
  kind: AppointmentPersonKind;
  name: string;
  /** An Indian mobile in E.164. */
  phone: string | null;
  patientId: string | null;
  leadId: string | null;
  /** The patient's or the lead's `seq`; null for a contact. */
  seq: number | null;
}

/** A bookable staff member — the doctor chip, the doctor pickers, the Day strip. */
export interface AppointmentStaff {
  id: string;
  firstName: string;
  lastName: string | null;
  initials: string;
  tone: Tone;
  /** Real roles — a therapist reads "Therapist", never "Doctor" (§7.3). */
  roles: Role[];
  presence: Presence;
  active: boolean;
}

/**
 * One appointment as a view reads it: the record, the person and the doctor
 * joined, and the plan behind "Plan ready · <n> offerings" — the suggestions
 * for this visit and the patient's whole plan (`S:352`, derived, never stored).
 */
export type AppointmentRow = AppointmentRecord & {
  person: AppointmentPerson;
  doctor: AppointmentStaff | null;
  plan: { visit: number; patient: number };
};

// ── Lengths and slots ──

/** Each type's default length in minutes (`S:1131–1135`): picking a type sets it. */
export const APPOINTMENT_TYPE_MINUTES: Readonly<Record<AppointmentType, number>> = {
  consultation: 20,
  follow_up: 15,
  treatment: 60,
  package_session: 45,
  other: 30,
};

/**
 * A booking's service when neither an offering nor a label names one: its
 * type's (`AP_TYPE`, H:3418) — stored text, as the design writes it.
 */
export const APPOINTMENT_TYPE_SERVICES: Readonly<Record<AppointmentType, string>> = {
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  treatment: 'Treatment',
  package_session: 'Package session',
  other: 'Other',
};

/** The form's length chips, in minutes (`appointments.md:76`). */
export const APPOINTMENT_LENGTHS = [15, 20, 30, 45, 60, 90, 120] as const;

/** The slot grid's step, 30 minutes by default (`appointments.md:85`). */
export const APPOINTMENT_SLOT_STEPS = [30, 15] as const;
/** One slot step. */
export type AppointmentSlotStep = (typeof APPOINTMENT_SLOT_STEPS)[number];

// ── Views ──

/**
 * The room's four views (D27; `view=agenda*|day|week|month` — the schema's
 * `day|week|list`, default `day`, is stale, Appendix F). Week is not offered
 * on a phone: a Week link renders Day there.
 */
export const APPOINTMENT_VIEWS = ['agenda', 'day', 'week', 'month'] as const;
/** One view. */
export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number];

// ── Filters and list reads ──

/** "Active" (Q-A5): Scheduled, Confirmed and Checked in — in the Agenda and the calendars. */
const ACTIVE_APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
] as const satisfies readonly AppointmentStatus[];

/** The Filters' STATUS chips: All · Active (open) · one status (default Active). */
export const APPOINTMENT_STATUS_FILTERS = [
  'active',
  'all',
  ...APPOINTMENT_STATUS_VALUES,
] as const;
/** One status filter. */
export type AppointmentStatusFilter = (typeof APPOINTMENT_STATUS_FILTERS)[number];

/** The statuses a status filter lets through. */
export function statusesForFilter(
  filter: AppointmentStatusFilter,
): readonly AppointmentStatus[] {
  if (filter === 'active') return ACTIVE_APPOINTMENT_STATUSES;
  if (filter === 'all') return APPOINTMENT_STATUS_VALUES;
  return [filter];
}

/** The Agenda's sortable columns, sorted inside each day (Contact A–Z, Service, Status). */
export const APPOINTMENT_SORT_KEYS = ['contact', 'service', 'status'] as const;
/** One Agenda sort key. */
export type AppointmentSortKey = (typeof APPOINTMENT_SORT_KEYS)[number];

/** The search a list read takes: name, mobile or "#seq", spaces and "#" ignored (Q-A12). */
export const APPOINTMENT_SEARCH_MAX = 80;

/** The filters every appointment read shares (Filters, the toolbar search, the branch picker). */
const appointmentFiltersSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS_FILTERS).default('active'),
  /** "APPOINTED TO": any of these doctors; empty = every doctor. */
  doctorIds: z.array(z.uuid()).max(50).default([]),
  created: z
    .custom<CreatedFilter>((value) => readCreatedFilter(value) !== undefined)
    .optional(),
  followUp: z
    .custom<FollowUpFilter>((value) => readFollowUpFilter(value) !== undefined)
    .optional(),
  q: z.string().max(APPOINTMENT_SEARCH_MAX).optional(),
  /** The header branch picker; empty = every branch. */
  branchIds: z.array(z.uuid()).max(20).default([]),
});

/**
 * The Agenda's read (`listAppointments`, `S:1603`; Appendix F's plan
 * changes): from today on — or the one day picked in Filters, past days
 * included — by day, then the sort inside the day, then the time; cursor
 * pages of 50.
 */
export const appointmentListParamsSchema = appointmentFiltersSchema.extend({
  date: civilDateSchema.optional(),
  /** A column sorted inside each day (asc → desc → off); none is by time. */
  sort: z.enum(APPOINTMENT_SORT_KEYS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});
/** Agenda params, defaults filled. */
export type AppointmentListParams = z.infer<typeof appointmentListParamsSchema>;
/** Agenda params as callers write them. */
export type AppointmentListParamsInput = z.input<typeof appointmentListParamsSchema>;

/** The longest range one calendar read covers — a Month board's six weeks. */
export const APPOINTMENT_RANGE_MAX_DAYS = 42;

/**
 * The calendars' read (`listAppointmentsRange`, `S:1602`): every booking from
 * `from` to `to` (both included) — a day, a week or a month board — by date
 * and time, no paging.
 */
export const appointmentRangeParamsSchema = appointmentFiltersSchema
  .extend({ from: civilDateSchema, to: civilDateSchema })
  .refine((range) => range.to >= range.from, {
    message: 'The range ends before it starts',
    path: ['to'],
  });
/** Range params, defaults filled. */
export type AppointmentRangeParams = z.infer<typeof appointmentRangeParamsSchema>;
/** Range params as callers write them. */
export type AppointmentRangeParamsInput = z.input<typeof appointmentRangeParamsSchema>;

/**
 * One Agenda day's counts (Appendix F's per-day summary — a day can straddle
 * two cursor pages): its bookings in view, how many are confirmed and how many
 * still wait for a reply (Scheduled) — "<n> confirmed · <n> awaiting reply".
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const appointmentDaySummarySchema = z.object({
  date: civilDateSchema,
  total: z.number().int().nonnegative(),
  confirmed: z.number().int().nonnegative(),
  scheduled: z.number().int().nonnegative(),
});
/** One day's counts. */
export type AppointmentDaySummary = z.infer<typeof appointmentDaySummarySchema>;

/**
 * The slot grid's read (`availableSlots`, `S:1605`; Q-A3, Q-A4): the starts
 * a doctor can take on a day for a length — inside the branch's opening hours
 * and the doctor's working days and hours, every `step` minutes, the passed
 * ones left out — each free or taken by an overlapping booking of the same
 * doctor. `exceptId` is the booking being moved (its own slot reads free).
 */
export const availableSlotsParamsSchema = z.object({
  date: civilDateSchema,
  doctorId: z.uuid(),
  durationMin: z.number().int().min(5).max(240),
  branchId: z.uuid().optional(),
  step: z.union([z.literal(30), z.literal(15)]).default(30),
  exceptId: z.uuid().optional(),
});
/** Slot params as callers write them. */
export type AvailableSlotsParamsInput = z.input<typeof availableSlotsParamsSchema>;

/**
 * One start in the slot grid.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const appointmentSlotSchema = z.object({
  time: clockTimeSchema,
  free: z.boolean(),
});
/** One start in the slot grid. */
export type AppointmentSlot = z.infer<typeof appointmentSlotSchema>;

// ── Writes ──

/** "Length" (`S:340`): 5–240 minutes, in steps of 5. */
const durationSchema = z
  .number()
  .int()
  .min(5, 'Pick a length of at least 5 minutes')
  .max(240, 'Pick a length up to 240 minutes')
  .refine((minutes) => minutes % 5 === 0, 'Pick a length in steps of 5 minutes');

/**
 * Every field a client sends for a booking, with the contract's ranges
 * (`S:321–353`): the person (a patient, a lead or a contact thread — at least
 * one), the service, the doctor, the slot, Reason (≤ 160) and Notes (≤ 2,000)
 * — saved on create too (Q-A9).
 */
export const appointmentFieldsSchema = z.object({
  patientId: z.uuid().nullable(),
  leadId: z.uuid().nullable(),
  branchId: z.uuid(),
  type: appointmentTypeSchema,
  offeringId: z.uuid().nullable(),
  serviceLabel: z.string().trim().min(1, 'Pick a service').max(120),
  doctorId: z.uuid({ message: 'Pick a doctor' }),
  therapistId: z.uuid().nullable(),
  room: roomSchema.nullable(),
  date: civilDateSchema,
  startTime: clockTimeSchema,
  durationMin: durationSchema,
  reason: z.string().trim().max(160).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  followUpAt: isoDateTimeSchema.nullable(),
  patientPackageId: z.uuid().nullable(),
});
/** A booking's fields. */
export type AppointmentFields = z.infer<typeof appointmentFieldsSchema>;

/** {@link appointmentFieldsSchema} with its whole-record rule: someone to book. */
export const appointmentInputSchema = appointmentFieldsSchema.refine(
  (fields) => fields.patientId !== null || fields.leadId !== null,
  { message: 'Pick who the appointment is for', path: ['patientId'] },
);

/**
 * A person the search did not find (`createAppointment`, `S:1609`: "new contact
 * name+phone → contact-thread Lead"): booking them opens their contact thread
 * — or finds the one already on that mobile.
 */
export interface AppointmentNewContact {
  name: string;
  /** E.164 — the contract's Lead needs a mobile. */
  phone: string;
}

/**
 * A new booking (`createAppointment`, `S:1609`): who, the doctor and the slot
 * are required; the type defaults to Consultation and its length, the service
 * to the offering's name, the branch to the member's. Who is a patient, a lead
 * or `newContact`. `copyOf` names the booking a Copy or Rebook starts from (the
 * server sets `copiedFromId`). It saves as Scheduled.
 */
export type AppointmentCreateInput = Pick<
  AppointmentFields,
  'doctorId' | 'date' | 'startTime'
> &
  Partial<AppointmentFields> & { copyOf?: string; newContact?: AppointmentNewContact };

/**
 * An edit (`updateAppointment`, `S:1610`): any field, and the status the
 * form's tiles picked. A new date or time on a Scheduled or Confirmed booking
 * moves it — back to Scheduled, with `rescheduledFrom` (`S:344`).
 */
export type AppointmentPatch = Partial<AppointmentFields> & {
  status?: AppointmentStatus;
};

/** The status moves a client asks for directly (the popover, the card, Today). */
const APPOINTMENT_STATUS_MOVES = [
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
] as const satisfies readonly AppointmentStatus[];

/** A status change (`setAppointmentStatus`, `S:1582`); Cancel and Restore have their own writes. */
export const appointmentStatusInputSchema = z.object({
  id: z.uuid(),
  status: z.enum(APPOINTMENT_STATUS_MOVES),
});
/** A status change. */
export type AppointmentStatusInput = z.infer<typeof appointmentStatusInputSchema>;

/** A cancel note's limit (`cancelNote`, `S:343`). */
const APPOINTMENT_CANCEL_NOTE_MAX = 280;

/**
 * A cancel (`cancelAppointment`, `S:1611`): one of the contract's reasons
 * (D32) and a note — required for "Other" (`S:1154`).
 */
export const appointmentCancelInputSchema = z
  .object({
    id: z.uuid(),
    reason: cancelReasonSchema,
    note: z.string().trim().max(APPOINTMENT_CANCEL_NOTE_MAX).nullable(),
  })
  .refine((cancel) => cancel.reason !== 'other' || Boolean(cancel.note), {
    message: 'Add a short note for "Other"',
    path: ['note'],
  });
/** A cancel. */
export type AppointmentCancelInput = z.input<typeof appointmentCancelInputSchema>;

/**
 * A status write's answer: the row after it, and the token that undoes it —
 * the status and every side effect (the toast's Undo, 10s, D32).
 */
export interface AppointmentChange {
  appointment: AppointmentRow;
  undoToken: string;
}

/** An edit's answer: the row after it, and whether the slot moved. */
export interface AppointmentUpdate {
  appointment: AppointmentRow;
  moved: boolean;
}

// ── The appointment form's reads ──

/**
 * The person a booking prefill names (`create/?who=<patientId|leadId>`, `S:27`)
 * — the booked person, plus what the form defaults from them: the patient's
 * usual doctor (`Patient.doctorId`, `S:335`) and their care types ("Patient ·
 * <care>").
 */
export interface AppointmentBookingPerson extends AppointmentPerson {
  usualDoctorId: string | null;
  types: readonly PatientType[];
}

/**
 * Whom a read is about: any of the person's ids and their mobile — a patient,
 * a lead, a contact thread, or someone found by phone.
 */
export interface AppointmentPersonLookup {
  patientId: string | null;
  leadId: string | null;
  /** E.164. */
  phone: string | null;
}

/**
 * A lead connected to the booked person (`getAppointment`'s "connected leads",
 * `S:1604`): their own, the leads on their patient record and the enquiries on
 * their mobile — the form's "Connected lead" chips and its "Lead" radios. Never
 * a contact thread.
 */
export interface AppointmentConnectedLead {
  id: string;
  seq: number;
  status: LeadStatus | null;
  kind: LeadKind;
  source: LeadRecordSource | null;
  /** The contract's interests' values and the custom ones, as typed. */
  interests: readonly string[];
  ownerName: string | null;
  patientId: string | null;
  /** ISO instant the lead came in. */
  createdAt: string;
}

/**
 * A paid package a Package session can use a session of (C19, Appendix F):
 * its offering, the sessions used of the total and the last day it is valid.
 */
export interface AppointmentPackageOption {
  id: string;
  offeringId: string;
  name: string;
  tone: Tone;
  /** The offering's session length — what picking the package sets the length to. */
  durationMin: number;
  sessionsTotal: number;
  sessionsUsed: number;
  validUntil: string;
}

/**
 * A photo to file under a visit (`uploadVisitPhotos`, `S:1613`): the booking,
 * the album and the storage key the upload tray confirmed.
 */
export interface VisitPhotoInput {
  appointmentId: string;
  album: ImageAlbum;
  key: string;
  fileName: string;
}
