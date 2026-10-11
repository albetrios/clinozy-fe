import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import { fetchAppointmentRange } from '@/shared/api/app/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TOMORROW,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
} from '@/tests/utils/appointment-doubles.ts';

import {
  type AppointmentsWorld,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  grantAppAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentsDay } from './AppointmentsDay.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

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

/** Tomorrow: Riya (Dr. Nisha, 20 min) and Dev (Dr. Arjun, 20 min), both Scheduled. */
const TOMORROW_URL = `${APPOINTMENTS_PAGE}?view=day&date=${APPOINTMENT_TOMORROW}`;

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

beforeEach(() => {
  viewport.tier = 'desktop';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentsDay (KICKOFF §6.4 Day)', () => {
  it('reads the day for every doctor and heads it with "All doctors", its load and the doctor picker', async () => {
    renderInAppointments(<AppointmentsDay />, TOMORROW_URL);
    const header = await screen.findByTestId('appointments-day-header');
    expect(header).toHaveTextContent('All doctors');
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(2),
    );
    expect(header).toHaveTextContent('2 booked · 0.7 h');
    expect(fetchAppointmentRange).toHaveBeenLastCalledWith({
      from: APPOINTMENT_TOMORROW,
      to: APPOINTMENT_TOMORROW,
      status: 'active',
      doctorId: undefined,
      q: undefined,
      created: undefined,
      branchIds: [],
    });
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

  it('draws the picked doctor’s bookings — still reading every doctor — and counts each one in the picker', async () => {
    const user = userEvent.setup();
    renderInAppointments(
      <AppointmentsDay />,
      `${TOMORROW_URL}&doctor=${DOCTOR_ARJUN.id}`,
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(1),
    );
    expect(screen.getByTestId('appointments-block')).toHaveTextContent('Dev Shah');
    expect(vi.mocked(fetchAppointmentRange).mock.lastCall?.[0].doctorId).toBeUndefined();
    const header = screen.getByTestId('appointments-day-header');
    expect(header).toHaveTextContent('1 booked · 0.3 h');
    await user.click(screen.getByTestId('appointments-day-doctors'));
    const list = await screen.findByRole('listbox');
    expect(
      within(list).getByTestId(`appointments-day-doctors-option-${DOCTOR_NISHA.id}`),
    ).toHaveTextContent('1 booked');
    expect(
      within(list).getByTestId(`appointments-day-doctors-option-${DOCTOR_ARJUN.id}`),
    ).toHaveTextContent('1 booked');
  });

  it('picks one doctor into the URL from the picker, and "Show all" every doctor again', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<AppointmentsDay />, TOMORROW_URL);
    await user.click(await screen.findByTestId('appointments-day-doctors'));
    await user.click(
      await screen.findByTestId(`appointments-day-doctors-option-${DOCTOR_NISHA.id}`),
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ doctor: DOCTOR_NISHA.id }),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(1),
    );
    await user.click(screen.getByTestId('appointments-day-doctors'));
    await user.click(await screen.findByRole('button', { name: 'Show all' }));
    await waitFor(() =>
      expect(router.state.location.search).not.toHaveProperty('doctor'),
    );
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
    expect(notify.info).toHaveBeenCalledWith(
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
    expect(notify.info).toHaveBeenCalledWith('Past dates can’t be booked');
    expect(router.state.location.pathname).toBe(APPOINTMENTS_PAGE);
  });

  it('offers no slot without Create', async () => {
    grantAppAccess('none');
    renderInAppointments(<AppointmentsDay />, TOMORROW_URL);
    const column = await screen.findByTestId('appointments-day-column');
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(2),
    );
    expect(column.querySelector('[data-testid="appointments-day-slots"]')).toBeNull();
  });

  it('swaps the header for the Doctor strip on a phone, its counts ignoring the doctor picked (A-A2)', async () => {
    viewport.tier = 'phone';
    const user = userEvent.setup();
    const { router } = renderInAppointments(<AppointmentsDay />, TOMORROW_URL);
    const strip = await screen.findByRole('radiogroup', { name: 'Doctor' });
    expect(screen.queryByTestId('appointments-day-header')).toBeNull();
    const all = within(strip).getByRole('radio', { name: /All doctors/ });
    await waitFor(() => expect(all).toHaveTextContent('All doctors2'));
    expect(all).toHaveAttribute('aria-checked', 'true');
    const arjun = await within(strip).findByRole('radio', { name: /Arjun R\./ });
    expect(arjun).toHaveTextContent('Arjun R.1');
    await user.click(arjun);
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ doctor: DOCTOR_ARJUN.id }),
    );
    // Picking one doctor keeps every pill's count.
    const after = within(screen.getByRole('radiogroup', { name: 'Doctor' }));
    expect(after.getByRole('radio', { name: /All doctors/ })).toHaveTextContent(
      'All doctors2',
    );
    expect(after.getByRole('radio', { name: /Nisha S\./ })).toHaveTextContent(
      'Nisha S.1',
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(1),
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInAppointments(<AppointmentsDay />, TOMORROW_URL);
    await waitFor(() =>
      expect(screen.getAllByTestId('appointments-block')).toHaveLength(2),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
