import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import {
  fetchAppointmentRange,
  listAppointments,
} from '@/shared/api/app/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type * as AppointmentFormModule from '@/shared/forms/AppointmentForm/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { APPOINTMENT_NOW } from '@/tests/utils/appointment-doubles.ts';

import {
  type AppointmentsWorld,
  RIYA_BOOKING,
  seededAppointmentsWorld,
  STAND_IN_OTHER_ID,
  standInForm,
} from './__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  grantAppAccess,
  renderAppointmentsRoutes,
} from './__tests__/integration/appointments-test-router.tsx';
import { AppointmentsPage } from './AppointmentsPage.tsx';

// A desktop: a phone renders Week as Day.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

// The form is its own suites'; here it stands in as its props and callbacks.
vi.mock('@/shared/forms/AppointmentForm/index.ts', async (importOriginal) => {
  const { AppointmentFormStandIn } =
    await import('./__tests__/integration/appointment-form-stand-in.tsx');
  return {
    ...(await importOriginal<typeof AppointmentFormModule>()),
    AppointmentForm: AppointmentFormStandIn,
  };
});

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } =
    await import('./__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('./__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentsPage', () => {
  it('renders the room: its toolbar, then the Agenda by default (D27)', async () => {
    const { container } = renderAppointmentsRoutes(APPOINTMENTS_PAGE, AppointmentsPage);
    const page = await screen.findByTestId('appointments-page');
    expect(page).toHaveAttribute('data-view', 'agenda');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Appointments');
    expect(screen.getByRole('tabpanel', { name: 'Agenda' })).toContainElement(
      await screen.findByTestId('appointments-table'),
    );
    expect(await screen.findAllByTestId('appointments-table-row')).toHaveLength(5);
    expect(listAppointments).toHaveBeenCalled();
    expect(fetchAppointmentRange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('appointment-form-stand-in')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(['day', 'week', 'month'] as const)(
    'renders the %s calendar in its panel from the URL, reading its range',
    async (view) => {
      renderAppointmentsRoutes(`${APPOINTMENTS_PAGE}?view=${view}`, AppointmentsPage);
      const page = await screen.findByTestId('appointments-page');
      expect(page).toHaveAttribute('data-view', view);
      const calendar = await screen.findByTestId('appointments-calendar');
      expect(calendar).toHaveAttribute('data-view', view);
      expect(screen.getByRole('tabpanel')).toContainElement(calendar);
      expect(screen.queryByTestId('appointments-table')).toBeNull();
      await waitFor(() => expect(fetchAppointmentRange).toHaveBeenCalled());
      expect(listAppointments).not.toHaveBeenCalled();
    },
  );
});

describe('AppointmentsPage — the appointment form over it (L-38)', () => {
  it('opens the booking’s drawer over the Agenda, and a chat’s "Appointment #…" chip that booking', async () => {
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/${RIYA_BOOKING.id}`,
      AppointmentsPage,
    );
    const drawer = await screen.findByTestId('appointment-form-stand-in');
    await waitFor(() =>
      expect(standInForm(within(drawer).getByTestId('form'))).toMatchObject({
        mode: 'edit',
        appointmentId: RIYA_BOOKING.id,
        seq: 2861,
      }),
    );
    expect(screen.getByTestId('appointments-page')).toHaveAttribute(
      'data-view',
      'agenda',
    );
    fireEvent.click(within(drawer).getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${APPOINTMENTS_PAGE}/${STAND_IN_OTHER_ID}`,
      ),
    );
  });

  it('opens New appointment from the toolbar over the page', async () => {
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}?view=week`,
      AppointmentsPage,
    );
    fireEvent.click(await screen.findByTestId('appointments-new-appointment'));
    const drawer = await screen.findByTestId('appointment-form-stand-in');
    expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`);
    expect(standInForm(within(drawer).getByTestId('form')).mode).toBe('create');
    expect(screen.getByTestId('appointments-page')).toHaveAttribute('data-view', 'week');
  });
});
