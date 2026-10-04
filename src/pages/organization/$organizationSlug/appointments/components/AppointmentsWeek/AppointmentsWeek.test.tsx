import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchAppointmentRange } from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { weekLoad } from '../../appointments.calendar.ts';
import { AppointmentsWeek } from './AppointmentsWeek.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

/** Sat 3 Oct 2026: its week runs Sun 27 Sep to Sat 3 Oct. */
const TODAY = '2026-10-03';
const URL = `${APPOINTMENTS_PAGE}?view=week`;
let week: AppointmentRow[];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
  resetClinicFixtures();
  grantClinicAccess('owner');
  week = await fetchAppointmentRange({ from: '2026-09-27', to: TODAY });
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

const headers = () => screen.getAllByTestId('appointments-week-day');

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

  it('draws each day’s bookings in its own column, none bookable', async () => {
    renderInAppointments(<AppointmentsWeek />, URL);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(week.length),
    );
    const todayColumn = screen
      .getAllByTestId('appointments-day-column')
      .find((column) => column.dataset.date === TODAY) as HTMLElement;
    expect(within(todayColumn).getAllByTestId('appointments-block')).toHaveLength(
      week.filter((row) => row.date === TODAY).length,
    );
    expect(
      todayColumn.querySelector('[data-testid="appointments-day-slots"]'),
    ).toBeNull();
    expect(within(todayColumn).getByTestId('appointments-now-line')).toBeInTheDocument();
  });

  it('shows each day’s chair-time load and a double-booked doctor', async () => {
    renderInAppointments(<AppointmentsWeek />, URL);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(week.length),
    );
    for (const header of headers()) {
      const load = weekLoad(week.filter((row) => row.date === header.dataset.date));
      const bar = header.querySelector('[title]') as HTMLElement;
      expect(bar.getAttribute('title')).toBe(
        `${load.booked} booked · ${load.percent}% of chair time${load.overlap ? ' · overlapping booking' : ''}`,
      );
      expect(
        within(header).queryByRole('img', { name: 'Overlapping booking' }) !== null,
      ).toBe(load.overlap);
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

  it('has no accessibility violations', async () => {
    const { container } = renderInAppointments(<AppointmentsWeek />, URL);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(week.length),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
