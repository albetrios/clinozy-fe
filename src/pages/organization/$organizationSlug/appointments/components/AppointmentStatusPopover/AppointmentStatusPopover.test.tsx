import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAppointment } from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

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

let base: AppointmentRow;

/** A trigger and the popover, open state and view kept here as the Agenda keeps them. */
function Harness({ appointment }: { appointment: AppointmentRow }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AppointmentStatusView>('moves');
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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  grantClinicAccess('owner');
  base = await fetchAppointment(ref.appointment(2858));
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('AppointmentStatusPopover (appointments.md:165–179)', () => {
  it('lists the moves out of Scheduled, each with its reason line', async () => {
    const { popover } = await openFor({ status: 'scheduled', date: '2026-10-04' });
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
    const { popover } = await openFor({ status: 'confirmed', date: '2026-10-04' });
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
      date: '2026-10-03',
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
    const { popover, user } = await openFor({ status: 'scheduled', date: '2026-10-04' });
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
      date: '2026-10-04',
    });
    await user.click(
      within(popover).getByTestId('appointments-status-option-reschedule'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${APPOINTMENTS_PAGE}/${ref.appointment(2858)}`,
      ),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
  });

  it('has no axe violations', async () => {
    const { popover } = await openFor({ status: 'scheduled', date: '2026-10-04' });
    expect(await axeForDialog(popover)).toHaveNoViolations();
  });

  it('opens "Other"’s note in the cancel view; Back closes it again', async () => {
    const { popover, user } = await openFor({ status: 'scheduled', date: '2026-10-04' });
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
