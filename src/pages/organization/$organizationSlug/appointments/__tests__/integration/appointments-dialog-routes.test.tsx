import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { appointmentQueryKeys } from '@/shared/api/clinic/appointments-api.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { AppointmentsPage } from '../../AppointmentsPage.tsx';
import { renderAppointmentsRoutes } from './appointments-test-router.tsx';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const PAGE = '/organization/acme/appointments';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  notifyMock.info.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the Appointments dialog routes (D24, S:26–29)', () => {
  it('keeps the page behind a deep-linked booking, the URL and its view in place', async () => {
    const id = ref.appointment(2861);
    const { router, queryClient } = renderAppointmentsRoutes(
      `${PAGE}/${id}?view=month&date=2026-10-09`,
      AppointmentsPage,
    );
    const page = await screen.findByTestId('appointments-page');
    expect(page).toHaveAttribute('data-view', 'month');
    await waitFor(() =>
      expect(queryClient.getQueryState(appointmentQueryKeys.detail(id))?.status).toBe(
        'success',
      ),
    );
    expect(router.state.location.pathname).toBe(`${PAGE}/${id}`);
    expect(router.state.location.search).toEqual({ view: 'month', date: '2026-10-09' });
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('answers an unknown booking with the page, no drawer, and "Appointment not found" (S:115)', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${ref.appointment(9)}?status=all`,
      AppointmentsPage,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(screen.getByTestId('appointments-page')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ status: 'all' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Appointment not found · it may have been deleted',
    );
  });

  it('keeps the booking prefill in the URL — the Day view behind on the same day', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/create?view=day&date=2026-10-05&time=10:15`,
      AppointmentsPage,
    );
    expect(await screen.findByTestId('appointments-page')).toHaveAttribute(
      'data-view',
      'day',
    );
    expect(router.state.location.pathname).toBe(`${PAGE}/create`);
    expect(router.state.matches.at(-1)?.search).toMatchObject({
      view: 'day',
      date: '2026-10-05',
      time: '10:15',
    });
  });

  it('has no axe violations behind a dialog route', async () => {
    const { container } = renderAppointmentsRoutes(
      `${PAGE}/${ref.appointment(2861)}`,
      AppointmentsPage,
    );
    await screen.findByTestId('appointments-page');
    expect(await axe(container)).toHaveNoViolations();
  });
});
