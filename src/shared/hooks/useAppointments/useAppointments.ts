import { keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';

import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { AppointmentStatus } from '@/shared/api/app/app-schema.ts';
import { appToday, civilDayOffset } from '@/shared/api/app/app-time.ts';
import {
  appointmentQueryKeys,
  cancelAppointment,
  copyAppointment,
  createAppointment,
  fetchAppointment,
  fetchAppointmentDayCounts,
  fetchAppointmentRange,
  fetchAppointmentSlots,
  fetchPersonAppointments,
  listAppointments,
  moveAppointment,
  updateAppointment,
} from '@/shared/api/app/appointments-api.ts';
import {
  type AppointmentCancel,
  type AppointmentCreateInput,
  type AppointmentFields,
  type AppointmentListParams,
  type AppointmentMoveRoute,
  type AppointmentRangeParams,
  type AppointmentRow,
  type AppointmentSlotParams,
  bookableTreatmentsOf,
} from '@/shared/api/app/appointments-contracts.ts';
import { contactQueryKeys } from '@/shared/api/app/contacts-api.ts';
import { leadQueryKeys } from '@/shared/api/app/leads-api.ts';
import { messageQueryKeys } from '@/shared/api/app/messages-api.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
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
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { useRefreshTasksAfterRules } from '@/shared/hooks/useTasks/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Appointments' server state on clinozy-be (KICKOFF §6.4; api-integration §5.3): the Agenda in
 * cursor pages of 50, the day counts, the calendars' ranges, one booking and the free slots;
 * writes that refetch every appointment read and what a booking changes (the contact's lead and
 * patient file, their activity), with the spec's toasts. A status move is optimistic; Undo is
 * offered where the API has a way back — a check-in (`undo-check-in`) and a cancel (`reinstate`).
 */

const KEYS = APP_KEYS.appointments;

/** What every appointment write may have changed. */
const APPOINTMENT_WRITE_KEYS = [
  appointmentQueryKeys.all,
  leadQueryKeys.all,
  contactQueryKeys.all,
  messageQueryKeys.all,
  ['app', 'patients'],
];

/**
 * A booking write's options with the task reads refreshed once the server's rules have run on it:
 * a booking, a move, a status change and its way back each ask for a run (D81 T7 — a confirm, a
 * check-in or a cancel closes its task, a no-show opens a rebook), so a task list on screen — Today's
 * work queue beside the floor and the form stacked over it — follows within seconds, not the 60s poll.
 */
function withTaskRulesRefresh<TData, TVars>(
  options: CrudMutationOptions<TData, TVars>,
  refreshTasks: () => void,
): CrudMutationOptions<TData, TVars> {
  return {
    ...options,
    onSuccess: async (data, vars) => {
      refreshTasks();
      await options.onSuccess?.(data, vars);
    },
  };
}

/** A phrase in the clinic vocabulary (the namespace loads with the org shell). */
function appText(key: string, values: Record<string, string> = {}): string {
  return i18n.t(key, { ns: APP_NS, ...values });
}

const statusLabel = (status: AppointmentStatus) => appText(KEYS.statuses[status]);

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

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
      const offset = civilDayOffset(appToday(), date);
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
 * counts, the slots) as it was. The optimistic side of a status move; the
 * refetch brings the server's truth.
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
 * The Agenda (`GET /app/appointments`): from today on, or the one day picked in Filters, by
 * date and start — 50 a page (D7). While new params load the previous rows stay on screen.
 */
export function useAppointmentList(
  params: AppointmentListParams,
  options: AppointmentQueryOptions = {},
): CursorListResult<AppointmentRow> {
  const organizationId = useOrganizationId();
  return useCursorList({
    queryKey: appointmentQueryKeys.list(organizationId, params),
    queryFn: async (after) => {
      const page = await listAppointments(params, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    enabled: (options.enabled ?? true) && organizationId !== null,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/** The days a counts read covers, the branches and the doctor; idle without one. */
export interface AppointmentCountsWindow {
  from: string;
  to: string;
  doctorId?: string;
  branchIds: readonly string[];
}

/**
 * Each day's counts for the Agenda's day headers — "<n> confirmed · <n> awaiting reply"
 * (`GET /app/appointments/daily-counts`); idle without a window.
 */
export function useAppointmentDayCounts(
  window: AppointmentCountsWindow | null,
  options: AppointmentQueryOptions = {},
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: window
      ? appointmentQueryKeys.counts(organizationId, window)
      : [...appointmentQueryKeys.all, organizationId, 'counts', 'none'],
    queryFn: () => (window ? fetchAppointmentDayCounts(window) : Promise.resolve([])),
    enabled: window !== null && organizationId !== null && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/** A person's bookings, newest first — the patient file's Visits; idle without a contact. */
export function usePersonAppointments(contactId: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: appointmentQueryKeys.person(organizationId, contactId ?? ''),
    queryFn: () => fetchPersonAppointments(contactId ?? ''),
    enabled: Boolean(contactId) && organizationId !== null,
  });
}

/**
 * Every booking a Day, Week or Month board shows; idle without a range. A new range or filter
 * keeps the last board's bookings (`isPlaceholderData`) while it loads, so the board shows them
 * as the in-place skeleton instead of going blank (KICKOFF §6.4 States).
 */
export function useAppointmentRange(
  params: AppointmentRangeParams | null,
  options: AppointmentQueryOptions = {},
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: params
      ? appointmentQueryKeys.range(organizationId, params)
      : [...appointmentQueryKeys.all, organizationId, 'range', 'none'],
    queryFn: () => (params ? fetchAppointmentRange(params) : Promise.resolve([])),
    enabled: params !== null && organizationId !== null && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/**
 * One booking; idle without an id. The dialog route reads the same entry, so a drawer opened
 * from a deep link fetches it once.
 */
export function useAppointment(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: appointmentQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchAppointment(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

/** A day's free starts for a doctor and a length, or why it is closed; idle until all are set. */
export function useAppointmentSlots(params: AppointmentSlotParams | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: params
      ? appointmentQueryKeys.slots(organizationId, params)
      : [...appointmentQueryKeys.slotDays(organizationId), 'none'],
    queryFn: () =>
      params ? fetchAppointmentSlots(params) : Promise.reject(new Error('no slot read')),
    enabled: params !== null && organizationId !== null,
  });
}

/**
 * The clinic's active treatments, A to Z — the form's "From offerings", out of the one offerings
 * catalogue (`useOfferings`); taken as fresh for five minutes, refreshed by any offering write.
 */
export function useBookableTreatments() {
  return useOfferings({ select: bookableTreatmentsOf, staleTime: 5 * 60_000 });
}

// ── Writes ──

/** "Booked #2870 · <day> <time>", with what the server sent the person. */
function bookedToast(row: AppointmentRow, slot: { day: string; time: string }): string {
  const values = { id: displayId.appointment(row.seq), ...slot };
  if (row.reminder === 'confirm_requested') return appText(KEYS.toasts.booked, values);
  if (row.reminder === 'reminder_queued') {
    return appText(KEYS.toasts.bookedQueued, values);
  }
  return appText(KEYS.toasts.bookedOnly, values);
}

/** Who a new booking is for, and its fields. */
export type AppointmentCreateVars = AppointmentCreateInput;

/**
 * Book — not optimistic (the form shows "Saving…"): "Booked #2870 · <day> <time> · confirm
 * request sent on WhatsApp" when the server sent one. The list stays where it is (D28).
 */
export function useCreateAppointment(
  options: CrudMutationOptions<AppointmentRow, AppointmentCreateVars> = {},
) {
  const slotLabel = useAppointmentSlotLabel();
  const refreshTasks = useRefreshTasksAfterRules();
  return useAppMutation<AppointmentRow, AppointmentCreateVars>({
    mutationFn: (input, action) => createAppointment({ input, ...action }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    successMessage: (row) => bookedToast(row, slotLabel(row.date, row.startTime)),
    ...withTaskRulesRefresh(options, refreshTasks),
  });
}

/** What a Copy or Rebook sends: the booking it starts from and the new slot. */
export interface AppointmentCopyVars {
  appointmentId: string;
  date: string;
  startTime: string;
}

/** Copy or Rebook (`POST …/copy`) — the same toast as a booking. */
export function useCopyAppointment(
  options: CrudMutationOptions<AppointmentRow, AppointmentCopyVars> = {},
) {
  const slotLabel = useAppointmentSlotLabel();
  const refreshTasks = useRefreshTasksAfterRules();
  return useAppMutation<AppointmentRow, AppointmentCopyVars>({
    mutationFn: (vars, action) => copyAppointment({ ...vars, ...action }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    successMessage: (row) => bookedToast(row, slotLabel(row.date, row.startTime)),
    ...withTaskRulesRefresh(options, refreshTasks),
  });
}

/** What an edit sends: the booking as read and the changed fields. */
export interface AppointmentUpdateVars {
  appointment: AppointmentRow;
  fields: Partial<AppointmentFields>;
}

/** Whether a saved edit moved the booking to another slot. */
const movedBy = ({ appointment }: AppointmentUpdateVars, row: AppointmentRow) =>
  row.date !== appointment.date || row.startTime !== appointment.startTime;

/**
 * Save an edit — not optimistic, refused when someone saved the booking meanwhile
 * (`409 record_changed`): "#2861 moved to <day> <time> · confirm request sent" when the slot
 * moved, else "#2861 updated".
 */
export function useUpdateAppointment(
  options: CrudMutationOptions<AppointmentRow, AppointmentUpdateVars> = {},
) {
  const slotLabel = useAppointmentSlotLabel();
  const refreshTasks = useRefreshTasksAfterRules();
  return useAppMutation<AppointmentRow, AppointmentUpdateVars>({
    mutationFn: ({ appointment, fields }, action) =>
      updateAppointment({
        appointmentId: appointment.id,
        fields,
        expectedUpdatedAt: appointment.updatedAt,
        ...action,
      }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    successMessage: (row, vars) => {
      const id = displayId.appointment(row.seq);
      if (!movedBy(vars, row)) return appText(KEYS.toasts.updated, { id });
      const values = { id, ...slotLabel(row.date, row.startTime) };
      return row.reminder === 'confirm_requested'
        ? appText(KEYS.toasts.moved, values)
        : appText(KEYS.toasts.movedOnly, values);
    },
    ...withTaskRulesRefresh(options, refreshTasks),
  });
}

/** The status each move route arrives at — what the optimistic flip shows. */
const MOVE_STATUSES: Readonly<Record<AppointmentMoveRoute, AppointmentStatus>> = {
  confirm: 'confirmed',
  'check-in': 'checked_in',
  complete: 'completed',
  'no-show': 'no_show',
  reinstate: 'scheduled',
  'undo-check-in': 'confirmed',
};

/** What a status move sends: the booking and the route. */
export interface AppointmentMoveVars {
  appointment: AppointmentRow;
  route: AppointmentMoveRoute;
}

/** "<name> → <status>", and " · reminder queued" when the server queued one. */
function statusToast(row: AppointmentRow): string {
  const values = { name: row.person.name, status: statusLabel(row.status) };
  return appText(
    row.status === 'confirmed' && row.reminder === 'reminder_queued'
      ? KEYS.toasts.statusConfirmed
      : KEYS.toasts.statusChanged,
    values,
  );
}

/** Options for {@link useMoveAppointment}. */
export interface AppointmentMoveOptions extends CrudMutationOptions<
  AppointmentRow,
  AppointmentMoveVars
> {
  /** The toast's own words — Default: "<name> → <status>". */
  announce?: (row: AppointmentRow) => string;
}

/**
 * Move a status — the popover, the card's next step, the form. Optimistic: every cached read
 * shows the new status at once and goes back if the server refuses (409 with its reason).
 * "<name> → <status>"; a check-in's toast offers Undo for 10s (`undo-check-in`).
 */
export function useMoveAppointment({
  announce,
  ...options
}: AppointmentMoveOptions = {}) {
  const organizationId = useOrganizationId();
  const refreshTasks = useRefreshTasksAfterRules();
  const undo = useAppMutation<AppointmentRow, AppointmentRow>({
    mutationFn: (row, action) =>
      moveAppointment({ appointmentId: row.id, route: 'undo-check-in', ...action }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    onSuccess: refreshTasks,
  });
  return useAppMutation<AppointmentRow, AppointmentMoveVars>({
    mutationFn: ({ appointment, route }, action) =>
      moveAppointment({ appointmentId: appointment.id, route, ...action }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    optimisticQueries: {
      queryKey: [...appointmentQueryKeys.all, organizationId],
      update: (data, { appointment, route }) =>
        withAppointmentStatus(data, appointment.id, MOVE_STATUSES[route]),
    },
    ...withUndoToast(withTaskRulesRefresh(options, refreshTasks), (row, { route }) => {
      const message = announce ? announce(row) : statusToast(row);
      if (route === 'check-in') {
        notify.undo(message, { onUndo: () => undo.mutate(row) });
        return;
      }
      notify.success(message);
    }),
  });
}

/** What a cancel sends: the booking and the reason. */
export interface AppointmentCancelVars {
  appointment: AppointmentRow;
  cancel: AppointmentCancel;
}

/** Options for {@link useCancelAppointment}. */
export interface AppointmentCancelOptions extends CrudMutationOptions<
  AppointmentRow,
  AppointmentCancelVars
> {
  /**
   * How the toast names it: the popover's "<name> → Cancelled · <reason> · slot freed,
   * reminders stopped", or the form's "Appointment #<seq> cancelled" (the default).
   */
  announce?: 'status' | 'record';
}

/**
 * Cancel with one of the API's reasons — not optimistic. The toast offers Undo for 10s, which
 * reinstates it (`POST …/reinstate`: Scheduled again while its slot is still bookable).
 */
export function useCancelAppointment({
  announce = 'record',
  ...options
}: AppointmentCancelOptions = {}) {
  const refreshTasks = useRefreshTasksAfterRules();
  const reinstate = useAppMutation<AppointmentRow, AppointmentRow>({
    mutationFn: (row, action) =>
      moveAppointment({ appointmentId: row.id, route: 'reinstate', ...action }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    onSuccess: refreshTasks,
  });
  return useAppMutation<AppointmentRow, AppointmentCancelVars>({
    mutationFn: ({ appointment, cancel }, action) =>
      cancelAppointment({ appointmentId: appointment.id, cancel, ...action }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    ...withUndoToast(withTaskRulesRefresh(options, refreshTasks), (row) => {
      const message =
        announce === 'status'
          ? appText(KEYS.toasts.statusCancelled, {
              name: row.person.name,
              status: statusLabel(row.status),
              reason: appText(KEYS.cancelReasons[row.cancelReason ?? 'other']),
            })
          : appText(KEYS.toasts.cancelled, { id: displayId.appointment(row.seq) });
      notify.undo(message, { onUndo: () => reinstate.mutate(row) });
    }),
  });
}

/** Reinstate a cancelled booking — "Appointment restored · reminder goes out again". */
export function useReinstateAppointment(
  options: CrudMutationOptions<AppointmentRow, AppointmentRow> = {},
) {
  const refreshTasks = useRefreshTasksAfterRules();
  return useAppMutation<AppointmentRow, AppointmentRow>({
    mutationFn: (row, action) =>
      moveAppointment({ appointmentId: row.id, route: 'reinstate', ...action }),
    invalidateKeys: APPOINTMENT_WRITE_KEYS,
    successMessage: () => appText(KEYS.toasts.restored),
    ...withTaskRulesRefresh(options, refreshTasks),
  });
}
