import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APPOINTMENT_NOW,
  appointmentRow,
  contactHit,
  DOCTOR_NISHA,
} from '@/tests/utils/appointment-doubles.ts';

import {
  APPOINTMENTS_PAGE,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import {
  isCurrentPeriod,
  shiftAnchor,
  useAppointmentsNavigation,
} from './useAppointmentsNavigation.ts';

describe('shiftAnchor', () => {
  it('moves a Day by one day and a Week by seven', () => {
    expect(shiftAnchor('2026-10-31', 'day', 1)).toBe('2026-11-01');
    expect(shiftAnchor('2026-10-03', 'week', -1)).toBe('2026-09-26');
  });

  it('moves a Month by a month, keeping the day inside it', () => {
    expect(shiftAnchor('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftAnchor('2026-03-31', 'month', -1)).toBe('2026-02-28');
    expect(shiftAnchor('2026-12-15', 'month', 1)).toBe('2027-01-15');
  });
});

describe('isCurrentPeriod', () => {
  it('knows the current day, week (Sunday first) and month', () => {
    expect(isCurrentPeriod('day', '2026-10-03', '2026-10-03')).toBe(true);
    expect(isCurrentPeriod('day', '2026-10-04', '2026-10-03')).toBe(false);
    expect(isCurrentPeriod('week', '2026-09-27', '2026-10-03')).toBe(true);
    expect(isCurrentPeriod('week', '2026-10-04', '2026-10-03')).toBe(false);
    expect(isCurrentPeriod('month', '2026-10-31', '2026-10-03')).toBe(true);
  });
});

const WHO = contactHit().id;
const BOOKING = appointmentRow().id;

/** Buttons for each move the hook makes. */
function Probe() {
  const navigation = useAppointmentsNavigation();
  return (
    <>
      <span data-testid="anchor">{navigation.anchor}</span>
      <button type="button" onClick={() => navigation.setView('week')}>
        week
      </button>
      <button type="button" onClick={() => navigation.openDay('2026-10-09')}>
        day
      </button>
      <button type="button" onClick={() => navigation.goToday()}>
        today
      </button>
      <button
        type="button"
        onClick={() => navigation.openCreate({ date: '2026-10-09', time: '10:15' })}
      >
        create
      </button>
      <button
        type="button"
        onClick={() => navigation.openCreate({ who: WHO, copyOf: BOOKING })}
      >
        copy
      </button>
      <button
        type="button"
        onClick={() => navigation.openAppointment(BOOKING, 'reschedule')}
      >
        reschedule
      </button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
});
afterEach(() => vi.useRealTimers());

describe('useAppointmentsNavigation', () => {
  it('anchors the calendars on the URL’s day, else today', async () => {
    renderAppointmentsRoutes(`${APPOINTMENTS_PAGE}?view=day`, Probe);
    expect(await screen.findByTestId('anchor')).toHaveTextContent('2026-10-03');
  });

  it('keeps the day across calendar views and opens a day in Day', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}?view=day&date=2026-10-05&status=all`,
      Probe,
    );
    await user.click(await screen.findByRole('button', { name: 'week' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        view: 'week',
        date: '2026-10-05',
        status: 'all',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'day' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        view: 'day',
        date: '2026-10-09',
        status: 'all',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'today' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'day', status: 'all' }),
    );
  });

  it('opens New appointment with the prefill, the page’s params — its one doctor — kept', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}?view=day&doctor=${DOCTOR_NISHA.id}`,
      Probe,
    );
    await user.click(await screen.findByRole('button', { name: 'create' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({
      view: 'day',
      doctor: DOCTOR_NISHA.id,
      date: '2026-10-09',
      time: '10:15',
    });
  });

  it('carries the contact and the booking copied by their public ids', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(`${APPOINTMENTS_PAGE}?status=all`, Probe);
    await user.click(await screen.findByRole('button', { name: 'copy' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({
      status: 'all',
      who: WHO,
      copyOf: BOOKING,
    });
  });

  it('opens a booking’s drawer in Reschedule, the page’s params kept', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(`${APPOINTMENTS_PAGE}?view=month`, Probe);
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/${BOOKING}`),
    );
    expect(router.state.location.search).toEqual({ view: 'month', mode: 'reschedule' });
  });
});
