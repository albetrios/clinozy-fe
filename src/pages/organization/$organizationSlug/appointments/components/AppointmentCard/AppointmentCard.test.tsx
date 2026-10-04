import { screen, waitFor, within } from '@testing-library/react';
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
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentCardContent, AppointmentQuickView } from './AppointmentCard.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

let base: AppointmentRow;

/** A booking for the card: Jalpa's (#2858), moved to the status and slot asked. */
const booking = (overrides: Partial<AppointmentRow> = {}): AppointmentRow => ({
  ...base,
  ...overrides,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  for (const spy of Object.values(notifyMock)) spy.mockReset();
  resetClinicFixtures();
  grantClinicAccess('owner');
  base = await fetchAppointment(ref.appointment(2858));
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

function renderCard(appointment: AppointmentRow, onCancel = vi.fn()) {
  const close = vi.fn();
  const view = renderInAppointments(
    <div data-testid="card">
      <AppointmentCardContent
        appointment={appointment}
        close={close}
        onCancel={onCancel}
      />
    </div>,
  );
  return { ...view, close, onCancel };
}

describe('AppointmentCardContent (appointments.md:149–163)', () => {
  it('names the person, the booking, the slot, the doctor and the last update', async () => {
    renderCard(booking({ status: 'confirmed', date: '2026-10-04', startTime: '10:30' }));
    const card = await screen.findByTestId('card');
    expect(card).toHaveTextContent('Jalpa Sheladiya');
    expect(card).toHaveTextContent('#2858');
    expect(card).toHaveTextContent('Confirmed');
    expect(card).toHaveTextContent(/Tomorrow · 10:30 AM · 20 min/);
    expect(card).toHaveTextContent('Dr. Drashti');
  });

  it('marks the tracker: done steps checked, the current one numbered', async () => {
    renderCard(booking({ status: 'confirmed', date: '2026-10-04' }));
    const tracker = await screen.findByRole('list');
    const steps = within(tracker).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[0]?.querySelector('svg')).not.toBeNull();
    expect(steps[2]).toHaveTextContent(/^3Checked in$/);
  });

  it('offers the next step and the other moves, each through the guards (Q-A7)', async () => {
    const user = userEvent.setup();
    // A booking the server holds as Scheduled for tomorrow, so the move lands.
    const page = await fetchAppointmentPage({ status: 'scheduled', date: '2026-10-04' });
    const scheduled = page.rows[0];
    if (!scheduled)
      throw new Error('the fixture world has no booking scheduled tomorrow');
    const { close } = renderCard(scheduled);
    const next = await screen.findByTestId('appointment-card-next');
    expect(next).toHaveTextContent('Confirm');
    // Checked in only on the visit day; No show only after the start. (The
    // moves wait for the member's access to resolve.)
    expect(await screen.findByTestId('appointment-card-move-checked_in')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByTestId('appointment-card-move-no_show')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByTestId('appointment-card-move-checked_in'));
    expect(close).not.toHaveBeenCalled();

    await user.click(next);
    expect(close).toHaveBeenCalled();
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        `${scheduled.person.name} → Confirmed · reminder queued`,
        expect.anything(),
      ),
    );
  });

  it('checks in on the visit day', async () => {
    renderCard(booking({ status: 'confirmed', date: '2026-10-03', startTime: '11:30' }));
    expect(await screen.findByTestId('appointment-card-next')).toHaveTextContent(
      'Check in',
    );
  });

  it('hands "Cancel" to the status popover’s cancel view', async () => {
    const user = userEvent.setup();
    const appointment = booking({ status: 'scheduled', date: '2026-10-04' });
    const { onCancel } = renderCard(appointment);
    await user.click(await screen.findByTestId('appointment-card-move-cancelled'));
    expect(onCancel).toHaveBeenCalledWith(appointment);
  });

  it('opens Reschedule and Rebook in the drawer', async () => {
    const user = userEvent.setup();
    const { router } = renderCard(booking({ status: 'scheduled', date: '2026-10-04' }));
    await user.click(await screen.findByTestId('appointment-card-move-reschedule'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${APPOINTMENTS_PAGE}/${ref.appointment(2858)}`,
      ),
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
    expect(router.state.location.search).toEqual({ copyOf: ref.appointment(2858) });
  });

  it('keeps the moves away from a member without Edit', async () => {
    grantClinicAccess('none');
    renderCard(booking({ status: 'scheduled', date: '2026-10-04' }));
    await screen.findByTestId('appointment-card-open');
    expect(screen.queryByTestId('appointment-card-move-reschedule')).toBeNull();
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
