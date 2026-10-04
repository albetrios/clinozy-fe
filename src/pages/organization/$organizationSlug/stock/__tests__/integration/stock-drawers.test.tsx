import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { ItemsPage } from '../../items/ItemsPage.tsx';
import { MovementsPage } from '../../movements/MovementsPage.tsx';
import { PurchasesPage } from '../../purchases/PurchasesPage.tsx';
import { VendorsPage } from '../../vendors/VendorsPage.tsx';
import { renderStockRoutes, resetStockRoutes } from './stock-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const PAGES = {
  items: ItemsPage,
  purchases: PurchasesPage,
  movements: MovementsPage,
  vendors: VendorsPage,
};
const ROOM = '/organization/acme/stock';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const rowOf = (tab: string, text: string) => {
  const row = screen
    .getAllByTestId(`stock-${tab}-table-row`)
    .find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};
/** The row's action buttons, by id. */
const actionsOf = (tab: string, text: string) =>
  within(rowOf(tab, text))
    .queryAllByTestId(/-row-action-/)
    .map((button) => button.dataset.testid?.split('-row-action-')[1]);
const action = (tab: string, text: string, id: string) =>
  within(rowOf(tab, text)).getByTestId(`stock-${tab}-row-action-${id}`);

/** Open a tab and wait for `text` in its rows. */
async function openTab(
  tab: keyof typeof PAGES,
  text: string,
  role?: 'therapist' | 'accountant',
) {
  const view = renderStockRoutes(`${ROOM}/${tab}`, PAGES, role ? { role } : {});
  await waitFor(() => expect(rowOf(tab, text)).toBeInTheDocument());
  return view;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  viewport.tier = 'desktop';
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('Clinic stock › Items row actions (clinic-stock.md:34)', () => {
  it('offers Use · Receive stock · Log usage… · Adjust count · Edit · Delete to Admin', async () => {
    await openTab('items', 'Soframycin');
    expect(actionsOf('items', 'Soframycin')).toEqual([
      'use',
      'receive',
      'log',
      'adjust',
      'edit',
      'delete',
    ]);
  });

  it('a member who uses stock gets Use and Log usage…; a viewer only Edit', async () => {
    const therapist = await openTab('items', 'Soframycin', 'therapist');
    await waitFor(() =>
      expect(actionsOf('items', 'Soframycin')).toEqual(['use', 'log', 'edit']),
    );
    therapist.unmount();
    await openTab('items', 'Soframycin', 'accountant');
    await waitFor(() => expect(actionsOf('items', 'Soframycin')).toEqual(['edit']));
  });

  it('Use opens the popover at the row; the use moves the stock and its runway', async () => {
    const user = setup();
    await openTab('items', 'Soframycin');
    expect(rowOf('items', 'Soframycin')).toHaveTextContent('~6 weeks');
    await user.click(action('items', 'Soframycin', 'use'));
    const popover = await screen.findByTestId('stock-use-popover');
    await user.click(within(popover).getByTestId('stock-use-popover-save'));
    await waitFor(() =>
      expect(rowOf('items', 'Soframycin')).toHaveTextContent('2 tube · 60 g · OK'),
    );
    // 2 tubes at half a tube a week: four weeks left.
    expect(rowOf('items', 'Soframycin')).toHaveTextContent('~4 weeks');
    expect(notifyMock.undo).toHaveBeenCalledWith(
      '1 tube of Soframycin 30 gm used · 2 tube left',
      expect.anything(),
    );
  });

  it('an item out of stock never opens the popover', async () => {
    const user = setup();
    await openTab('items', 'D-Tan Mask');
    await user.click(action('items', 'D-Tan Mask', 'use'));
    expect(notifyMock.info).toHaveBeenCalledWith('D-Tan Mask is out of stock');
    expect(screen.queryByTestId('stock-use-popover')).not.toBeInTheDocument();
  });

  it('"More details" moves the use into the Log usage drawer', async () => {
    const user = setup();
    await openTab('items', 'Soframycin');
    await user.click(action('items', 'Soframycin', 'use'));
    await user.click(await screen.findByTestId('stock-use-popover-more-details'));
    const drawer = await screen.findByTestId('stock-movement-drawer');
    expect(within(drawer).getByTestId('stock-movement-drawer-title')).toHaveTextContent(
      'Log usage',
    );
    await waitFor(() =>
      expect(screen.queryByTestId('stock-use-popover')).not.toBeInTheDocument(),
    );
  });

  it('Receive stock, Log usage… and Adjust count open the movement drawer on their type', async () => {
    const user = setup();
    await openTab('items', 'Soframycin');
    const titles: [string, string][] = [
      ['receive', 'Receive stock'],
      ['log', 'Log usage'],
      ['adjust', 'Adjust stock'],
    ];
    for (const [id, title] of titles) {
      await user.click(action('items', 'Soframycin', id));
      const drawer = await screen.findByTestId('stock-movement-drawer');
      expect(within(drawer).getByTestId('stock-movement-drawer-title')).toHaveTextContent(
        title,
      );
      await user.click(within(drawer).getByTestId('stock-movement-drawer-dismiss'));
      await waitFor(() =>
        expect(
          screen.queryByTestId('stock-movement-drawer')?.getAttribute('data-state') ??
            'closed',
        ).toBe('closed'),
      );
    }
  });

  it('a row’s Delete asks for a reason, then the item leaves the list', async () => {
    const user = setup();
    await openTab('items', 'Fucibet');
    await user.click(action('items', 'Fucibet', 'delete'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this item?');
    await user.click(within(confirm).getByRole('radio', { name: 'No longer needed' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId('stock-items-table-row')
          .some((row) => row.textContent?.includes('Fucibet')),
      ).toBe(false),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Fucibet removed', expect.anything());
  });
});

describe('Clinic stock › the drawers on their routes (KICKOFF §6.8 Routes)', () => {
  it('opens New item named from the URL, then closes back to the list', async () => {
    const user = setup();
    const { router } = renderStockRoutes(`${ROOM}/items/create?name=Cotton&q=co`, PAGES);
    const drawer = await screen.findByTestId('stock-item-drawer');
    expect(within(drawer).getByTestId('stock-item-drawer-name')).toHaveValue('Cotton');
    await user.click(within(drawer).getByTestId('stock-item-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/items`));
    expect(router.state.location.search).toMatchObject({ q: 'co' });
  });

  it('a row opens Edit item; Stock check opens from its route', async () => {
    const user = setup();
    const { router } = await openTab('items', 'Soframycin');
    await user.click(within(rowOf('items', 'Soframycin')).getByText('Soframycin 30 gm'));
    const drawer = await screen.findByTestId('stock-item-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('stock-item-drawer-tag')).toHaveTextContent(
        '#167',
      ),
    );

    await router.navigate({ to: `${ROOM}/items/check` });
    const check = await screen.findByTestId('stock-check-drawer');
    await waitFor(() =>
      expect(within(check).getByTestId('stock-check-drawer-counter')).toHaveTextContent(
        '0 of 10 counted',
      ),
    );
  });

  it('`purchases/create?reorder=low` opens the reordered purchase; a row deletes one', async () => {
    const user = setup();
    renderStockRoutes(`${ROOM}/purchases/create?reorder=low`, PAGES);
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-purchase-drawer-lines-row')).toHaveLength(2),
    );
    await user.click(screen.getByTestId('stock-purchase-drawer-dismiss'));
    await waitFor(() => expect(rowOf('purchases', 'Cranix')).toBeInTheDocument());

    await user.click(action('purchases', 'Cranix', 'delete'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this purchase?');
    expect(confirm).toHaveTextContent('Cranix Pharma');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Purchase #15 deleted',
        expect.anything(),
      ),
    );
  });

  it('Edit purchase opens from its route with the bill', async () => {
    renderStockRoutes(`${ROOM}/purchases/${ref.stockPurchase(16)}/edit`, PAGES);
    await waitFor(() =>
      expect(screen.getByTestId('stock-purchase-drawer-tag')).toHaveTextContent('#16'),
    );
  });
});

describe('Clinic stock › Movements Revert (clinic-stock.md:65)', () => {
  it('reverts a use; both rows lose Revert and the new one says what it undid', async () => {
    const user = setup();
    await openTab('movements', 'Noprik');
    await user.click(action('movements', 'Noprik', 'revert'));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: 'Logged by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Revert' }));
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-movements-table-row')[0]).toHaveTextContent(
        /Reverts used of .+ · Logged by mistake/,
      ),
    );
    const [reverting, original] = screen
      .getAllByTestId('stock-movements-table-row')
      .filter((row) => row.textContent?.includes('Noprik'));
    expect(
      within(reverting as HTMLElement).queryByTestId(/-row-action-revert/),
    ).toBeNull();
    expect(
      within(original as HTMLElement).queryByTestId(/-row-action-revert/),
    ).toBeNull();
    expect(original).toHaveTextContent('Reverted');
    // A payment is never reverted.
    expect(
      within(rowOf('movements', 'Shivam Water')).queryByTestId(/-row-action-revert/),
    ).toBeNull();
  });

  it('only a member with Stock Delete reverts', async () => {
    await openTab('movements', 'Noprik', 'therapist');
    await waitFor(() => expect(actionsOf('movements', 'Noprik')).toEqual([]));
  });
});

describe('Clinic stock › Vendors (Q-K1)', () => {
  it('Delete shows only for a vendor nothing is owed; New clinic vendor opens from its route', async () => {
    const user = setup();
    const { router } = await openTab('vendors', 'Ibreia');
    expect(actionsOf('vendors', 'Ibreia')).toEqual(['edit', 'delete']);
    expect(actionsOf('vendors', 'Cranix')).toEqual(['edit']);

    await user.click(action('vendors', 'Ibreia', 'delete'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this clinic vendor?');
    await user.click(within(confirm).getByRole('button', { name: 'Keep it' }));

    await router.navigate({ to: `${ROOM}/vendors/create`, search: { name: 'Ankit' } });
    const drawer = await screen.findByTestId('stock-vendor-drawer');
    expect(within(drawer).getByTestId('stock-vendor-drawer-name')).toHaveValue('Ankit');
    await user.click(within(drawer).getByTestId('stock-vendor-drawer-save'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/vendors`));
    expect(
      clinicFixtures.stockVendors.snapshot((vendor) => vendor.name === 'Ankit'),
    ).toHaveLength(1);
  });

  it('Edit clinic vendor opens from its route once the vendor loads', async () => {
    renderStockRoutes(`${ROOM}/vendors/${ref.stockVendor(4)}/edit`, PAGES);
    // The pending drawer gives way to the form once the vendor is in.
    await waitFor(() =>
      expect(screen.getByTestId('stock-vendor-drawer-name')).toHaveValue('Ibreia'),
    );
  });
});
