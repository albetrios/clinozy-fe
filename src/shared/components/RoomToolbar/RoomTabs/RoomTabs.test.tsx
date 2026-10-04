import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { House, Wallet } from '@/shared/icons/index.ts';

import { type RoomLinkTab, RoomTabs, RoomViewTabs } from './RoomTabs.tsx';

const measured = vi.hoisted(() => ({ width: 0 }));
vi.mock('@/shared/hooks/useElementWidth/index.ts', () => ({
  useElementWidth: () => [() => undefined, measured.width],
}));
const viewport = vi.hoisted(() => ({
  tier: 'desktop' as 'phone' | 'tablet' | 'desktop',
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

/** Medical's tabs (H:4155); without a canvas each label measures 7.5px a character. */
const MEDICAL_TABS: RoomLinkTab[] = [
  { id: 'sales', label: 'Sales', to: '/medical/sales' },
  { id: 'medicines', label: 'Medicines', to: '/medical/medicines' },
  { id: 'purchases', label: 'Purchases', to: '/medical/purchases' },
  { id: 'suppliers', label: 'Suppliers', to: '/medical/suppliers' },
  {
    id: 'manufacturers',
    label: 'Manufacturers',
    to: '/medical/manufacturers',
    group: 'Buying',
  },
  {
    id: 'representatives',
    label: 'MRs',
    to: '/medical/representatives',
    group: 'Buying',
  },
  { id: 'payments', label: 'Payments', to: '/medical/payments', group: 'Money' },
];

/** The tabs over the room's child routes, at `path`. */
function renderRoom(path: string, tabs: ReactElement) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        {tabs}
        <Outlet />
      </>
    ),
  });
  const pages = MEDICAL_TABS.map((tab) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: tab.to,
      component: () => <p>{tab.label} page</p>,
    }),
  );
  const create = createRoute({
    getParentRoute: () => rootRoute,
    path: '/medical/sales/create',
    component: () => <p>New sale</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([...pages, create]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...view };
}

const medical = (overflow?: 'scroll' | 'fold') => (
  <RoomTabs
    label="Medical sections"
    tabs={MEDICAL_TABS}
    overflow={overflow}
    testIdPrefix="medical"
  />
);

beforeEach(() => {
  measured.width = 0;
  viewport.tier = 'desktop';
});

describe('RoomTabs', () => {
  it('links each tab to its child route and marks the current one, children included', async () => {
    renderRoom('/medical/sales/create', medical());
    const nav = await screen.findByRole('navigation', { name: 'Medical sections' });
    const sales = within(nav).getByRole('link', { name: 'Sales' });
    expect(sales).toHaveAttribute('href', '/medical/sales');
    expect(sales).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Payments' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByTestId('medical-tab-sales')).toBe(sales);
  });

  it('marks the deepest tab current when one tab’s URL holds another’s (Offerings)', async () => {
    const tabs: RoomLinkTab[] = [
      { id: 'offerings', label: 'Offerings', to: '/offerings' },
      { id: 'offers', label: 'Offers', to: '/offerings/offers' },
    ];
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <RoomTabs label="Offerings views" tabs={tabs} testIdPrefix="offerings" />
          <Outlet />
        </>
      ),
    });
    const routes = ['/offerings', '/offerings/offers', '/offerings/offers/create'].map(
      (path) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => <p>{path}</p>,
        }),
    );
    const router = createRouter({
      routeTree: rootRoute.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ['/offerings/offers/create'] }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    const offers = await screen.findByRole('link', { name: 'Offers' });
    expect(offers).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Offerings' })).not.toHaveAttribute(
      'aria-current',
    );
    await router.navigate({ to: '/offerings' });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Offerings' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(screen.getByRole('link', { name: 'Offers' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('moves the current tab when another is followed', async () => {
    const user = userEvent.setup();
    const { router } = renderRoom('/medical/sales', medical());
    await user.click(await screen.findByRole('link', { name: 'Purchases' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/medical/purchases'),
    );
    expect(screen.getByRole('link', { name: 'Purchases' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Sales' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('marks the most specific tab when one tab’s route sits under another’s (Users)', async () => {
    const tabs: RoomLinkTab[] = [
      { id: 'team', label: 'Team', to: '/users' },
      { id: 'roles', label: 'Roles & access', to: '/users/roles' },
      { id: 'branches', label: 'Branches', to: '/users/branches' },
    ];
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <RoomTabs label="Users views" tabs={tabs} testIdPrefix="users" />
          <Outlet />
        </>
      ),
    });
    const routes = ['/users', '/users/roles', '/users/branches', '/users/create'].map(
      (path) =>
        createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
    );
    const at = (path: string) =>
      createRouter({
        routeTree: rootRoute.addChildren(routes),
        history: createMemoryHistory({ initialEntries: [path] }),
      });
    const view = render(<RouterProvider router={at('/users/roles')} />);
    expect(await screen.findByRole('link', { name: 'Roles & access' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Team' })).not.toHaveAttribute(
      'aria-current',
    );
    view.unmount();

    render(<RouterProvider router={at('/users/create')} />);
    expect(await screen.findByRole('link', { name: 'Team' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('takes the current tab from `current` when the URL alone can’t say', async () => {
    // A drawer route rendering another tab's page behind it (Users' member
    // drawer over Roles): the URL sits under one tab, the page is another's.
    renderRoom(
      '/medical/sales/create',
      <RoomTabs
        label="Medical sections"
        tabs={MEDICAL_TABS}
        testIdPrefix="medical"
        current="payments"
      />,
    );
    expect(await screen.findByRole('link', { name: 'Payments' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Sales' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('folds what does not fit into "More", keeping the current tab (H:4003–4007)', async () => {
    // 380px: budget 380 − 8 − 78 = 294 → Medicines 91.5 · Sales 63.5 · Purchases 93.5; Suppliers stops it.
    measured.width = 380;
    const user = userEvent.setup();
    const { router } = renderRoom('/medical/medicines', medical('fold'));
    const nav = await screen.findByRole('navigation', { name: 'Medical sections' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Sales', 'Medicines', 'Purchases']);

    const more = within(nav).getByRole('button', { name: 'More sections' });
    expect(more).toHaveTextContent('More');
    await user.click(more);
    const list = await screen.findByTestId('medical-tabs-more-panel');
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Suppliers', 'Manufacturers', 'MRs', 'Payments']);
    // Grouped as the room groups its sections (H:4007).
    expect(
      within(within(list).getByRole('group', { name: 'Buying' })).getAllByRole('option'),
    ).toHaveLength(2);

    await user.click(within(list).getByRole('option', { name: 'Suppliers' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/medical/suppliers'),
    );
    // The current tab stays visible: Suppliers now shows, Purchases folds.
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Sales', 'Medicines', 'Suppliers']);
    expect(within(nav).getByRole('link', { name: 'Suppliers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the current tab alone beside "More" on a phone (`medical.md:17`)', async () => {
    measured.width = 351;
    viewport.tier = 'phone';
    renderRoom('/medical/purchases', medical('fold'));
    const nav = await screen.findByRole('navigation', { name: 'Medical sections' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Purchases']);
    expect(within(nav).getByRole('button', { name: 'More sections' })).toBeVisible();
  });

  it('shows every tab when they fit, and never folds a scrolling row', async () => {
    measured.width = 380;
    renderRoom('/medical/sales', medical('scroll'));
    const nav = await screen.findByRole('navigation', { name: 'Medical sections' });
    expect(within(nav).getAllByRole('link')).toHaveLength(MEDICAL_TABS.length);
    expect(within(nav).queryByRole('button', { name: 'More sections' })).toBeNull();
  });

  it('folds nothing before the row is measured', async () => {
    renderRoom('/medical/sales', medical('fold'));
    const nav = await screen.findByRole('navigation', { name: 'Medical sections' });
    expect(within(nav).getAllByRole('link')).toHaveLength(MEDICAL_TABS.length);
  });

  it('has no accessibility violations', async () => {
    measured.width = 380;
    const { container } = renderRoom('/medical/sales', medical('fold'));
    await screen.findByRole('navigation', { name: 'Medical sections' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('RoomViewTabs', () => {
  function Views({ onValueChange = vi.fn() }: { onValueChange?: (id: string) => void }) {
    const [value, setValue] = useState('all');
    return (
      <>
        <RoomViewTabs
          label="Patient views"
          value={value}
          onValueChange={(id) => {
            setValue(id);
            onValueChange(id);
          }}
          controls="patients-list"
          testIdPrefix="patients"
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'today', label: 'In clinic today', icon: House },
            {
              id: 'dues',
              label: 'With dues',
              icon: Wallet,
              badge: <span data-testid="dues-count">2</span>,
            },
          ]}
        />
        <div id="patients-list">Rows</div>
      </>
    );
  }

  it('is a tablist of the views, the current one selected', () => {
    render(<Views />);
    const list = screen.getByRole('tablist', { name: 'Patient views' });
    expect(within(list).getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(list).getByRole('tab', { name: /With dues/ })).toContainElement(
      screen.getByTestId('dues-count'),
    );
    expect(screen.getByTestId('patients-tab-today')).toHaveAttribute(
      'aria-controls',
      'patients-list',
    );
  });

  it('moves with the arrows and opens a view only on Enter (no refetch per arrow)', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<Views onValueChange={onValueChange} />);
    await user.click(screen.getByRole('tab', { name: 'All' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'In clinic today' })).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('today');
    expect(screen.getByRole('tab', { name: 'In clinic today' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Views />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
