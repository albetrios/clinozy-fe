import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchAppointment } from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderInAppointments,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { blockGeometry } from '../../appointments.calendar.ts';
import { CalendarBlock } from './CalendarBlock.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

let base: AppointmentRow;

/** Jalpa's booking (#2858), moved to what a test asks. */
const booking = (overrides: Partial<AppointmentRow> = {}): AppointmentRow => ({
  ...base,
  ...overrides,
});

const block = () => screen.getByTestId('appointments-block');

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

describe('CalendarBlock (KICKOFF §6.4 Blocks; H:2063)', () => {
  it('draws the person, the doctor, the time and both pills on its status tint', async () => {
    const appointment = booking({
      status: 'scheduled',
      date: '2026-10-04',
      startTime: '10:30',
      durationMin: 60,
      person: { ...base.person, kind: 'patient' },
    });
    renderInAppointments(
      <div className="relative">
        <CalendarBlock
          appointment={appointment}
          variant="grid"
          geometry={blockGeometry(appointment)}
        />
      </div>,
    );
    await screen.findByTestId('appointments-block');
    expect(block()).toHaveAttribute('data-status', 'scheduled');
    expect(block().className).toContain('bg-tone-butter');
    expect(block().className).toContain('border-s-tone-butter-foreground');
    expect(block().className).toContain('flex-wrap');
    expect(block()).toHaveTextContent('Jalpa Sheladiya');
    expect(block()).toHaveTextContent('10:30 AM · 60m');
    expect(block()).toHaveTextContent(appointment.serviceLabel);
    expect(block()).toHaveTextContent('Scheduled');
    expect(within(block()).getByTestId('patient-badge')).toHaveTextContent('P');
    // Placed by its geometry: 10:30 sits 132px below 9 am, 60 minutes are 86px.
    expect(block().style.getPropertyValue('--block-top')).toBe('132px');
    expect(block().style.getPropertyValue('--block-height')).toBe('86px');
  });

  it('marks a lead "L", keeps a short block on one line and names a clash in its tooltip', async () => {
    const appointment = booking({
      durationMin: 20,
      person: { ...base.person, kind: 'lead' },
    });
    renderInAppointments(
      <CalendarBlock
        appointment={appointment}
        variant="grid"
        geometry={blockGeometry(appointment)}
        clash
      />,
    );
    await screen.findByTestId('appointments-block');
    expect(within(block()).getByTestId('lead-badge')).toHaveTextContent('L');
    expect(block().className).toContain('flex-nowrap');
    expect(block()).toHaveAttribute(
      'title',
      expect.stringMatching(
        /^Jalpa Sheladiya · .+ · 20 min · .+ · overlaps another booking$/,
      ),
    );
  });

  it('is a Month chip without the pills, and a popover row that wraps', async () => {
    renderInAppointments(
      <>
        <CalendarBlock appointment={booking()} variant="chip" />
        <CalendarBlock
          appointment={booking({ id: crypto.randomUUID() })}
          variant="list"
        />
      </>,
    );
    const [chip, row] = await screen.findAllByTestId('appointments-block');
    expect(chip?.className).toContain('h-5.5');
    expect(chip?.className).toContain('flex-nowrap');
    expect(chip?.querySelectorAll('[data-slot="pill"][data-tone]')).toHaveLength(0);
    expect(row?.className).toContain('flex-wrap');
    expect(row?.querySelectorAll('[data-slot="pill"][data-tone]')).toHaveLength(2);
  });

  it('opens the booking’s drawer on a press, as a real button', async () => {
    const user = userEvent.setup();
    const { router } = renderInAppointments(
      <CalendarBlock appointment={booking()} variant="chip" />,
    );
    await user.click(await screen.findByRole('button', { name: /Jalpa Sheladiya/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${APPOINTMENTS_PAGE}/${base.id}`),
    );
  });

  it('shows the card on hover; its Cancel opens Change status on the cancel view, under the block', async () => {
    const user = userEvent.setup();
    renderInAppointments(
      <CalendarBlock appointment={booking({ status: 'scheduled' })} variant="chip" />,
    );
    await user.hover(await screen.findByTestId('appointments-block'));
    const card = await screen.findByTestId('appointment-card', {}, { timeout: 2_000 });
    await user.click(within(card).getByTestId('appointment-card-move-cancelled'));
    const popover = await screen.findByTestId('appointments-status-popover');
    expect(popover).toHaveTextContent('Why is it cancelled?');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInAppointments(
      <CalendarBlock appointment={booking()} variant="list" />,
    );
    await screen.findByTestId('appointments-block');
    expect(await axe(container)).toHaveNoViolations();
  });
});
