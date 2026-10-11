import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppointmentStatus } from '@/shared/api/app/app-schema.ts';
import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
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
import type {
  AppointmentCreateInput,
  AppointmentMoveRoute,
  AppointmentRow,
} from '@/shared/api/app/appointments-contracts.ts';
import type * as OfferingsApiModule from '@/shared/api/app/offerings-api.ts';
import { fetchAllOfferings } from '@/shared/api/app/offerings-api.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
  dayCount,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  slotDay,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

import {
  useAppointment,
  useAppointmentDayCounts,
  useAppointmentList,
  useAppointmentRange,
  useAppointmentSlotLabel,
  useAppointmentSlots,
  useBookableTreatments,
  useCancelAppointment,
  useCopyAppointment,
  useCreateAppointment,
  useMoveAppointment,
  usePersonAppointments,
  useReinstateAppointment,
  useUpdateAppointment,
  withAppointmentStatus,
} from './useAppointments.ts';

vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppointmentsApiModule>()),
  listAppointments: vi.fn(),
  fetchAppointmentRange: vi.fn(),
  fetchAppointmentDayCounts: vi.fn(),
  fetchAppointment: vi.fn(),
  fetchAppointmentSlots: vi.fn(),
  fetchPersonAppointments: vi.fn(),
  createAppointment: vi.fn(),
  copyAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  moveAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
}));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchAllOfferings: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

/** Riya Mehta's consultation with Dr. Nisha, Scheduled for tomorrow at 10:30. */
const RIYA = appointmentRow();
/** Kabir Shah's booking with Dr. Arjun, the same day. */
const KABIR = appointmentRow({
  id: 'appt_kabir0000000000000000',
  seq: 2862,
  contactId: 'con_kabir0000000000000000',
  person: { ...RIYA.person, contactId: 'con_kabir0000000000000000', name: 'Kabir Shah' },
  doctorId: DOCTOR_ARJUN.id,
  doctor: DOCTOR_ARJUN,
  startTime: '11:30',
  endTime: '11:50',
});

/** The status each move route lands on. */
const ROUTE_STATUSES: Readonly<Record<AppointmentMoveRoute, AppointmentStatus>> = {
  confirm: 'confirmed',
  'check-in': 'checked_in',
  complete: 'completed',
  'no-show': 'no_show',
  reinstate: 'scheduled',
  'undo-check-in': 'confirmed',
};

/** The server the mocked API serves: its bookings, a page size, a write held until let go. */
const server = {
  rows: [] as AppointmentRow[],
  pageSize: 1,
  hold: null as Promise<void> | null,
};

/** Hold the next writes until the returned function lets them land. */
function holdWrites(): () => void {
  let release: () => void = () => undefined;
  server.hold = new Promise((resolve) => {
    release = resolve;
  });
  return release;
}

/** The booking on the server with this id. */
function stored(id: string): AppointmentRow {
  const row = server.rows.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`no booking ${id}`);
  return row;
}

/** Replace a booking on the server with its change applied. */
function patchStored(id: string, patch: Partial<AppointmentRow>): AppointmentRow {
  const saved = { ...stored(id), ...patch, updatedAt: '2026-10-03T03:30:00.000Z' };
  server.rows = server.rows.map((row) => (row.id === id ? saved : row));
  return saved;
}

/** What a booking sends. */
const NEW_BOOKING: AppointmentCreateInput = {
  contactId: 'con_meera0000000000000000',
  branchId: TEST_BRANCH_ID,
  doctorId: DOCTOR_NISHA.id,
  type: 'consultation',
  offeringId: null,
  serviceLabel: 'Consultation',
  durationMin: 20,
  date: APPOINTMENT_TOMORROW,
  startTime: '10:30',
  reason: null,
  notes: null,
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The Undo the last undo toast offers — what the toast's button runs. */
function lastUndo(): { message: string; onUndo: () => void } {
  const [message, options] = vi.mocked(notify.undo).mock.lastCall ?? [];
  if (!(message && options)) throw new Error('no undo toast');
  return { message, onUndo: options.onUndo };
}

/** The last success toast's words. */
const lastSuccess = () => vi.mocked(notify.success).mock.lastCall?.[0];

/** The route the last move sent. */
const lastRoute = () => vi.mocked(moveAppointment).mock.lastCall?.[0].route;

const statusIn = (rows: readonly AppointmentRow[] | undefined, id: string) =>
  rows?.find((row) => row.id === id)?.status;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  signInTestMember();
  Object.assign(server, { rows: [RIYA, KABIR], pageSize: 1, hold: null });
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();

  vi.mocked(listAppointments).mockImplementation(async (_params, after) => {
    const start = after ? Number(after.replace('cursor-', '')) : 0;
    const end = start + server.pageSize;
    return {
      rows: server.rows.slice(start, end),
      next: end < server.rows.length ? `cursor-${end}` : null,
      total: server.rows.length,
    };
  });
  vi.mocked(fetchAppointmentRange).mockImplementation(async ({ from, to }) =>
    server.rows.filter((row) => row.date >= from && row.date <= to),
  );
  vi.mocked(fetchAppointmentDayCounts).mockResolvedValue([
    dayCount(APPOINTMENT_TOMORROW, { scheduled: 2 }),
  ]);
  vi.mocked(fetchAppointment).mockImplementation(async (id) => stored(id));
  vi.mocked(fetchPersonAppointments).mockImplementation(async (contactId) =>
    server.rows.filter((row) => row.contactId === contactId),
  );
  vi.mocked(fetchAppointmentSlots).mockImplementation(async ({ date }) =>
    slotDay(date, ['10:00', '11:00']),
  );
  vi.mocked(fetchAllOfferings).mockResolvedValue([
    offeringRecord({
      id: 'off_hydra000000000000000',
      name: 'Hydrafacial',
      durationMin: 60,
    }),
    offeringRecord({
      id: 'off_serum000000000000000',
      name: 'Aloe serum',
      category: 'product',
    }),
  ]);
  vi.mocked(createAppointment).mockImplementation(async ({ input }) => {
    const created = appointmentRow({
      ...input,
      id: 'appt_meera0000000000000000',
      seq: 2870,
      reminder: 'confirm_requested',
    });
    server.rows = [...server.rows, created];
    return created;
  });
  vi.mocked(copyAppointment).mockImplementation(async ({ appointmentId, ...slot }) => {
    const copy = {
      ...stored(appointmentId),
      id: 'appt_copy00000000000000000',
      seq: 2871,
      date: slot.date,
      startTime: slot.startTime,
      copiedFromId: appointmentId,
      reminder: 'not_sent' as const,
    };
    server.rows = [...server.rows, copy];
    return copy;
  });
  vi.mocked(updateAppointment).mockImplementation(async ({ appointmentId, fields }) =>
    patchStored(appointmentId, fields),
  );
  vi.mocked(moveAppointment).mockImplementation(async ({ appointmentId, route }) => {
    await server.hold;
    return patchStored(appointmentId, { status: ROUTE_STATUSES[route] });
  });
  vi.mocked(cancelAppointment).mockImplementation(async ({ appointmentId, cancel }) =>
    patchStored(appointmentId, {
      status: 'cancelled',
      cancelReason: cancel.reason,
      cancelNote: cancel.note,
    }),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
  useAuthStore.setState({ user: null });
});

describe('the reads', () => {
  it('reads the Agenda a cursor page at a time, under the organization', async () => {
    const params = { status: 'active', branchIds: [] } as const;
    const { result } = renderHook(() => useAppointmentList(params), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.rows).toEqual([RIYA]);
    expect(result.current.hasNextPage).toBe(true);
    expect(listAppointments).toHaveBeenLastCalledWith(params, undefined);

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.rows).toEqual([RIYA, KABIR]));
    expect(result.current.hasNextPage).toBe(false);
    expect(listAppointments).toHaveBeenLastCalledWith(params, 'cursor-1');
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: appointmentQueryKeys.lists('org_test') }),
    ).toHaveLength(1);
  });

  it('reads the day counts, a range, one booking, the slots and the treatments', async () => {
    const window = { from: APPOINTMENT_TODAY, to: APPOINTMENT_TOMORROW, branchIds: [] };
    const slots = {
      date: APPOINTMENT_TOMORROW,
      branchId: TEST_BRANCH_ID,
      doctorId: DOCTOR_NISHA.id,
      durationMin: 20,
      step: 30,
    } as const;
    const { result } = renderHook(
      () => ({
        counts: useAppointmentDayCounts(window),
        range: useAppointmentRange({
          status: 'active',
          branchIds: [],
          from: APPOINTMENT_TODAY,
          to: APPOINTMENT_TOMORROW,
        }),
        one: useAppointment(KABIR.id),
        slots: useAppointmentSlots(slots),
        treatments: useBookableTreatments(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.treatments.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.slots.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.one.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.range.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.counts.isSuccess).toBe(true));
    expect(fetchAppointmentDayCounts).toHaveBeenCalledWith(window);
    expect(result.current.counts.data).toEqual([
      dayCount(APPOINTMENT_TOMORROW, { scheduled: 2 }),
    ]);
    expect(result.current.range.data).toEqual([RIYA, KABIR]);
    expect(result.current.one.data).toEqual(KABIR);
    expect(fetchAppointmentSlots).toHaveBeenCalledWith(slots);
    expect(result.current.slots.data?.slots.map((slot) => slot.time)).toEqual([
      '10:00',
      '11:00',
    ]);
    // The one offerings catalogue, its active treatments only (the product is not bookable).
    expect(result.current.treatments.data?.map((treatment) => treatment.name)).toEqual([
      'Hydrafacial',
    ]);
  });

  it('keeps the last range’s bookings while the next range loads', async () => {
    const { result, rerender } = renderHook(
      ({ from, to }) => useAppointmentRange({ status: 'all', branchIds: [], from, to }),
      { wrapper, initialProps: { from: APPOINTMENT_TOMORROW, to: APPOINTMENT_TOMORROW } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const tomorrow = result.current.data;
    expect(tomorrow).toHaveLength(2);

    rerender({ from: '2026-10-05', to: '2026-10-11' });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(tomorrow);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it('stays idle without a window, a range, an id or slot params', () => {
    const { result } = renderHook(
      () => ({
        counts: useAppointmentDayCounts(null),
        range: useAppointmentRange(null),
        one: useAppointment(undefined),
        slots: useAppointmentSlots(null),
      }),
      { wrapper },
    );
    for (const read of Object.values(result.current)) {
      expect(read.fetchStatus).toBe('idle');
    }
    expect(fetchAppointmentDayCounts).not.toHaveBeenCalled();
    expect(fetchAppointmentRange).not.toHaveBeenCalled();
    expect(fetchAppointment).not.toHaveBeenCalled();
    expect(fetchAppointmentSlots).not.toHaveBeenCalled();
  });

  it('reads nothing outside an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    const { result } = renderHook(
      () => ({
        list: useAppointmentList({ status: 'active', branchIds: [] }),
        one: useAppointment(RIYA.id),
        treatments: useBookableTreatments(),
      }),
      { wrapper },
    );
    expect(result.current.list.isPending).toBe(true);
    expect(result.current.one.fetchStatus).toBe('idle');
    expect(result.current.treatments.fetchStatus).toBe('idle');
    expect(listAppointments).not.toHaveBeenCalled();
    expect(fetchAppointment).not.toHaveBeenCalled();
    expect(fetchAllOfferings).not.toHaveBeenCalled();
  });

  it('keeps each organization’s bookings apart', async () => {
    const { result } = renderHook(() => useAppointment(RIYA.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(appointmentQueryKeys.detail('org_test', RIYA.id))).toEqual(
      RIYA,
    );
    expect(
      client.getQueryData(appointmentQueryKeys.detail('org_else', RIYA.id)),
    ).toBeUndefined();
  });
});

describe('usePersonAppointments (the patient file’s Visits)', () => {
  it('reads one person’s bookings under the organization and the person', async () => {
    const { result } = renderHook(() => usePersonAppointments(KABIR.contactId), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPersonAppointments).toHaveBeenCalledWith(KABIR.contactId);
    expect(result.current.data).toEqual([KABIR]);
    expect(
      client.getQueryData(appointmentQueryKeys.person('org_test', KABIR.contactId)),
    ).toEqual([KABIR]);
  });

  it('stays idle without a contact, and outside an organization', () => {
    const { result: noContact } = renderHook(() => usePersonAppointments(undefined), {
      wrapper,
    });
    expect(noContact.current.fetchStatus).toBe('idle');

    useOrganizationStore.getState().clearOrganization();
    const { result: noOrganization } = renderHook(
      () => usePersonAppointments(RIYA.contactId),
      { wrapper },
    );
    expect(noOrganization.current.fetchStatus).toBe('idle');
    expect(fetchPersonAppointments).not.toHaveBeenCalled();
  });

  it('reads the person again after a booking for them', async () => {
    const meera = NEW_BOOKING.contactId;
    const { result } = renderHook(
      () => ({ visits: usePersonAppointments(meera), book: useCreateAppointment() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.visits.isSuccess).toBe(true));
    expect(result.current.visits.data).toEqual([]);

    await act(() => result.current.book.mutateAsync(NEW_BOOKING));

    await waitFor(() =>
      expect(result.current.visits.data?.map((row) => row.id)).toEqual([
        'appt_meera0000000000000000',
      ]),
    );
    expect(fetchPersonAppointments).toHaveBeenCalledTimes(2);
  });
});

describe('useAppointmentSlotLabel', () => {
  it('names today and tomorrow, else the date, with the start as written', () => {
    const { result } = renderHook(() => useAppointmentSlotLabel(), { wrapper });
    expect(result.current(APPOINTMENT_TODAY, '12:30')).toMatchObject({ day: 'Today' });
    expect(result.current(APPOINTMENT_TOMORROW, '09:05')).toMatchObject({
      day: 'Tomorrow',
    });
    const later = result.current('2026-10-12', '16:00');
    expect(later.day).toMatch(/Mon/);
    expect(later.day).toMatch(/12/);
    expect(later.time).toMatch(/4:00/);
  });
});

describe('withAppointmentStatus (the optimistic flip)', () => {
  it('moves the booking in pages, lists and the record, and leaves the rest alone', () => {
    expect(withAppointmentStatus([RIYA, KABIR], RIYA.id, 'confirmed')).toEqual([
      { ...RIYA, status: 'confirmed' },
      KABIR,
    ]);
    expect(
      withAppointmentStatus(
        { pages: [{ rows: [RIYA], next: null }], pageParams: [undefined] },
        RIYA.id,
        'no_show',
      ),
    ).toEqual({
      pages: [{ rows: [{ ...RIYA, status: 'no_show' }], next: null }],
      pageParams: [undefined],
    });
    expect(withAppointmentStatus(RIYA, RIYA.id, 'confirmed')).toEqual({
      ...RIYA,
      status: 'confirmed',
    });
    const counts = [dayCount(APPOINTMENT_TOMORROW, { scheduled: 2 })];
    expect(withAppointmentStatus(counts, RIYA.id, 'confirmed')).toBe(counts);
    const slots = slotDay(APPOINTMENT_TOMORROW, ['10:00']);
    expect(withAppointmentStatus(slots, RIYA.id, 'confirmed')).toBe(slots);
    expect(withAppointmentStatus(KABIR, RIYA.id, 'confirmed')).toBe(KABIR);
  });
});

describe('useCreateAppointment', () => {
  it('books with the action’s key and refreshes the Agenda', async () => {
    const { result } = renderHook(
      () => ({
        list: useAppointmentList({ status: 'active', branchIds: [] }),
        book: useCreateAppointment(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isPending).toBe(false));

    await act(() => result.current.book.mutateAsync(NEW_BOOKING));

    expect(createAppointment).toHaveBeenCalledWith({
      input: NEW_BOOKING,
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(listAppointments).toHaveBeenCalledTimes(2));
  });

  it.each([
    ['confirm_requested', ' · confirm request sent on WhatsApp'],
    ['reminder_queued', ' · reminder queued'],
    ['not_sent', ''],
    ['failed', ''],
  ] as const)(
    'says "Booked #N · <day> <time>" for a %s reminder',
    async (reminder, tail) => {
      vi.mocked(createAppointment).mockResolvedValueOnce(
        appointmentRow({ seq: 2870, reminder }),
      );
      const { result } = renderHook(() => useCreateAppointment(), { wrapper });

      await act(() => result.current.mutateAsync(NEW_BOOKING));

      expect(lastSuccess()).toMatch(
        new RegExp(`^Booked #2870 · Tomorrow 10:30\\s?(AM|am)${tail}$`),
      );
      expect(notify.undo).not.toHaveBeenCalled();
    },
  );

  it('says why a booking was refused, and books nothing', async () => {
    vi.mocked(createAppointment).mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderHook(() => useCreateAppointment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(NEW_BOOKING).catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe('useCopyAppointment', () => {
  it('books the same again on the new slot, with the booking’s toast', async () => {
    const { result } = renderHook(() => useCopyAppointment(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        appointmentId: RIYA.id,
        date: APPOINTMENT_TODAY,
        startTime: '16:00',
      }),
    );

    expect(copyAppointment).toHaveBeenCalledWith({
      appointmentId: RIYA.id,
      date: APPOINTMENT_TODAY,
      startTime: '16:00',
      idempotencyKey: expect.any(String),
    });
    expect(lastSuccess()).toMatch(/^Booked #2871 · Today 4:00\s?(PM|pm)$/);
  });
});

describe('useUpdateAppointment', () => {
  it('sends the changed fields with the read’s updatedAt — "#2861 updated" on the same slot', async () => {
    const { result } = renderHook(() => useUpdateAppointment(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        appointment: RIYA,
        fields: { notes: 'Prefers evenings' },
      }),
    );

    expect(updateAppointment).toHaveBeenCalledWith({
      appointmentId: RIYA.id,
      fields: { notes: 'Prefers evenings' },
      expectedUpdatedAt: RIYA.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenLastCalledWith('#2861 updated');
  });

  it('names a move "#2861 moved to <day> <time>", saying when a confirm request went out', async () => {
    const { result } = renderHook(() => useUpdateAppointment(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        appointment: RIYA,
        fields: { date: '2026-10-12', startTime: '11:00' },
      }),
    );
    expect(lastSuccess()).toMatch(/^#2861 moved to Mon.*12.* 11:00\s?(AM|am)$/);

    vi.mocked(updateAppointment).mockResolvedValueOnce({
      ...RIYA,
      date: '2026-10-13',
      reminder: 'confirm_requested',
    });
    await act(() =>
      result.current.mutateAsync({ appointment: RIYA, fields: { date: '2026-10-13' } }),
    );
    expect(lastSuccess()).toMatch(/^#2861 moved to Tue.* · confirm request sent$/);
  });

  it('says why a stale save was refused', async () => {
    vi.mocked(updateAppointment).mockRejectedValueOnce(new Error('record_changed'));
    const { result } = renderHook(() => useUpdateAppointment(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ appointment: RIYA, fields: { notes: 'x' } })
        .catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe('useMoveAppointment', () => {
  /** The Agenda, a calendar range and the booking itself beside the move, sharing one cache. */
  function renderWithReads() {
    return renderHook(
      () => ({
        list: useAppointmentList({ status: 'active', branchIds: [] }),
        range: useAppointmentRange({
          status: 'active',
          branchIds: [],
          from: APPOINTMENT_TOMORROW,
          to: APPOINTMENT_TOMORROW,
        }),
        one: useAppointment(RIYA.id),
        move: useMoveAppointment(),
      }),
      { wrapper },
    );
  }

  it('shows the new status on every cached read at once, then "<name> → <status>"', async () => {
    const { result } = renderWithReads();
    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.range.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.one.isSuccess).toBe(true));
    const release = holdWrites();

    let landed: Promise<unknown> = Promise.resolve();
    act(() => {
      landed = result.current.move.mutateAsync({ appointment: RIYA, route: 'confirm' });
    });

    await waitFor(() =>
      expect(statusIn(result.current.list.rows, RIYA.id)).toBe('confirmed'),
    );
    expect(statusIn(result.current.range.data, RIYA.id)).toBe('confirmed');
    expect(result.current.one.data?.status).toBe('confirmed');
    expect(statusIn(result.current.range.data, KABIR.id)).toBe('scheduled');
    expect(stored(RIYA.id).status).toBe('scheduled');

    release();
    await act(() => landed);
    expect(moveAppointment).toHaveBeenCalledWith({
      appointmentId: RIYA.id,
      route: 'confirm',
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenCalledWith('Riya Mehta → Confirmed');
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('adds " · reminder queued" to a confirm the server queued one for', async () => {
    vi.mocked(moveAppointment).mockResolvedValueOnce({
      ...RIYA,
      status: 'confirmed',
      reminder: 'reminder_queued',
    });
    const { result } = renderHook(() => useMoveAppointment(), { wrapper });

    await act(() => result.current.mutateAsync({ appointment: RIYA, route: 'confirm' }));

    expect(notify.success).toHaveBeenCalledWith(
      'Riya Mehta → Confirmed · reminder queued',
    );
  });

  it('puts every read back and says why when the server refuses', async () => {
    vi.mocked(moveAppointment).mockRejectedValueOnce(new Error('transition_not_allowed'));
    const { result } = renderWithReads();
    await waitFor(() => expect(result.current.range.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.one.isSuccess).toBe(true));

    await act(async () => {
      await result.current.move
        .mutateAsync({ appointment: RIYA, route: 'no-show' })
        .catch(() => undefined);
    });

    expect(statusIn(result.current.range.data, RIYA.id)).toBe('scheduled');
    expect(result.current.one.data?.status).toBe('scheduled');
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('offers Undo on a check-in, which takes it back through undo-check-in', async () => {
    const today = patchStored(RIYA.id, { date: APPOINTMENT_TODAY, status: 'confirmed' });
    const { result } = renderHook(() => useMoveAppointment(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ appointment: today, route: 'check-in' }),
    );

    const undo = lastUndo();
    expect(undo.message).toBe('Riya Mehta → Checked in');
    expect(notify.success).not.toHaveBeenCalled();

    act(() => undo.onUndo());
    await waitFor(() => expect(lastRoute()).toBe('undo-check-in'));
    expect(vi.mocked(moveAppointment).mock.lastCall?.[0]).toMatchObject({
      appointmentId: RIYA.id,
    });
    await waitFor(() => expect(stored(RIYA.id).status).toBe('confirmed'));
  });

  it.each<AppointmentMoveRoute>(['complete', 'no-show', 'reinstate'])(
    'offers no Undo on %s — the API has no way back',
    async (route) => {
      const { result } = renderHook(() => useMoveAppointment(), { wrapper });

      await act(() => result.current.mutateAsync({ appointment: RIYA, route }));

      expect(notify.success).toHaveBeenCalledTimes(1);
      expect(notify.undo).not.toHaveBeenCalled();
    },
  );

  it('toasts the caller’s own words — Today’s check-in — still with Undo', async () => {
    const { result } = renderHook(
      () => useMoveAppointment({ announce: (row) => `${row.person.name} checked in` }),
      { wrapper },
    );

    await act(() => result.current.mutateAsync({ appointment: RIYA, route: 'check-in' }));

    expect(lastUndo().message).toBe('Riya Mehta checked in');
  });
});

describe('useCancelAppointment', () => {
  it('cancels with the reason — "Appointment #2861 cancelled" — and Undo reinstates it', async () => {
    const { result } = renderHook(() => useCancelAppointment(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        appointment: RIYA,
        cancel: { reason: 'patient_asked', note: null },
      }),
    );

    expect(cancelAppointment).toHaveBeenCalledWith({
      appointmentId: RIYA.id,
      cancel: { reason: 'patient_asked', note: null },
      idempotencyKey: expect.any(String),
    });
    expect(stored(RIYA.id).status).toBe('cancelled');
    const undo = lastUndo();
    expect(undo.message).toBe('Appointment #2861 cancelled');

    act(() => undo.onUndo());
    await waitFor(() => expect(lastRoute()).toBe('reinstate'));
    await waitFor(() => expect(stored(RIYA.id).status).toBe('scheduled'));
  });

  it('names the person and the API’s reason from the popover', async () => {
    const { result } = renderHook(() => useCancelAppointment({ announce: 'status' }), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        appointment: RIYA,
        cancel: { reason: 'unreachable', note: null },
      }),
    );

    expect(lastUndo().message).toBe(
      'Riya Mehta → Cancelled · Could not reach patient · slot freed, reminders stopped',
    );
  });
});

describe('useReinstateAppointment', () => {
  it('reinstates through its route — "Appointment restored · reminder goes out again"', async () => {
    const cancelled = patchStored(RIYA.id, { status: 'cancelled' });
    const { result } = renderHook(() => useReinstateAppointment(), { wrapper });

    await act(() => result.current.mutateAsync(cancelled));

    expect(moveAppointment).toHaveBeenCalledWith({
      appointmentId: RIYA.id,
      route: 'reinstate',
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenLastCalledWith(
      'Appointment restored · reminder goes out again',
    );
    expect(stored(RIYA.id).status).toBe('scheduled');
  });
});

describe('the task rules after a booking write (D81 T7)', () => {
  it('reads the tasks again once the server’s rules have run on a booking or a status move', async () => {
    const refresh = vi.spyOn(client, 'invalidateQueries');
    const taskReads = () =>
      refresh.mock.calls.filter(([filters]) => filters?.queryKey?.[1] === 'tasks').length;
    const { result } = renderHook(
      () => ({ book: useCreateAppointment(), move: useMoveAppointment() }),
      { wrapper },
    );

    await act(() => result.current.book.mutateAsync(NEW_BOOKING));
    // Not at once: the rules run just after the commit.
    expect(taskReads()).toBe(0);
    await waitFor(() => expect(taskReads()).toBe(1), { timeout: 3_000 });

    await act(() =>
      result.current.move.mutateAsync({ appointment: RIYA, route: 'confirm' }),
    );
    await waitFor(() => expect(taskReads()).toBe(2), { timeout: 3_000 });
  });
});
