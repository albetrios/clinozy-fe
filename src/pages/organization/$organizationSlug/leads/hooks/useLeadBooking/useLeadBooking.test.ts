import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import {
  APPOINTMENT_TOMORROW,
  appointmentRow,
} from '@/tests/utils/appointment-doubles.ts';

import { useLeadBooking } from './useLeadBooking.ts';

/** What the member may do in Appointments, and the person's bookings as read. */
const world = vi.hoisted(() => ({
  reads: true,
  edits: true,
  rows: undefined as AppointmentRow[] | undefined,
  contactsRead: [] as (string | undefined)[],
}));

vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: () => ({
    isResolved: true,
    can: (_area: string, action: string) =>
      action === 'view' ? world.reads : world.edits,
  }),
}));
vi.mock('@/shared/hooks/useAppointments/index.ts', () => ({
  usePersonAppointments: (contactId: string | undefined) => {
    world.contactsRead.push(contactId);
    return { data: contactId ? world.rows : undefined };
  },
  useAppointmentSlotLabel: () => (date: string, time: string) => ({
    day: date,
    time,
  }),
}));

const LEAD = { contactId: 'con_anaya0000000000000000', interests: ['clinical'] };
const LATER = appointmentRow({
  id: 'appt_later00000000000000',
  date: APPOINTMENT_TOMORROW,
  startTime: '11:00',
  serviceLabel: 'Consultation',
});

beforeEach(() => {
  Object.assign(world, { reads: true, edits: true, rows: [LATER], contactsRead: [] });
});

describe('useLeadBooking (clinozy-be L11)', () => {
  it('shows the booking still to happen, with Reschedule and Cancel for Appointments Edit', () => {
    const { result } = renderHook(() => useLeadBooking({ lead: LEAD, canBook: true }));
    const visit = result.current.progress.visit;
    expect(visit?.when).toBe(`${APPOINTMENT_TOMORROW} · 11:00`);
    expect(visit?.what).toMatch(/^Consultation/);
    act(() => visit?.onReschedule?.());
    expect(result.current.form).toEqual({ mode: 'reschedule', appointment: LATER });
    act(() => result.current.progress.visit?.onCancel?.());
    expect(result.current.cancelling).toBe(LATER);
    act(() => {
      result.current.closeForm();
      result.current.closeCancel();
    });
    expect(result.current.form).toBeNull();
    expect(result.current.cancelling).toBeNull();
  });

  it('shows it without actions to a member who does not edit Appointments', () => {
    world.edits = false;
    const { result } = renderHook(() => useLeadBooking({ lead: LEAD, canBook: true }));
    expect(result.current.progress.visit?.onReschedule).toBeUndefined();
    expect(result.current.progress.visit?.onCancel).toBeUndefined();
  });

  it('is null with nothing left to happen, and unknown for a member who does not read them', () => {
    world.rows = [appointmentRow({ status: 'cancelled' })];
    const none = renderHook(() => useLeadBooking({ lead: LEAD, canBook: true }));
    expect(none.result.current.progress.visit).toBeNull();

    world.reads = false;
    const unread = renderHook(() => useLeadBooking({ lead: LEAD, canBook: true }));
    expect(unread.result.current.progress.visit).toBeUndefined();
    expect(world.contactsRead.at(-1)).toBeUndefined();
  });

  it('opens a new booking on the person for a member who books — never for one who does not', () => {
    const { result } = renderHook(() => useLeadBooking({ lead: LEAD, canBook: true }));
    act(() => result.current.progress.onBook?.());
    expect(result.current.form).toMatchObject({
      mode: 'create',
      prefill: { whoId: LEAD.contactId, type: 'consultation' },
    });
    act(() => result.current.book?.('Asked about acne'));
    expect(result.current.form).toMatchObject({
      mode: 'create',
      prefill: { reason: 'Asked about acne' },
    });

    const viewer = renderHook(() => useLeadBooking({ lead: LEAD, canBook: false }));
    expect(viewer.result.current.book).toBeUndefined();
    expect(viewer.result.current.progress.onBook).toBeUndefined();
  });
});
