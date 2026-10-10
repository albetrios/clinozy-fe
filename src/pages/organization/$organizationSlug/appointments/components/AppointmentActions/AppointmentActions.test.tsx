import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppointmentMove } from '@/shared/api/clinic/appointment-status.ts';
import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import {
  cancelAppointment,
  moveAppointment,
} from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { APPOINTMENT_NOW } from '@/tests/utils/appointment-doubles.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import {
  type AppointmentsWorld,
  KABIR_BOOKING,
  MEERA_BOOKING,
  OMAR_BOOKING,
  RIYA_BOOKING,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { useAppointmentActions } from './appointment-actions-context.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
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

/** Buttons that run each action on one booking. */
function Probe({ appointment }: { appointment: AppointmentRow }) {
  const actions = useAppointmentActions();
  return (
    <>
      <span data-testid="access">{`${actions.canEdit}·${actions.canCreate}`}</span>
      <button type="button" onClick={() => actions.runNext(appointment)}>
        next
      </button>
      {(['confirmed', 'checked_in', 'completed', 'no_show', 'reschedule'] as const).map(
        (move: Exclude<AppointmentMove, 'cancelled'>) => (
          <button
            key={move}
            type="button"
            onClick={() => actions.move(appointment, move)}
          >
            {move}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => actions.cancel(appointment, 'other', ' Clinic closed early ')}
      >
        other
      </button>
      <button type="button" onClick={() => actions.cancel(appointment, 'other', '   ')}>
        blank
      </button>
      <button
        type="button"
        onClick={() => actions.cancel(appointment, 'doctor_unavailable')}
      >
        doctor
      </button>
      <button type="button" onClick={() => actions.open(appointment)}>
        open
      </button>
    </>
  );
}

/** The `onUndo` the last Undo toast offered. */
function lastUndo(): () => void {
  const options = vi.mocked(notify.undo).mock.lastCall?.[1];
  if (!options?.onUndo) throw new Error('no Undo toast');
  return options.onUndo;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantClinicAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentActionsProvider', () => {
  it('needs its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe appointment={RIYA_BOOKING} />)).toThrow(
      /AppointmentActionsProvider/,
    );
  });

  it('opens the drawer, in Reschedule for "Move to another time"', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${APPOINTMENTS_PAGE}/${RIYA_BOOKING.id}`,
      ),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
    expect(moveAppointment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it.each([
    ['confirmed', 'confirm'],
    ['checked_in', 'check-in'],
    ['completed', 'complete'],
    ['no_show', 'no-show'],
  ] as const)('moves to %s through its own route, `%s`', async (move, route) => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: move }));
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: RIYA_BOOKING.id,
        route,
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('confirms a Scheduled booking as its next step, "<name> → Confirmed" with no Undo', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'next' }));
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Riya Mehta → Confirmed'),
    );
    expect(moveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: RIYA_BOOKING.id, route: 'confirm' }),
    );
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('checks in on the visit day, its toast’s Undo running `undo-check-in`', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={KABIR_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'next' }));
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Kabir Rao → Checked in',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    lastUndo()();
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenLastCalledWith({
        appointmentId: KABIR_BOOKING.id,
        route: 'undo-check-in',
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('completes a checked-in visit as its next step', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={MEERA_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'next' }));
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: MEERA_BOOKING.id, route: 'complete' }),
      ),
    );
  });

  it('rebooks a No-show as a new booking from it (Q-A6) — no move', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<Probe appointment={OMAR_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'next' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({ copyOf: OMAR_BOOKING.id });
    expect(moveAppointment).not.toHaveBeenCalled();
  });

  it('cancels with a reason at once, the status toast’s Undo reinstating it', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'doctor' }));
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Riya Mehta → Cancelled · Doctor unavailable · slot freed, reminders stopped',
        expect.anything(),
      ),
    );
    expect(cancelAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: RIYA_BOOKING.id,
      cancel: { reason: 'doctor_unavailable', note: null },
      idempotencyKey: expect.any(String),
    });
    lastUndo()();
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: RIYA_BOOKING.id, route: 'reinstate' }),
      ),
    );
  });

  it('sends "Other" with the note the cancel view took, trimmed — no second confirm (L-64)', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'other' }));
    await waitFor(() =>
      expect(cancelAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          cancel: { reason: 'other', note: 'Clinic closed early' },
        }),
      ),
    );
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Riya Mehta → Cancelled · Other · slot freed, reminders stopped',
        expect.anything(),
      ),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sends a blank note as none', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await user.click(await screen.findByRole('button', { name: 'blank' }));
    await waitFor(() =>
      expect(cancelAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ cancel: { reason: 'other', note: null } }),
      ),
    );
  });

  it('reads the member’s Edit and Create', async () => {
    renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await waitFor(() =>
      expect(screen.getByTestId('access')).toHaveTextContent('true·true'),
    );
  });

  it('reads no Edit and no Create for a member who only reads', async () => {
    grantClinicAccess('none');
    renderInAppointments(<Probe appointment={RIYA_BOOKING} />);
    await waitFor(() =>
      expect(screen.getByTestId('access')).toHaveTextContent('false·false'),
    );
  });
});
