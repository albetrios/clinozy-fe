import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { type ColumnDef, useTable } from '@tanstack/react-table';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';

import { type OfferingsTab, OfferingsToolbar } from './OfferingsToolbar.tsx';

interface Row {
  id: string;
  name: string;
}

const COLUMNS: ColumnDef<DataTableFeatures, Row>[] = [
  { id: 'name', accessorKey: 'name', header: 'Offering', enableHiding: false },
];

/** A toolbar over a one-column table, as a tab renders it. */
function Host({ tab, onNew }: { tab: OfferingsTab; onNew?: () => void }) {
  const table = useTable({ features: dataTableFeatures, data: [], columns: COLUMNS });
  return (
    <OfferingsToolbar
      tab={tab}
      tableId={tab}
      table={table}
      filters={{ fields: { created: { kind: 'date', presets: 'created' } }, copy: {} }}
      onNew={onNew}
    />
  );
}

/** The room's two tabs as routes, opened at `url`. */
function renderTabs(url: string, onNew?: () => void) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const offerings = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/offerings',
    component: () => <Host tab="offerings" onNew={onNew} />,
  });
  const offers = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/offerings/offers',
    component: () => <Host tab="offers" onNew={onNew} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([offerings, offers]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

describe('OfferingsToolbar (KICKOFF §6.11 Toolbar)', () => {
  it('heads the Offerings tab: h1, the two link tabs, its search and "New offering"', async () => {
    const onNew = vi.fn();
    const user = userEvent.setup();
    const { container } = renderTabs('/organization/acme/offerings', onNew);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Offerings' }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByTestId('offerings-tabs'));
    expect(tabs.getByRole('link', { name: 'Offerings' })).toHaveAttribute(
      'href',
      '/organization/acme/offerings',
    );
    expect(tabs.getByRole('link', { name: 'Offers' })).toHaveAttribute(
      'href',
      '/organization/acme/offerings/offers',
    );
    expect(screen.getByLabelText('Search offerings')).toHaveAttribute(
      'placeholder',
      'Search name or search term',
    );
    const button = screen.getByTestId('offerings-new-button');
    expect(button).toHaveTextContent('New offering');
    await user.click(button);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('heads the Offers tab with its own search and "New offer", the tab ids unchanged', async () => {
    renderTabs('/organization/acme/offerings/offers', vi.fn());
    expect(await screen.findByTestId('offerings-tab-offers')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByLabelText('Search offerings')).toHaveAttribute(
      'placeholder',
      'Search offers or codes',
    );
    expect(screen.getByTestId('offers-new-button')).toHaveTextContent('New offer');
  });

  it('hides the New button without access', async () => {
    renderTabs('/organization/acme/offerings');
    await screen.findByTestId('offerings-tabs');
    expect(screen.queryByTestId('offerings-new-button')).not.toBeInTheDocument();
  });

  it('follows a tab to its route', async () => {
    const user = userEvent.setup();
    const { router } = renderTabs('/organization/acme/offerings');
    await user.click(await screen.findByRole('link', { name: 'Offers' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/offerings/offers'),
    );
  });
});
