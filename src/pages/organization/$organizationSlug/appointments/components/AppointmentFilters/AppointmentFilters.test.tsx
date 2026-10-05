import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import {
  appliedFilters,
  countFilters,
  filtersPatch,
} from './appointment-filters-model.ts';
import { AppointmentFilters } from './AppointmentFilters.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

beforeEach(() => {
  viewport.tier = 'desktop';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  grantClinicAccess('owner');
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the Filters model', () => {
  it('reads Active by default and counts doctors, a status, the Agenda’s day and the dates', () => {
    const values = appliedFilters({
      doctor: [ref.user(9), ref.user(2)],
      status: 'all',
      date: '2026-10-09',
      created: 'today',
    });
    expect(values.status).toBe('all');
    expect(countFilters(values, 'agenda')).toBe(5);
    // On a calendar the day is the one shown, not a filter.
    expect(countFilters(values, 'week')).toBe(4);
    expect(countFilters(appliedFilters({}), 'agenda')).toBe(0);
  });

  it('leaves the defaults out of the URL', () => {
    expect(filtersPatch(appliedFilters({}))).toEqual({
      doctor: undefined,
      status: undefined,
      date: undefined,
      created: undefined,
      followUp: undefined,
    });
  });
});

describe('AppointmentFilters (appointments.md:103–117, 135–147)', () => {
  async function open(url = APPOINTMENTS_PAGE, view: 'agenda' | 'day' = 'agenda') {
    const user = userEvent.setup();
    const rendered = renderInAppointments(<AppointmentFilters view={view} />, url);
    await user.click(await screen.findByTestId('appointments-filters-trigger'));
    const panel = await screen.findByTestId('appointments-filters');
    return { ...rendered, user, panel };
  }

  it('shows the calendar, Appointed to, Status, Created and Follow-up date', async () => {
    const { panel } = await open();
    expect(panel).toHaveAccessibleName('Appointment filters');
    expect(
      within(panel).getByTestId('appointments-filters-calendar'),
    ).toBeInTheDocument();
    for (const name of ['Appointed to', 'Status', 'Created', 'Follow-up date']) {
      expect(within(panel).getByRole('group', { name })).toBeInTheDocument();
    }
    expect(
      within(panel).getByTestId('appointments-filters-status-active').firstElementChild,
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps choices pending until "Apply filter", then writes the URL and counts', async () => {
    const { panel, user, router } = await open();
    await user.click(
      within(panel).getByTestId('appointments-filters-status-cancelled')
        .firstElementChild as HTMLElement,
    );
    expect(router.state.location.search).toEqual({});
    await user.click(within(panel).getByTestId('appointments-filters-apply'));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ status: 'cancelled' }),
    );
    expect(screen.getByTestId('appointments-filters-trigger')).toHaveTextContent(
      /^Filters1/,
    );
  });

  it('picks the Agenda’s one day on the calendar; a second press clears it', async () => {
    const { panel, user, router } = await open();
    const days = within(panel).getAllByTestId('appointments-filters-day');
    const ninth = days.find((day) => day.dataset.day === '2026-10-09');
    if (!ninth) throw new Error('no 9 Oct');
    expect(ninth).toHaveAccessibleName(/^2026-10-09 · \d+ booked$/);
    // The month grid marks the pick on the day's gridcell (one tab stop, arrows move).
    const cell = () => ninth.closest('[role="gridcell"]');
    await user.click(ninth);
    expect(cell()).toHaveAttribute('aria-selected', 'true');
    await user.click(ninth);
    expect(cell()).not.toHaveAttribute('aria-selected');
    await user.click(ninth);
    await user.click(within(panel).getByTestId('appointments-filters-apply'));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ date: '2026-10-09' }),
    );
  });

  it('keeps its own month, apart from the board', async () => {
    const { panel, user } = await open();
    const calendar = within(panel).getByTestId('appointments-filters-calendar');
    expect(calendar).toHaveTextContent('Oct 2026');
    await user.click(within(panel).getByTestId('appointments-filters-month-next'));
    expect(calendar).toHaveTextContent('Nov 2026');
  });

  it('"Clear all" and the joined × clear everything at once', async () => {
    const { panel, user, router } = await open(
      `${APPOINTMENTS_PAGE}?status=all&created=today`,
    );
    await user.click(within(panel).getByTestId('appointments-filters-clear-all'));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('appointments-filters-clear')).toBeNull();
  });

  it('closes on Esc without applying (D33)', async () => {
    const { panel, user, router } = await open();
    await user.click(
      within(panel).getByTestId('appointments-filters-status-all')
        .firstElementChild as HTMLElement,
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('appointments-filters')).toBeNull());
    expect(router.state.location.search).toEqual({});
  });

  it('opens as the bottom sheet on a phone', async () => {
    viewport.tier = 'phone';
    const { panel } = await open();
    expect(panel).toHaveAttribute('data-picker-surface', 'sheet');
  });

  it('has no axe violations', async () => {
    const { panel } = await open();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });
});
