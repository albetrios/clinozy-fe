import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { APPOINTMENT_NOW, appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import { TEST_CONTACT_ID, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { useVisitsTable } from './useVisitsTable.tsx';

/** Priya's bookings, newest first: tomorrow's consultation, a completed visit last month. */
const ROWS: AppointmentRow[] = [
  appointmentRow({ contactId: TEST_CONTACT_ID, patientId: TEST_PATIENT_ID }),
  appointmentRow({
    id: 'appt_older0000000000000000',
    seq: 2790,
    contactId: TEST_CONTACT_ID,
    patientId: TEST_PATIENT_ID,
    date: '2026-09-12',
    startTime: '16:00',
    endTime: '16:45',
    status: 'completed',
    serviceLabel: 'Hydrafacial',
    type: 'treatment',
    // A doctor who has left the team: no name to join.
    doctorId: 'mem_dev00000000000000000',
    doctor: null,
  }),
];

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
});

describe('useVisitsTable (H:4746)', () => {
  it('lays out ID · When · Offering · Doctor · Status, When the primary, none sortable', () => {
    const { result } = renderHook(() => useVisitsTable(ROWS), { wrapper });
    const table = result.current;
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual([
      'id',
      'when',
      'offering',
      'doctor',
      'status',
    ]);
    expect(table.getVisibleLeafColumns()).toHaveLength(5);
    expect(table.getAllLeafColumns().every((column) => !column.getCanSort())).toBe(true);
    expect(table.getColumn('when')?.columnDef.meta?.primary).toBe(true);
    expect(table.getColumn('id')?.getCanHide()).toBe(false);
  });

  it('keeps the bookings in the order they came, each by its public id', () => {
    const { result } = renderHook(() => useVisitsTable(ROWS), { wrapper });
    expect(result.current.getRowModel().rows.map((row) => row.id)).toEqual([
      'appt_riya00000000000000000',
      'appt_older0000000000000000',
    ]);
  });

  it('reads When as the day and the start, the offering and the doctor’s name', () => {
    const { result } = renderHook(() => useVisitsTable(ROWS), { wrapper });
    const [tomorrow, older] = result.current.getRowModel().rows;
    expect(tomorrow?.getValue('when')).toMatch(/^Tomorrow · 10:30\s?(AM|am)$/);
    expect(older?.getValue('when')).toMatch(/12.* · 4:00\s?(PM|pm)$/);
    expect(tomorrow?.getValue('offering')).toBe('Consultation');
    expect(tomorrow?.getValue('doctor')).toBe('Nisha Shah');
    expect(older?.getValue('doctor')).toBe('');
  });

  it('folds the number, the status with its dot, and the doctor to nothing', () => {
    const { result } = renderHook(() => useVisitsTable(ROWS), { wrapper });
    const [, completed] = ROWS;
    if (!completed) throw new Error('no visit');
    const fold = (id: string) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(completed);
    expect(fold('id')).toBe('#2790');
    expect(fold('doctor')).toBeNull();
    expect(fold('status')).toMatchObject({
      value: 'Completed',
      dotClassName: expect.stringMatching(/^bg-tone-/),
    });
  });
});
