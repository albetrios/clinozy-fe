import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import { CROSS_ROOM_PARAM } from '@/shared/app/app-referrer.ts';
import type * as AppointmentFormModule from '@/shared/forms/AppointmentForm/index.ts';
import { CrossRoomDialogContext } from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  contactHit,
  DOCTOR_NISHA,
} from '@/tests/utils/appointment-doubles.ts';

import {
  type AppointmentsWorld,
  KABIR_BOOKING,
  RIYA_BOOKING,
  seededAppointmentsWorld,
  STAND_IN_BOOKED_DATE,
  STAND_IN_OTHER_ID,
  standInForm,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  grantAppAccess,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentDialog } from './AppointmentDialog.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { info: vi.fn(), success: vi.fn(), error: vi.fn(), undo: vi.fn() },
}));

// The shared form stands in as its props and its callbacks: this unit is the wiring.
vi.mock('@/shared/forms/AppointmentForm/index.ts', async (importOriginal) => {
  const { AppointmentFormStandIn } =
    await import('../../__tests__/integration/appointment-form-stand-in.tsx');
  return {
    ...(await importOriginal<typeof AppointmentFormModule>()),
    AppointmentForm: AppointmentFormStandIn,
  };
});

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});

const form = () => standInForm(screen.getByTestId('form'));
const WHO = contactHit().id;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentDialog', () => {
  it('opens nothing on the page itself, and New appointment on `create/` with its prefill', async () => {
    const empty = renderAppointmentsRoutes(APPOINTMENTS_PAGE, AppointmentDialog);
    await waitFor(() => expect(empty.router.state.status).toBe('idle'));
    expect(screen.queryByTestId('form')).toBeNull();
    empty.unmount();

    const { container, router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/create?view=day&date=2026-10-05&doctor=${DOCTOR_NISHA.id}&time=10:15&who=${WHO}&source=task`,
      AppointmentDialog,
    );
    await waitFor(() =>
      expect(form()).toEqual({
        mode: 'create',
        prefill: {
          whoId: WHO,
          date: '2026-10-05',
          time: '10:15',
          doctorId: DOCTOR_NISHA.id,
          collapsed: true,
        },
        seq: null,
        readOnly: false,
      }),
    );
    expect(await axe(container)).toHaveNoViolations();
    // A new booking closes onto its day (H:6051).
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(APPOINTMENTS_PAGE));
    expect(router.state.location.search).toEqual({
      view: 'day',
      date: STAND_IN_BOOKED_DATE,
      doctor: DOCTOR_NISHA.id,
    });
  });

  it('starts a Copy from `copyOf`', async () => {
    renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/create?copyOf=${KABIR_BOOKING.id}`,
      AppointmentDialog,
    );
    await waitFor(() =>
      expect(form().prefill).toEqual({ copyOf: KABIR_BOOKING.id, collapsed: false }),
    );
  });

  it('opens a booking in its mode, its id before the booking; Copy and a chat’s booking chip stay on the page', async () => {
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/${RIYA_BOOKING.id}?mode=reschedule&view=week`,
      AppointmentDialog,
    );
    await waitFor(() =>
      expect(form()).toMatchObject({
        mode: 'reschedule',
        appointmentId: RIYA_BOOKING.id,
      }),
    );
    await waitFor(() => expect(form().seq).toBe(2861));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({
      view: 'week',
      copyOf: RIYA_BOOKING.id,
    });
  });

  it('opens a chat’s booking chip over the page, and closes an edit onto the page', async () => {
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/${RIYA_BOOKING.id}?view=month`,
      AppointmentDialog,
    );
    await waitFor(() => expect(form().seq).toBe(2861));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${APPOINTMENTS_PAGE}/${STAND_IN_OTHER_ID}`,
      ),
    );
    expect(router.state.location.search).toEqual({ view: 'month' });
    await waitFor(() => expect(form().seq).toBe(KABIR_BOOKING.seq));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(APPOINTMENTS_PAGE));
    expect(router.state.location.search).toEqual({ view: 'month' });
  });

  it('opens the drawer read-only for a member without Edit', async () => {
    grantAppAccess('none');
    renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/${RIYA_BOOKING.id}`,
      AppointmentDialog,
    );
    await waitFor(() => expect(form()).toMatchObject({ seq: 2861, readOnly: true }));
  });

  /** The dialog over Today, as the app's cross-room host renders it (A-P1). */
  function renderOverToday() {
    const close = vi.fn();
    const id = RIYA_BOOKING.id;
    const dialog = {
      pathname: `${APPOINTMENTS_PAGE}/${id}`,
      search: { from: 'today' },
      params: { organizationSlug: 'acme', appointmentId: id },
      close,
    };
    const rendered = renderAppointmentsRoutes(
      '/organization/acme/today?lane=waiting',
      AppointmentDialog,
      {
        Today: () => (
          <CrossRoomDialogContext.Provider value={dialog}>
            <AppointmentDialog />
          </CrossRoomDialogContext.Provider>
        ),
      },
    );
    return { ...rendered, close, id };
  }

  it('over another room (A-P1), Copy keeps that room behind it, and × closes back to it', async () => {
    const { router, close, id } = renderOverToday();
    await waitFor(() => expect(form()).toMatchObject({ mode: 'edit', seq: 2861 }));

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        lane: 'waiting',
        [CROSS_ROOM_PARAM]: `appointments/create?copyOf=${id}&from=today`,
      }),
    );
    expect(router.state.location.pathname).toBe('/organization/acme/today');
    expect(router.history.location.href).toBe(
      `${APPOINTMENTS_PAGE}/create?copyOf=${id}&from=today`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('over another room (A-P1), a chat’s booking chip keeps that room behind it', async () => {
    const { router } = renderOverToday();
    await waitFor(() => expect(form()).toMatchObject({ mode: 'edit', seq: 2861 }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(
      () =>
        expect(router.state.location.search).toEqual({
          lane: 'waiting',
          [CROSS_ROOM_PARAM]: `appointments/${STAND_IN_OTHER_ID}?from=today`,
        }),
      { timeout: 1_000 },
    );
    expect(router.state.location.pathname).toBe('/organization/acme/today');
  });
});
