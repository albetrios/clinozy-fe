import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { fetchMedicalSale } from '../shared/medical-api.ts';
import { SalesPage } from './SalesPage.tsx';

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const ROOM = '/organization/acme/medical/sales';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  printMock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
  resetClinicFixtures();
});

/** The Sales tab at `url`, its rows loaded. */
async function renderSales(url = ROOM, role?: 'admin' | 'pharmacist' | 'accountant') {
  const view = renderMedicalRoutes(url, { sales: SalesPage }, role ? { role } : {});
  await waitFor(() =>
    expect(screen.getAllByTestId('medical-sales-table-row')).toHaveLength(3),
  );
  return view;
}

describe('SalesPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All sales loaded"', async () => {
    const { container } = await renderSales();
    expect(screen.getByTestId('medical-sales-page')).toHaveTextContent('Rhea Shah');
    expect(screen.getByTestId('medical-sales-table-end')).toHaveTextContent(
      'All sales loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-sales-tab-sales',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers Collect, Return and Void on the unpaid sale; Collect records its due', async () => {
    const user = setup();
    await renderSales();
    const collect = screen.getByTestId('medical-sales-row-action-collect');
    expect(collect).toHaveAccessibleName('Collect ₹563');
    expect(screen.getAllByTestId('medical-sales-row-action-return')).toHaveLength(3);
    expect(screen.getAllByTestId('medical-sales-row-action-void')).toHaveLength(1);
    await user.click(collect);
    await waitFor(async () =>
      expect((await fetchMedicalSale(ref.medicalSale(978))).status).toBe('paid'),
    );

    await user.click(
      screen.getAllByTestId('medical-sales-row-action-return')[0] as HTMLElement,
    );
    expect(await screen.findByTestId('sale-return-drawer')).toBeInTheDocument();
  });

  it('asks for a reason before voiding', async () => {
    const user = setup();
    await renderSales();
    await user.click(screen.getByTestId('medical-sales-row-action-void'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Void this sale?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Dharti Galani');
  });

  it('a Pharmacist collects and returns but never voids; an Accountant only looks', async () => {
    const first = await renderSales(ROOM, 'pharmacist');
    expect(screen.getByTestId('medical-sales-row-action-collect')).toBeInTheDocument();
    expect(screen.queryByTestId('medical-sales-row-action-void')).not.toBeInTheDocument();
    first.unmount();
    await renderSales(ROOM, 'accountant');
    expect(
      screen.queryByTestId('medical-sales-row-action-collect'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('medical-sales-row-action-return'),
    ).not.toBeInTheDocument();
  });

  it('opens the Sale over the list from a row, and Return from patient from its URL', async () => {
    const user = setup();
    const { router } = await renderSales();
    const rows = screen.getAllByTestId('medical-sales-table-row');
    await user.click(rows[0] as HTMLElement);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/${ref.medicalSale(983)}`),
    );
    const drawer = await screen.findByTestId('sale-drawer');
    expect(drawer).toHaveTextContent('Rhea Shah');
    await user.click(within(drawer).getByTestId('sale-drawer-save'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/${ref.medicalSale(983)}/return`,
      ),
    );
    expect(await screen.findByTestId('sale-return-drawer')).toBeInTheDocument();
  });

  it('"Prescriptions to fill" opens New sale on the one picked', async () => {
    const user = setup();
    const { router } = await renderSales();
    await user.click(
      await screen.findByTestId('medical-sales-view-action-prescriptions'),
    );
    const panel = await screen.findByTestId('prescriptions-to-fill-panel');
    const [newest] = within(panel).getAllByRole('option');
    await user.click(newest as HTMLElement);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/create`));
    expect(router.state.location.search).toMatchObject({
      prescription: ref.prescription(501),
    });
  });

  it('shows no "Prescriptions to fill" with a Status set', async () => {
    renderMedicalRoutes(`${ROOM}?status=unpaid`, { sales: SalesPage });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-sales-table-row')).toHaveLength(1),
    );
    expect(
      screen.queryByTestId('medical-sales-view-action-prescriptions'),
    ).not.toBeInTheDocument();
  });

  it('New sale is the Invoice drawer with Medical locked, closing back to the room it came from', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(`${ROOM}/create?from=today`, {
      sales: SalesPage,
    });
    const drawer = await screen.findByTestId('invoice-drawer');
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'New sale',
    );
    await user.click(within(drawer).getByTestId('invoice-drawer-dismiss'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
  });

  it('New sale without a referrer closes onto the Sales list', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(`${ROOM}/create`, { sales: SalesPage });
    const drawer = await screen.findByTestId('invoice-drawer');
    await user.click(within(drawer).getByTestId('invoice-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(ROOM));
  });

  it('prints a sale’s invoice on the A4 sheet', async () => {
    const user = setup();
    await renderSales();
    const [print] = screen.getAllByTestId('medical-sales-row-action-print');
    expect(print).toHaveAccessibleName('Print');
    await user.click(print as HTMLElement);
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
  });
});
