import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import {
  appointmentQueryKeys,
  fetchAppointment,
  fetchAppointmentRange,
} from '@/shared/api/clinic/appointments-api.ts';
import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import type * as AppointmentFormModule from '@/shared/forms/AppointmentForm/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { APPOINTMENT_NOW, contactHit } from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { AppointmentsPage } from '../../AppointmentsPage.tsx';
import {
  type AppointmentsWorld,
  DEV_BOOKING,
  publicId,
  RIYA_BOOKING,
  seededAppointmentsWorld,
  STAND_IN_BOOKED_DATE,
  standInForm,
} from './appointments-test-data.ts';
import {
  grantClinicAccess,
  renderAppointmentsRoutes,
} from './appointments-test-router.tsx';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

// The form is its own suites'; the routes hand it its props and close on its callbacks.
vi.mock('@/shared/forms/AppointmentForm/index.ts', async (importOriginal) => {
  const { AppointmentFormStandIn } = await import('./appointment-form-stand-in.tsx');
  return {
    ...(await importOriginal<typeof AppointmentFormModule>()),
    AppointmentForm: AppointmentFormStandIn,
  };
});

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } = await import('./appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } = await import('./appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});

const PAGE = '/organization/acme/appointments';

/** The drawer over the page, and what the form was opened with. */
async function drawer() {
  const form = await screen.findByTestId('appointment-form-stand-in');
  return { form, opened: () => standInForm(within(form).getByTestId('form')) };
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

describe('the Appointments dialog routes (D24, S:26–29)', () => {
  it('keeps the page behind a deep-linked booking, the URL and its view in place, the booking read once', async () => {
    const id = RIYA_BOOKING.id;
    const { router, queryClient } = renderAppointmentsRoutes(
      `${PAGE}/${id}?view=month&date=2026-10-09`,
      AppointmentsPage,
    );
    const page = await screen.findByTestId('appointments-page');
    expect(page).toHaveAttribute('data-view', 'month');
    const { opened } = await drawer();
    await waitFor(() => expect(opened()).toMatchObject({ appointmentId: id, seq: 2861 }));
    expect(
      queryClient.getQueryState(appointmentQueryKeys.detail('org_test', id))?.status,
    ).toBe('success');
    expect(fetchAppointment).toHaveBeenCalledExactlyOnceWith(id);
    expect(router.state.location.pathname).toBe(`${PAGE}/${id}`);
    expect(router.state.location.search).toEqual({ view: 'month', date: '2026-10-09' });
    // The board behind reads its own month.
    await waitFor(() =>
      expect(fetchAppointmentRange).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-10-01', to: '2026-10-31' }),
      ),
    );
    expect(notify.info).not.toHaveBeenCalled();
  });

  it('answers an unknown booking with the page, no drawer, and "Appointment not found" (S:115)', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${publicId('appt', 'gone')}?status=all`,
      AppointmentsPage,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(screen.getByTestId('appointments-page')).toBeInTheDocument();
    expect(screen.queryByTestId('appointment-form-stand-in')).toBeNull();
    expect(router.state.location.search).toEqual({ status: 'all' });
    expect(notify.info).toHaveBeenCalledExactlyOnceWith(
      'Appointment not found · it may have been deleted',
    );
  });

  it('keeps the booking prefill in the URL — the Day view behind on the same day', async () => {
    const who = contactHit().id;
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/create?view=day&date=2026-10-05&time=10:15&who=${who}`,
      AppointmentsPage,
    );
    expect(await screen.findByTestId('appointments-page')).toHaveAttribute(
      'data-view',
      'day',
    );
    const { opened } = await drawer();
    expect(opened().prefill).toEqual({
      whoId: who,
      date: '2026-10-05',
      time: '10:15',
      collapsed: false,
    });
    expect(router.state.location.pathname).toBe(`${PAGE}/create`);
    expect(router.state.matches.at(-1)?.search).toMatchObject({
      view: 'day',
      date: '2026-10-05',
      time: '10:15',
      who,
    });
    await waitFor(() =>
      expect(fetchAppointmentRange).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-10-05', to: '2026-10-05' }),
      ),
    );
  });

  it('has no axe violations with a booking’s drawer route open over the page', async () => {
    renderAppointmentsRoutes(`${PAGE}/${RIYA_BOOKING.id}`, AppointmentsPage);
    await screen.findAllByTestId('appointments-table-row');
    const { form, opened } = await drawer();
    await waitFor(() => expect(opened().seq).toBe(2861));
    expect(await axeForDialog(form)).toHaveNoViolations();
  });

  it('books from create/ and closes onto the booked day, the view kept (H:6051, D28)', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/create?view=day&date=2026-10-03&time=11:00`,
      AppointmentsPage,
    );
    const { form } = await drawer();
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({
      view: 'day',
      date: STAND_IN_BOOKED_DATE,
    });
    expect(screen.queryByTestId('appointment-form-stand-in')).toBeNull();
  });

  it('closes create/ without booking, the view and its day kept', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/create?view=month&date=2026-10-05`,
      AppointmentsPage,
    );
    const { form } = await drawer();
    fireEvent.click(within(form).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'month', date: '2026-10-05' });
  });

  it('saves an edit and closes onto the page; × closes without one', async () => {
    const id = DEV_BOOKING.id;
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${id}?view=month`,
      AppointmentsPage,
    );
    const edit = await drawer();
    await waitFor(() => expect(edit.opened().seq).toBe(DEV_BOOKING.seq));
    fireEvent.click(within(edit.form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'month' });

    await router.navigate({ to: `${PAGE}/${id}`, search: { view: 'month' } });
    const again = await drawer();
    fireEvent.click(within(again.form).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
  });

  it('copies a booking into create/?copyOf=, the page kept behind', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${RIYA_BOOKING.id}?view=month`,
      AppointmentsPage,
    );
    const { form, opened } = await drawer();
    await waitFor(() => expect(opened().seq).toBe(2861));
    fireEvent.click(within(form).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${PAGE}/create`));
    expect(router.state.matches.at(-1)?.search).toMatchObject({
      view: 'month',
      copyOf: RIYA_BOOKING.id,
    });
    const copy = await drawer();
    await waitFor(() =>
      expect(copy.opened()).toMatchObject({
        mode: 'create',
        prefill: { copyOf: RIYA_BOOKING.id },
      }),
    );
    expect(screen.getByTestId('appointments-page')).toHaveAttribute('data-view', 'month');
  });
});
