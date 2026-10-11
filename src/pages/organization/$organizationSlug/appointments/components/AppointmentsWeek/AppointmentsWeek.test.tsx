import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { appInstant } from '@/shared/api/app/app-time.ts';
import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import { fetchAppointmentRange } from '@/shared/api/app/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
  DOCTOR_NISHA,
} from '@/tests/utils/appointment-doubles.ts';

import {
  type AppointmentsWorld,
  MEERA_BOOKING,
  publicId,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  grantAppAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { weekLoad } from '../../appointments.calendar.ts';
import { AppointmentsWeek } from './AppointmentsWeek.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});

/** Sat 3 Oct 2026: its week runs Sun 27 Sep to Sat 3 Oct. */
const URL = `${APPOINTMENTS_PAGE}?view=week`;
/** The next week, Sun 4 to Sat 10 Oct. */
const NEXT_WEEK = `${APPOINTMENTS_PAGE}?view=week&date=${APPOINTMENT_TOMORROW}`;

const headers = () => screen.getAllByTestId('appointments-week-day');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentsWeek (KICKOFF §6.4 Week)', () => {
  it('heads seven days, Sunday first, today in red and the past dimmed', async () => {
    renderInAppointments(<AppointmentsWeek />, URL);
    await screen.findAllByTestId('appointments-week-day');
    expect(headers().map((header) => header.dataset.date)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(headers()[0]).toHaveTextContent(/^Sun27/);
    const today = headers()[6] as HTMLElement;
    expect(within(today).getByText('3')).toHaveClass('text-destructive');
    expect(today.className).not.toContain('opacity-45');
    expect(headers()[0]?.className).toContain('opacity-45');
  });

  it('reads Sunday to Saturday with the page’s filters, the picked doctor’s bookings only', async () => {
    renderInAppointments(<AppointmentsWeek />, `${URL}&doctor=${DOCTOR_NISHA.id}`);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(1),
    );
    expect(fetchAppointmentRange).toHaveBeenLastCalledWith({
      from: '2026-09-27',
      to: '2026-10-03',
      status: 'active',
      doctorId: DOCTOR_NISHA.id,
      q: undefined,
      created: undefined,
      branchIds: [],
    });
    expect(screen.getByTestId('appointments-block')).toHaveTextContent('Meera Iyer');
  });

  it('draws each day’s bookings in its own column, none bookable, today’s with the now line', async () => {
    // An hour into the rail, so the now line has a place on it.
    vi.setSystemTime(new Date(appInstant(APPOINTMENT_TODAY, '10:00')));
    renderInAppointments(<AppointmentsWeek />, URL);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(2),
    );
    const todayColumn = screen
      .getAllByTestId('appointments-day-column')
      .find((column) => column.dataset.date === APPOINTMENT_TODAY) as HTMLElement;
    expect(within(todayColumn).getAllByTestId('appointments-block')).toHaveLength(2);
    expect(
      todayColumn.querySelector('[data-testid="appointments-day-slots"]'),
    ).toBeNull();
    expect(within(todayColumn).getByTestId('appointments-now-line')).toBeInTheDocument();
  });

  it('shows each day’s chair-time load and a double-booked doctor', async () => {
    // Dr. Nisha holds Riya at 10:30 and a second booking at 10:40 tomorrow.
    const clash = appointmentRow({
      id: publicId('appt', 'clash'),
      seq: 2870,
      startTime: '10:40',
      endTime: '11:00',
    });
    world.rows = [...world.rows, clash];
    renderInAppointments(<AppointmentsWeek />, NEXT_WEEK);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(4),
    );
    const shown = vi.mocked(fetchAppointmentRange).mock.lastCall?.[0];
    expect(shown).toMatchObject({ from: '2026-10-04', to: '2026-10-10' });
    const rows = world.rows.filter((row) => row.status !== 'cancelled');
    for (const header of headers()) {
      const load = weekLoad(rows.filter((row) => row.date === header.dataset.date));
      const bar = header.querySelector('[title]') as HTMLElement;
      expect(bar.getAttribute('title')).toBe(
        `${load.booked} booked · ${load.percent}% of chair time${load.overlap ? ' · overlapping booking' : ''}`,
      );
      expect(
        within(header).queryByRole('img', { name: 'Overlapping booking' }) !== null,
      ).toBe(header.dataset.date === APPOINTMENT_TOMORROW);
    }
  });

  it('opens a day in Day from its header', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<AppointmentsWeek />, URL);
    await user.click(
      (await screen.findAllByTestId('appointments-week-day'))[2] as HTMLElement,
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        view: 'day',
        date: '2026-09-29',
      }),
    );
  });

  it('opens a booking’s drawer from its block', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<AppointmentsWeek />, URL);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(2),
    );
    await user.click(screen.getByRole('button', { name: /^Meera Iyer/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${APPOINTMENTS_PAGE}/${MEERA_BOOKING.id}`,
      ),
    );
    expect(router.state.location.search).toEqual({ view: 'week' });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInAppointments(<AppointmentsWeek />, URL);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(2),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
