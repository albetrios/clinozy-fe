import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchAppointment,
  fetchAppointmentPage,
} from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { useAppointmentActions } from './appointment-actions-context.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

/** Buttons that run each action on one booking. */
function Probe({ appointment }: { appointment: AppointmentRow }) {
  const actions = useAppointmentActions();
  return (
    <>
      <span data-testid="access">{`${actions.canEdit}·${actions.canCreate}`}</span>
      <button type="button" onClick={() => actions.runNext(appointment)}>
        next
      </button>
      <button type="button" onClick={() => actions.move(appointment, 'reschedule')}>
        reschedule
      </button>
      <button
        type="button"
        onClick={() => actions.cancel(appointment, 'other', ' Clinic closed early ')}
      >
        other
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

let scheduled: AppointmentRow;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  for (const spy of Object.values(notifyMock)) spy.mockReset();
  resetClinicFixtures();
  grantClinicAccess('owner');
  const page = await fetchAppointmentPage({ status: 'scheduled', date: '2026-10-04' });
  const first = page.rows[0];
  if (!first) throw new Error('no booking scheduled tomorrow');
  scheduled = first;
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('AppointmentActionsProvider', () => {
  it('needs its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe appointment={scheduled} />)).toThrow(
      /AppointmentActionsProvider/,
    );
  });

  it('opens the drawer, in Reschedule for "Move to another time"', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(<Probe appointment={scheduled} />);
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/${scheduled.id}`),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
    await user.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('rebooks a No-show as a new booking from it (Q-A6)', async () => {
    const user = userEvent.setup();
    const noShow = await fetchAppointment(ref.appointment(2838));
    expect(noShow.status).toBe('no_show');
    const { router } = renderInAppointments(<Probe appointment={noShow} />);
    await user.click(await screen.findByRole('button', { name: 'next' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({ copyOf: noShow.id });
  });

  it('cancels with a reason at once, with the status toast', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={scheduled} />);
    await user.click(await screen.findByRole('button', { name: 'doctor' }));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        `${scheduled.person.name} → Cancelled · Doctor unavailable · slot freed, reminders stopped`,
        expect.anything(),
      ),
    );
  });

  it('stores "Other" with the note the cancel view took — no second confirm (L-64)', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Probe appointment={scheduled} />);
    await user.click(await screen.findByRole('button', { name: 'other' }));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        `${scheduled.person.name} → Cancelled · Other · slot freed, reminders stopped`,
        expect.anything(),
      ),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const after = await fetchAppointment(scheduled.id);
    expect(after).toMatchObject({
      status: 'cancelled',
      cancelReason: 'other',
      cancelNote: 'Clinic closed early',
    });
  });

  it('reads the member’s Edit and Create', async () => {
    grantClinicAccess('none');
    renderInAppointments(<Probe appointment={scheduled} />);
    await waitFor(() =>
      expect(screen.getByTestId('access')).toHaveTextContent('false·false'),
    );
  });
});
