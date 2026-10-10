import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import {
  cancelAppointment,
  moveAppointment,
} from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
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
  AppointmentStatusPopover,
  type AppointmentStatusView,
} from './AppointmentStatusPopover.tsx';

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

/** Riya's booking (#2861) — Scheduled with Dr. Nisha tomorrow at 10:30. */
const base = appointmentRow();

/**
 * A trigger and the popover, open state and view kept here as the Agenda keeps them — the
 * trigger once the member's access is known, as the guards read it.
 */
function Harness({ appointment }: { appointment: AppointmentRow }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AppointmentStatusView>('moves');
  const access = useClinicAccess();
  if (!access.isResolved) return null;
  return (
    <AppointmentStatusPopover
      appointment={appointment}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setView('moves');
      }}
      view={view}
      onViewChange={setView}
    >
      <button type="button">Status</button>
    </AppointmentStatusPopover>
  );
}

async function openFor(overrides: Partial<AppointmentRow>) {
  const user = userEvent.setup();
  const view = renderInAppointments(<Harness appointment={{ ...base, ...overrides }} />);
  await user.click(await screen.findByRole('button', { name: 'Status' }));
  const popover = await screen.findByTestId('appointments-status-popover');
  return { ...view, user, popover };
}

const optionMoves = (popover: HTMLElement) =>
  within(popover)
    .queryAllByTestId(/^appointments-status-option-/)
    .map((option) => option.dataset.testid?.replace('appointments-status-option-', ''));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantClinicAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('AppointmentStatusPopover (appointments.md:165–179)', () => {
  it('lists the moves out of Scheduled, each with its reason line', async () => {
    const { popover } = await openFor({
      status: 'scheduled',
      date: APPOINTMENT_TOMORROW,
    });
    expect(popover).toHaveAccessibleName('Change status');
    expect(popover).toHaveTextContent(/^Now: Scheduled/);
    expect(optionMoves(popover)).toEqual([
      'confirmed',
      'checked_in',
      'reschedule',
      'cancelled',
      'no_show',
    ]);
    expect(
      within(popover).getByTestId('appointments-status-option-reschedule'),
    ).toHaveTextContent(
      'Move to another timeMove to a new slot · same appointment, old slot kept in history',
    );
  });

  it('keeps Checked in to the visit day, saying which day', async () => {
    const { popover } = await openFor({
      status: 'confirmed',
      date: APPOINTMENT_TOMORROW,
    });
    expect(optionMoves(popover)).toEqual([
      'checked_in',
      'reschedule',
      'cancelled',
      'no_show',
    ]);
    const checkIn = within(popover).getByTestId('appointments-status-option-checked_in');
    expect(checkIn).toHaveAttribute('aria-disabled', 'true');
    expect(checkIn).toHaveTextContent('Only on Tomorrow');
  });

  it('completes only a patient’s visit', async () => {
    const { popover } = await openFor({
      status: 'checked_in',
      date: APPOINTMENT_TODAY,
      person: { ...base.person, kind: 'lead', patientId: null },
    });
    expect(optionMoves(popover)).toEqual(['completed']);
    expect(
      within(popover).getByTestId('appointments-status-option-completed'),
    ).toHaveTextContent('Create the patient record first · Completed needs a patient');
  });

  it('says a final status is final, with the reason when cancelled', async () => {
    const { popover } = await openFor({
      status: 'cancelled',
      cancelReason: 'unreachable',
    });
    expect(popover).toHaveTextContent('Now: Cancelled · Could not reach patient');
    expect(optionMoves(popover)).toEqual([]);
    expect(popover).toHaveTextContent(
      'Final status. Use Rebook to make a new appointment.',
    );
  });

  it('opens the cancel view on Cancel, on its Back button, and goes back', async () => {
    const { popover, user } = await openFor({
      status: 'scheduled',
      date: APPOINTMENT_TOMORROW,
    });
    await user.click(within(popover).getByTestId('appointments-status-option-cancelled'));
    const back = await screen.findByTestId('appointments-status-back');
    await waitFor(() => expect(back).toHaveFocus());
    const cancelView = screen.getByTestId('appointments-status-popover');
    expect(
      within(cancelView)
        .getAllByTestId(/^appointments-cancel-reason-/)
        .map((reason) => reason.textContent),
    ).toEqual([
      'Patient asked',
      'Could not reach patient',
      'Doctor unavailable',
      'Machine or room unavailable',
      'Other',
    ]);
    await user.click(back);
    expect(
      await screen.findByTestId('appointments-status-option-confirmed'),
    ).toBeInTheDocument();
  });

  it('moves to another time through the drawer’s Reschedule mode', async () => {
    const { popover, user, router } = await openFor({
      status: 'scheduled',
      date: APPOINTMENT_TOMORROW,
    });
    await user.click(
      within(popover).getByTestId('appointments-status-option-reschedule'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/${base.id}`),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
  });

  it('moves a status through its own route, then closes', async () => {
    const { popover, user } = await openFor({
      status: 'scheduled',
      date: APPOINTMENT_TOMORROW,
    });
    await user.click(within(popover).getByTestId('appointments-status-option-confirmed'));
    await waitFor(() =>
      expect(screen.queryByTestId('appointments-status-popover')).toBeNull(),
    );
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: base.id,
        route: 'confirm',
        idempotencyKey: expect.any(String),
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Riya Mehta → Confirmed');
  });

  it('cancels with one tap on a reason, through the cancel write', async () => {
    const { popover, user } = await openFor({
      status: 'scheduled',
      date: APPOINTMENT_TOMORROW,
    });
    await user.click(within(popover).getByTestId('appointments-status-option-cancelled'));
    await user.click(await screen.findByTestId('appointments-cancel-reason-unreachable'));
    await waitFor(() =>
      expect(cancelAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: base.id,
        cancel: { reason: 'unreachable', note: null },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(moveAppointment).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Riya Mehta → Cancelled · Could not reach patient · slot freed, reminders stopped',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
  });

  it('cancels "Other" once its note is typed', async () => {
    const { popover, user } = await openFor({
      status: 'confirmed',
      date: APPOINTMENT_TOMORROW,
    });
    await user.click(within(popover).getByTestId('appointments-status-option-cancelled'));
    await user.click(await screen.findByTestId('appointments-cancel-reason-other'));
    const submit = screen.getByTestId('appointments-cancel-submit');
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    await user.click(submit);
    expect(cancelAppointment).not.toHaveBeenCalled();
    await user.type(screen.getByTestId('appointments-cancel-note'), 'Power cut{Enter}');
    await waitFor(() =>
      expect(cancelAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ cancel: { reason: 'other', note: 'Power cut' } }),
      ),
    );
  });

  it('has no axe violations', async () => {
    const { popover } = await openFor({
      status: 'scheduled',
      date: APPOINTMENT_TOMORROW,
    });
    expect(await axeForDialog(popover)).toHaveNoViolations();
  });

  it('opens "Other"’s note in the cancel view; Back closes it again', async () => {
    const { popover, user } = await openFor({
      status: 'scheduled',
      date: APPOINTMENT_TOMORROW,
    });
    await user.click(within(popover).getByTestId('appointments-status-option-cancelled'));
    await user.click(await screen.findByTestId('appointments-cancel-reason-other'));
    const note = screen.getByTestId('appointments-cancel-note');
    await waitFor(() => expect(note).toHaveFocus());
    expect(note).toHaveAttribute('maxlength', '160');
    expect(screen.getByTestId('appointments-cancel-submit')).toHaveTextContent('Cancel');
    expect(
      await axeForDialog(screen.getByTestId('appointments-status-popover')),
    ).toHaveNoViolations();
    await user.click(screen.getByTestId('appointments-status-back'));
    expect(screen.queryByTestId('appointments-cancel-note')).not.toBeInTheDocument();
  });
});
