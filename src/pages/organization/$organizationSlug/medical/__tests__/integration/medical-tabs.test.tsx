import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { ManufacturersPage } from '../../manufacturers/ManufacturersPage.tsx';
import { MedicinesPage } from '../../medicines/MedicinesPage.tsx';
import { MrsPage } from '../../mrs/MrsPage.tsx';
import { MedicalPaymentsPage } from '../../payments/MedicalPaymentsPage.tsx';
import { PurchasesPage } from '../../purchases/PurchasesPage.tsx';
import { SalesPage } from '../../sales/SalesPage.tsx';
import { SuppliersPage } from '../../suppliers/SuppliersPage.tsx';
import { renderMedicalRoutes, resetMedicalRoutes } from './medical-test-router.tsx';

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
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: csv.downloadCsv,
}));

const PAGES = {
  sales: SalesPage,
  medicines: MedicinesPage,
  purchases: PurchasesPage,
  suppliers: SuppliersPage,
  manufacturers: ManufacturersPage,
  mrs: MrsPage,
  payments: MedicalPaymentsPage,
};
const ROOM = '/organization/acme/medical';

const rows = (tab: string) => screen.getAllByTestId(`medical-${tab}-table-row`);
const rowOf = (tab: string, text: string) => {
  const row = rows(tab).find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('Medical › Sales (KICKOFF §6.7)', () => {
  it('lists the sales with their bills and statuses, the count and the end line', async () => {
    const { container } = renderMedicalRoutes(`${ROOM}/sales`, PAGES);
    await waitFor(() => expect(rows('sales')).toHaveLength(3));
    expect(screen.getByRole('heading', { level: 1, name: 'Medical' })).toBeVisible();
    const unpaid = rowOf('sales', 'Dharti Galani');
    expect(unpaid).toHaveTextContent('#978');
    expect(unpaid).toHaveTextContent('Unpaid');
    expect(unpaid).toHaveTextContent('₹563');
    expect(rowOf('sales', 'Viral Sheth')).toHaveTextContent('Medical contact');
    expect(rowOf('sales', 'Rhea Shah')).toHaveTextContent('Batches: ASC002, CSH26044');
    expect(screen.getByTestId('medical-sales-table-footer')).toHaveTextContent('3 sales');
    expect(screen.getByTestId('medical-sales-table-end')).toHaveTextContent(
      'All sales loaded',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('filters by Status through the URL, and opens the sale or its return', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/sales?status=unpaid`, PAGES);
    await waitFor(() => expect(rows('sales')).toHaveLength(1));
    await user.click(within(rowOf('sales', '#978')).getByText('Dharti Galani'));
    const sale = ref.medicalSale(978);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/sales/${sale}`),
    );
    // The list keeps its filter behind the drawer, and Close goes back to it.
    expect(router.state.location.search).toMatchObject({ status: 'unpaid' });
    await user.click(await screen.findByTestId('sale-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/sales`));
    expect(router.state.location.search).toMatchObject({ status: 'unpaid' });
    await user.click(
      within(rowOf('sales', '#978')).getByTestId('medical-sales-row-action-return'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/sales/${sale}/return`),
    );
  });
});

describe('Medical › Medicines', () => {
  it('lists every medicine with its stock, nearest expiry and margin', async () => {
    renderMedicalRoutes(`${ROOM}/medicines`, PAGES);
    await waitFor(() => expect(rows('medicines')).toHaveLength(9));
    const glycolac = rowOf('medicines', 'Glycolac Cream');
    expect(glycolac).toHaveTextContent('3 in stock · OK');
    expect(glycolac).toHaveTextContent('026-312');
    expect(rowOf('medicines', 'Trichospire Hair Kit')).toHaveTextContent('No stock');
    expect(rowOf('medicines', 'Arganlif Hair Serum')).toHaveTextContent('Low');
    // "Best rate" is hidden by default (H:4160); the ID and the name always show.
    expect(screen.getByTestId('medical-medicines-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 5 of 6 shown',
    );
    // Medicines leaves the footer count blank (`medical.md:19`).
    expect(screen.getByTestId('medical-medicines-table-footer')).not.toHaveTextContent(
      /medicines/,
    );
  });

  it('turns the near-expiry discount on for every expiring medicine, with Undo', async () => {
    const user = userEvent.setup();
    renderMedicalRoutes(`${ROOM}/medicines?expiry=90`, PAGES);
    await waitFor(() => expect(rows('medicines').length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('medical-medicines-view-action-discount'));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        '20% off on expiring medicines',
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('medical-medicines-view-action-discount'),
      ).toHaveAccessibleName('Remove near-expiry discount'),
    );
    const discounted = clinicFixtures.medicines.snapshot(
      (medicine) => medicine.nearExpiryDiscountPct === 20,
    );
    expect(discounted.length).toBeGreaterThan(0);
  });

  it('reorders low stock into a new purchase order', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/medicines?stock=low`, PAGES);
    await waitFor(() => expect(rows('medicines').length).toBeGreaterThan(0));
    for (const row of rows('medicines')) expect(row).toHaveTextContent(/Low|Out/);
    await user.click(screen.getByTestId('medical-medicines-view-action-reorder'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/create`),
    );
    expect(router.state.location.search).toMatchObject({ reorder: 'low' });
  });
});

describe('Medical › Purchases', () => {
  it('opens an Ordered order for editing and a received one as its view', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/purchases`, PAGES);
    await waitFor(() => expect(rows('purchases')).toHaveLength(3));
    expect(screen.getByTestId('medical-purchases-table-footer')).toHaveTextContent(
      '3 orders',
    );
    const ordered = rowOf('purchases', 'T-82370');
    expect(ordered).toHaveTextContent('Ordered');
    await user.click(within(ordered).getByText('K R Medical Agency'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/purchases/${ref.purchaseOrder(430)}/edit`,
      ),
    );
    await user.click(await screen.findByTestId('purchase-order-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/purchases`));
    await user.click(
      within(rowOf('purchases', '1631')).getByTestId('medical-purchases-row-action-view'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/purchases/${ref.purchaseOrder(431)}`,
      ),
    );
  });
});

describe('Medical › Suppliers, Manufacturers and MRs', () => {
  it('counts the suppliers and what is owed on received orders', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/suppliers`, PAGES);
    await waitFor(() => expect(rows('suppliers')).toHaveLength(4));
    expect(screen.getByTestId('medical-suppliers-table-footer')).toHaveTextContent(
      '4 suppliers · ₹2,980 payable',
    );
    const owed = rowOf('suppliers', 'Shree Ramdev Medical Agency');
    expect(owed).toHaveTextContent('₹2,980');
    expect(owed).toHaveTextContent(' day');
    expect(rowOf('suppliers', 'NH Pharma')).toHaveTextContent('No orders');
    await user.click(
      within(rowOf('suppliers', 'NH Pharma')).getByTestId(
        'medical-suppliers-row-action-new-order',
      ),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/create`),
    );
    expect(router.state.location.search).toMatchObject({ supplier: ref.supplier(59) });
  });

  it('lists each maker with its medicines, suppliers and MRs', async () => {
    renderMedicalRoutes(`${ROOM}/manufacturers`, PAGES);
    await waitFor(() => expect(rows('manufacturers')).toHaveLength(6));
    expect(rowOf('manufacturers', 'ALVI')).toHaveTextContent('1 medicine');
    expect(rowOf('manufacturers', 'ALVI')).toHaveTextContent('Alvio Pharma · Rakesh');
    expect(screen.getByTestId('medical-manufacturers-table-footer')).toHaveTextContent(
      '6 manufacturers',
    );
  });

  it('logs an MR visit from the row', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/mrs`, PAGES);
    await waitFor(() => expect(rows('mrs')).toHaveLength(3));
    expect(screen.getByTestId('medical-mrs-table-footer')).toHaveTextContent('3 MRs');
    await user.click(
      within(rowOf('mrs', 'Rakesh')).getByTestId('medical-mrs-row-action-log-visit'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/mrs/${ref.medicalRep(1)}/visits/create`,
      ),
    );
  });
});

describe('the Medical toolbar', () => {
  it('links the seven tabs and offers every other create, grouped', async () => {
    const user = userEvent.setup();
    const { router } = renderMedicalRoutes(`${ROOM}/suppliers`, PAGES);
    await waitFor(() => expect(rows('suppliers')).toHaveLength(4));
    const nav = screen.getByRole('navigation', { name: 'Medical sections' });
    expect(within(nav).getByRole('link', { name: 'Suppliers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('medical-suppliers-new')).toHaveTextContent('New supplier');
    await user.click(screen.getByTestId('medical-suppliers-new-menu'));
    const menu = await screen.findByTestId('medical-suppliers-new-menu-panel');
    expect(
      within(menu)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'New sale',
      'New medicine',
      'New purchase order',
      'New MR',
      'New manufacturer',
    ]);
    expect(within(menu).getByRole('group', { name: 'Buying' })).toBeInTheDocument();
    await user.click(within(menu).getByRole('option', { name: 'New medicine' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/medicines/create`),
    );
  });

  it('shows Payments the room toolbar over its ledger', async () => {
    renderMedicalRoutes(`${ROOM}/payments`, PAGES);
    expect(await screen.findByTestId('medical-payments-page')).toBeInTheDocument();
    expect(await screen.findByTestId('medical-payments-new')).toHaveTextContent(
      'New sale',
    );
  });

  it('leaves out the creates and edits a view-only role cannot use', async () => {
    renderMedicalRoutes(`${ROOM}/sales`, PAGES, { role: 'accountant' });
    await waitFor(() => expect(rows('sales')).toHaveLength(3));
    expect(screen.queryByTestId('medical-sales-new')).toBeNull();
    expect(screen.queryByTestId('medical-sales-row-action-return')).toBeNull();
  });
});
