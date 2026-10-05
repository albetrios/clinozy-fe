import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { CROSS_ROOM_PARAM } from '@/shared/clinic/clinic-referrer.ts';
import { CrossRoomDialogContext } from '@/shared/hooks/useCrossRoomDialog/index.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentDialog } from './AppointmentDialog.tsx';

const { COPY, OTHER } = vi.hoisted(() => ({
  COPY: '5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f',
  OTHER: '6e7f8091-ab2c-4d3e-9f4a-5b6c7d8e9fa0',
}));

// The shared form stands in as its props and its callbacks: this unit is the wiring.
vi.mock('@/shared/forms/AppointmentForm/index.ts', () => ({
  AppointmentForm: (props: {
    mode: string;
    prefill?: unknown;
    appointmentId?: string;
    readOnly?: boolean;
    onClose: () => void;
    onSaved: (outcome: { appointment: { date: string } }) => void;
    onCopy?: (appointment: { id: string }) => void;
    onOpenAppointment?: (id: string) => void;
  }) => (
    <section aria-label="Appointment form">
      <output data-testid="form">
        {JSON.stringify({
          mode: props.mode,
          prefill: props.prefill,
          appointmentId: props.appointmentId,
        })}
      </output>
      <button type="button" onClick={props.onClose}>
        Close
      </button>
      <button
        type="button"
        onClick={() => props.onSaved({ appointment: { date: '2026-10-07' } })}
      >
        Save
      </button>
      <button type="button" onClick={() => props.onCopy?.({ id: COPY })}>
        Copy
      </button>
      <button type="button" onClick={() => props.onOpenAppointment?.(OTHER)}>
        Open
      </button>
    </section>
  ),
}));

const form = () => JSON.parse(screen.getByTestId('form').textContent ?? '{}') as unknown;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  grantClinicAccess('owner');
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('AppointmentDialog', () => {
  it('opens nothing on the page itself, and New appointment on `create/` with its prefill', async () => {
    const empty = renderAppointmentsRoutes(APPOINTMENTS_PAGE, AppointmentDialog);
    await waitFor(() => expect(empty.router.state.status).toBe('idle'));
    expect(screen.queryByTestId('form')).toBeNull();
    empty.unmount();

    const who = ref.appointment(5);
    const { container, router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/create?view=day&date=2026-10-05&time=10:15&who=${who}&source=task`,
      AppointmentDialog,
    );
    await waitFor(() =>
      expect(form()).toEqual({
        mode: 'create',
        prefill: { whoId: who, date: '2026-10-05', time: '10:15', collapsed: true },
      }),
    );
    expect(await axe(container)).toHaveNoViolations();
    // A new booking closes onto its day (H:6051).
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(APPOINTMENTS_PAGE));
    expect(router.state.location.search).toEqual({ view: 'day', date: '2026-10-07' });
  });

  it('opens a booking in its mode; Copy and a chat’s booking chip stay on the page', async () => {
    const id = ref.appointment(2861);
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/${id}?mode=reschedule&view=week`,
      AppointmentDialog,
    );
    await waitFor(() =>
      expect(form()).toEqual({ mode: 'reschedule', appointmentId: id }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({ view: 'week', copyOf: COPY });
  });

  it('over another room (A-P1), Copy and the chip keep that room behind them', async () => {
    const id = ref.appointment(2861);
    const close = vi.fn();
    const dialog = {
      pathname: `${APPOINTMENTS_PAGE}/${id}`,
      search: { from: 'today' },
      params: { organizationSlug: 'acme', appointmentId: id },
      close,
    };
    const { router } = renderAppointmentsRoutes(
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
    await waitFor(() => expect(form()).toEqual({ mode: 'edit', appointmentId: id }));

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        lane: 'waiting',
        [CROSS_ROOM_PARAM]: `appointments/create?copyOf=${COPY}&from=today`,
      }),
    );
    expect(router.state.location.pathname).toBe('/organization/acme/today');
    expect(router.history.location.href).toBe(
      `${APPOINTMENTS_PAGE}/create?copyOf=${COPY}&from=today`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        [CROSS_ROOM_PARAM]: `appointments/${OTHER}?from=today`,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
  });
});
