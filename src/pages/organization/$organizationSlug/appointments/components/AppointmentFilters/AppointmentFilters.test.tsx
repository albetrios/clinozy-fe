import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import { fetchAppointmentDayCounts } from '@/shared/api/clinic/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import { saveMyPreferences } from '@/shared/api/clinic/preferences-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import {
  APPOINTMENT_NOW,
  dayCount,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import {
  type AppointmentsWorld,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import {
  appliedFilters,
  CLEARED_FILTERS,
  countFilters,
  filtersPatch,
} from './appointment-filters-model.ts';
import { AppointmentFilters } from './AppointmentFilters.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});

beforeEach(() => {
  viewport.tier = 'desktop';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantClinicAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('the Filters model', () => {
  it('reads Active by default and counts the one doctor, a status, the Agenda’s day and Created', () => {
    const values = appliedFilters({
      doctor: DOCTOR_NISHA.id,
      status: 'all',
      date: '2026-10-09',
      created: 'today',
    });
    expect(values).toEqual({
      doctor: DOCTOR_NISHA.id,
      status: 'all',
      date: '2026-10-09',
      created: 'today',
    });
    expect(countFilters(values, 'agenda')).toBe(4);
    // On a calendar the day is the one shown, not a filter.
    expect(countFilters(values, 'week')).toBe(3);
    expect(countFilters(appliedFilters({}), 'agenda')).toBe(0);
  });

  it('leaves the defaults out of the URL — no follow-up key', () => {
    expect(filtersPatch(appliedFilters({}))).toEqual({
      doctor: undefined,
      status: undefined,
      date: undefined,
      created: undefined,
    });
    expect(filtersPatch(CLEARED_FILTERS)).toEqual(filtersPatch(appliedFilters({})));
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

  /** The Filters calendar's day button for a date. */
  const dayOf = (panel: HTMLElement, date: string) => {
    const day = within(panel)
      .getAllByTestId('appointments-filters-day')
      .find((candidate) => candidate.dataset.day === date);
    if (!day) throw new Error(`no ${date}`);
    return day;
  };

  it('shows the calendar, Appointed to, Status and Created — no Follow-up date', async () => {
    const { panel } = await open();
    expect(panel).toHaveAccessibleName('Appointment filters');
    expect(
      within(panel).getByTestId('appointments-filters-calendar'),
    ).toBeInTheDocument();
    for (const name of ['Appointed to', 'Status', 'Created']) {
      expect(within(panel).getByRole('group', { name })).toBeInTheDocument();
    }
    expect(within(panel).queryByRole('group', { name: 'Follow-up date' })).toBeNull();
    expect(
      within(panel).getByTestId('appointments-filters-status-active'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps choices pending until "Apply filter", then writes the URL and counts', async () => {
    const { panel, user, router } = await open();
    await user.click(within(panel).getByTestId('appointments-filters-status-cancelled'));
    expect(router.state.location.search).toEqual({});
    await user.click(within(panel).getByTestId('appointments-filters-apply'));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ status: 'cancelled' }),
    );
    expect(screen.getByTestId('appointments-filters-trigger')).toHaveTextContent(
      /^Filters1/,
    );
  });

  it('appoints the view to one doctor of the team, or every doctor again', async () => {
    const { panel, user, router } = await open(
      `${APPOINTMENTS_PAGE}?doctor=${DOCTOR_NISHA.id}`,
    );
    const doctors = within(panel).getByTestId('appointments-filters-doctors');
    await waitFor(() => expect(doctors).toHaveTextContent('Nisha S.'));
    await user.click(doctors);
    await user.click(
      await screen.findByTestId(`appointments-filters-doctors-option-${DOCTOR_ARJUN.id}`),
    );
    await user.click(within(panel).getByTestId('appointments-filters-apply'));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ doctor: DOCTOR_ARJUN.id }),
    );
  });

  it('dots each day by its bookings from the month’s day counts — every doctor and status, the header’s branches', async () => {
    await saveMyPreferences({ branchFilter: [TEST_BRANCH_ID] });
    world.counts = [
      // Seven live bookings (the cancelled one holds no slot): two dots.
      dayCount('2026-10-09', { scheduled: 4, confirmed: 3, cancelled: 2 }),
      dayCount('2026-10-12', { completed: 1 }),
    ];
    const { panel } = await open(`${APPOINTMENTS_PAGE}?doctor=${DOCTOR_NISHA.id}`);
    await waitFor(() =>
      expect(dayOf(panel, '2026-10-09')).toHaveAccessibleName('2026-10-09 · 7 booked'),
    );
    expect(fetchAppointmentDayCounts).toHaveBeenLastCalledWith({
      from: '2026-10-01',
      to: '2026-10-31',
      branchIds: [TEST_BRANCH_ID],
    });
    const dotsOf = (date: string) =>
      dayOf(panel, date).querySelectorAll('[aria-hidden="true"] > span').length;
    expect(dotsOf('2026-10-09')).toBe(2);
    expect(dotsOf('2026-10-12')).toBe(1);
    expect(dotsOf('2026-10-10')).toBe(0);
    expect(dayOf(panel, '2026-10-10')).toHaveAccessibleName('2026-10-10 · 0 booked');
  });

  it('picks the Agenda’s one day on the calendar; a second press clears it', async () => {
    const { panel, user, router } = await open();
    const ninth = dayOf(panel, '2026-10-09');
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

  it('keeps its own month, apart from the board, and reads that month’s counts', async () => {
    const { panel, user } = await open();
    const calendar = within(panel).getByTestId('appointments-filters-calendar');
    expect(calendar).toHaveTextContent('Oct 2026');
    await user.click(within(panel).getByTestId('appointments-filters-month-next'));
    expect(calendar).toHaveTextContent('Nov 2026');
    await waitFor(() =>
      expect(fetchAppointmentDayCounts).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-11-01', to: '2026-11-30' }),
      ),
    );
  });

  it('"Clear all" and the joined × clear everything at once', async () => {
    const { panel, user, router } = await open(
      `${APPOINTMENTS_PAGE}?status=all&created=today&doctor=${DOCTOR_NISHA.id}`,
    );
    await user.click(within(panel).getByTestId('appointments-filters-clear-all'));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('appointments-filters-clear')).toBeNull();
  });

  it('closes on Esc without applying (D33)', async () => {
    const { panel, user, router } = await open();
    await user.click(within(panel).getByTestId('appointments-filters-status-all'));
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
