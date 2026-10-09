import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import { appointmentQueryKeys } from './appointments-api.ts';
import { clinicToday } from './clinic-time.ts';
import { fetchMemberNames, fetchRoomNames } from './directory-api.ts';
import { leadQueryKeys } from './leads-api.ts';
import {
  enquiryLeadWire,
  FLOOR_STATUSES,
  type FloorAppointmentWire,
  floorAppointmentWire,
  floorPrescriptionWire,
  type FloorStage,
  type TodayEnquiry,
  type TodayFloorParams,
  type TodayFloorParamsInput,
  todayFloorParamsSchema,
  type TodayFloorRow,
  type TodayPrescription,
  toTodayEnquiry,
  toTodayFloorRow,
  toTodayPrescription,
} from './today-contracts.ts';

/*
 * The Today API on clinozy-be (KICKOFF §6.2; api-integration §5.1): the floor is today's open
 * bookings, the Enquiries lane the open enquiries awaiting a reply, and a card's move is the
 * booking's own move route — check in (and its Undo while the visit waits), or a later floor
 * stage. Each write carries the user action's idempotency key.
 */

/** A list page's size — the API's most. */
const PAGE_SIZE = 100;

/** Floor params with the day filled (today, clinic-local) and the branches in a stable order. */
export function normalizeTodayFloorParams(
  params: TodayFloorParamsInput = {},
): Required<TodayFloorParams> {
  const parsed = todayFloorParamsSchema.parse(params);
  return {
    date: parsed.date ?? clinicToday(),
    branchIds: [...new Set(parsed.branchIds)].sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * TanStack Query keys for Today, each carrying the active organization. The
 * floor lives under the appointments prefix and the enquiries under the leads
 * one, so every booking, visit, lead or task write — each refetches its
 * domain — refreshes the floor too.
 */
export const todayQueryKeys = {
  floors: () => [...appointmentQueryKeys.all, 'today-floor'] as const,
  floor: (organizationId: string | null, params: TodayFloorParamsInput = {}) =>
    [
      ...todayQueryKeys.floors(),
      organizationId,
      normalizeTodayFloorParams(params),
    ] as const,
  enquiries: (organizationId: string | null, params: TodayFloorParamsInput = {}) =>
    [
      ...leadQueryKeys.all,
      'today-enquiries',
      organizationId,
      normalizeTodayFloorParams(params),
    ] as const,
};

/** The branches filter as the API takes it: a comma list, or none for every branch. */
const branchIdsQuery = (branchIds: readonly string[]) =>
  branchIds.length > 0 ? branchIds.join(',') : undefined;

/** Every open booking of the day in the branches, by start time. */
async function readFloorAppointments({
  date,
  branchIds,
}: Required<TodayFloorParams>): Promise<FloorAppointmentWire[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/appointments', {
      query: {
        limit: PAGE_SIZE,
        after: after ?? undefined,
        appointment_date_from: date,
        appointment_date_to: date,
        branch_ids: branchIdsQuery(branchIds),
        status: FLOOR_STATUSES.join(','),
        sort: 'appointment_date',
        order: 'asc',
      },
    });
    return {
      rows: z.array(floorAppointmentWire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, 'today-floor');
}

/** The day's approved prescriptions still to fill, by appointment — what the pharmacy cards dispense. */
async function readPharmacyQueue(date: string): Promise<Map<string, TodayPrescription>> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/patient-prescriptions', {
      query: {
        limit: PAGE_SIZE,
        after: after ?? undefined,
        status: 'approved',
        is_filled: 'false',
        prescription_date_from: date,
        prescription_date_to: date,
      },
    });
    return {
      rows: z.array(floorPrescriptionWire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, 'today-pharmacy');
  const byAppointment = new Map<string, TodayPrescription>();
  for (const row of rows) {
    const prescription = toTodayPrescription(row);
    if (row.appointment_id && prescription)
      byAppointment.set(row.appointment_id, prescription);
  }
  return byAppointment;
}

/** The rooms' names across the branches the floor's bookings hold a room in. */
async function readRoomNames(
  rows: readonly FloorAppointmentWire[],
): Promise<Map<string, string>> {
  const branches = new Set(
    rows.filter((row) => row.branch_room_id).map((row) => row.branch_id),
  );
  const names = new Map<string, string>();
  for (const branchNames of await Promise.all(
    [...branches].map((branchId) => fetchRoomNames(branchId)),
  )) {
    for (const [id, name] of branchNames) names.set(id, name);
  }
  return names;
}

/** Options for {@link fetchTodayFloor}. */
export interface TodayFloorReadOptions {
  /** Whether the member reads the pharmacy queue (`patient_prescription:read`) — Dispense needs it. */
  readsPrescriptions: boolean;
}

/**
 * Today's floor: the day's scheduled, confirmed and checked-in bookings in the header's branches,
 * every page, by start time — with the doctors' and rooms' names (one read per set, cached) and,
 * when a visit has reached the pharmacy, the day's approved prescriptions still to fill.
 */
export async function fetchTodayFloor(
  params: TodayFloorParamsInput = {},
  options: TodayFloorReadOptions = { readsPrescriptions: false },
): Promise<TodayFloorRow[]> {
  const normalized = normalizeTodayFloorParams(params);
  const rows = await readFloorAppointments(normalized);
  const atPharmacy = rows.some((row) => row.visit_stage === 'pharmacy');
  const [doctorNames, roomNames, prescriptions] = await Promise.all([
    fetchMemberNames(rows.map((row) => row.doctor_membership_id)),
    readRoomNames(rows),
    atPharmacy && options.readsPrescriptions
      ? readPharmacyQueue(normalized.date)
      : new Map<string, TodayPrescription>(),
  ]);
  return rows.map((row) =>
    toTodayFloorRow(row, { doctorNames, roomNames, prescriptions }),
  );
}

/** Where the enquiries read stops: past this many pages it shows what it has. */
const ENQUIRY_PAGES_MAX = 5;

/**
 * The open enquiries awaiting a reply whose latest activity is today (clinic-local), newest
 * first: every page of `kind=enquiry`, open statuses and `is_awaiting_reply`, sorted by
 * `last_activity_at`, read until the first older one.
 */
export async function fetchTodayEnquiries(
  params: TodayFloorParamsInput = {},
): Promise<TodayEnquiry[]> {
  const { date, branchIds } = normalizeTodayFloorParams(params);
  const enquiries: TodayEnquiry[] = [];
  let after: string | undefined;
  for (let page = 0; page < ENQUIRY_PAGES_MAX; page += 1) {
    const response = await api.get('/app/leads', {
      query: {
        limit: PAGE_SIZE,
        after,
        kind: 'enquiry',
        status: 'new,contacted,follow_up,no_response',
        is_awaiting_reply: 'true',
        branch_ids: branchIdsQuery(branchIds),
        sort: 'last_activity_at',
        order: 'desc',
      },
    });
    for (const row of z.array(enquiryLeadWire).parse(response.data ?? [])) {
      const enquiry = toTodayEnquiry(row);
      if (!enquiry || clinicToday(new Date(enquiry.lastActivityAt)) !== date) {
        return enquiries;
      }
      enquiries.push(enquiry);
    }
    const next = response.meta?.pagination?.next;
    if (!next) return enquiries;
    after = next;
  }
  return enquiries;
}

/** A move's input: the booking and the user action's key. */
export interface TodayMove {
  appointmentId: string;
  idempotencyKey: string;
}

/**
 * Check a booking in: it becomes `checked_in` at stage `waiting`; the server opens the contact's
 * patient file and moves their open lead to `clinic_visited`.
 */
export async function checkInAppointment({ appointmentId, idempotencyKey }: TodayMove) {
  await api.post('/app/appointments/{appointment_id}/check-in', {
    params: { appointment_id: appointmentId },
    idempotencyKey,
  });
}

/** Undo a mistaken check-in while the visit still waits (`409 visit_started` after). */
export async function undoCheckIn({ appointmentId, idempotencyKey }: TodayMove) {
  await api.post('/app/appointments/{appointment_id}/undo-check-in', {
    params: { appointment_id: appointmentId },
    idempotencyKey,
  });
}

/** Move a checked-in visit to a later floor stage — forward only, so it has no Undo. */
export async function moveFloorStage({
  appointmentId,
  stage,
  idempotencyKey,
}: TodayMove & { stage: FloorStage }) {
  await api.post('/app/appointments/{appointment_id}/stage', {
    params: { appointment_id: appointmentId },
    body: { visit_stage: stage },
    idempotencyKey,
  });
}
