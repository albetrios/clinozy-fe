import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import i18n from '@/lib/i18n/i18n.ts';
import type * as PaymentsApiModule from '@/shared/api/app/payments-api.ts';
import {
  deletePayment,
  fetchLedgerCount,
  fetchPayment,
  listLedger,
  listOpenSupplierBills,
  reversePayment,
} from '@/shared/api/app/payments-api.ts';
import type { LedgerListParams } from '@/shared/api/app/payments-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { ledgerRow, TEST_PAYMENT_ID } from '@/tests/utils/payments-doubles.ts';

import {
  LEDGER_NOW,
  ledgerWorld,
  seededLedger,
  SETTLED_EXPENSE,
} from './payments-ledger-data.ts';
import {
  PAYMENTS_OWNER_CODES,
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from './payments-test-router.tsx';

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

vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => {
  const { ledgerApiDouble } = await import('./payments-ledger-data.ts');
  const double = ledgerApiDouble();
  return {
    ...(await importOriginal<typeof PaymentsApiModule>()),
    listLedger: vi.fn(double.listLedger),
    fetchLedgerCount: vi.fn(double.fetchLedgerCount),
    fetchPayment: vi.fn(),
    deletePayment: vi.fn(),
    restorePayment: vi.fn(),
    reversePayment: vi.fn(),
    listOpenSupplierBills: vi.fn(),
  };
});

// Day close is its own package's drawer: here only that the ledger opens it.
vi.mock('../../components/DayCloseDrawer/index.ts', () => ({
  DayCloseDrawer: () => <section data-testid="day-close-drawer" />,
}));

const LEDGER = '/organization/acme/payments';

const rows = () => screen.getAllByTestId('payments-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};
const words = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: 'payments', ...options });

/** The params of the last ledger read. */
const lastParams = (): LedgerListParams => {
  const params = vi.mocked(listLedger).mock.lastCall?.[0];
  if (!params) throw new Error('the ledger was never read');
  return params;
};

/** The ledger as an Owner — or a member holding `codes`. */
const open = (
  url = LEDGER,
  codes: readonly OrganizationPermission[] = PAYMENTS_OWNER_CODES,
) => renderPaymentsRoutes(url, { permissions: codes });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(LEDGER_NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  ledgerWorld.rows = seededLedger();
  vi.mocked(listLedger).mockClear();
  vi.mocked(fetchLedgerCount).mockClear();
  vi.mocked(fetchPayment).mockReset();
  vi.mocked(deletePayment).mockReset();
  vi.mocked(reversePayment).mockReset();
  vi.mocked(listOpenSupplierBills).mockReset().mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
  resetPaymentsRoutes();
});

describe('the Payments ledger on clinozy-be (KICKOFF §6.9)', () => {
  it('lists the ledger newest first under the toolbar, with the API’s count and "All entries loaded"', async () => {
    const { container } = open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    const tabs = within(screen.getByTestId('payments-tabs'));
    expect(tabs.getByTestId('payments-tab-ledger')).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The gates answer once the member's access resolves.
    expect(await screen.findByTestId('payments-day-close')).toHaveTextContent(
      'Day close',
    );
    expect(screen.getByTestId('payments-pay')).toBeInTheDocument();
    expect(screen.getByTestId('payments-receive')).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent('PAY-15');
    expect(screen.getByTestId('payments-table-footer')).toHaveTextContent(
      words('ledger.count', { count: 6 }),
    );
    expect(screen.getByTestId('payments-table-end')).toHaveTextContent(
      'All entries loaded',
    );
    // The search finds the person, the payee or a PAY- number — not an invoice number.
    expect(screen.getByRole('searchbox', { name: 'Search payments' })).toHaveAttribute(
      'placeholder',
      words('ledger.search'),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('words each entry: What, When, From / to with its sub line, Mode, signed rupees, By', async () => {
    open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    const tea = rowOf('PAY-310');
    expect(tea).toHaveTextContent('Paid');
    expect(tea).toHaveTextContent(`Today ${fsi('10:15 AM')}`);
    expect(tea).toHaveTextContent('Tea & snacks');
    expect(tea).toHaveTextContent('Misc');
    expect(tea).toHaveTextContent('− ₹260');
    const kavya = rowOf('PAY-5');
    expect(kavya).toHaveTextContent('Received');
    expect(kavya).toHaveTextContent('Kavya Mehta');
    expect(kavya).toHaveTextContent('Invoice #5');
    expect(kavya).toHaveTextContent('Edited 1× · last ₹100 Cash → ₹150 Cash + UPI');
    expect(kavya).toHaveTextContent('+ ₹150');
    expect(kavya).toHaveTextContent('Nisha Shah');
    expect(rowOf('PAY-15')).toHaveTextContent('Stock PO #2 · bill ZZ-INV-2');
    expect(rowOf('PAY-6')).toHaveTextContent('Invoice #5 · From CR-1');
  });

  it('names a reversal by the entry it undid, and marks that entry reversed', async () => {
    open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    const reversal = rowOf('PAY-9');
    expect(reversal).toHaveTextContent(words('kinds.reversal'));
    expect(reversal).toHaveTextContent('Soprano service');
    expect(reversal).toHaveTextContent('Wrong amount');
    expect(rowOf('PAY-305')).toHaveTextContent(words('ledger.sub.reversed'));
  });

  it('opens an open day’s entry; a closed day’s, a credit’s and a reversal’s say why not', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPayment).mockResolvedValue(ledgerRow());
    const { router } = open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    await user.click(within(rowOf('PAY-305')).getByText('Soprano service'));
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-305 · Day closed');
    await user.click(within(rowOf('PAY-6')).getByText('Kavya Mehta'));
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-6 · From CR-1');
    await user.click(within(rowOf('PAY-9')).getByText('Soprano service'));
    expect(notifyMock.info).toHaveBeenCalledWith(
      i18n.t('ledger.fixedEntry', { ns: 'payments', ref: 'PAY-9' }),
    );
    expect(router.state.location.pathname).toBe(LEDGER);
    await user.click(within(rowOf('PAY-5')).getByText('Kavya Mehta'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${LEDGER}/${TEST_PAYMENT_ID}/edit`),
    );
    expect(await screen.findByText('Edit payment in')).toBeInTheDocument();
  });

  it('offers Edit and Delete on an open day, Reverse on a closed one, none on a credit’s', async () => {
    open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    const actions = (text: string) =>
      within(rowOf(text))
        .queryAllByTestId(/^payments-row-action-/)
        .map((action) => action.getAttribute('data-testid'));
    expect(actions('PAY-310')).toEqual([
      'payments-row-action-edit',
      'payments-row-action-delete',
    ]);
    expect(actions('PAY-9')).toEqual(['payments-row-action-delete']);
    expect(actions('PAY-6')).toEqual([]);
    // PAY-305 is reversed already: nothing more to do.
    expect(actions('PAY-305')).toEqual([]);
  });

  it('deletes an open day’s entry with the ledger’s reasons, offering Undo', async () => {
    const user = userEvent.setup();
    vi.mocked(deletePayment).mockResolvedValue();
    open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    await user.click(within(rowOf('PAY-5')).getByTestId('payments-row-action-delete'));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete this payment?',
    });
    // Invoice #5's ₹100 due, with this receipt's ₹150 back on it.
    expect(dialog).toHaveTextContent(
      'Allowed until the day is closed. Invoice #5 goes back to ₹250 due. The deletion is kept in the audit log.',
    );
    expect(await axeForDialog(dialog)).toHaveNoViolations();
    await user.click(within(dialog).getByRole('radio', { name: 'Entered twice' }));
    ledgerWorld.rows = ledgerWorld.rows.filter((row) => row.id !== TEST_PAYMENT_ID);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(deletePayment).toHaveBeenCalledWith({
      paymentId: TEST_PAYMENT_ID,
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'PAY-5 removed · invoice balance restored',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });

  it('reverses a closed day’s entry from its row', async () => {
    const user = userEvent.setup();
    const settled = { ...SETTLED_EXPENSE, reversedByPaymentId: null };
    ledgerWorld.rows = [settled];
    vi.mocked(reversePayment).mockResolvedValue(ledgerRow({ seq: 16, kind: 'reversal' }));
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(within(rowOf('PAY-305')).getByTestId('payments-row-action-reverse'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent('PAY-305');
    await user.click(within(dialog).getByRole('radio', { name: 'Wrong amount' }));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(reversePayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: settled.id, reason: 'Wrong amount' }),
      ),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      words('reverseEntry.reversed', { ref: 'PAY-305', reversal: 'PAY-16' }),
    );
  });

  it('reads the URL’s filters and search: Show, What, Mode and q', async () => {
    open(`${LEDGER}?direction=paid&mode=cash&kind=expense&q=Kavya`);
    await waitFor(() => expect(listLedger).toHaveBeenCalled());
    expect(lastParams()).toMatchObject({
      direction: 'paid',
      mode: ['cash'],
      kind: ['expense'],
      q: 'Kavya',
    });
    expect(fetchLedgerCount).toHaveBeenLastCalledWith(lastParams());
    expect(screen.getByTestId('payments-filters-trigger')).toHaveTextContent('3');
  });

  it('says so when nothing matches, and Clear filters empties the URL', async () => {
    const user = userEvent.setup();
    ledgerWorld.rows = [];
    const { router } = open(`${LEDGER}?kind=money_back`);
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('kind'));
  });

  it('shows the error in place when the first read fails, and Retry reads again', async () => {
    const user = userEvent.setup();
    vi.mocked(listLedger).mockRejectedValueOnce(new Error('offline'));
    open();
    const retry = await screen.findByTestId('retry-button');
    await user.click(retry);
    await waitFor(() => expect(rows()).toHaveLength(6));
  });

  it('opens Receive, Pay and Day close by their routes', async () => {
    const user = userEvent.setup();
    const { router } = open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    await user.click(screen.getByTestId('payments-receive'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${LEDGER}/receive`));
    expect(await screen.findByTestId('receive-drawer')).toHaveTextContent(
      'Receive payment',
    );
    await user.click(screen.getByTestId('receive-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    await user.click(screen.getByTestId('payments-pay'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${LEDGER}/pay`));
    expect(await screen.findByTestId('pay-drawer')).toHaveTextContent('Send payment');
    await router.navigate({ to: LEDGER });
    await user.click(screen.getByTestId('payments-day-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${LEDGER}/day-close`),
    );
    expect(await screen.findByTestId('day-close-drawer')).toBeInTheDocument();
  });

  it('lists only the reviewed day while Day close is open', async () => {
    open(`${LEDGER}/day-close?date=2026-10-02`);
    await waitFor(() => expect(listLedger).toHaveBeenCalled());
    expect(lastParams()).toMatchObject({ day: '2026-10-02' });
  });

  it('exports the selected rows as CSV — signed rupees — with payment:export', async () => {
    const user = userEvent.setup();
    open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    await user.click(within(rowOf('PAY-310')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(csv.downloadCsv).toHaveBeenCalledWith(
      'payments.csv',
      expect.stringContaining('PAY-310'),
    );
    const sheet = String(csv.downloadCsv.mock.calls[0]?.[1]);
    // A sheet outlives the day: When is the full date and time.
    expect(sheet).toMatch(/2026/);
    expect(sheet).toContain('-260');
    expect(notifyMock.success).toHaveBeenCalledWith('1 row exported as CSV');
  });

  it('gates every control on its own code', async () => {
    const user = userEvent.setup();
    open(LEDGER, ['organization:read', 'payment:read']);
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(screen.queryByTestId('payments-pay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payments-receive')).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^payments-row-action-/)).not.toBeInTheDocument();
    expect(await screen.findByTestId('payments-day-close')).toBeInTheDocument();
    await user.click(within(rowOf('PAY-310')).getByRole('checkbox'));
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('floats Pay and Receive as pills on a phone', async () => {
    viewport.tier = 'phone';
    open();
    await waitFor(() => expect(rows()).toHaveLength(6));
    const fab = screen.getByTestId('payments-fab');
    expect(within(fab).getByTestId('payments-pay')).toHaveTextContent('Pay');
    expect(within(fab).getByTestId('payments-receive')).toHaveTextContent('Receive');
  });
});
