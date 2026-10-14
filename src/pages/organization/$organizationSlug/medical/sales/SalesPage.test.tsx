import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicalSales: vi.fn(),
  medicalListSummary: vi.fn(),
  fetchMedicalSale: vi.fn(),
  listSaleReminders: vi.fn(),
  listPrescriptionsToFill: vi.fn(),
}));
vi.mock('../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collectSale: vi.fn(),
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoice: vi.fn(),
}));
vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllMedicines: vi.fn(),
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));

import * as branchesApi from '@/shared/api/app/branches-api.ts';
import { fetchTeamDirectory } from '@/shared/api/app/directory-api.ts';
import { fetchInvoice } from '@/shared/api/app/invoices-api.ts';
import { fetchAllMedicines } from '@/shared/api/app/medicines-api.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  INVOICE_TEST_BRANCHES,
  INVOICE_TEST_TEAM,
  invoiceDetail,
} from '@/tests/utils/invoice-doubles.ts';
import {
  medicalPage,
  medicineRow,
  paidSaleRow,
  prescriptionToFill,
  saleRow,
  TEST_BUYER_CONTACT_ID,
  TEST_BUYER_PATIENT_ID,
  TEST_MEDICAL_AUTHOR_ID,
  TEST_PRESCRIPTION_ID,
  TEST_SALE_ID,
} from '@/tests/utils/medical-doubles.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import {
  fetchMedicalSale,
  listMedicalSales,
  listPrescriptionsToFill,
  listSaleReminders,
  medicalListSummary,
} from '../shared/medical-api.ts';
import { collectSale } from '../shared/medical-records-api.ts';
import { SalesPage } from './SalesPage.tsx';

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const ROOM = '/organization/acme/medical/sales';
const PAID_ID = 'msal_sale98300000000000000';
const RETURNED_ID = 'msal_sale97100000000000000';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** #978 to Priya Shah, unpaid; #983 to Rhea Shah, paid in full; #971 to Meera Joshi, partly returned. */
const UNPAID = saleRow();
const PAID = paidSaleRow({
  id: PAID_ID,
  seq: 983,
  customer: {
    id: 'con_rhea00000000000000000',
    name: 'Rhea Shah',
    phone: '+919825044120',
    patientId: 'pat_rhea00000000000000000',
  },
});
const RETURNED = paidSaleRow({
  id: RETURNED_ID,
  seq: 971,
  status: 'returned',
  returned: 650,
  customer: {
    id: 'con_meera0000000000000000',
    name: 'Meera Joshi',
    phone: null,
    patientId: null,
  },
});
const SALES = [PAID, UNPAID, RETURNED];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  printMock.mockReset();
  signInTestMember();
  vi.mocked(listMedicalSales).mockResolvedValue(medicalPage(SALES));
  vi.mocked(medicalListSummary).mockResolvedValue({ total: 3, payable: 0 });
  vi.mocked(fetchMedicalSale).mockImplementation(async (id) => {
    const sale = SALES.find((row) => row.id === id);
    if (!sale) throw new Error(`no sale ${id}`);
    return sale;
  });
  vi.mocked(listPrescriptionsToFill).mockResolvedValue([prescriptionToFill()]);
  vi.mocked(listSaleReminders).mockResolvedValue({
    clinicName: 'Cresence Skin',
    customers: [
      {
        customer: {
          id: TEST_BUYER_CONTACT_ID,
          name: 'Priya Shah',
          phone: '+919900011122',
          patientId: TEST_BUYER_PATIENT_ID,
        },
        due: 1300,
        sales: [{ id: TEST_SALE_ID, seq: 978, due: 1300, soldAt: UNPAID.soldAt }],
      },
    ],
  });
  vi.mocked(collectSale).mockResolvedValue(ledgerRow({ amount: 1300 }));
  vi.mocked(fetchInvoice).mockResolvedValue(invoiceDetail());
  vi.mocked(fetchAllMedicines).mockResolvedValue([medicineRow()]);
  vi.mocked(fetchTeamDirectory).mockResolvedValue(INVOICE_TEST_TEAM);
  vi.mocked(findMyMembershipId).mockResolvedValue(TEST_MEDICAL_AUTHOR_ID);
  vi.spyOn(branchesApi, 'fetchActiveBranches').mockResolvedValue(INVOICE_TEST_BRANCHES);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetMedicalRoutes();
  for (const fn of [
    listMedicalSales,
    medicalListSummary,
    fetchMedicalSale,
    listPrescriptionsToFill,
    listSaleReminders,
    collectSale,
    fetchInvoice,
    fetchAllMedicines,
    fetchTeamDirectory,
    findMyMembershipId,
  ]) {
    vi.mocked(fn).mockReset();
  }
});

/** The Sales tab at `url`, its rows loaded. */
async function renderSales(url = ROOM, role?: 'admin' | 'pharmacist' | 'accountant') {
  const view = renderMedicalRoutes(url, { sales: SalesPage }, role ? { role } : {});
  await waitFor(() =>
    expect(screen.getAllByTestId('medical-sales-table-row')).toHaveLength(3),
  );
  return view;
}

/** The row of the sale to `name`. */
const rowOf = (name: string) => {
  const row = screen
    .getAllByTestId('medical-sales-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
};

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
    expect(listMedicalSales).toHaveBeenCalledWith({}, undefined);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers Collect and Void on the unpaid sale, Return on those paid in full; Collect records its due', async () => {
    const user = setup();
    await renderSales();
    const collect = screen.getByTestId('medical-sales-row-action-collect');
    expect(collect).toHaveAccessibleName('Collect ₹1,300');
    expect(screen.getAllByTestId('medical-sales-row-action-return')).toHaveLength(2);
    expect(
      rowOf('Priya Shah').queryByTestId('medical-sales-row-action-return'),
    ).toBeNull();
    expect(screen.getAllByTestId('medical-sales-row-action-void')).toHaveLength(1);
    await user.click(collect);
    await waitFor(() =>
      expect(collectSale).toHaveBeenCalledWith(
        expect.objectContaining({ sale: UNPAID, mode: 'upi' }),
      ),
    );

    await user.click(rowOf('Rhea Shah').getByTestId('medical-sales-row-action-return'));
    expect(await screen.findByTestId('sale-return-drawer')).toBeInTheDocument();
  });

  it('asks for a reason before voiding', async () => {
    const user = setup();
    await renderSales();
    await user.click(screen.getByTestId('medical-sales-row-action-void'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Void this sale?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Priya Shah');
  });

  it('a Pharmacist collects but never returns or voids; an Accountant collects and returns (MD23)', async () => {
    const first = await renderSales(ROOM, 'pharmacist');
    expect(screen.getByTestId('medical-sales-row-action-collect')).toBeInTheDocument();
    expect(
      screen.queryByTestId('medical-sales-row-action-return'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('medical-sales-row-action-void')).not.toBeInTheDocument();
    first.unmount();
    await renderSales(ROOM, 'accountant');
    expect(screen.getByTestId('medical-sales-row-action-collect')).toBeInTheDocument();
    expect(screen.getAllByTestId('medical-sales-row-action-return')).toHaveLength(2);
    expect(screen.queryByTestId('medical-sales-row-action-void')).not.toBeInTheDocument();
  });

  it('opens the Sale over the list from a row, and Return from patient from its URL', async () => {
    const user = setup();
    const { router } = await renderSales();
    await user.click(rowOf('Rhea Shah').getByText('Rhea Shah'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/${PAID_ID}`),
    );
    const drawer = await screen.findByTestId('sale-drawer');
    expect(drawer).toHaveTextContent('Rhea Shah');
    await user.click(within(drawer).getByTestId('sale-drawer-save'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/${PAID_ID}/return`),
    );
    expect(await screen.findByTestId('sale-return-drawer')).toBeInTheDocument();
  });

  it('"Prescriptions to fill" opens New sale on the one picked — its patient’s contact and the prescription', async () => {
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
      prescription: TEST_PRESCRIPTION_ID,
      customer: TEST_BUYER_CONTACT_ID,
    });
  });

  it('filters by Status — Paid among them — and shows no "Prescriptions to fill" with one set', async () => {
    renderMedicalRoutes(`${ROOM}?status=paid`, { sales: SalesPage });
    await waitFor(() =>
      expect(listMedicalSales).toHaveBeenCalledWith({ status: 'paid' }, undefined),
    );
    expect(await screen.findByTestId('medical-sales-page')).toBeInTheDocument();
    expect(
      screen.queryByTestId('medical-sales-view-action-prescriptions'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('medical-sales-view-action-reminders'),
    ).not.toBeInTheDocument();
  });

  it('Unpaid offers "Send payment reminders" for the customers who owe (Q-M6)', async () => {
    const user = setup();
    const view = renderMedicalRoutes(`${ROOM}?status=unpaid`, { sales: SalesPage });
    await user.click(await screen.findByTestId('medical-sales-view-action-reminders'));
    const panel = await screen.findByTestId('payment-reminders');
    const [row] = within(panel).getAllByTestId('payment-reminders-row');
    expect(row).toHaveTextContent('Priya Shah');
    expect(row).toHaveTextContent(/₹1,300 due · Sale #978/);
    expect(listSaleReminders).toHaveBeenCalledWith({ status: 'unpaid' });
    view.unmount();

    // Returned has no view action.
    renderMedicalRoutes(`${ROOM}?status=returned`, { sales: SalesPage });
    expect(await screen.findByTestId('medical-sales-page')).toBeInTheDocument();
    expect(
      screen.queryByTestId('medical-sales-view-action-reminders'),
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
