import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { renderAppointmentsRoutes } from '../../__tests__/integration/appointments-test-router.tsx';
import {
  type AppointmentsDialogRoute,
  useAppointmentsDialogRoute,
} from './useAppointmentsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const PAGE = '/organization/acme/appointments';
const DOCTOR = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';

/** What the hook answered, minus the record itself (its seq stands in). */
function summary(route: AppointmentsDialogRoute) {
  if (route.kind !== 'appointment') return route;
  return {
    kind: route.kind,
    appointmentId: route.appointmentId,
    mode: route.mode,
    seq: route.appointment?.seq ?? null,
    isPending: route.isPending,
    readOnly: route.readOnly,
  };
}

/** Renders the hook's answer as JSON, and a button that closes the drawer. */
function Probe() {
  const { dialog, close } = useAppointmentsDialogRoute();
  return (
    <>
      <output data-testid="probe">{JSON.stringify(summary(dialog))}</output>
      <button type="button" onClick={close}>
        Close
      </button>
    </>
  );
}

/** The hook's latest answer. */
function seen(): unknown {
  return JSON.parse(screen.getByTestId('probe').textContent ?? 'null');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  notifyMock.info.mockReset();
  useOrganizationStore.getState().clearPermissions();
  useUIStore.getState().setPreviewRole(null);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('useAppointmentsDialogRoute', () => {
  it('opens nothing on the page itself', async () => {
    renderAppointmentsRoutes(PAGE, Probe);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('opens the drawer on a deep link and resolves the booking', async () => {
    const id = ref.appointment(2861);
    const { router } = renderAppointmentsRoutes(`${PAGE}/${id}?view=day`, Probe);
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'appointment',
        appointmentId: id,
        mode: 'edit',
        seq: 2861,
        isPending: false,
        readOnly: false,
      }),
    );
    expect(router.state.location.pathname).toBe(`${PAGE}/${id}`);
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('opens Reschedule from `?mode=reschedule`', async () => {
    const id = ref.appointment(2861);
    renderAppointmentsRoutes(`${PAGE}/${id}?mode=reschedule`, Probe);
    await waitFor(() => expect(seen()).toMatchObject({ mode: 'reschedule', seq: 2861 }));
  });

  it('sends an unknown or malformed id back to the page, filters kept, with "Appointment not found" (S:115)', async () => {
    for (const id of [ref.appointment(1), 'not-an-id']) {
      notifyMock.info.mockReset();
      const { router, unmount } = renderAppointmentsRoutes(
        `${PAGE}/${id}?view=week&status=all&mode=reschedule`,
        Probe,
      );
      await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
      expect(router.state.location.search).toEqual({ view: 'week', status: 'all' });
      expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
        'Appointment not found · it may have been deleted',
      );
      expect(seen()).toEqual({ kind: 'none' });
      unmount();
    }
  });

  it('opens New appointment with the prefill — the page’s day and its one doctor included', async () => {
    const who = ref.appointment(5);
    renderAppointmentsRoutes(
      `${PAGE}/create?view=day&date=2026-10-05&doctor=${DOCTOR}&time=10:15&who=${who}&source=task&from=nowhere`,
      Probe,
    );
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'create',
        prefill: {
          time: '10:15',
          who,
          source: 'task',
          from: 'nowhere',
          date: '2026-10-05',
          doctorId: DOCTOR,
        },
      }),
    );
  });

  it('closes a drawer back to the page with the page’s params only', async () => {
    const id = ref.appointment(2861);
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${id}?view=month&q=rhea&mode=reschedule`,
      Probe,
    );
    await waitFor(() => expect(seen()).toMatchObject({ seq: 2861 }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'month', q: 'rhea' });
  });

  it('closes back to the room it came from (A-P1), never anywhere off the list', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/create?from=today&time=11:00`,
      Probe,
    );
    await waitFor(() => expect(seen()).toMatchObject({ kind: 'create' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );

    const off = renderAppointmentsRoutes(`${PAGE}/create?from=settings/billing`, Probe);
    await waitFor(() => expect(seen()).toMatchObject({ kind: 'create' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(off.router.state.location.pathname).toBe(PAGE));
  });

  it('reads the drawer read-only without Edit, and refuses a create link without Create', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'organization:delete']);
    useUIStore.getState().setPreviewRole('therapist');
    const id = ref.appointment(2861);
    const drawer = renderAppointmentsRoutes(`${PAGE}/${id}`, Probe);
    await waitFor(() => expect(seen()).toMatchObject({ seq: 2861, readOnly: true }));
    drawer.unmount();

    const { router } = renderAppointmentsRoutes(`${PAGE}/create?view=day`, Probe);
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'day' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'You do not have permission to perform this action.',
    );
    expect(seen()).toEqual({ kind: 'none' });
  });
});
