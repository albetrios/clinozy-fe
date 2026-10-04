import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import { appointmentQueryKeys } from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useAppointment,
  useAppointmentDaySummaries,
  useAppointmentList,
  useAppointmentRange,
  useAppointmentSlotLabel,
  useAvailableSlots,
  useBookableStaff,
  useCancelAppointment,
  useCreateAppointment,
  useRestoreAppointment,
  useSetAppointmentStatus,
  useUpdateAppointment,
  withAppointmentStatus,
} from './useAppointments.ts';

/** Holds a status write until a test lets it land, so the optimistic patch can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));

vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof AppointmentsApiModule>();
  return {
    ...actual,
    setAppointmentStatus: async (
      ...args: Parameters<typeof actual.setAppointmentStatus>
    ) => {
      await gate.hold;
      return actual.setAppointmentStatus(...args);
    },
  };
});
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

const TODAY = '2026-10-03';
const DR = staffRef('DR');

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

const statusOf = (seq: number) =>
  clinicFixtures.appointments.snapshot((row) => row.seq === seq)[0]?.status;
const priti = () =>
  clinicFixtures.patients.snapshot((row) => row.firstName === 'Priti')[0]?.id ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  gate.hold = null;
  for (const fn of Object.values(notify)) vi.mocked(fn).mockClear();
  resetClinicFixtures();
  for (const collection of Object.values(clinicFixtures)) collection.snapshot();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('appointment reads', () => {
  it('reads the Agenda a page at a time, equal params sharing one entry', async () => {
    const { result } = renderHook(
      () => ({
        one: useAppointmentList({ doctorIds: [DR, staffRef('DN')] }),
        two: useAppointmentList({ doctorIds: [staffRef('DN'), DR], q: ' ' }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.one.isPending).toBe(false));
    expect(result.current.one.rows.length).toBeGreaterThan(5);
    expect(result.current.one.hasNextPage).toBe(false);
    expect(
      client.getQueryCache().findAll({ queryKey: appointmentQueryKeys.lists() }),
    ).toHaveLength(1);
  });

  it('reads the day counts, a range, one booking, the slots and the bookable staff', async () => {
    const { result } = renderHook(
      () => ({
        days: useAppointmentDaySummaries({}),
        week: useAppointmentRange({ from: TODAY, to: '2026-10-09' }),
        one: useAppointment(ref.appointment(2861)),
        slots: useAvailableSlots({ date: '2026-10-05', doctorId: DR, durationMin: 30 }),
        staff: useBookableStaff(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.staff.data).toBeDefined());
    await waitFor(() => expect(result.current.slots.data).toBeDefined());
    expect(result.current.days.data?.[0]).toMatchObject({ date: TODAY, total: 8 });
    expect(result.current.week.data?.map((row) => row.seq)).toContain(2861);
    expect(result.current.one.data).toMatchObject({ seq: 2861 });
    expect(result.current.slots.data?.[0]).toEqual({ time: '10:00', free: true });
    expect(result.current.staff.data?.[0]?.roles).toContain('doctor');
  });

  it('keeps the last range’s bookings while the next range loads', async () => {
    const { result, rerender } = renderHook(
      ({ from, to }) => useAppointmentRange({ from, to }),
      { wrapper, initialProps: { from: TODAY, to: TODAY } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const today = result.current.data;
    expect(today?.length).toBeGreaterThan(0);

    rerender({ from: '2026-10-04', to: '2026-10-10' });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(today);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.every((row) => row.date >= '2026-10-04')).toBe(true);
  });

  it('stays idle without a range, an id or slot params', () => {
    const { result } = renderHook(
      () => ({
        range: useAppointmentRange(null),
        one: useAppointment(undefined),
        slots: useAvailableSlots(null),
      }),
      { wrapper },
    );
    expect(result.current.range.fetchStatus).toBe('idle');
    expect(result.current.one.fetchStatus).toBe('idle');
    expect(result.current.slots.fetchStatus).toBe('idle');
  });
});

describe('useAppointmentSlotLabel', () => {
  it('names today and tomorrow, else the date, with the start as written', () => {
    const { result } = renderHook(() => useAppointmentSlotLabel(), { wrapper });
    expect(result.current(TODAY, '12:30')).toMatchObject({ day: 'Today' });
    expect(result.current('2026-10-04', '09:05')).toMatchObject({ day: 'Tomorrow' });
    const later = result.current('2026-10-12', '16:00');
    expect(later.day).toMatch(/Mon/);
    expect(later.day).toMatch(/12/);
    expect(later.time).toMatch(/4:00/);
  });
});

describe('withAppointmentStatus (the optimistic flip)', () => {
  const row = { id: 'a', seq: 1, status: 'scheduled' } as unknown as AppointmentRow;
  const other = { id: 'b', seq: 2, status: 'scheduled' } as unknown as AppointmentRow;

  it('moves the booking in pages, lists and the record, and leaves the rest alone', () => {
    expect(withAppointmentStatus([row, other], 'a', 'confirmed')).toEqual([
      { ...row, status: 'confirmed' },
      other,
    ]);
    expect(
      withAppointmentStatus(
        { pages: [{ rows: [row] }], pageParams: [undefined] },
        'a',
        'no_show',
      ),
    ).toEqual({
      pages: [{ rows: [{ ...row, status: 'no_show' }] }],
      pageParams: [undefined],
    });
    expect(withAppointmentStatus(row, 'a', 'confirmed')).toEqual({
      ...row,
      status: 'confirmed',
    });
    const summaries = [{ date: TODAY, total: 1, confirmed: 0, scheduled: 1 }];
    expect(withAppointmentStatus(summaries, 'a', 'confirmed')).toBe(summaries);
    expect(withAppointmentStatus(other, 'a', 'confirmed')).toBe(other);
  });
});

describe('useSetAppointmentStatus', () => {
  it('flips the status everywhere at once, toasts with Undo, and Undo puts it back', async () => {
    let release = () => {};
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });
    const { result } = renderHook(
      () => ({
        list: useAppointmentList({}),
        week: useAppointmentRange({ from: TODAY, to: '2026-10-09' }),
        set: useSetAppointmentStatus(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.week.data).toBeDefined());
    await waitFor(() => expect(result.current.list.rows.length).toBeGreaterThan(0));

    act(() => {
      result.current.set.mutate({ id: ref.appointment(2848), status: 'confirmed' });
    });
    const shown = (rows: readonly AppointmentRow[] | undefined) =>
      rows?.find((row) => row.seq === 2848)?.status;
    await waitFor(() => expect(shown(result.current.list.rows)).toBe('confirmed'));
    expect(shown(result.current.week.data)).toBe('confirmed');
    expect(statusOf(2848)).toBe('scheduled');

    await act(async () => release());
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    expect(statusOf(2848)).toBe('confirmed');
    const undo = lastUndo();
    expect(undo.message).toBe('Priti Soni → Confirmed · reminder queued');

    act(() => undo.onUndo());
    await waitFor(() => expect(statusOf(2848)).toBe('scheduled'));
  });

  it('puts every read back and toasts the guard when the server refuses', async () => {
    const { result } = renderHook(
      () => ({
        week: useAppointmentRange({ from: TODAY, to: '2026-10-09' }),
        set: useSetAppointmentStatus(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.week.data).toBeDefined());
    await act(async () => {
      await result.current.set
        .mutateAsync({ id: ref.appointment(2848), status: 'no_show' })
        .catch(() => undefined);
    });
    expect(result.current.week.data?.find((row) => row.seq === 2848)?.status).toBe(
      'scheduled',
    );
    expect(notify.error).toHaveBeenCalledWith('Available after 11:30 am on Today');
    expect(notify.undo).not.toHaveBeenCalled();
  });
});

describe('booking and editing', () => {
  it('books with "Booked #<seq> · <day> <time> · confirm request sent on WhatsApp"', async () => {
    const { result } = renderHook(() => useCreateAppointment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        patientId: priti(),
        doctorId: DR,
        date: TODAY,
        startTime: '12:30',
      });
    });
    const [message] = vi.mocked(notify.success).mock.lastCall ?? [];
    expect(message).toMatch(
      /^Booked #2870 · Today 12:30\s?(PM|pm) · confirm request sent on WhatsApp$/,
    );
  });

  it('names a move "#<seq> moved to …" and any other save "#<seq> updated"', async () => {
    const { result } = renderHook(() => useUpdateAppointment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        id: ref.appointment(2861),
        patch: { notes: 'Prefers evenings' },
      });
    });
    expect(notify.success).toHaveBeenLastCalledWith('#2861 updated');
    await act(async () => {
      await result.current.mutateAsync({
        id: ref.appointment(2861),
        patch: { date: '2026-10-12', startTime: '11:00' },
      });
    });
    const [message] = vi.mocked(notify.success).mock.lastCall ?? [];
    expect(message).toMatch(/^#2861 moved to Mon.* · confirm request sent$/);
  });
});

describe('cancel and restore', () => {
  it('cancels from the form with "Appointment #<seq> cancelled" and Undo', async () => {
    const { result } = renderHook(() => useCancelAppointment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        id: ref.appointment(2858),
        reason: 'patient_asked',
        note: null,
      });
    });
    const undo = lastUndo();
    expect(undo.message).toBe('Appointment #2858 cancelled');
    act(() => undo.onUndo());
    await waitFor(() => expect(statusOf(2858)).toBe('confirmed'));
  });

  it('cancels from the popover naming the person and the reason', async () => {
    const { result } = renderHook(() => useCancelAppointment({ announce: 'status' }), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        id: ref.appointment(2858),
        reason: 'unreachable',
        note: null,
      });
    });
    expect(lastUndo().message).toBe(
      'Jalpa Sheladiya → Cancelled · Could not reach patient · slot freed, reminders stopped',
    );
  });

  it('restores with "Appointment restored · reminder goes out again"', async () => {
    const { result } = renderHook(
      () => ({ cancel: useCancelAppointment(), restore: useRestoreAppointment() }),
      { wrapper },
    );
    await act(async () => {
      await result.current.cancel.mutateAsync({
        id: ref.appointment(2858),
        reason: 'patient_asked',
        note: null,
      });
      await result.current.restore.mutateAsync(ref.appointment(2858));
    });
    expect(notify.success).toHaveBeenLastCalledWith(
      'Appointment restored · reminder goes out again',
    );
    expect(statusOf(2858)).toBe('scheduled');
  });
});
