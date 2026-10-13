import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import { fetchAppointmentRange } from '@/shared/api/app/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  appointmentRow,
  DOCTOR_ARJUN,
} from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  type AppointmentsWorld,
  publicId,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  grantAppAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentsMonth } from './AppointmentsMonth.tsx';

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

const URL = `${APPOINTMENTS_PAGE}?view=month`;

/** Two more bookings today: Dr. Arjun's at 11:40, clashing with Kabir's 11:30, and Dr. Nisha's at 17:00. */
const EXTRA_TODAY = [
  appointmentRow({
    id: publicId('appt', 'zoya'),
    seq: 2871,
    date: APPOINTMENT_TODAY,
    startTime: '11:40',
    endTime: '12:00',
    doctorId: DOCTOR_ARJUN.id,
    doctor: DOCTOR_ARJUN,
  }),
  appointmentRow({
    id: publicId('appt', 'neel'),
    seq: 2872,
    date: APPOINTMENT_TODAY,
    startTime: '17:00',
    endTime: '17:20',
  }),
];

/** The Month cell of a date. */
const cellOf = (date: string) =>
  screen
    .getAllByTestId('appointments-month-cell')
    .find((cell) => cell.dataset.date === date) as HTMLElement;

/** Today's live bookings — Meera, Kabir and the two extra. */
const TODAY_COUNT = 4;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  world.rows = [...world.rows, ...EXTRA_TODAY.map((row) => structuredClone(row))];
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentsMonth (KICKOFF §6.4 Month)', () => {
  it('lays October under Sun–Sat: four blanks, then every day', async () => {
    renderInAppointments(<AppointmentsMonth />, URL);
    const cells = await screen.findAllByTestId('appointments-month-cell');
    expect(cells).toHaveLength(31);
    expect(cells[0]).toHaveAttribute('data-date', '2026-10-01');
    expect(screen.getByTestId('appointments-calendar')).toHaveTextContent(
      /^SunMonTueWedThuFriSat/,
    );
    const today = cellOf(APPOINTMENT_TODAY);
    expect(today.className).toContain('border-primary');
    expect(within(today).getByText('3')).toHaveClass('text-destructive', 'font-bold');
    expect(cellOf('2026-10-02').className).toContain('opacity-62');
  });

  it('reads the calendar month with the page’s filters', async () => {
    renderInAppointments(<AppointmentsMonth />, `${URL}&status=all`);
    await waitFor(() =>
      expect(fetchAppointmentRange).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31',
        status: 'all',
        doctorId: undefined,
        q: undefined,
        created: undefined,
        branchIds: [],
      }),
    );
    // A No show and a cancelled booking show with every status.
    await waitFor(() =>
      expect(
        within(cellOf('2026-10-02')).getAllByTestId('appointments-block'),
      ).toHaveLength(1),
    );
  });

  it('fits the chips the cell holds — two before it is measured — then "+<n> more" and a clash’s dot', async () => {
    renderInAppointments(<AppointmentsMonth />, URL);
    await waitFor(() =>
      expect(
        within(cellOf(APPOINTMENT_TODAY)).getAllByTestId('appointments-block'),
      ).toHaveLength(2),
    );
    expect(
      within(cellOf(APPOINTMENT_TODAY)).getByTestId('appointments-month-more'),
    ).toHaveTextContent(`+${TODAY_COUNT - 2} more`);
    expect(
      within(cellOf(APPOINTMENT_TODAY)).getByRole('img', { name: 'Overlapping booking' }),
    ).toBeInTheDocument();
    // Tomorrow's two fit, by two doctors: no clash.
    expect(
      within(cellOf('2026-10-04')).queryByRole('img', { name: 'Overlapping booking' }),
    ).toBeNull();
    expect(
      within(cellOf('2026-10-04')).queryByTestId('appointments-month-more'),
    ).toBeNull();
  });

  it('lists the whole day in its popover, which opens the day', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<AppointmentsMonth />, URL);
    await waitFor(() =>
      expect(
        within(cellOf(APPOINTMENT_TODAY)).getAllByTestId('appointments-block'),
      ).toHaveLength(2),
    );
    await user.click(
      within(cellOf(APPOINTMENT_TODAY)).getByTestId('appointments-month-more'),
    );
    const popover = await screen.findByTestId('appointments-month-popover');
    expect(popover).toHaveAccessibleName(`Today · ${TODAY_COUNT} appointments`);
    expect(within(popover).getAllByTestId('appointments-block')).toHaveLength(
      TODAY_COUNT,
    );
    expect(await axeForDialog(popover)).toHaveNoViolations();
    await user.click(within(popover).getByTestId('appointments-month-open-day'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        view: 'day',
        date: APPOINTMENT_TODAY,
      }),
    );
  });

  it('closes the popover on ×', async () => {
    const user = userEvent.setup();
    renderInAppointments(<AppointmentsMonth />, URL);
    await waitFor(() =>
      expect(
        within(cellOf(APPOINTMENT_TODAY)).getAllByTestId('appointments-block'),
      ).toHaveLength(2),
    );
    await user.click(
      within(cellOf(APPOINTMENT_TODAY)).getByTestId('appointments-month-more'),
    );
    const popover = await screen.findByTestId('appointments-month-popover');
    await user.click(within(popover).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByTestId('appointments-month-popover')).toBeNull(),
    );
  });

  it('opens a day in Day from its cell', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<AppointmentsMonth />, URL);
    await screen.findAllByTestId('appointments-month-cell');
    await user.click(screen.getByRole('button', { name: /Wednesday, October 14/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        view: 'day',
        date: '2026-10-14',
      }),
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInAppointments(<AppointmentsMonth />, URL);
    await waitFor(() =>
      expect(
        within(cellOf(APPOINTMENT_TODAY)).getAllByTestId('appointments-block'),
      ).toHaveLength(2),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
