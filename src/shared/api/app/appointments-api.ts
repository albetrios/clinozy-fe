import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { toneForLabel } from '@/shared/app/app-tone-label.ts';
import { personInitials } from '@/shared/components/Cells/PersonAvatar/person-name.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { createdRangeOf } from './app-filter-ranges.ts';
import { appToday } from './app-time.ts';
import {
  appointmentBodyOf,
  type AppointmentCancel,
  type AppointmentCreateInput,
  type AppointmentDayCount,
  appointmentDayCountWire,
  type AppointmentFields,
  type AppointmentFilters,
  type AppointmentListParams,
  type AppointmentMoveRoute,
  type AppointmentRangeParams,
  type AppointmentRecord,
  type AppointmentRow,
  appointmentRowWire,
  type AppointmentSlotDay,
  appointmentSlotDayWire,
  type AppointmentSlotParams,
  type AppointmentStaff,
  appointmentWire,
  statusesForFilter,
  toAppointmentRecord,
} from './appointments-contracts.ts';
import {
  fetchMemberNames,
  fetchTeamDirectory,
  teamDirectoryQueryKey,
} from './directory-api.ts';

/*
 * The Appointments domain on clinozy-be (`/app/appointments`, api-integration §5.3): the Agenda
 * in pages, the calendars' ranges, the day counts, one booking, the free slots, and the writes —
 * book, copy, change (with the read's `updated_at`), one route per status move, cancel with its
 * reason. Every row carries its doctor from the team directory. Every write carries the action's
 * key.
 */

/** TanStack Query keys for the bookings, each carrying the organization. */
export const appointmentQueryKeys = {
  all: ['app', 'appointments'] as const,
  /** Every Agenda read — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...appointmentQueryKeys.all, organizationId, 'list'] as const,
  list: (organizationId: string | null, params: AppointmentListParams) =>
    [...appointmentQueryKeys.lists(organizationId), params] as const,
  counts: (
    organizationId: string | null,
    window: { from: string; to: string; doctorId?: string; branchIds: readonly string[] },
  ) => [...appointmentQueryKeys.all, organizationId, 'counts', window] as const,
  range: (organizationId: string | null, params: AppointmentRangeParams) =>
    [...appointmentQueryKeys.all, organizationId, 'range', params] as const,
  detail: (organizationId: string | null, appointmentId: string) =>
    [...appointmentQueryKeys.all, organizationId, 'detail', appointmentId] as const,
  /** Every slot grid — a refused booking refreshes them. */
  slotDays: (organizationId: string | null) =>
    [...appointmentQueryKeys.all, organizationId, 'slots'] as const,
  slots: (organizationId: string | null, params: AppointmentSlotParams) =>
    [...appointmentQueryKeys.slotDays(organizationId), params] as const,
  /** A person's bookings — the patient file's Visits. */
  person: (organizationId: string | null, contactId: string) =>
    [...appointmentQueryKeys.all, organizationId, 'person', contactId] as const,
};

/** One page of the Agenda — the design's 50. */
const PAGE_SIZE = 50;
/** One page of a calendar's range — the API's most. */
const RANGE_PAGE_SIZE = 100;

/** The filters every list read shares, as the API names them. */
function filterQuery(filters: AppointmentFilters, today: string) {
  const created = filters.created ? createdRangeOf(filters.created, today) : {};
  const q = filters.q?.trim();
  return {
    status:
      filters.status === 'all' ? undefined : statusesForFilter(filters.status).join(','),
    doctor_membership_id: filters.doctorId,
    branch_ids: filters.branchIds.length ? filters.branchIds.join(',') : undefined,
    q: q === '' ? undefined : q,
    created_from: created.from,
    created_to: created.to,
  };
}

/**
 * The Agenda's query: from today on, or the one day picked in Filters — by date, then start
 * (the API's default sort).
 */
export function appointmentListQuery(
  params: AppointmentListParams,
  today: string = appToday(),
) {
  return {
    ...filterQuery(params, today),
    limit: PAGE_SIZE,
    appointment_date_from: params.date ?? today,
    appointment_date_to: params.date,
  };
}

/** The organization the cached team belongs to. */
const activeOrganizationId = () => useOrganizationStore.getState().organizationId;

/** A member who left, from their name alone. */
function formerMember(id: string, name: string): AppointmentStaff {
  return {
    id,
    userId: '',
    name,
    initials: personInitials(name),
    tone: toneForLabel(name),
    roleIds: [],
    branchIds: [],
  };
}

/**
 * The bookings with their doctors: the team directory (cached five minutes), and the names of
 * any who have left since.
 */
async function withDoctors(records: AppointmentRecord[]): Promise<AppointmentRow[]> {
  if (records.length === 0) return [];
  const team = await queryClient.query({
    queryKey: teamDirectoryQueryKey(activeOrganizationId()),
    queryFn: fetchTeamDirectory,
    staleTime: 5 * 60_000,
  });
  const byId = new Map(team.map((member) => [member.id, member]));
  const missing = records.map((row) => row.doctorId).filter((id) => !byId.has(id));
  const names = missing.length ? await fetchMemberNames(missing) : new Map();
  return records.map((row) => {
    const name = names.get(row.doctorId);
    const doctor =
      byId.get(row.doctorId) ?? (name ? formerMember(row.doctorId, name) : null);
    return { ...row, doctor };
  });
}

/** One page of the Agenda; `after` is the previous page's cursor. */
export async function listAppointments(
  params: AppointmentListParams,
  after?: string,
): Promise<{ rows: AppointmentRow[]; next: string | null; total: number | null }> {
  const response = await api.get('/app/appointments', {
    query: { ...appointmentListQuery(params), after },
  });
  const pagination = response.meta?.pagination;
  const records = z
    .array(appointmentRowWire)
    .parse(response.data ?? [])
    .map(toAppointmentRecord);
  return {
    rows: await withDoctors(records),
    next: pagination?.has_more ? (pagination.next ?? null) : null,
    total: pagination?.estimated_total ?? null,
  };
}

/** A person's bookings, newest first — every page (`contact_id`); the patient file's Visits. */
export async function fetchPersonAppointments(
  contactId: string,
): Promise<AppointmentRow[]> {
  const records = await collectAllPages(async (after) => {
    const response = await api.get('/app/appointments', {
      query: {
        contact_id: contactId,
        sort: 'appointment_date',
        order: 'desc',
        limit: RANGE_PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(appointmentRowWire)
        .parse(response.data ?? [])
        .map(toAppointmentRecord),
      next: response.meta?.pagination?.has_more
        ? (response.meta.pagination.next ?? null)
        : null,
    };
  }, 'appointments-person');
  return withDoctors(records);
}

/** Every booking a Day, Week or Month board shows — every page of the range. */
export async function fetchAppointmentRange(
  params: AppointmentRangeParams,
): Promise<AppointmentRow[]> {
  const query = {
    ...filterQuery(params, appToday()),
    limit: RANGE_PAGE_SIZE,
    appointment_date_from: params.from,
    appointment_date_to: params.to,
  };
  const records = await collectAllPages(async (after) => {
    const response = await api.get('/app/appointments', {
      query: { ...query, after: after ?? undefined },
    });
    return {
      rows: z
        .array(appointmentRowWire)
        .parse(response.data ?? [])
        .map(toAppointmentRecord),
      next: response.meta?.pagination?.has_more
        ? (response.meta.pagination.next ?? null)
        : null,
    };
  }, 'appointments-range');
  return withDoctors(records);
}

/**
 * Each day's counts from `from` to `to` (both included, up to 62 days) — within the branches and
 * the doctor; the status, search and created filters do not narrow them.
 */
export async function fetchAppointmentDayCounts({
  from,
  to,
  doctorId,
  branchIds,
}: {
  from: string;
  to: string;
  doctorId?: string;
  branchIds: readonly string[];
}): Promise<AppointmentDayCount[]> {
  const response = await api.get('/app/appointments/daily-counts', {
    query: {
      date_from: from,
      date_to: to,
      doctor_membership_id: doctorId,
      branch_ids: branchIds.length ? branchIds.join(',') : undefined,
    },
  });
  return z
    .array(appointmentDayCountWire)
    .parse(response.data ?? [])
    .map((day) => ({
      date: day.appointment_date,
      total: day.total,
      byStatus: {
        scheduled: day.by_status.scheduled ?? 0,
        confirmed: day.by_status.confirmed ?? 0,
        checked_in: day.by_status.checked_in ?? 0,
        completed: day.by_status.completed ?? 0,
        cancelled: day.by_status.cancelled ?? 0,
        no_show: day.by_status.no_show ?? 0,
      },
    }));
}

/** One booking — a 404 when it is gone or in a branch the member cannot see. */
export async function fetchAppointment(appointmentId: string): Promise<AppointmentRow> {
  const response = await api.get('/app/appointments/{appointment_id}', {
    params: { appointment_id: appointmentId },
  });
  const [row] = await withDoctors([
    toAppointmentRecord(appointmentWire.parse(response.data)),
  ]);
  if (!row) throw new Error('appointment read without a row');
  return row;
}

/**
 * A day's free starts for a doctor and a length (`GET /app/appointments/slots`) — or why the
 * day takes none: past, the branch inactive, a closed day, a holiday, the doctor off.
 */
export async function fetchAppointmentSlots(
  params: AppointmentSlotParams,
): Promise<AppointmentSlotDay> {
  const response = await api.get('/app/appointments/slots', {
    query: {
      appointment_date: params.date,
      branch_id: params.branchId,
      doctor_membership_id: params.doctorId,
      duration_minutes: params.durationMin,
      step_minutes: params.step,
    },
  });
  const day = appointmentSlotDayWire.parse(response.data);
  return {
    date: day.appointment_date,
    isOpen: day.is_open,
    closedReason: day.closed_reason,
    closedLabel: day.closed_label,
    slots: day.slots.map((slot) => ({ time: slot.start_time, endTime: slot.end_time })),
  };
}

// ── Writes ──

/** The written booking with its doctor. */
async function rowOf(data: unknown): Promise<AppointmentRow> {
  const [row] = await withDoctors([toAppointmentRecord(appointmentWire.parse(data))]);
  if (!row) throw new Error('appointment write without a row');
  return row;
}

/**
 * Book a contact — `409 slot_taken`, `slot_in_past`, `slot_closed` or `slot_outside_hours`
 * when the slot cannot take it.
 */
export async function createAppointment({
  input,
  idempotencyKey,
}: {
  input: AppointmentCreateInput;
  idempotencyKey: string;
}): Promise<AppointmentRow> {
  const { contactId, ...fields } = input;
  const body = appointmentBodyOf(fields);
  const response = await api.post('/app/appointments', {
    body: {
      ...body,
      contact_id: contactId,
      branch_id: fields.branchId,
      doctor_membership_id: fields.doctorId,
    },
    idempotencyKey,
  });
  return rowOf(response.data);
}

/** Book the same again on another day and start (Copy, Rebook) — the create's 409s apply. */
export async function copyAppointment({
  appointmentId,
  date,
  startTime,
  idempotencyKey,
}: {
  appointmentId: string;
  date: string;
  startTime: string;
  idempotencyKey: string;
}): Promise<AppointmentRow> {
  const response = await api.post('/app/appointments/{appointment_id}/copy', {
    params: { appointment_id: appointmentId },
    body: { appointment_date: date, start_time: startTime },
    idempotencyKey,
  });
  return rowOf(response.data);
}

/**
 * A change — refused (`409 record_changed`) when the booking changed since `expectedUpdatedAt`;
 * a new slot moves it (`409 appointment_not_movable` after check-in) and a moved confirmed
 * booking is scheduled again.
 */
export async function updateAppointment({
  appointmentId,
  fields,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  appointmentId: string;
  fields: Partial<AppointmentFields>;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}): Promise<AppointmentRow> {
  const response = await api.patch('/app/appointments/{appointment_id}', {
    params: { appointment_id: appointmentId },
    body: { ...appointmentBodyOf(fields), expected_updated_at: expectedUpdatedAt },
    idempotencyKey,
  });
  return rowOf(response.data);
}

/** Each move's route. */
const MOVE_PATHS = {
  confirm: '/app/appointments/{appointment_id}/confirm',
  'check-in': '/app/appointments/{appointment_id}/check-in',
  complete: '/app/appointments/{appointment_id}/complete',
  'no-show': '/app/appointments/{appointment_id}/no-show',
  reinstate: '/app/appointments/{appointment_id}/reinstate',
  'undo-check-in': '/app/appointments/{appointment_id}/undo-check-in',
} as const satisfies Record<AppointmentMoveRoute, string>;

/** One status move — `409 transition_not_allowed` (or `appointment_not_due`) when it cannot run. */
export async function moveAppointment({
  appointmentId,
  route,
  idempotencyKey,
}: {
  appointmentId: string;
  route: AppointmentMoveRoute;
  idempotencyKey: string;
}): Promise<AppointmentRow> {
  const response = await api.post(MOVE_PATHS[route], {
    params: { appointment_id: appointmentId },
    idempotencyKey,
  });
  return rowOf(response.data);
}

/** Cancel a scheduled or confirmed booking with its reason; its slot frees. */
export async function cancelAppointment({
  appointmentId,
  cancel,
  idempotencyKey,
}: {
  appointmentId: string;
  cancel: AppointmentCancel;
  idempotencyKey: string;
}): Promise<AppointmentRow> {
  const response = await api.post('/app/appointments/{appointment_id}/cancel', {
    params: { appointment_id: appointmentId },
    body: { cancel_reason: cancel.reason, cancel_note: cancel.note ?? undefined },
    idempotencyKey,
  });
  return rowOf(response.data);
}
