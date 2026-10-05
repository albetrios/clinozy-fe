import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { CROSS_ROOM_PARAM } from '@/shared/clinic/clinic-referrer.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useCrossRoomDialog } from '@/shared/hooks/useCrossRoomDialog/index.ts';

import { CrossRoomDialogs } from './CrossRoomDialogs.tsx';
import { handOverToReferrer } from './dialog-routes.ts';

const { gate, notifyMock, probe } = vi.hoisted(() => ({
  gate: vi.fn<(manifest: { path: string }) => Promise<void>>(),
  notifyMock: { info: vi.fn() },
  /** A room's drawer host: what it reads of the drawer route, and its way out. */
  probe: (room: string) =>
    function RoomProbe() {
      const dialog = useCrossRoomDialog();
      return (
        <>
          <output data-testid={`probe-${room}`}>
            {JSON.stringify({
              pathname: dialog?.pathname,
              search: dialog?.search,
              params: dialog?.params,
            })}
          </output>
          <button type="button" onClick={() => dialog?.close()}>
            Close {room}
          </button>
        </>
      );
    },
}));

vi.mock('@/core/security/gateway.ts', () => ({
  gatewayFromManifest: (manifest: { path: string }) => () => gate(manifest),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/pages/organization/$organizationSlug/invoices/invoices.route.tsx', () => ({
  Component: probe('invoices'),
}));
vi.mock(
  '@/pages/organization/$organizationSlug/payments/components/PaymentsDrawers/index.ts',
  () => ({ PaymentsDialogHost: probe('payments') }),
);
vi.mock(
  '@/pages/organization/$organizationSlug/appointments/components/AppointmentDialog/index.ts',
  () => ({ AppointmentDialog: probe('appointments') }),
);
vi.mock(
  '@/pages/organization/$organizationSlug/medical/sales/components/SaleDrawers/index.ts',
  () => ({ SaleDrawers: probe('sales') }),
);

const TODAY = '/organization/acme/today';
const APPOINTMENT = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const NEW_INVOICE = clinicCommandNavigation('newInvoice', {
  organizationSlug: 'acme',
  referrer: 'today',
  search: { type: 'clinic' },
});

/** What a room's host reads of its drawer route. */
const read = (room: string) =>
  JSON.parse(screen.getByTestId(`probe-${room}`).textContent ?? '{}') as unknown;

/**
 * Today (its mounts counted, a button opening the Invoice drawer from it) with
 * the cross-room host beside it, as the org shell mounts it; the Invoice
 * drawer's own route hands over, as `dialogRoute(name)` makes it.
 */
function renderShell(
  url: string,
  history = createMemoryHistory({ initialEntries: [url] }),
) {
  const mounted = vi.fn();
  function Today() {
    const navigate = useClinicNavigate();
    useEffect(() => mounted(), []);
    return (
      <>
        <p data-testid="today-page">Today</p>
        <button type="button" onClick={() => void navigate(NEW_INVOICE)}>
          New invoice
        </button>
      </>
    );
  }
  const root = createRootRoute({
    component: () => (
      <>
        <Outlet />
        <CrossRoomDialogs />
      </>
    ),
  });
  const today = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/today',
    component: Today,
  });
  const invoiceCreate = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/invoices/create',
    beforeLoad: ({ location }) => handOverToReferrer(location),
    component: () => <p data-testid="payments-page">Payments</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([today, invoiceCreate]),
    history,
  });
  const view = render(<RouterProvider router={router} />);
  return { ...view, router, history, mounted };
}

beforeEach(() => {
  gate.mockReset().mockResolvedValue(undefined);
  notifyMock.info.mockReset();
});

describe('CrossRoomDialogs (KICKOFF §4, A-P1)', () => {
  it('renders nothing while the page names no drawer', async () => {
    renderShell(`${TODAY}?lane=checkout`);
    await screen.findByTestId('today-page');
    expect(screen.queryByTestId('probe-invoices')).toBeNull();
    expect(gate).not.toHaveBeenCalled();
  });

  it('opens the drawer over the page it came from, after its own gate, and closes back to the page as it was', async () => {
    const { router, mounted } = renderShell(`${TODAY}?lane=checkout`);
    await screen.findByTestId('today-page');
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));

    await waitFor(() =>
      expect(read('invoices')).toEqual({
        pathname: '/organization/acme/invoices/create',
        search: { type: 'clinic', from: 'today' },
        params: { organizationSlug: 'acme' },
      }),
    );
    expect(gate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        path: '/organization/$organizationSlug/invoices/create',
      }),
    );
    expect(router.history.location.href).toBe(
      '/organization/acme/invoices/create?type=clinic&from=today',
    );
    expect(screen.queryByTestId('payments-page')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close invoices' }));
    await waitFor(() => expect(screen.queryByTestId('probe-invoices')).toBeNull());
    expect(router.state.location.pathname).toBe(TODAY);
    expect(router.state.location.search).toEqual({ lane: 'checkout' });
    expect(router.history.location.href).toBe(`${TODAY}?lane=checkout`);
    expect(mounted).toHaveBeenCalledOnce();
  });

  it('refuses a drawer its gate denies: the permission toast, and the page alone', async () => {
    gate.mockRejectedValue(new Error('module off'));
    const { router } = renderShell(`${TODAY}?lane=checkout`);
    await screen.findByTestId('today-page');
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));

    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
        'You do not have permission to perform this action.',
      ),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ lane: 'checkout' }),
    );
    expect(screen.queryByTestId('probe-invoices')).toBeNull();
    expect(screen.getByTestId('today-page')).toBeInTheDocument();
  });

  it('hands a deep link of the drawer’s route over to the room it names — the URL bar keeps the link', async () => {
    const { router } = renderShell(
      '/organization/acme/invoices/create?type=clinic&from=today',
    );
    await screen.findByTestId('probe-invoices');
    expect(screen.getByTestId('today-page')).toBeInTheDocument();
    expect(screen.queryByTestId('payments-page')).toBeNull();
    expect(router.state.location.pathname).toBe(TODAY);
    expect(router.history.location.href).toBe(
      '/organization/acme/invoices/create?type=clinic&from=today',
    );
    // Without a room to keep, the drawer stays on its own route.
    const own = renderShell('/organization/acme/invoices/create?type=clinic');
    await waitFor(() =>
      expect(own.router.state.location.pathname).toBe(
        '/organization/acme/invoices/create',
      ),
    );
  });

  it('keeps the drawer over the page through a refresh', async () => {
    const first = renderShell(`${TODAY}?lane=checkout`);
    await screen.findByTestId('today-page');
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    await screen.findByTestId('probe-invoices');
    first.unmount();

    // A reload reads the same history entry — its mask included.
    const reloaded = renderShell('', first.history);
    await screen.findByTestId('probe-invoices');
    expect(reloaded.router.state.location.pathname).toBe(TODAY);
    expect(reloaded.router.state.location.search).toMatchObject({ lane: 'checkout' });
  });

  it.each([
    ['payments/receive?from=today', 'payments', {}],
    [
      `appointments/${APPOINTMENT}?mode=reschedule&from=today`,
      'appointments',
      { appointmentId: APPOINTMENT },
    ],
    ['medical/sales/create?from=today', 'sales', {}],
  ] as const)('opens %s with its own room’s host', async (path, room, params) => {
    renderShell(`${TODAY}?${CROSS_ROOM_PARAM}=${encodeURIComponent(path)}`);
    await screen.findByTestId(`probe-${room}`);
    expect(read(room)).toMatchObject({
      pathname: `/organization/acme/${path.split('?')[0] ?? ''}`,
      params: { organizationSlug: 'acme', ...params },
    });
  });
});
