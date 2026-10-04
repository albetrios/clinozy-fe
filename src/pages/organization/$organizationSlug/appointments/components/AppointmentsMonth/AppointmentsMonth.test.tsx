import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchAppointmentRange } from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { doubleBooked } from '../../appointments.calendar.ts';
import { AppointmentsMonth } from './AppointmentsMonth.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const TODAY = '2026-10-03';
const URL = `${APPOINTMENTS_PAGE}?view=month`;
let october: AppointmentRow[];
const onDay = (date: string) => october.filter((row) => row.date === date);

/** The Month cell of a date. */
const cellOf = (date: string) =>
  screen
    .getAllByTestId('appointments-month-cell')
    .find((cell) => cell.dataset.date === date) as HTMLElement;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
  resetClinicFixtures();
  grantClinicAccess('owner');
  october = await fetchAppointmentRange({ from: '2026-10-01', to: '2026-10-31' });
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('AppointmentsMonth (KICKOFF §6.4 Month)', () => {
  it('lays October under Sun–Sat: four blanks, then every day', async () => {
    renderInAppointments(<AppointmentsMonth />, URL);
    const cells = await screen.findAllByTestId('appointments-month-cell');
    expect(cells).toHaveLength(31);
    expect(cells[0]).toHaveAttribute('data-date', '2026-10-01');
    expect(screen.getByTestId('appointments-calendar')).toHaveTextContent(
      /^SunMonTueWedThuFriSat/,
    );
    const today = cellOf(TODAY);
    expect(today.className).toContain('border-primary');
    expect(within(today).getByText('3')).toHaveClass('text-destructive', 'font-bold');
    expect(cellOf('2026-10-02').className).toContain('opacity-62');
  });

  it('fits the chips the cell holds — two before it is measured — then "+<n> more"', async () => {
    renderInAppointments(<AppointmentsMonth />, URL);
    const busy = onDay(TODAY);
    expect(busy.length).toBeGreaterThan(2);
    await waitFor(() =>
      expect(within(cellOf(TODAY)).getAllByTestId('appointments-block')).toHaveLength(2),
    );
    expect(
      within(cellOf(TODAY)).getByTestId('appointments-month-more'),
    ).toHaveTextContent(`+${busy.length - 2} more`);
    expect(
      within(cellOf(TODAY)).queryByRole('img', { name: 'Overlapping booking' }) !== null,
    ).toBe(doubleBooked(busy));
  });

  it('lists the whole day in its popover, which opens the day', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<AppointmentsMonth />, URL);
    await waitFor(() =>
      expect(within(cellOf(TODAY)).getAllByTestId('appointments-block')).toHaveLength(2),
    );
    await user.click(within(cellOf(TODAY)).getByTestId('appointments-month-more'));
    const popover = await screen.findByTestId('appointments-month-popover');
    expect(popover).toHaveAccessibleName(`Today · ${onDay(TODAY).length} appointments`);
    expect(within(popover).getAllByTestId('appointments-block')).toHaveLength(
      onDay(TODAY).length,
    );
    await axeForDialog(popover);
    await user.click(within(popover).getByTestId('appointments-month-open-day'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'day', date: TODAY }),
    );
  });

  it('closes the popover on ×', async () => {
    const user = userEvent.setup();
    renderInAppointments(<AppointmentsMonth />, URL);
    await waitFor(() =>
      expect(within(cellOf(TODAY)).getAllByTestId('appointments-block')).toHaveLength(2),
    );
    await user.click(within(cellOf(TODAY)).getByTestId('appointments-month-more'));
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
      expect(within(cellOf(TODAY)).getAllByTestId('appointments-block')).toHaveLength(2),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
