import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  type AppointmentType,
  appointmentTypeSchema,
  civilDateSchema,
  clockTimeSchema,
  isoDateTimeSchema,
  type LeadInterest,
  leadInterestSchema,
  type LeadStatus,
  leadStatusSchema,
} from './app-schema.ts';

/**
 * Today's floor (KICKOFF §6.2) on clinozy-be: today's open bookings (`GET /app/appointments`),
 * each in the lane its `status` and `visit_stage` put it in, with the doctor's and the room's
 * names and the approved prescription a pharmacy card dispenses; and the open enquiries waiting
 * for a reply (`GET /app/leads`). The pulse is counted from the floor. What the design's cards
 * also showed — a first visit, the pack, dues, "₹n to pay", allergies, the enquiry's message —
 * has no field in the API (api-integration §8 G1) and is not shown.
 */

/** How long the floor stays fresh while the tab is visible (a 60 s poll). */
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

/** A checked-in visit's floor stages (`visit_stage`), forward only — the API's order. */
const FLOOR_STAGES = [
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
] as const;
/** One floor stage. */
export type FloorStage = (typeof FLOOR_STAGES)[number];

/** The booking statuses on the floor: booked (Arriving) and checked in (the visit's stage). */
export const FLOOR_STATUSES = ['scheduled', 'confirmed', 'checked_in'] as const;
/** A status on the floor. */
type FloorStatus = (typeof FLOOR_STATUSES)[number];

/** A read of the floor: the clinic day (today when omitted) and the header's branches (empty = all). */
export const todayFloorParamsSchema = z.object({
  date: civilDateSchema.optional(),
  branchIds: z.array(z.string().min(1)).max(20).default([]),
});
/** Floor params, defaults filled. */
export type TodayFloorParams = z.infer<typeof todayFloorParamsSchema>;
/** Floor params as callers write them. */
export type TodayFloorParamsInput = z.input<typeof todayFloorParamsSchema>;

// ── The wire ──

type ApiAppointmentRow = NonNullable<ApiData<'/app/appointments', 'get'>>[number];
type ApiLeadRow = NonNullable<ApiData<'/app/leads', 'get'>>[number];
type ApiPrescriptionRow = NonNullable<
  ApiData<'/app/patient-prescriptions', 'get'>
>[number];

/** The parts of an appointment row the floor reads. */
export const floorAppointmentWire = wireSchema<ApiAppointmentRow>()(
  z.object({
    id: z.string(),
    appointment_number: z.number().int(),
    contact_id: z.string(),
    contact: z
      .object({
        first_name: z.string(),
        last_name: z.string().nullable(),
        primary_phone: z.string(),
      })
      .nullable(),
    patient_id: z.string().nullable(),
    lead_id: z.string().nullable(),
    branch_id: z.string(),
    type: appointmentTypeSchema,
    service_label: z.string(),
    doctor_membership_id: z.string(),
    branch_room_id: z.string().nullable(),
    start_time: clockTimeSchema,
    status: z.enum(FLOOR_STATUSES),
    visit_stage: z.enum(FLOOR_STAGES).nullable(),
    visit_stage_changed_at: isoDateTimeSchema.nullable(),
    checked_in_at: isoDateTimeSchema.nullable(),
    is_walk_in: z.boolean(),
    updated_at: isoDateTimeSchema,
  }),
);
/** A floor appointment as the API sends it. */
export type FloorAppointmentWire = z.output<typeof floorAppointmentWire>;

/** The parts of a lead row the Enquiries lane reads. */
export const enquiryLeadWire = wireSchema<ApiLeadRow>()(
  z.object({
    id: z.string(),
    lead_number: z.number().int(),
    contact: z
      .object({
        first_name: z.string(),
        last_name: z.string().nullable(),
      })
      .nullable(),
    status: leadStatusSchema,
    source: z
      .enum([
        'instagram',
        'google',
        'whatsapp',
        'facebook',
        'walk_in',
        'referral',
        'retarget',
      ])
      .nullable(),
    interests: z.array(leadInterestSchema),
    last_activity_at: isoDateTimeSchema.nullable(),
  }),
);
/** An enquiry as the API sends it. */
export type EnquiryLeadWire = z.output<typeof enquiryLeadWire>;

/** The parts of a pharmacy-queue prescription a pharmacy card reads. */
export const floorPrescriptionWire = wireSchema<ApiPrescriptionRow>()(
  z.object({
    id: z.string(),
    patient_id: z.string(),
    appointment_id: z.string().nullable(),
    items: z.array(z.object({ medicine_name: z.string() })),
    approved_at: isoDateTimeSchema.nullable(),
  }),
);
/** A pharmacy-queue prescription as the API sends it. */
export type FloorPrescriptionWire = z.output<typeof floorPrescriptionWire>;

// ── The room's shapes ──

/** The approved prescription a pharmacy card dispenses — "Rx approved 10:05", "3 medicines". */
export interface TodayPrescription {
  /** The prescription's id. */
  id: string;
  patientId: string;
  /** When the doctor approved it. */
  approvedAt: string;
  /** How many medicines it lists. */
  items: number;
}

/** One booking on today's floor. */
export interface TodayFloorRow {
  /** The appointment's id. */
  id: string;
  appointmentNumber: number;
  contactId: string;
  /** The contact's name — "Riya Shah". */
  name: string;
  phone: string | null;
  /** The patient file (opened by the check-in), or none yet. */
  patientId: string | null;
  /** The contact's open lead, or none. */
  leadId: string | null;
  branchId: string;
  type: AppointmentType;
  /** The service as booked — "Hydrafacial". */
  serviceLabel: string;
  doctorMembershipId: string;
  /** The doctor's display name, when the member list has them. */
  doctorName: string | null;
  /** The room's name, when the booking has one. */
  roomName: string | null;
  /** `HH:mm`, clinic-local. */
  startTime: string;
  status: FloorStatus;
  /** A checked-in visit's stage; null before the check-in. */
  visitStage: FloorStage | null;
  /** When the current stage began. */
  visitStageChangedAt: string | null;
  checkedInAt: string | null;
  isWalkIn: boolean;
  updatedAt: string;
  /** The approved prescription still to fill, on a pharmacy card. */
  prescription: TodayPrescription | null;
}

/** An open enquiry waiting for a reply (the Enquiries lane). */
export interface TodayEnquiry {
  /** The lead's id. */
  id: string;
  leadNumber: number;
  name: string;
  status: LeadStatus;
  /** Where the lead came from — the card's channel flag. */
  source: EnquiryLeadWire['source'];
  interests: LeadInterest[];
  /**
   * The lead's latest activity — the card's time. An enquiry awaiting a reply last heard from
   * them, so this is their latest message unless the team logged a note or a call since (the
   * time of the message itself is not on the row, api-integration §8 G1).
   */
  lastActivityAt: string;
}

/** A contact summary's full name. */
function contactName(
  contact: { first_name: string; last_name: string | null } | null,
): string {
  if (!contact) return '';
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
}

/** What a floor row joins by id: the doctors' and rooms' names, the pharmacy queue. */
export interface FloorLookups {
  doctorNames: ReadonlyMap<string, string>;
  /** Room names by room id, across the floor's branches. */
  roomNames: ReadonlyMap<string, string>;
  /** Approved prescriptions still to fill, by appointment id. */
  prescriptions: ReadonlyMap<string, TodayPrescription>;
}

/** A floor appointment as the room reads it. */
export function toTodayFloorRow(
  row: FloorAppointmentWire,
  lookups: FloorLookups,
): TodayFloorRow {
  return {
    id: row.id,
    appointmentNumber: row.appointment_number,
    contactId: row.contact_id,
    name: contactName(row.contact),
    phone: row.contact?.primary_phone ?? null,
    patientId: row.patient_id,
    leadId: row.lead_id,
    branchId: row.branch_id,
    type: row.type,
    serviceLabel: row.service_label,
    doctorMembershipId: row.doctor_membership_id,
    doctorName: lookups.doctorNames.get(row.doctor_membership_id) ?? null,
    roomName: row.branch_room_id
      ? (lookups.roomNames.get(row.branch_room_id) ?? null)
      : null,
    startTime: row.start_time,
    status: row.status,
    visitStage: row.visit_stage,
    visitStageChangedAt: row.visit_stage_changed_at,
    checkedInAt: row.checked_in_at,
    isWalkIn: row.is_walk_in,
    updatedAt: row.updated_at,
    prescription:
      row.visit_stage === 'pharmacy' ? (lookups.prescriptions.get(row.id) ?? null) : null,
  };
}

/** An approved pharmacy-queue prescription, or null when it is not approved. */
export function toTodayPrescription(
  row: FloorPrescriptionWire,
): TodayPrescription | null {
  if (!row.approved_at) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    approvedAt: row.approved_at,
    items: row.items.length,
  };
}

/** An enquiry as the lane reads it, or null when the lead has no activity yet. */
export function toTodayEnquiry(row: EnquiryLeadWire): TodayEnquiry | null {
  if (!row.last_activity_at) return null;
  return {
    id: row.id,
    leadNumber: row.lead_number,
    name: contactName(row.contact),
    status: row.status,
    source: row.source,
    interests: row.interests,
    lastActivityAt: row.last_activity_at,
  };
}

/**
 * The lane a booking stands in: booked and not checked in → Arriving; checked in → its visit's
 * stage (`waiting` until the first move). A completed booking is not on the floor.
 */
export function todayLaneOf(
  row: Pick<TodayFloorRow, 'status' | 'visitStage'>,
): TodayLane {
  if (row.status === 'checked_in') return row.visitStage ?? 'waiting';
  return 'arriving';
}
