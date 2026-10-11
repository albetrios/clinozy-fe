import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import {
  appointmentQueryKeys,
  fetchAppointment,
} from '@/shared/api/app/appointments-api.ts';
import {
  type CrossRoomDialog,
  CrossRoomDialogContext,
} from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  contactHit,
  DOCTOR_NISHA,
} from '@/tests/utils/appointment-doubles.ts';

import {
  type AppointmentsWorld,
  KABIR_BOOKING,
  publicId,
  RIYA_BOOKING,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  grantAppAccess,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import {
  type AppointmentsDialogRoute,
  useAppointmentsDialogRoute,
} from './useAppointmentsDialogRoute.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { info: vi.fn(), success: vi.fn(), error: vi.fn(), undo: vi.fn() },
}));

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});

const PAGE = '/organization/acme/appointments';
const RIYA = RIYA_BOOKING.id;
const WHO = contactHit().id;
const NOT_FOUND = 'Appointment not found · it may have been deleted';
const NO_PERMISSION = 'You do not have permission to perform this action.';

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
      <button type="button" onClick={() => close()}>
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
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => vi.useRealTimers());

describe('useAppointmentsDialogRoute', () => {
  it('opens nothing on the page itself', async () => {
    renderAppointmentsRoutes(PAGE, Probe);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'none' });
    expect(fetchAppointment).not.toHaveBeenCalled();
  });

  it('opens the drawer on a deep link, the booking read once into the organization’s detail entry', async () => {
    const { router, queryClient } = renderAppointmentsRoutes(
      `${PAGE}/${RIYA}?view=day`,
      Probe,
    );
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'appointment',
        appointmentId: RIYA,
        mode: 'edit',
        seq: 2861,
        isPending: false,
        readOnly: false,
      }),
    );
    expect(fetchAppointment).toHaveBeenCalledExactlyOnceWith(RIYA);
    expect(
      queryClient.getQueryData(appointmentQueryKeys.detail('org_test', RIYA)),
    ).toMatchObject({ id: RIYA, seq: 2861 });
    expect(router.state.location.pathname).toBe(`${PAGE}/${RIYA}`);
    expect(notify.info).not.toHaveBeenCalled();
  });

  it('opens the drawer before the booking arrives — the same drawer fills in', async () => {
    let release: () => void = () => {};
    vi.mocked(fetchAppointment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(structuredClone(KABIR_BOOKING));
        }),
    );
    renderAppointmentsRoutes(`${PAGE}/${KABIR_BOOKING.id}`, Probe);
    await waitFor(() =>
      expect(seen()).toMatchObject({ kind: 'appointment', seq: null, isPending: true }),
    );
    release();
    await waitFor(() => expect(seen()).toMatchObject({ seq: 2862, isPending: false }));
  });

  it('opens Reschedule from `?mode=reschedule`', async () => {
    renderAppointmentsRoutes(`${PAGE}/${RIYA}?mode=reschedule`, Probe);
    await waitFor(() => expect(seen()).toMatchObject({ mode: 'reschedule', seq: 2861 }));
  });

  it('sends an unknown or malformed id back to the page, filters kept, with "Appointment not found" (S:115)', async () => {
    for (const id of [publicId('appt', 'gone'), 'not-an-id']) {
      vi.mocked(notify.info).mockClear();
      const { router, unmount } = renderAppointmentsRoutes(
        `${PAGE}/${id}?view=week&status=all&mode=reschedule`,
        Probe,
      );
      await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
      expect(router.state.location.search).toEqual({ view: 'week', status: 'all' });
      expect(notify.info).toHaveBeenCalledExactlyOnceWith(NOT_FOUND);
      expect(seen()).toEqual({ kind: 'none' });
      unmount();
    }
  });

  it('opens New appointment with the prefill — the contact, the page’s day and its one doctor', async () => {
    renderAppointmentsRoutes(
      `${PAGE}/create?view=day&date=2026-10-05&doctor=${DOCTOR_NISHA.id}&time=10:15&who=${WHO}&source=task&from=nowhere`,
      Probe,
    );
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'create',
        prefill: {
          time: '10:15',
          who: WHO,
          source: 'task',
          from: 'nowhere',
          date: '2026-10-05',
          doctorId: DOCTOR_NISHA.id,
        },
      }),
    );
  });

  it('copies through `copyOf`, a booking’s public id', async () => {
    renderAppointmentsRoutes(`${PAGE}/create?copyOf=${KABIR_BOOKING.id}`, Probe);
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'create',
        prefill: { copyOf: KABIR_BOOKING.id },
      }),
    );
  });

  it('closes a drawer back to the page with the page’s params only', async () => {
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${RIYA}?view=month&q=riya&mode=reschedule`,
      Probe,
    );
    await waitFor(() => expect(seen()).toMatchObject({ seq: 2861 }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'month', q: 'riya' });
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
    grantAppAccess('none');
    const drawer = renderAppointmentsRoutes(`${PAGE}/${RIYA}`, Probe);
    await waitFor(() => expect(seen()).toMatchObject({ seq: 2861, readOnly: true }));
    drawer.unmount();

    const { router } = renderAppointmentsRoutes(`${PAGE}/create?view=day`, Probe);
    await waitFor(() => expect(router.state.location.pathname).toBe(PAGE));
    expect(router.state.location.search).toEqual({ view: 'day' });
    expect(notify.info).toHaveBeenCalledExactlyOnceWith(NO_PERMISSION);
    expect(seen()).toEqual({ kind: 'none' });
  });
});

describe('useAppointmentsDialogRoute over another room (A-P1)', () => {
  const TODAY = '/organization/acme/today';

  /** Today with the Probe on it, reading the booking from the drawer route the host provides. */
  function overToday(dialog: CrossRoomDialog) {
    return function TodayWithBooking() {
      return (
        <CrossRoomDialogContext.Provider value={dialog}>
          <Probe />
        </CrossRoomDialogContext.Provider>
      );
    };
  }
  const drawer = (path: string, search: Record<string, unknown>, close: () => void) => ({
    pathname: `${PAGE}/${path}`,
    search,
    params: {
      organizationSlug: 'acme',
      ...(path === 'create' ? {} : { appointmentId: path }),
    },
    close,
  });

  it('reads the booking from the drawer’s own route — the page behind has no say — and closes back to it', async () => {
    const close = vi.fn();
    const { router } = renderAppointmentsRoutes(`${TODAY}?lane=waiting`, Probe, {
      Today: overToday(
        drawer('create', { who: WHO, source: 'task', from: 'today' }, close),
      ),
    });
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'create',
        prefill: { who: WHO, source: 'task', from: 'today' },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe(TODAY);
  });

  it('goes back to the page behind on a dead booking link, and on a create link without Create', async () => {
    const close = vi.fn();
    const missing = renderAppointmentsRoutes(TODAY, Probe, {
      Today: overToday(drawer(publicId('appt', 'gone'), { from: 'today' }, close)),
    });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(notify.info).toHaveBeenCalledExactlyOnceWith(NOT_FOUND);
    missing.unmount();

    vi.mocked(notify.info).mockClear();
    close.mockReset();
    grantAppAccess('none');
    renderAppointmentsRoutes(TODAY, Probe, {
      Today: overToday(drawer('create', { from: 'today' }, close)),
    });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(seen()).toEqual({ kind: 'none' });
    expect(notify.info).toHaveBeenCalledExactlyOnceWith(NO_PERMISSION);
  });
});
