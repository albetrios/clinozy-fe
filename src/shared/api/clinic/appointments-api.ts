import type { ListPage } from '@/shared/api/fetch-list-page.ts';

import {
  APPOINTMENT_SEARCH_MAX,
  type AppointmentCancelInput,
  type AppointmentChange,
  type AppointmentCreateInput,
  type AppointmentDaySummary,
  type AppointmentListParams,
  type AppointmentListParamsInput,
  appointmentListParamsSchema,
  type AppointmentPatch,
  type AppointmentRangeParams,
  type AppointmentRangeParamsInput,
  appointmentRangeParamsSchema,
  type AppointmentRow,
  type AppointmentSlot,
  type AppointmentStaff,
  type AppointmentStatusInput,
  type AppointmentUpdate,
  type AvailableSlotsParamsInput,
  availableSlotsParamsSchema,
} from './appointments-contracts.ts';

/*
 * The Appointments API (KICKOFF §6.4; `schema-routes.md` S:1582, 1600–1612,
 * plus Appendix F). REPLACE_WITH_API: every call runs on the fixture server,
 * loaded on demand so the seed data never lands in a room's chunk; when
 * clinozy-be serves appointments, these bodies become `apiClient` calls and
 * nothing else moves.
 */

const server = () => import('./fixtures/appointments-server.fixtures.ts');

/** Ids in a stable order, each once — equal filters share one cache entry. */
const idSet = (ids: readonly string[]) => [...new Set(ids)].sort();

/** The search trimmed to its limit; an empty one is none. */
const searchOf = (q: string | undefined) =>
  q?.trim().slice(0, APPOINTMENT_SEARCH_MAX) || undefined;

/** Agenda params with their defaults filled, the search trimmed and the ids in order. */
export function normalizeAppointmentListParams(
  params: AppointmentListParamsInput = {},
): AppointmentListParams {
  const parsed = appointmentListParamsSchema.parse({ ...params, q: searchOf(params.q) });
  return {
    ...parsed,
    doctorIds: idSet(parsed.doctorIds),
    branchIds: idSet(parsed.branchIds),
  };
}

/** Range params with their defaults filled, the search trimmed and the ids in order. */
export function normalizeAppointmentRangeParams(
  params: AppointmentRangeParamsInput,
): AppointmentRangeParams {
  const parsed = appointmentRangeParamsSchema.parse({ ...params, q: searchOf(params.q) });
  return {
    ...parsed,
    doctorIds: idSet(parsed.doctorIds),
    branchIds: idSet(parsed.branchIds),
  };
}

/** TanStack Query keys for appointments — every one under `['clinic', 'appointments']`, which task writes invalidate. */
export const appointmentQueryKeys = {
  all: ['clinic', 'appointments'] as const,
  lists: () => [...appointmentQueryKeys.all, 'list'] as const,
  list: (params: AppointmentListParamsInput = {}) =>
    [...appointmentQueryKeys.lists(), normalizeAppointmentListParams(params)] as const,
  daySummaries: (params: AppointmentListParamsInput = {}) =>
    [
      ...appointmentQueryKeys.all,
      'day-summaries',
      normalizeAppointmentListParams(params),
    ] as const,
  ranges: () => [...appointmentQueryKeys.all, 'range'] as const,
  range: (params: AppointmentRangeParamsInput) =>
    [...appointmentQueryKeys.ranges(), normalizeAppointmentRangeParams(params)] as const,
  details: () => [...appointmentQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...appointmentQueryKeys.details(), id] as const,
  slots: (params: AvailableSlotsParamsInput) =>
    [
      ...appointmentQueryKeys.all,
      'slots',
      availableSlotsParamsSchema.parse(params),
    ] as const,
  staff: () => [...appointmentQueryKeys.all, 'staff'] as const,
};

/**
 * The other records an appointment write can change, by the `['clinic',
 * <domain>]` key prefix each room keeps its queries under: tasks (the rule
 * job), leads and contact threads (Clinic visited), the chat column's reads
 * (`messageQueryKeys`: the thread's system line, the contact history's
 * booking lines, the free slots its templates offer), patients.
 */
export const APPOINTMENT_SIDE_EFFECT_KEYS = [
  ['clinic', 'tasks'],
  ['clinic', 'leads'],
  ['clinic', 'messages'],
  ['clinic', 'contact-threads'],
  ['clinic', 'patients'],
] as const;

/** One Agenda page (`listAppointments`), from `after` — the previous page's cursor. */
export async function fetchAppointmentPage(
  params: AppointmentListParamsInput,
  after?: string,
): Promise<ListPage<AppointmentRow>> {
  return (await server()).listAppointments(normalizeAppointmentListParams(params), after);
}

/** The Agenda's per-day counts for the same filters (Appendix F). */
export async function fetchAppointmentDaySummaries(
  params: AppointmentListParamsInput,
): Promise<AppointmentDaySummary[]> {
  return (await server()).listAppointmentDaySummaries(
    normalizeAppointmentListParams(params),
  );
}

/** Every booking in a calendar range (`listAppointmentsRange`) — Day, Week or Month. */
export async function fetchAppointmentRange(
  params: AppointmentRangeParamsInput,
): Promise<AppointmentRow[]> {
  return (await server()).listAppointmentsRange(normalizeAppointmentRangeParams(params));
}

/** One booking (`getAppointment`) — a 404 when it is unknown or deleted. */
export async function fetchAppointment(id: string): Promise<AppointmentRow> {
  return (await server()).getAppointment(id);
}

/** The slot grid for a doctor, a day and a length (`availableSlots`). */
export async function fetchAvailableSlots(
  params: AvailableSlotsParamsInput,
): Promise<AppointmentSlot[]> {
  return (await server()).listAvailableSlots(params);
}

/** The doctors and therapists who can be booked. */
export async function fetchBookableStaff(): Promise<AppointmentStaff[]> {
  return (await server()).listBookableStaff();
}

/** Book (`createAppointment`) — Scheduled; 422 on a broken field, 409 on a taken slot. */
export async function createAppointment(
  input: AppointmentCreateInput,
): Promise<AppointmentRow> {
  return (await server()).createAppointment(input);
}

/** Save an edit (`updateAppointment`) — a new slot moves the booking back to Scheduled. */
export async function updateAppointment(
  id: string,
  patch: AppointmentPatch,
): Promise<AppointmentUpdate> {
  return (await server()).updateAppointment(id, patch);
}

/** Move a status (`setAppointmentStatus`) through the status machine; answers an Undo token. */
export async function setAppointmentStatus(
  input: AppointmentStatusInput,
): Promise<AppointmentChange> {
  return (await server()).setAppointmentStatus(input);
}

/** Cancel with a reason (`cancelAppointment`); answers an Undo token. */
export async function cancelAppointment(
  input: AppointmentCancelInput,
): Promise<AppointmentChange> {
  return (await server()).cancelAppointment(input);
}

/** Restore a cancelled booking to Scheduled (`restoreAppointment`). */
export async function restoreAppointment(id: string): Promise<AppointmentRow> {
  return (await server()).restoreAppointment(id);
}

/** Undo a status write by the token it answered — its side effects included. */
export async function undoAppointmentChange(undoToken: string): Promise<void> {
  return (await server()).undoAppointmentChange(undoToken);
}
