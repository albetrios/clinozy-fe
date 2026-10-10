import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import {
  cancelAppointment,
  moveAppointment,
} from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
} from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
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
import { AppointmentCardContent, AppointmentQuickView } from './AppointmentCard.tsx';

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

/** Riya's booking (#2861) — Scheduled with Dr. Nisha tomorrow at 10:30 — as a test asks. */
const booking = (overrides: Partial<AppointmentRow> = {}) => appointmentRow(overrides);

/** The card once the member's access is known — the guards read it. */
function WhenResolved({ children }: { children: ReactNode }) {
  const access = useClinicAccess();
  return access.isResolved ? children : null;
}

function renderCard(appointment: AppointmentRow, onCancel = vi.fn()) {
  const close = vi.fn();
  const view = renderInAppointments(
    <WhenResolved>
      <div data-testid="card">
        <AppointmentCardContent
          appointment={appointment}
          close={close}
          onCancel={onCancel}
        />
      </div>
    </WhenResolved>,
  );
  return { ...view, close, onCancel };
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

describe('AppointmentCardContent (appointments.md:149–163)', () => {
  it('names the person, the booking, the slot, the doctor and the last update', async () => {
    renderCard(booking({ status: 'confirmed', reminder: 'reminder_sent' }));
    const card = await screen.findByTestId('card');
    expect(card).toHaveTextContent('Riya Mehta');
    expect(card).toHaveTextContent('#2861');
    expect(card).toHaveTextContent('Confirmed');
    expect(withoutBidiMarks(card.textContent)).toMatch(/Tomorrow · 10:30 AM · 20 min/);
    expect(card).toHaveTextContent('Nisha S.');
    expect(card).toHaveTextContent('Reminder sent');
  });

  it('says where a moved booking came from, and "No update yet" without an event', async () => {
    const moved = renderCard(
      booking({ moveCount: 1, rescheduledFrom: clinicInstant('2026-10-02', '16:30') }),
    );
    expect(withoutBidiMarks((await screen.findByTestId('card')).textContent)).toMatch(
      /Moved from .+ 4:30\sPM/,
    );
    moved.unmount();
    renderCard(booking());
    expect(await screen.findByTestId('card')).toHaveTextContent('No update yet');
  });

  it('keeps the name, phone, id, slot and doctor whole on a right-to-left page', async () => {
    renderCard(
      booking({
        status: 'confirmed',
        person: { ...booking().person, name: 'Riya S.', phone: '+919825044120' },
      }),
    );
    const card = await screen.findByTestId('card');
    const name = within(card).getByText('Riya S.');
    expect(name).toHaveAttribute('dir', 'auto');
    expect(name).toHaveClass('[text-align:match-parent]');
    expect(within(card).getByText('+91 98250 44120')).toHaveAttribute('dir', 'ltr');
    expect(within(card).getByText('#2861')).toHaveAttribute('dir', 'ltr');
    expect(within(card).getByText('Nisha S.')).toHaveAttribute('dir', 'auto');
    // The day and the time are tokens inside the translated line.
    expect(card).toHaveTextContent(`${fsi('Tomorrow')} · ${fsi('10:30 AM')} · 20 min`);
    expect(card).toHaveTextContent('Riya S.+91 98250 44120#2861');
  });

  it('marks the tracker: done steps checked, the current one numbered', async () => {
    renderCard(booking({ status: 'confirmed' }));
    const tracker = await screen.findByRole('list');
    const steps = within(tracker).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[0]?.querySelector('svg')).not.toBeNull();
    expect(steps[2]).toHaveTextContent(/^3Checked in$/);
  });

  it('offers the next step and the other moves, each through the guards (Q-A7)', async () => {
    const user = userEvent.setup();
    const { close } = renderCard(booking());
    const next = await screen.findByTestId('appointment-card-next');
    expect(next).toHaveTextContent('Confirm');
    // Checked in only on the visit day; No show only after the start.
    expect(screen.getByTestId('appointment-card-move-checked_in')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByTestId('appointment-card-move-no_show')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByTestId('appointment-card-move-checked_in'));
    expect(close).not.toHaveBeenCalled();
    expect(moveAppointment).not.toHaveBeenCalled();

    await user.click(next);
    expect(close).toHaveBeenCalled();
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: booking().id,
        route: 'confirm',
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Riya Mehta → Confirmed'),
    );
  });

  it('checks in on the visit day through `check-in`, with Undo', async () => {
    const user = userEvent.setup();
    const today = booking({
      status: 'confirmed',
      date: APPOINTMENT_TODAY,
      startTime: '11:30',
    });
    world.rows = [today];
    renderCard(today);
    const next = await screen.findByTestId('appointment-card-next');
    expect(next).toHaveTextContent('Check in');
    await user.click(next);
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: today.id, route: 'check-in' }),
      ),
    );
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Riya Mehta → Checked in',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
  });

  it('hands "Cancel" to the status popover’s cancel view — no cancel of its own', async () => {
    const user = userEvent.setup();
    const appointment = booking({ status: 'scheduled', date: APPOINTMENT_TOMORROW });
    const { onCancel } = renderCard(appointment);
    await user.click(await screen.findByTestId('appointment-card-move-cancelled'));
    expect(onCancel).toHaveBeenCalledWith(appointment);
    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it('opens Reschedule in the drawer', async () => {
    const user = userEvent.setup();
    const { router } = renderCard(booking());
    await user.click(await screen.findByTestId('appointment-card-move-reschedule'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/${booking().id}`),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
  });

  it('says a closed booking is closed, and rebooks a No-show as a new booking (Q-A6)', async () => {
    const user = userEvent.setup();
    const { router } = renderCard(booking({ status: 'no_show', date: '2026-10-02' }));
    const card = await screen.findByTestId('card');
    expect(card).toHaveTextContent('This appointment is closed · No show');
    expect(screen.queryByTestId('appointment-card-move-cancelled')).toBeNull();
    const next = screen.getByTestId('appointment-card-next');
    expect(next).toHaveTextContent('Rebook');
    await user.click(next);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/create`),
    );
    expect(router.state.location.search).toEqual({ copyOf: booking().id });
    expect(moveAppointment).not.toHaveBeenCalled();
  });

  it('keeps the moves away from a member without Edit', async () => {
    grantClinicAccess('none');
    renderCard(booking());
    await screen.findByTestId('appointment-card-open');
    expect(screen.queryByTestId('appointment-card-move-reschedule')).toBeNull();
    expect(screen.getByTestId('appointment-card-next')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('AppointmentQuickView', () => {
  it('pins the card from the eye, focused on the card itself, with no axe violations', async () => {
    const user = userEvent.setup();
    renderInAppointments(
      <AppointmentQuickView appointment={booking()} onCancel={vi.fn()}>
        <button type="button">Quick view</button>
      </AppointmentQuickView>,
    );
    await user.click(await screen.findByRole('button', { name: 'Quick view' }));
    const card = await screen.findByTestId('appointment-card');
    expect(card).toHaveAttribute('role', 'dialog');
    expect(card).toHaveAccessibleName('Appointment');
    await waitFor(() => expect(card).toHaveFocus());
    expect(await axeForDialog(card)).toHaveNoViolations();
  });
});
