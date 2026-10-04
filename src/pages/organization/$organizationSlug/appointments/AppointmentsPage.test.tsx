import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { APPOINTMENT_FORM_TEST_IDS } from '@/shared/forms/AppointmentForm/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  APPOINTMENTS_PAGE,
  grantClinicAccess,
  renderAppointmentsRoutes,
} from './__tests__/integration/appointments-test-router.tsx';
import { AppointmentsPage } from './AppointmentsPage.tsx';

// A desktop: a phone renders Week as Day.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));

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

describe('AppointmentsPage', () => {
  it('renders the room: its toolbar, then the Agenda by default (D27)', async () => {
    const { container } = renderWithProviders(<AppointmentsPage />);
    const page = await screen.findByTestId('appointments-page');
    expect(page).toHaveAttribute('data-view', 'agenda');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Appointments');
    expect(screen.getByRole('tabpanel', { name: 'Agenda' })).toContainElement(
      await screen.findByTestId('appointments-table'),
    );
    await screen.findAllByTestId('appointments-table-row');
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(['day', 'week', 'month'] as const)(
    'renders the %s calendar in its panel from the URL',
    async (view) => {
      renderAppointmentsRoutes(`${APPOINTMENTS_PAGE}?view=${view}`, AppointmentsPage);
      const page = await screen.findByTestId('appointments-page');
      expect(page).toHaveAttribute('data-view', view);
      const calendar = await screen.findByTestId('appointments-calendar');
      expect(calendar).toHaveAttribute('data-view', view);
      expect(screen.getByRole('tabpanel')).toContainElement(calendar);
      expect(screen.queryByTestId('appointments-table')).toBeNull();
    },
  );
});

describe('AppointmentsPage — the appointment form over it (L-38)', () => {
  it('opens the booking a chat’s "Appointment #…" chip names', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const id = ref.appointment(2861);
    const { router } = renderAppointmentsRoutes(
      `${APPOINTMENTS_PAGE}/${id}`,
      AppointmentsPage,
    );
    const drawer = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.drawer);
    const chat = await within(drawer).findByTestId(APPOINTMENT_FORM_TEST_IDS.chat);
    const chip = (await within(chat).findAllByTestId('chat-history-chip')).find((item) =>
      /Appointment #/.test(item.textContent ?? ''),
    );
    if (!chip) throw new Error('no appointment chip');
    const before = router.state.location.href;
    await user.click(chip);
    await waitFor(() => expect(router.state.location.href).not.toBe(before));
    expect(router.state.location.pathname).toMatch(
      new RegExp(String.raw`^${APPOINTMENTS_PAGE}/[^/]+$`),
    );
  });
});
