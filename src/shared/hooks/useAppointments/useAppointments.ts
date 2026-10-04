import { keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';

import i18n from '@/lib/i18n/i18n.ts';
import {
  APPOINTMENT_SIDE_EFFECT_KEYS,
  appointmentQueryKeys,
  cancelAppointment,
  createAppointment,
  deleteVisitPhoto,
  fetchActivePackages,
  fetchAppointment,
  fetchAppointmentDaySummaries,
  fetchAppointmentPage,
  fetchAppointmentRange,
  fetchAvailableSlots,
  fetchBookableStaff,
  fetchBookingPerson,
  fetchConnectedLeads,
  fetchVisitPhotos,
  normalizeAppointmentListParams,
  restoreAppointment,
  restoreVisitPhoto,
  setAppointmentStatus,
  undoAppointmentChange,
  updateAppointment,
} from '@/shared/api/clinic/appointments-api.ts';
import type {
  AppointmentCancelInput,
  AppointmentChange,
  AppointmentCreateInput,
  AppointmentListParamsInput,
  AppointmentPatch,
  AppointmentPersonLookup,
  AppointmentRangeParamsInput,
  AppointmentRow,
  AppointmentStatusInput,
  AppointmentUpdate,
  AvailableSlotsParamsInput,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type {
  AppointmentStatus,
  DeleteReason,
  PatientImage,
} from '@/shared/api/clinic/clinic-schema.ts';
import { civilDayOffset, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import {
  type CrudMutationOptions,
  withUndoToast,
} from '@/shared/hooks/useCreate/index.ts';
import {
  type CursorListResult,
  useCursorList,
} from '@/shared/hooks/useCursorList/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

/**
 * Appointments' server state (KICKOFF §6.4): the Agenda in cursor pages of 50,
 * its per-day counts, the calendars' range reads, one booking, the slot grid
 * and who can be booked; writes that refetch every appointment read and the
 * records a write can change (tasks, leads, threads, patients), with the
 * spec's toasts. Status moves are optimistic and offer Undo for 10s (D32).
 */

const KEYS = CLINIC_KEYS.appointments;

/** What every appointment write may have changed. */
const APPOINTMENT_WRITE_KEYS = [
  appointmentQueryKeys.all,
  ...APPOINTMENT_SIDE_EFFECT_KEYS,
];

/** A phrase in the clinic vocabulary (the namespace loads with the org shell). */
function clinicText(key: string, values: Record<string, string> = {}): string {
  return i18n.t(key, { ns: CLINIC_NS, ...values });
}

const statusLabel = (status: AppointmentStatus) => clinicText(KEYS.statuses[status]);

/** Options for the reads. */
export interface AppointmentQueryOptions {
  enabled?: boolean;
  /** Toast a failed load (default: true); off when the room shows its own "Couldn’t load" toast. */
  notifyOnError?: boolean;
}

// ── Labels ──

/**
 * A slot as the toasts name it — "Today", "Tomorrow" or "Sat 3 Oct", and the
 * start ("10:30 am") — clinic-local and as written, whatever the viewer's
 * display timezone; the user's format locale and hour cycle apply.
 */
export function useAppointmentSlotLabel(): (
  date: string,
  time: string,
) => { day: string; time: string } {
  const { formatDate } = useLocaleFormat();
  return useCallback(
    (date: string, time: string) => {
      const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
      const [hours = 0, minutes = 0] = time.split(':').map(Number);
      const slot = new Date(year, month - 1, day, hours, minutes);
      const offset = civilDayOffset(clinicToday(), date);
      let dayLabel = formatDate(
        slot,
        { weekday: 'short', day: 'numeric', month: 'short' },
        { wallClock: true },
      );
      // The app's one set of relative-day words — the date list's, in `common`.
      if (offset === 0) dayLabel = i18n.t(PICKER_KEYS.date.today, { ns: PICKER_NS });
      if (offset === 1) dayLabel = i18n.t(PICKER_KEYS.date.tomorrow, { ns: PICKER_NS });
      return {
        day: dayLabel,
        time: formatDate(
          slot,
          { hour: 'numeric', minute: '2-digit' },
          { wallClock: true },
        ),
      };
    },
    [formatDate],
  );
}

// ── The optimistic status flip ──

const isAppointmentRow = (value: unknown): value is AppointmentRow =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'seq' in value &&
  'status' in value;

function withRowStatus<T>(rows: readonly T[], id: string, status: AppointmentStatus) {
  let changed = false;
  const next = rows.map((row) => {
    if (!(isAppointmentRow(row) && row.id === id && row.status !== status)) return row;
    changed = true;
    return { ...row, status };
  });
  return changed ? next : rows;
}

/**
 * A cached appointment read with one booking's status moved — an Agenda's
 * pages, a calendar range or the booking itself — and anything else (the day
 * counts, the slots, the staff) as it was. The optimistic side of a status
 * move; the refetch brings the server's truth.
 */
export function withAppointmentStatus(
  data: unknown,
  id: string,
  status: AppointmentStatus,
): unknown {
  if (Array.isArray(data)) return withRowStatus(data, id, status);
  if (typeof data === 'object' && data !== null && 'pages' in data) {
    const infinite = data as { pages: readonly { rows?: readonly unknown[] }[] };
    return {
      ...infinite,
      pages: infinite.pages.map((page) =>
        page.rows ? { ...page, rows: withRowStatus(page.rows, id, status) } : page,
      ),
    };
  }
  if (isAppointmentRow(data) && data.id === id) return { ...data, status };
  return data;
}

// ── Reads ──

/**
 * The Agenda (`listAppointments`): from today on, or the one day picked in
 * Filters, by day and the sort inside each day — 50 a page (D7). While new
 * params load the previous rows stay on screen (`isRefreshing`).
 */
export function useAppointmentList(
  params: AppointmentListParamsInput,
  options: AppointmentQueryOptions = {},
): CursorListResult<AppointmentRow> {
  const normalized = normalizeAppointmentListParams(params);
  return useCursorList({
    queryKey: appointmentQueryKeys.list(normalized),
    queryFn: (after) => fetchAppointmentPage(normalized, after),
    ...options,
  });
}

/** Each Agenda day's counts for its header — "<n> confirmed · <n> awaiting reply" (Appendix F). */
export function useAppointmentDaySummaries(
  params: AppointmentListParamsInput,
  options: AppointmentQueryOptions = {},
) {
  return useAppQuery({
    queryKey: appointmentQueryKeys.daySummaries(params),
    queryFn: () => fetchAppointmentDaySummaries(params),
    enabled: options.enabled ?? true,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/**
 * Every booking a Day, Week or Month board shows (`listAppointmentsRange`);
 * idle without a range. A new range or filter keeps the last board's bookings
 * (`isPlaceholderData`) while it loads, so the board shows them as the
 * in-place skeleton instead of going blank (KICKOFF §6.4 States).
 */
export function useAppointmentRange(
  params: AppointmentRangeParamsInput | null,
  options: AppointmentQueryOptions = {},
) {
  return useAppQuery({
    queryKey: params
      ? appointmentQueryKeys.range(params)
      : [...appointmentQueryKeys.ranges(), 'none'],
    queryFn: () => (params ? fetchAppointmentRange(params) : Promise.resolve([])),
    enabled: params !== null && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/**
 * One booking (`getAppointment`); idle without an id. The dialog route reads
 * the same entry, so a drawer opened from a deep link fetches it once.
 */
export function useAppointment(id: string | undefined) {
  return useAppQuery({
    queryKey: appointmentQueryKeys.detail(id ?? ''),
    queryFn: () => fetchAppointment(id ?? ''),
    enabled: Boolean(id),
  });
}

/** The slot grid for a doctor, a day and a length (`availableSlots`); idle until all three are set. */
export function useAvailableSlots(params: AvailableSlotsParamsInput | null) {
  return useAppQuery({
    queryKey: params
      ? appointmentQueryKeys.slots(params)
      : [...appointmentQueryKeys.all, 'slots', 'none'],
    queryFn: () => (params ? fetchAvailableSlots(params) : Promise.resolve([])),
    enabled: params !== null,
  });
}

/** Who can be booked — the doctors, then the therapists, with their real roles. */
export function useBookableStaff() {
  return useAppQuery({
    queryKey: appointmentQueryKeys.staff(),
    queryFn: fetchBookableStaff,
    staleTime: 5 * 60_000,
  });
}

// ── Writes ──

/** The Undo of a status move — its side effects included; silent unless it fails. */
export function useUndoAppointmentChange() {
  return useAppMutation<void, string>({
    mutationFn: undoAppointmentChange,
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
  });
}

/**
 * Book — not optimistic (the form shows "Saving…"): "Booked #2870 · <day>
 * <time> · confirm request sent on WhatsApp", or "… · reminder queued" when it
 * did not save as Scheduled. The list stays where it is (D28).
 */
export function useCreateAppointment(
  options: CrudMutationOptions<AppointmentRow, AppointmentCreateInput> = {},
) {
  const slotLabel = useAppointmentSlotLabel();
  return useAppMutation<AppointmentRow, AppointmentCreateInput>({
    mutationFn: createAppointment,
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    successMessage: (row) =>
      clinicText(
        row.status === 'scheduled' ? KEYS.toasts.booked : KEYS.toasts.bookedQueued,
        {
          id: displayId.appointment(row.seq),
          ...slotLabel(row.date, row.startTime),
        },
      ),
    ...options,
  });
}

/** What an edit sends: the booking and the changed fields (a new slot moves it). */
export interface AppointmentUpdateVars {
  id: string;
  patch: AppointmentPatch;
}

/**
 * Save an edit — not optimistic: "#2861 moved to <day> <time> · confirm
 * request sent" when the slot moved, else "#2861 updated".
 */
export function useUpdateAppointment(
  options: CrudMutationOptions<AppointmentUpdate, AppointmentUpdateVars> = {},
) {
  const slotLabel = useAppointmentSlotLabel();
  return useAppMutation<AppointmentUpdate, AppointmentUpdateVars>({
    mutationFn: ({ id, patch }) => updateAppointment(id, patch),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    successMessage: ({ appointment, moved }) => {
      const id = displayId.appointment(appointment.seq);
      return moved
        ? clinicText(KEYS.toasts.moved, {
            id,
            ...slotLabel(appointment.date, appointment.startTime),
          })
        : clinicText(KEYS.toasts.updated, { id });
    },
    ...options,
  });
}

/** "<name> → <status>", and " · reminder queued" for Confirmed. */
function statusToast(row: AppointmentRow): string {
  const values = { name: row.person.name, status: statusLabel(row.status) };
  return clinicText(
    row.status === 'confirmed' ? KEYS.toasts.statusConfirmed : KEYS.toasts.statusChanged,
    values,
  );
}

/** Options for {@link useSetAppointmentStatus}. */
export interface AppointmentStatusOptions extends CrudMutationOptions<
  AppointmentChange,
  AppointmentStatusInput
> {
  /**
   * The toast's own words, still with Undo — Today's "<name> checked in · Dr.
   * queue and room notified" (KICKOFF §6.2). Default: "<name> → <status>".
   */
  announce?: (change: AppointmentChange) => string;
}

/**
 * Move a status — the popover, the card's next step, Today. Optimistic: every
 * cached read shows the new status at once and goes back if the server
 * refuses (409 with the guard's words). "<name> → <status>" with Undo for 10s,
 * which reverts the status and its side effects.
 */
export function useSetAppointmentStatus({
  announce,
  ...options
}: AppointmentStatusOptions = {}) {
  const undo = useUndoAppointmentChange();
  return useAppMutation<AppointmentChange, AppointmentStatusInput>({
    mutationFn: setAppointmentStatus,
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    optimisticQueries: {
      queryKey: appointmentQueryKeys.all,
      update: (data, { id, status }) => withAppointmentStatus(data, id, status),
    },
    ...withUndoToast(options, (change) =>
      notify.undo(announce ? announce(change) : statusToast(change.appointment), {
        onUndo: () => undo.mutate(change.undoToken),
      }),
    ),
  });
}

/** Options for {@link useCancelAppointment}. */
export interface AppointmentCancelOptions extends CrudMutationOptions<
  AppointmentChange,
  AppointmentCancelInput
> {
  /**
   * How the toast names it: the popover's "<name> → Cancelled · <reason> ·
   * slot freed, reminders stopped", or the form's "Appointment #<seq>
   * cancelled" (the default).
   */
  announce?: 'status' | 'record';
}

/**
 * Cancel with one of the contract's reasons (D32) — not optimistic (`S:1611`).
 * The toast offers Undo for 10s, which brings back the status it had.
 */
export function useCancelAppointment({
  announce = 'record',
  ...options
}: AppointmentCancelOptions = {}) {
  const undo = useUndoAppointmentChange();
  return useAppMutation<AppointmentChange, AppointmentCancelInput>({
    mutationFn: cancelAppointment,
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    ...withUndoToast(options, ({ appointment, undoToken }) => {
      const message =
        announce === 'status'
          ? clinicText(KEYS.toasts.statusCancelled, {
              name: appointment.person.name,
              status: statusLabel(appointment.status),
              reason: clinicText(KEYS.cancelReasons[appointment.cancelReason ?? 'other']),
            })
          : clinicText(KEYS.toasts.cancelled, {
              id: displayId.appointment(appointment.seq),
            });
      notify.undo(message, { onUndo: () => undo.mutate(undoToken) });
    }),
  });
}

/** Restore a cancelled booking to Scheduled — "Appointment restored · reminder goes out again". */
export function useRestoreAppointment(
  options: CrudMutationOptions<AppointmentRow, string> = {},
) {
  return useAppMutation<AppointmentRow, string>({
    mutationFn: restoreAppointment,
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    successMessage: () => clinicText(KEYS.toasts.restored),
    ...options,
  });
}

// ── The appointment form's reads and the visit's photos ──

/**
 * The person a booking prefill names (`who=<patientId|leadId>`, `S:27`) — the
 * patient or the lead, with the patient's usual doctor; idle without an id.
 */
export function useBookingPerson(id: string | undefined) {
  return useAppQuery({
    queryKey: appointmentQueryKeys.person(id ?? ''),
    queryFn: () => fetchBookingPerson(id ?? ''),
    enabled: Boolean(id),
  });
}

/** A person's connected leads — the form's "Connected lead" chips and "Lead" radios; idle without one. */
export function useConnectedLeads(person: AppointmentPersonLookup | null) {
  return useAppQuery({
    queryKey: person
      ? appointmentQueryKeys.connectedLeads(person)
      : [...appointmentQueryKeys.all, 'connected-leads', 'none'],
    queryFn: () => (person ? fetchConnectedLeads(person) : Promise.resolve([])),
    enabled: person !== null,
  });
}

/** A patient's packages with a session left — the Package session radios; idle without a patient. */
export function useActivePackages(patientId: string | null) {
  return useAppQuery({
    queryKey: appointmentQueryKeys.packages(patientId ?? ''),
    queryFn: () => fetchActivePackages(patientId ?? ''),
    enabled: patientId !== null,
  });
}

/** The photos filed under a visit; idle without one. */
export function useVisitPhotos(appointmentId: string | null) {
  return useAppQuery({
    queryKey: appointmentQueryKeys.photos(appointmentId ?? ''),
    queryFn: () => fetchVisitPhotos(appointmentId ?? ''),
    enabled: appointmentId !== null,
  });
}

/** What a confirmed photo delete sends: the photo and the reason confirm's choice. */
export interface VisitPhotoDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/** What a visit photo write may have changed: the visit's photos and the patient file. */
export const VISIT_PHOTO_WRITE_KEYS = [appointmentQueryKeys.all, ['clinic', 'patients']];

/**
 * Delete a visit photo — no toast of its own: the reason confirm's `undo`
 * shows "Photo deleted" with Undo, which runs {@link useRestoreVisitPhoto}.
 */
export function useDeleteVisitPhoto(
  options: CrudMutationOptions<PatientImage, VisitPhotoDeleteVars> = {},
) {
  return useAppMutation<PatientImage, VisitPhotoDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteVisitPhoto(id, reason, note),
    invalidateKeys: VISIT_PHOTO_WRITE_KEYS,
    ...options,
  });
}

/** Put a deleted visit photo back — the Undo of its toast; silent on success. */
export function useRestoreVisitPhoto(
  options: CrudMutationOptions<PatientImage, string> = {},
) {
  return useAppMutation<PatientImage, string>({
    mutationFn: restoreVisitPhoto,
    invalidateKeys: VISIT_PHOTO_WRITE_KEYS,
    ...options,
  });
}
