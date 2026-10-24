import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import type { CreatedFilter } from './app-list-filters.ts';
import {
  APPOINTMENT_STATUS_VALUES,
  type AppointmentStatus,
  appointmentStatusSchema,
  type AppointmentType,
  appointmentTypeSchema,
  civilDateSchema,
  clockTimeSchema,
  type OfferingSpecialty,
  type Tone,
} from './app-schema.ts';
import { contactNameOf } from './contacts-contracts.ts';
import type { DirectoryMember } from './directory-api.ts';
import { type OfferingRecord, offeringsByName } from './offerings-contracts.ts';

/*
 * The Appointments domain on clinozy-be (KICKOFF §6.4; api-integration §5.3): a booking points
 * at its contact (`contact_id`, the row's `contact` summary) and carries the contact's patient
 * file and open lead (`patient_id`, `lead_id`, A1), the branch, doctor, therapist, room and
 * machine, the slot and length, the status with its stamps, the floor stage, and the reminder
 * state the server keeps. The design's package link, plan counts, per-row reminder delivered /
 * read and the client's own slot maths went with the backend (route map §4, G3).
 */

// ── Records ──

/** Who a booking is for: a patient (their file exists), a lead (an open enquiry) or a contact. */
export type AppointmentPersonKind = 'patient' | 'lead' | 'contact';

/** The booked person as every view shows them (avatar, name, mobile, "P" badge). */
export interface AppointmentPerson {
  kind: AppointmentPersonKind;
  contactId: string;
  /** "Riya Shah" — "" if the contact is gone. */
  name: string;
  /** Their primary number, E.164. */
  phone: string | null;
  patientId: string | null;
  leadId: string | null;
  /** The contact number ("C-12345"); null if the contact is gone. */
  contactNumber: number | null;
}

/** The reminder state the server keeps on a booking — the "Latest update" pill. */
const APPOINTMENT_REMINDER_VALUES = [
  'not_sent',
  'confirm_requested',
  'reminder_queued',
  'reminder_sent',
  'failed',
] as const;
/** One reminder state. */
type AppointmentReminder = (typeof APPOINTMENT_REMINDER_VALUES)[number];

/** A checked-in visit's floor stage, forward only. */
const APPOINTMENT_VISIT_STAGES = [
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
] as const;
/** One floor stage. */
type AppointmentVisitStage = (typeof APPOINTMENT_VISIT_STAGES)[number];

/** Why a booking was cancelled — the API's seven (the design's five plus two of the form's). */
const APPOINTMENT_CANCEL_REASONS = [
  'patient_asked',
  'unreachable',
  'doctor_unavailable',
  'resource_unavailable',
  'rescheduling_later',
  'booked_by_mistake',
  'other',
] as const;
/** One cancel reason. */
export type AppointmentCancelReason = (typeof APPOINTMENT_CANCEL_REASONS)[number];

/** A booking as every Appointments view reads it. */
export interface AppointmentRecord {
  id: string;
  /** "#2841". */
  seq: number;
  contactId: string;
  person: AppointmentPerson;
  patientId: string | null;
  leadId: string | null;
  branchId: string;
  type: AppointmentType;
  offeringId: string | null;
  serviceLabel: string;
  doctorId: string;
  therapistId: string | null;
  roomId: string | null;
  machineId: string | null;
  /** The visit day, clinic-local. */
  date: string;
  /** `HH:mm`, clinic-local. */
  startTime: string;
  endTime: string;
  durationMin: number;
  status: AppointmentStatus;
  cancelReason: AppointmentCancelReason | null;
  cancelNote: string | null;
  /** The slot it moved from, as an instant — set by a move. */
  rescheduledFrom: string | null;
  reason: string | null;
  notes: string | null;
  followUpAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  copiedFromId: string | null;
  reminder: AppointmentReminder;
  /** Confirmed by a WhatsApp "Yes". */
  repliedYes: boolean;
  /** How many times it moved to another slot. */
  moveCount: number;
  visitStage: AppointmentVisitStage | null;
  isWalkIn: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A bookable member — the team directory's member (no role or presence, api-integration M41). */
export type AppointmentStaff = DirectoryMember;

/** One booking as a view draws it: the record and its doctor from the team directory. */
export type AppointmentRow = AppointmentRecord & { doctor: AppointmentStaff | null };

// ── The wire ──

type ApiAppointmentRow = NonNullable<ApiData<'/app/appointments', 'get'>>[number];
type ApiAppointment = NonNullable<ApiData<'/app/appointments/{appointment_id}', 'get'>>;
/** A change as `PATCH /app/appointments/:appointment_id` takes it. */
export type ApiAppointmentChange = NonNullable<
  ApiBody<'/app/appointments/{appointment_id}', 'patch'>
>;

const appointmentFieldsWire = {
  id: z.string(),
  appointment_number: z.number().int(),
  contact_id: z.string(),
  contact: z
    .object({
      contact_number: z.number().int(),
      first_name: z.string(),
      last_name: z.string().nullable(),
      primary_phone: z.string(),
    })
    .nullable(),
  patient_id: z.string().nullable(),
  lead_id: z.string().nullable(),
  branch_id: z.string(),
  type: appointmentTypeSchema,
  offering_id: z.string().nullable(),
  service_label: z.string(),
  doctor_membership_id: z.string(),
  therapist_membership_id: z.string().nullable(),
  branch_room_id: z.string().nullable(),
  branch_machine_id: z.string().nullable(),
  appointment_date: civilDateSchema,
  start_time: clockTimeSchema,
  end_time: clockTimeSchema,
  duration_minutes: z.number().int(),
  status: appointmentStatusSchema,
  cancel_reason: z.enum(APPOINTMENT_CANCEL_REASONS).nullable(),
  cancel_note: z.string().nullable(),
  rescheduled_from: z.string().nullable(),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  follow_up_at: z.string().nullable(),
  checked_in_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  copied_from_appointment_id: z.string().nullable(),
  reminder_status: z.enum(APPOINTMENT_REMINDER_VALUES),
  is_confirmed_by_reply: z.boolean(),
  move_count: z.number().int(),
  visit_stage: z.enum(APPOINTMENT_VISIT_STAGES).nullable(),
  is_walk_in: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** A list row (`GET /app/appointments`). */
export const appointmentRowWire = wireSchema<ApiAppointmentRow>()(
  z.object(appointmentFieldsWire),
);

/** One booking (`GET /app/appointments/:appointment_id`, and every write's answer). */
export const appointmentWire = wireSchema<ApiAppointment>()(
  z.object(appointmentFieldsWire),
);

/** A booking as the API sends it. */
type AppointmentWire = z.output<typeof appointmentRowWire>;

/** Whom a booking is for, by the files the contact has. */
function personKindOf(row: AppointmentWire): AppointmentPersonKind {
  if (row.patient_id) return 'patient';
  return row.lead_id ? 'lead' : 'contact';
}

/** A booking as the rooms read it. */
export function toAppointmentRecord(row: AppointmentWire): AppointmentRecord {
  return {
    id: row.id,
    seq: row.appointment_number,
    contactId: row.contact_id,
    person: {
      kind: personKindOf(row),
      contactId: row.contact_id,
      name: row.contact ? contactNameOf(row.contact) : '',
      phone: row.contact?.primary_phone ?? null,
      patientId: row.patient_id,
      leadId: row.lead_id,
      contactNumber: row.contact?.contact_number ?? null,
    },
    patientId: row.patient_id,
    leadId: row.lead_id,
    branchId: row.branch_id,
    type: row.type,
    offeringId: row.offering_id,
    serviceLabel: row.service_label,
    doctorId: row.doctor_membership_id,
    therapistId: row.therapist_membership_id,
    roomId: row.branch_room_id,
    machineId: row.branch_machine_id,
    date: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMin: row.duration_minutes,
    status: row.status,
    cancelReason: row.cancel_reason,
    cancelNote: row.cancel_note,
    rescheduledFrom: row.rescheduled_from,
    reason: row.reason,
    notes: row.notes,
    followUpAt: row.follow_up_at,
    checkedInAt: row.checked_in_at,
    completedAt: row.completed_at,
    copiedFromId: row.copied_from_appointment_id,
    reminder: row.reminder_status,
    repliedYes: row.is_confirmed_by_reply,
    moveCount: row.move_count,
    visitStage: row.visit_stage,
    isWalkIn: row.is_walk_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
 * A booking's service when neither an offering nor a label names one: its type's (`AP_TYPE`,
 * H:3418) — stored text, as the design writes it.
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

/** The slot grid's step (`step_minutes`), 30 minutes by default (`appointments.md:85`). */
export const APPOINTMENT_SLOT_STEPS = [30, 15] as const;
/** One slot step. */
export type AppointmentSlotStep = (typeof APPOINTMENT_SLOT_STEPS)[number];

/** Why a day takes no booking (`GET /app/appointments/slots`'s `closed_reason`). */
const APPOINTMENT_CLOSED_REASONS = [
  'past',
  'branch_inactive',
  'closed_day',
  'holiday',
  'doctor_off',
] as const;
/** One closed reason. */
export type AppointmentClosedReason = (typeof APPOINTMENT_CLOSED_REASONS)[number];

/** One free start in the slot grid — the server lists free starts only. */
export interface AppointmentSlot {
  time: string;
  endTime: string;
}

/** A day's free starts for a doctor and a length, or why the day is closed. */
export interface AppointmentSlotDay {
  date: string;
  isOpen: boolean;
  closedReason: AppointmentClosedReason | null;
  /** A holiday's name ("Diwali"). */
  closedLabel: string | null;
  slots: AppointmentSlot[];
}

/** What the slot grid asks for: day, branch, doctor, length, step — and the booking moved. */
export interface AppointmentSlotParams {
  date: string;
  branchId: string;
  doctorId: string;
  durationMin: number;
  step: AppointmentSlotStep;
  /** The booking being edited or moved — not busy for itself (`exclude_appointment_id`). */
  excludeAppointmentId?: string;
  /**
   * The room and the machine the booking holds (`branch_room_id`, `branch_machine_id`): their
   * other bookings block a start too, as the save's own checks do.
   */
  roomId?: string;
  machineId?: string;
}

/** The slots wire — `GET /app/appointments/slots` (the OpenAPI document leaves it untyped, M44). */
export const appointmentSlotDayWire = z.object({
  appointment_date: civilDateSchema,
  is_open: z.boolean(),
  closed_reason: z.enum(APPOINTMENT_CLOSED_REASONS).nullable(),
  closed_label: z.string().nullable(),
  slots: z.array(z.object({ start_time: clockTimeSchema, end_time: clockTimeSchema })),
});

/**
 * A treatment the form offers under "From offerings" — an active treatment of the clinic's
 * offerings catalogue: its name becomes the service label, its length the booking's.
 */
export interface AppointmentTreatment {
  id: string;
  name: string;
  durationMin: number;
  specialty: OfferingSpecialty;
  tone: Tone;
}

/**
 * The form's "From offerings" out of the clinic's one offerings catalogue (`useOfferings`): its
 * active treatments, A to Z.
 */
export function bookableTreatmentsOf(
  catalogue: readonly OfferingRecord[],
): AppointmentTreatment[] {
  return offeringsByName(
    catalogue.filter(
      (offering) => offering.category === 'treatment' && offering.isActive,
    ),
  ).map(({ id, name, durationMin, specialty, tone }) => ({
    id,
    name,
    durationMin,
    specialty,
    tone,
  }));
}

// ── Views ──

/**
 * The room's four views (D27; `view=agenda*|day|week|month`). Week is not offered on a phone:
 * a Week link renders Day there.
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

/**
 * The filters every list read shares: the status chips, one doctor ("APPOINTED TO" — the API
 * takes one, G3), the created range, the search and the header's branches.
 */
export interface AppointmentFilters {
  status: AppointmentStatusFilter;
  /** One doctor's bookings; none = every doctor. */
  doctorId?: string;
  created?: CreatedFilter;
  q?: string;
  /** The header branch picker; empty = every branch. */
  branchIds: readonly string[];
}

/** The Agenda's read: from today on — or the one day picked in Filters, past days included. */
export interface AppointmentListParams extends AppointmentFilters {
  date?: string;
}

/** A calendar's read: every booking from `from` to `to`, both included. */
export interface AppointmentRangeParams extends AppointmentFilters {
  from: string;
  to: string;
}

/**
 * One day's counts (`GET /app/appointments/daily-counts`): every status, zeros included —
 * within the branches and the doctor, whatever the status, search and created filters say.
 */
export interface AppointmentDayCount {
  date: string;
  total: number;
  byStatus: Readonly<Record<AppointmentStatus, number>>;
}

/** The daily-counts wire (the OpenAPI document leaves it untyped, M44). */
export const appointmentDayCountWire = z.object({
  appointment_date: civilDateSchema,
  total: z.number().int(),
  by_status: z.partialRecord(appointmentStatusSchema, z.number().int()),
});

/** The longest window one daily-counts read covers. */
export const APPOINTMENT_COUNTS_MAX_DAYS = 62;

// ── Writes ──

/** The booking's own fields a member edits (the person's are the contact's). */
export interface AppointmentFields {
  branchId: string;
  doctorId: string;
  type: AppointmentType;
  offeringId: string | null;
  serviceLabel: string;
  durationMin: number;
  date: string;
  startTime: string;
  reason: string | null;
  notes: string | null;
}

/** A new booking: the contact, and the fields. */
export interface AppointmentCreateInput extends AppointmentFields {
  contactId: string;
}

/** The fields as the API names them. */
export function appointmentBodyOf(
  fields: Partial<AppointmentFields>,
): ApiAppointmentChange {
  const body: ApiAppointmentChange = {};
  if (fields.branchId !== undefined) body.branch_id = fields.branchId;
  if (fields.doctorId !== undefined) body.doctor_membership_id = fields.doctorId;
  if (fields.type !== undefined) body.type = fields.type;
  if (fields.offeringId !== undefined) body.offering_id = fields.offeringId;
  if (fields.serviceLabel !== undefined) body.service_label = fields.serviceLabel;
  if (fields.durationMin !== undefined) body.duration_minutes = fields.durationMin;
  if (fields.date !== undefined) body.appointment_date = fields.date;
  if (fields.startTime !== undefined) body.start_time = fields.startTime;
  if (fields.reason !== undefined) body.reason = fields.reason;
  if (fields.notes !== undefined) body.notes = fields.notes;
  return body;
}

/**
 * A status move — one route each (`POST …/confirm`, `/check-in`, `/complete`, `/no-show`,
 * `/reinstate`, `/undo-check-in`); Cancel takes its reason through {@link AppointmentCancel}.
 */
export type AppointmentMoveRoute =
  'confirm' | 'check-in' | 'complete' | 'no-show' | 'reinstate' | 'undo-check-in';

/** A cancel: one of the API's reasons and an optional note. */
export interface AppointmentCancel {
  reason: AppointmentCancelReason;
  note: string | null;
}
