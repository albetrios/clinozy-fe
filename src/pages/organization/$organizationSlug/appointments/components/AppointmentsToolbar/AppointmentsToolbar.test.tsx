import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { AppointmentView } from '@/shared/api/app/appointments-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { APPOINTMENT_NOW } from '@/tests/utils/appointment-doubles.ts';

import {
  APPOINTMENTS_PAGE,
  grantAppAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentsToolbar } from './AppointmentsToolbar.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

function renderToolbar(view: AppointmentView, url = APPOINTMENTS_PAGE) {
  return renderInAppointments(
    <>
      <AppointmentsToolbar view={view} panelId="panel" />
      <div id="panel" />
    </>,
    url,
  );
}

beforeEach(() => {
  viewport.tier = 'desktop';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentsToolbar (KICKOFF §6.4 Toolbar)', () => {
  it('heads the room with the view tabs, the search, Filters and New appointment', async () => {
    renderToolbar('agenda');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Appointments',
    );
    const tabs = screen.getByRole('tablist', { name: 'View' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Agenda', 'Day', 'Week', 'Month']);
    expect(
      screen.getByRole('searchbox', { name: 'Search appointments' }),
    ).toHaveAttribute('placeholder', 'Patient, phone or #ID');
    expect(await screen.findByTestId('appointments-new-appointment')).toHaveTextContent(
      'New appointment',
    );
    // The Agenda has no period control (A-A1).
    expect(screen.queryByTestId('appointments-today')).toBeNull();
  });

  it('offers no Week on a phone (H:5941)', async () => {
    viewport.tier = 'phone';
    renderToolbar('agenda');
    const tabs = await screen.findByRole('tablist', { name: 'View' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Agenda', 'Day', 'Month']);
  });

  it('switches views through the URL; the Agenda drops the calendars’ day', async () => {
    const user = userEvent.setup();
    const { router } = renderToolbar(
      'day',
      `${APPOINTMENTS_PAGE}?view=day&date=2026-10-09`,
    );
    await user.click(await screen.findByRole('tab', { name: 'Month' }));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'month', date: '2026-10-09' }),
    );
    await user.click(screen.getByRole('tab', { name: 'Agenda' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('labels and moves the Day period; "Today" is pressed on today', async () => {
    const user = userEvent.setup();
    const { router } = renderToolbar('day', `${APPOINTMENTS_PAGE}?view=day`);
    expect(await screen.findByTestId('appointments-period-label')).toHaveTextContent(
      'Sat, Oct 3, 2026',
    );
    expect(screen.getByTestId('appointments-today')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'day', date: '2026-10-04' }),
    );
  });

  it('labels the Week Sunday to Saturday and moves it by seven days', async () => {
    const user = userEvent.setup();
    const { router } = renderToolbar(
      'week',
      `${APPOINTMENTS_PAGE}?view=week&date=2026-10-14`,
    );
    expect(await screen.findByTestId('appointments-period-label')).toHaveTextContent(
      'Oct 11 – Oct 17',
    );
    expect(screen.getByTestId('appointments-today')).toHaveTextContent('This week');
    expect(screen.getByTestId('appointments-today')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'week', date: '2026-10-07' }),
    );
    await user.click(screen.getByTestId('appointments-today'));
    await waitFor(() => expect(router.state.location.search).toEqual({ view: 'week' }));
  });

  it('labels the Month and keeps a month-end inside the next month', async () => {
    const user = userEvent.setup();
    const { router } = renderToolbar(
      'month',
      `${APPOINTMENTS_PAGE}?view=month&date=2026-10-31`,
    );
    expect(await screen.findByTestId('appointments-period-label')).toHaveTextContent(
      'October 2026',
    );
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'month', date: '2026-11-30' }),
    );
  });

  it('opens New appointment over the page, and hides it without Create', async () => {
    const user = userEvent.setup();
    const { router, unmount } = renderToolbar(
      'agenda',
      `${APPOINTMENTS_PAGE}?status=all`,
    );
    await user.click(await screen.findByTestId('appointments-new-appointment'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({ status: 'all' });
    unmount();

    grantAppAccess('none');
    renderToolbar('agenda');
    await screen.findByRole('tablist', { name: 'View' });
    expect(screen.queryByTestId('appointments-new-appointment')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = renderToolbar('day', `${APPOINTMENTS_PAGE}?view=day`);
    await screen.findByTestId('appointments-period-label');
    expect(await axe(container)).toHaveNoViolations();
  });
});
