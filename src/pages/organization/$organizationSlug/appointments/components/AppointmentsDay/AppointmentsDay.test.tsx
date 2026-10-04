import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchAppointmentRange } from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentsDay } from './AppointmentsDay.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const TODAY = '2026-10-03';
let today: AppointmentRow[];

/** Press the Day's empty column at `clientY`, the column's top at 100px — once access allows it. */
async function pressSlot(clientY: number) {
  const column = await screen.findByTestId('appointments-day-column');
  const slot = await waitFor(() => {
    const surface = column.querySelector<HTMLButtonElement>(
      '[data-testid="appointments-day-slots"]',
    );
    if (!surface) throw new Error('no slot surface yet');
    return surface;
  });
  vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
  fireEvent.click(slot, { clientY });
}

beforeEach(async () => {
  viewport.tier = 'desktop';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
  for (const spy of Object.values(notifyMock)) spy.mockReset();
  resetClinicFixtures();
  grantClinicAccess('owner');
  today = await fetchAppointmentRange({ from: TODAY, to: TODAY });
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('AppointmentsDay (KICKOFF §6.4 Day)', () => {
  it('heads the day with "All doctors", its load and the doctor picker, and draws every booking', async () => {
    renderInAppointments(<AppointmentsDay />, `${APPOINTMENTS_PAGE}?view=day`);
    const header = await screen.findByTestId('appointments-day-header');
    expect(header).toHaveTextContent('All doctors');
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(today.length),
    );
    const minutes = today.reduce((sum, row) => sum + row.durationMin, 0);
    const hours = Math.round((minutes / 60) * 10) / 10;
    expect(header).toHaveTextContent(`${today.length} booked · ${hours} h`);
    expect(within(header).getByTestId('appointments-day-doctors')).toHaveAccessibleName(
      /Appointed to.*All doctors/,
    );
    expect(screen.getByTestId('appointments-calendar')).toHaveAttribute(
      'data-view',
      'day',
    );
  });

  it('says "Free all day" for a day with nothing booked', async () => {
    renderInAppointments(
      <AppointmentsDay />,
      `${APPOINTMENTS_PAGE}?view=day&date=2026-12-25`,
    );
    const header = await screen.findByTestId('appointments-day-header');
    await waitFor(() => expect(header).toHaveTextContent('Free all day'));
    expect(screen.queryByTestId('appointments-block')).toBeNull();
  });

  it('counts each doctor’s bookings in the picker, whatever doctor is picked', async () => {
    const user = userEvent.setup();
    const [first] = today;
    if (!first) throw new Error('no booking today');
    renderInAppointments(
      <AppointmentsDay />,
      `${APPOINTMENTS_PAGE}?view=day&doctor=${first.doctorId}`,
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block').length).toBeGreaterThan(0),
    );
    // Only the picked doctor's bookings are drawn.
    const theirs = today.filter((row) => row.doctorId === first.doctorId);
    expect(screen.getAllByTestId('appointments-block')).toHaveLength(theirs.length);
    await user.click(screen.getByTestId('appointments-day-doctors'));
    const list = await screen.findByRole('listbox');
    expect(within(list).getAllByText(/^\d+ booked$|^free$/).length).toBeGreaterThan(1);
  });

  it('books an empty slot to the nearest 15 minutes, and toasts it', async () => {
    const { router } = renderInAppointments(
      <AppointmentsDay />,
      `${APPOINTMENTS_PAGE}?view=day&date=2026-10-05`,
    );
    await screen.findByTestId('appointments-day-column');
    await pressSlot(100 + 88 * 5 + 20); // 14:13 → 14:15
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toMatchObject({
      view: 'day',
      date: '2026-10-05',
      time: '14:15',
    });
    expect(notifyMock.info).toHaveBeenCalledWith(
      expect.stringMatching(/^New appointment · .+ · 2:15\sPM$/),
    );
  });

  it('never books a past day', async () => {
    const { router } = renderInAppointments(
      <AppointmentsDay />,
      `${APPOINTMENTS_PAGE}?view=day&date=2026-10-01`,
    );
    await screen.findByTestId('appointments-day-column');
    await pressSlot(200);
    expect(notifyMock.info).toHaveBeenCalledWith('Past dates can’t be booked');
    expect(router.state.location.pathname).toBe(APPOINTMENTS_PAGE);
  });

  it('offers no slot without Create', async () => {
    grantClinicAccess('none');
    renderInAppointments(<AppointmentsDay />, `${APPOINTMENTS_PAGE}?view=day`);
    const column = await screen.findByTestId('appointments-day-column');
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block').length).toBeGreaterThan(0),
    );
    expect(column.querySelector('[data-testid="appointments-day-slots"]')).toBeNull();
  });

  it('swaps the header for the Doctor strip on a phone, its counts ignoring the doctor picked (A-A2)', async () => {
    viewport.tier = 'phone';
    const user = userEvent.setup();
    const { router } = renderInAppointments(
      <AppointmentsDay />,
      `${APPOINTMENTS_PAGE}?view=day`,
    );
    const strip = await screen.findByRole('radiogroup', { name: 'Doctor' });
    expect(screen.queryByTestId('appointments-day-header')).toBeNull();
    const live = today.filter((row) => row.status !== 'cancelled');
    const all = within(strip).getByRole('radio', { name: /All doctors/ });
    await waitFor(() => expect(all).toHaveTextContent(`All doctors${live.length}`));
    expect(all).toHaveAttribute('aria-checked', 'true');

    const [first] = live;
    if (!first) throw new Error('no live booking today');
    const pills = within(strip).getAllByRole('radio');
    const counted = pills.filter((pill) => /\d$/.test(pill.textContent ?? ''));
    await user.click(counted[1] ?? counted[0] ?? all);
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        doctor: [expect.any(String)],
      }),
    );
    // Picking one doctor keeps every other pill's count.
    const after = within(screen.getByRole('radiogroup', { name: 'Doctor' }));
    expect(after.getByRole('radio', { name: /All doctors/ })).toHaveTextContent(
      `All doctors${live.length}`,
    );
    expect(
      after.getAllByRole('radio').filter((pill) => /\d$/.test(pill.textContent ?? '')),
    ).toHaveLength(counted.length);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInAppointments(
      <AppointmentsDay />,
      `${APPOINTMENTS_PAGE}?view=day`,
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block').length).toBeGreaterThan(0),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
