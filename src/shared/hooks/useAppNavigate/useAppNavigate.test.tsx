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
import { describe, expect, it, vi } from 'vitest';

import {
  type AppCommandNavigation,
  appCommandNavigation,
} from '@/shared/app/app-command-targets.ts';
import { CROSS_ROOM_PARAM } from '@/shared/app/app-referrer.ts';

import { useAppNavigate } from './useAppNavigate.ts';

const TODAY = '/organization/acme/today';

/**
 * Today with its lane in the URL, counting its mounts, and a button per
 * navigation; the Invoice drawer's and New lead's routes beside it.
 */
function renderApp(go: Record<string, AppCommandNavigation>) {
  const mounted = vi.fn();
  function Today() {
    const navigate = useAppNavigate();
    useEffect(() => mounted(), []);
    return (
      <>
        <p data-testid="today-page">Today</p>
        {Object.entries(go).map(([label, navigation]) => (
          <button key={label} type="button" onClick={() => void navigate(navigation)}>
            {label}
          </button>
        ))}
      </>
    );
  }
  const root = createRootRoute({ component: () => <Outlet /> });
  const today = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/today',
    component: Today,
  });
  const invoices = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/invoices/create',
    component: () => <p data-testid="invoice-route">Invoice route</p>,
  });
  const leads = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/leads/create',
    component: () => <p data-testid="lead-route">New lead</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([today, invoices, leads]),
    history: createMemoryHistory({ initialEntries: [`${TODAY}?lane=checkout`] }),
  });
  render(<RouterProvider router={router} />);
  return { router, mounted };
}

const NEW_INVOICE = (referrer: string | null) =>
  appCommandNavigation('newInvoice', {
    organizationSlug: 'acme',
    referrer,
    search: { type: 'clinic' },
  });

describe('useAppNavigate (KICKOFF §4, A-P1)', () => {
  it('opens another room’s drawer over the page it came from: the page stays, the URL bar shows the drawer', async () => {
    const { router, mounted } = renderApp({ invoice: NEW_INVOICE('today') });
    await screen.findByTestId('today-page');
    fireEvent.click(screen.getByRole('button', { name: 'invoice' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        lane: 'checkout',
        [CROSS_ROOM_PARAM]: 'invoices/create?type=clinic&from=today',
      }),
    );
    expect(router.state.location.pathname).toBe(TODAY);
    expect(router.history.location.href).toBe(
      '/organization/acme/invoices/create?type=clinic&from=today',
    );
    expect(screen.getByTestId('today-page')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-route')).toBeNull();
    expect(mounted).toHaveBeenCalledOnce();

    // Back is the page alone — still the same mount.
    router.history.back();
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ lane: 'checkout' }),
    );
    expect(router.history.location.href).toBe(`${TODAY}?lane=checkout`);
    expect(mounted).toHaveBeenCalledOnce();
  });

  it('goes as given to its own room, without a referrer, and anywhere else', async () => {
    const { router } = renderApp({
      own: NEW_INVOICE('payments'),
      none: NEW_INVOICE(null),
      lead: appCommandNavigation('newLead', { organizationSlug: 'acme' }),
    });
    await screen.findByTestId('today-page');
    for (const [button, testId] of [
      ['own', 'invoice-route'],
      ['none', 'invoice-route'],
      ['lead', 'lead-route'],
    ] as const) {
      router.history.push(TODAY);
      await screen.findByTestId('today-page');
      fireEvent.click(screen.getByRole('button', { name: button }));
      await screen.findByTestId(testId);
      expect(router.state.location.maskedLocation).toBeUndefined();
      expect(router.state.location.search).not.toHaveProperty(CROSS_ROOM_PARAM);
    }
  });
});
