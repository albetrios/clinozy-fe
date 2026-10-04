import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentQueryKeys } from '@/shared/api/clinic/appointments-api.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { APPOINTMENT_FORM_TEST_IDS } from '@/shared/forms/AppointmentForm/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { AppointmentsPage } from '../../AppointmentsPage.tsx';
import { renderAppointmentsRoutes } from './appointments-test-router.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
  },
}));
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

  it('has no axe violations with the appointment form open over the page', async () => {
    renderAppointmentsRoutes(`${PAGE}/${ref.appointment(2861)}`, AppointmentsPage);
    await screen.findByTestId('appointments-page');
    const drawer = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.drawer);
    // The booking arrives after the drawer opens — the same drawer fills in.
    expect(
      await within(drawer).findByTestId(APPOINTMENT_FORM_TEST_IDS.form),
    ).toBeVisible();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('books from create/ and closes onto the booked day, the view kept (H:6051, D28)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const priti = clinicFixtures.patients.snapshot((row) => row.firstName === 'Priti')[0];
    if (!priti) throw new Error('no Priti');
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/create?view=day&date=2026-10-03&who=${priti.id}`,
      AppointmentsPage,
    );
    const drawer = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.createDrawer);
    await within(drawer).findByTestId(APPOINTMENT_FORM_TEST_IDS.form);
    await user.click(within(drawer).getByTestId(APPOINTMENT_FORM_TEST_IDS.calendarNext));
    await user.click(
      within(drawer)
        .getAllByTestId(APPOINTMENT_FORM_TEST_IDS.calendarDay)
        .find((day) => day.getAttribute('data-day') === '2026-11-02') as HTMLElement,
    );
    await waitFor(() =>
      expect(
        within(drawer)
          .queryAllByTestId(APPOINTMENT_FORM_TEST_IDS.slotTime)
          .some((slot) => !(slot as HTMLButtonElement).disabled),
      ).toBe(true),
    );
    const slot = within(drawer)
      .getAllByTestId(APPOINTMENT_FORM_TEST_IDS.slotTime)
      .find((button) => !(button as HTMLButtonElement).disabled) as HTMLElement;
    await user.click(slot);
    await user.click(
      within(drawer).getByTestId(`${APPOINTMENT_FORM_TEST_IDS.createDrawer}-save`),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'day', date: '2026-11-02' });
  });

  it('closes create/ without booking, the view and its day kept', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/create?view=month&date=2026-10-05`,
      AppointmentsPage,
    );
    const drawer = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.createDrawer);
    await user.click(
      within(drawer).getByTestId(`${APPOINTMENT_FORM_TEST_IDS.createDrawer}-close`),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'month', date: '2026-10-05' });
  });

  it('saves an edit and closes onto the page; × closes without one', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const id = ref.appointment(2859);
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${id}?view=month`,
      AppointmentsPage,
    );
    let drawer = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.drawer);
    await within(drawer).findByTestId(APPOINTMENT_FORM_TEST_IDS.form);
    await user.type(
      within(drawer).getByTestId(APPOINTMENT_FORM_TEST_IDS.notes),
      ' · prefers mornings',
    );
    await user.click(
      within(drawer).getByTestId(`${APPOINTMENT_FORM_TEST_IDS.drawer}-save`),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'month' });
    expect(
      clinicFixtures.appointments.snapshot((row) => row.id === id)[0]?.notes,
    ).toMatch(/prefers mornings$/);
    await router.navigate({ to: `${PAGE}/${id}`, search: { view: 'month' } });
    drawer = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.drawer);
    await user.click(
      within(drawer).getByTestId(`${APPOINTMENT_FORM_TEST_IDS.drawer}-close`),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
  });

  it('copies a booking into create/?copyOf=, the page kept behind', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${ref.appointment(2859)}?view=month`,
      AppointmentsPage,
    );
    const drawer = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.drawer);
    await within(drawer).findByTestId(APPOINTMENT_FORM_TEST_IDS.form);
    await user.click(within(drawer).getByTestId(APPOINTMENT_FORM_TEST_IDS.copy));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${PAGE}/create`));
    expect(router.state.matches.at(-1)?.search).toMatchObject({
      view: 'month',
      copyOf: ref.appointment(2859),
    });
    const copy = await screen.findByTestId(APPOINTMENT_FORM_TEST_IDS.createDrawer);
    expect(
      await within(copy).findByTestId(APPOINTMENT_FORM_TEST_IDS.whoCard),
    ).toHaveTextContent('Dharti Galani');
  });
});
