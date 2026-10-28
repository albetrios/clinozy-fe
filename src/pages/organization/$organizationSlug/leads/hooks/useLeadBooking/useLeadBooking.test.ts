import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
} from '@/tests/utils/appointment-doubles.ts';

import { nextLiveBooking } from './useLeadBooking.ts';

describe('nextLiveBooking (clinozy-be L11)', () => {
  it('is the earliest scheduled or confirmed booking', () => {
    const later = appointmentRow({
      id: 'appt_later0000000000000000',
      date: APPOINTMENT_TOMORROW,
    });
    const sooner = appointmentRow({
      id: 'appt_soon00000000000000000',
      date: APPOINTMENT_TODAY,
      startTime: '16:00',
      status: 'confirmed',
    });
    const earlierToday = appointmentRow({
      id: 'appt_early0000000000000000',
      date: APPOINTMENT_TODAY,
      startTime: '09:30',
    });
    expect(nextLiveBooking([later, sooner, earlierToday])?.id).toBe(earlierToday.id);
  });

  it('skips the final and the under-way ones — none left is null', () => {
    const rows = (['completed', 'cancelled', 'no_show', 'checked_in'] as const).map(
      (status) => appointmentRow({ status }),
    );
    expect(nextLiveBooking(rows)).toBeNull();
    expect(nextLiveBooking([])).toBeNull();
    const live = appointmentRow({
      id: 'appt_live00000000000000000',
      status: 'scheduled',
    });
    expect(nextLiveBooking([...rows, live])?.id).toBe(live.id);
  });
});
