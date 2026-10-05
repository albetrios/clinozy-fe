import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { renderPaymentsRoutes, resetPaymentsRoutes } from './payments-test-router.tsx';

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
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: csv.downloadCsv,
}));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const LEDGER = '/organization/acme/payments';
const PENDING = '/organization/acme/payments/pending';

const rows = (prefix = 'payments') => screen.getAllByTestId(`${prefix}-table-row`);
const rowOf = (text: string, prefix = 'payments') => {
  const row = rows(prefix).find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetPaymentsRoutes();
  resetClinicFixtures();
});

describe('the Payments ledger (KICKOFF §6.9)', () => {
  it('lists the ledger newest first under the toolbar, ending "All entries loaded"', async () => {
    const { container } = renderPaymentsRoutes(LEDGER);
    await waitFor(() => expect(rows()).toHaveLength(16));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payments' }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByTestId('payments-tabs'));
    expect(tabs.getByTestId('payments-tab-ledger')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(tabs.getByTestId('payments-tab-pending')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('payments-day-close')).toHaveTextContent('Day close');
    expect(screen.getByTestId('payments-pay')).toHaveAttribute(
      'title',
      'Pay · money out (rent, supplies, vendors, refunds)',
    );
    expect(screen.getByTestId('payments-receive')).toHaveAttribute(
      'title',
      'Receive · money in from a patient',
    );
    expect(screen.getByTestId('payments-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 6 of 6 shown',
    );
    expect(screen.getByTestId('payments-table-end')).toHaveTextContent(
      'All entries loaded',
    );
    expect(rows()[0]).toHaveTextContent('PAY-5509');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('words each entry: What, When, From / to with its sub line, Mode, signed Amount, By', async () => {
    renderPaymentsRoutes(LEDGER);
    await waitFor(() => expect(rows()).toHaveLength(16));
    const tea = rowOf('PAY-310');
    expect(tea).toHaveTextContent('Paid');
    // Today reads its time alone (the rooms' one time rule).
    expect(tea).toHaveTextContent('11:05');
    expect(tea).not.toHaveTextContent('Today');
    expect(tea).toHaveTextContent('Tea & snacks');
    expect(tea).toHaveTextContent('Misc');
    expect(tea).toHaveTextContent('Cash');
    expect(tea).toHaveTextContent('− ₹260');
    const rhea = rowOf('PAY-5512');
    expect(rhea).toHaveTextContent('Received');
    expect(rhea).toHaveTextContent('Sale · Invoice #785');
    expect(rhea).toHaveTextContent('+ ₹600');
    expect(rhea).toHaveTextContent('Farah A.');
    expect(rowOf('PAY-5466')).toHaveTextContent('Refund · Credit note · Charged twice');
  });

  it('opens an open day’s entry; a closed day’s answers "PAY-305 · Day closed"', async () => {
    const user = userEvent.setup();
    const { router } = renderPaymentsRoutes(LEDGER);
    await waitFor(() => expect(rows()).toHaveLength(16));
    await user.click(within(rowOf('PAY-305')).getByText('Soprano service'));
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-305 · Day closed');
    expect(router.state.location.pathname).toBe(LEDGER);
    await user.click(within(rowOf('PAY-310')).getByText('Tea & snacks'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${LEDGER}/${ref.payment(310)}/edit`),
    );
  });

  it('offers Edit and Delete on an open day only; Delete confirms with the ledger’s reasons', async () => {
    const user = userEvent.setup();
    renderPaymentsRoutes(LEDGER);
    await waitFor(() => expect(rows()).toHaveLength(16));
    expect(
      within(rowOf('PAY-305')).queryByTestId('payments-row-action-delete'),
    ).not.toBeInTheDocument();
    await user.click(within(rowOf('PAY-5512')).getByTestId('payments-row-action-delete'));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete this payment?',
    });
    expect(dialog).toHaveTextContent('PAY-5512');
    expect(dialog).toHaveTextContent(
      'Allowed until the day is closed. Invoice #785 goes back to ₹1,300 due. The deletion is kept in the audit log.',
    );
    const reasons = within(dialog)
      .getAllByRole('radio')
      .map((radio) => radio.textContent);
    expect(reasons).toEqual([
      'Entered twice',
      'Wrong amount',
      'Wrong patient or payee',
      'Other',
    ]);
    expect(await axeForDialog(dialog)).toHaveNoViolations();
    await user.click(within(dialog).getByRole('radio', { name: 'Entered twice' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rows()).toHaveLength(15));
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'PAY-5512 removed · invoice balance restored',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });

  it('filters through the URL: Show, What, Mode and the search', async () => {
    renderPaymentsRoutes(`${LEDGER}?direction=paid&mode=cash`);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows().map((row) => row.textContent?.match(/PAY-\d+/)?.[0])).toEqual([
      'PAY-310',
      'PAY-306',
    ]);
    expect(screen.getByTestId('payments-filters-trigger')).toHaveTextContent('2');
  });

  it('says so when nothing matches, and Clear filters empties the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderPaymentsRoutes(`${LEDGER}?kind=money_back`);
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('kind'));
  });

  it('opens Receive, Pay and Day close by their routes', async () => {
    const user = userEvent.setup();
    const { router } = renderPaymentsRoutes(LEDGER);
    await waitFor(() => expect(rows()).toHaveLength(16));
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
  });

  it('opens an open day’s receipt in Receive and its expense in Send, each as an edit', async () => {
    const user = userEvent.setup();
    const { router } = renderPaymentsRoutes(LEDGER);
    await waitFor(() => expect(rows()).toHaveLength(16));
    await user.click(within(rowOf('PAY-5512')).getByText('Rhea Shah'));
    const receive = await screen.findByTestId('receive-drawer');
    expect(within(receive).getByText('Edit payment in')).toBeInTheDocument();
    await user.click(screen.getByTestId('receive-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    await user.click(within(rowOf('PAY-310')).getByText('Tea & snacks'));
    const send = await screen.findByTestId('pay-drawer');
    expect(within(send).getByText('Edit payment out')).toBeInTheDocument();
  });

  it('lists only the reviewed day while Day close is open', async () => {
    renderPaymentsRoutes(`${LEDGER}/day-close?date=2026-10-02`);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[0]).toHaveTextContent('PAY-306');
  });

  it('exports the selected rows as CSV', async () => {
    const user = userEvent.setup();
    renderPaymentsRoutes(LEDGER, { role: 'accountant' });
    await waitFor(() => expect(rows()).toHaveLength(16));
    await user.click(within(rowOf('PAY-310')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(csv.downloadCsv).toHaveBeenCalledWith(
      'payments.csv',
      expect.stringContaining('PAY-310'),
    );
    // A sheet outlives the day: When is the full date and time, not "11:05 AM".
    expect(String(csv.downloadCsv.mock.calls[0]?.[1])).toMatch(/2026/);
    expect(notifyMock.success).toHaveBeenCalledWith('1 row exported as CSV');
  });

  it('hides Pay and Receive without Create, Delete without Delete', async () => {
    renderPaymentsRoutes(LEDGER, { role: 'doctor' });
    await waitFor(() => expect(rows()).toHaveLength(16));
    expect(screen.queryByTestId('payments-pay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payments-receive')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payments-row-action-delete')).not.toBeInTheDocument();
  });

  it('floats Pay and Receive as pills on a phone', async () => {
    viewport.tier = 'phone';
    renderPaymentsRoutes(LEDGER);
    await waitFor(() => expect(rows()).toHaveLength(16));
    const fab = screen.getByTestId('payments-fab');
    expect(within(fab).getByTestId('payments-pay')).toHaveTextContent('Pay');
    expect(within(fab).getByTestId('payments-receive')).toHaveTextContent('Receive');
  });
});

describe('Payments › Pending (KICKOFF §6.9)', () => {
  it('lists the credits with Pending current, ending "All pending loaded"', async () => {
    const { container } = renderPaymentsRoutes(PENDING);
    await waitFor(() => expect(rows('payments-pending')).toHaveLength(2));
    expect(screen.getByTestId('payments-pending-tab-pending')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('payments-pending-tab-ledger')).not.toHaveAttribute(
      'aria-current',
    );
    const tanvi = rowOf('CR-2', 'payments-pending');
    expect(tanvi).toHaveTextContent('Tanvi Shah');
    expect(tanvi).toHaveTextContent('Patient');
    expect(tanvi).toHaveTextContent('Give');
    expect(tanvi).toHaveTextContent('₹500');
    expect(tanvi).toHaveTextContent('From PAY-5466 · Paid');
    expect(tanvi).toHaveTextContent('Open');
    expect(rowOf('CR-1', 'payments-pending')).toHaveTextContent('Supplier / party');
    expect(screen.getByTestId('payments-pending-table-end')).toHaveTextContent(
      'All pending loaded',
    );
    expect(screen.getByTestId('payments-pending-add')).toHaveTextContent('Add pending');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens an open credit; Give / Take name the way through `direction`', async () => {
    const user = userEvent.setup();
    const { router } = renderPaymentsRoutes(PENDING);
    await waitFor(() => expect(rows('payments-pending')).toHaveLength(2));
    await user.click(within(rowOf('CR-2', 'payments-pending')).getByText('Tanvi Shah'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${PENDING}/${ref.pendingCredit(2)}/edit`,
      ),
    );
    await router.navigate({ to: PENDING });
    await user.click(screen.getByTestId('payments-pending-new-menu'));
    await user.click(await screen.findByRole('option', { name: /^Give/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${PENDING}/create`));
    expect(router.state.location.search).toMatchObject({ direction: ['give'] });
  });

  it('opens Add pending and Edit pending by their routes, and Back closes them', async () => {
    const user = userEvent.setup();
    const { router } = renderPaymentsRoutes(`${PENDING}/create?direction=take`);
    const drawer = await screen.findByTestId('credit-drawer');
    expect(within(drawer).getByText('Add pending')).toBeInTheDocument();
    expect(screen.getByTestId('credit-drawer-save')).toHaveTextContent(
      'Save · take later',
    );
    await user.click(screen.getByTestId('credit-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(PENDING));
    await waitFor(() => expect(screen.queryByTestId('credit-drawer')).toBeNull());

    await router.navigate({ to: `${PENDING}/${ref.pendingCredit(2)}/edit` });
    expect(await screen.findByText('Edit pending')).toBeInTheDocument();
    expect(screen.getByTestId('credit-drawer-tag')).toHaveTextContent('CR-2');
  });

  it('gives back from the row — a stacked drawer with no URL — and the row reads Returned', async () => {
    const user = userEvent.setup();
    const { router } = renderPaymentsRoutes(PENDING);
    await waitFor(() => expect(rows('payments-pending')).toHaveLength(2));
    expect(
      within(rowOf('CR-1', 'payments-pending')).getByTestId(
        'payments-pending-row-action-settle',
      ),
    ).toHaveAccessibleName('Got it back');
    expect(
      within(rowOf('CR-1', 'payments-pending')).queryByTestId(
        'payments-pending-row-action-use-on-bill',
      ),
    ).toBeNull();
    const settle = within(rowOf('CR-2', 'payments-pending')).getByTestId(
      'payments-pending-row-action-settle',
    );
    expect(settle).toHaveAccessibleName('Give back');
    await user.click(settle);
    const drawer = await screen.findByTestId('settle-credit-drawer');
    expect(router.state.location.pathname).toBe(PENDING);
    expect(within(drawer).getByText('Give back')).toBeInTheDocument();
    await user.click(screen.getByTestId('settle-credit-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        '₹500 given back to Tanvi Shah · Out entry added',
      ),
    );
    await waitFor(() =>
      expect(rowOf('CR-2', 'payments-pending')).toHaveTextContent('Returned · Today'),
    );
  });

  it('uses a give credit on the next bill: "Adjusted · Invoice #772"', async () => {
    const user = userEvent.setup();
    renderPaymentsRoutes(PENDING);
    await waitFor(() => expect(rows('payments-pending')).toHaveLength(2));
    const use = within(rowOf('CR-2', 'payments-pending')).getByTestId(
      'payments-pending-row-action-use-on-bill',
    );
    expect(use).toHaveAccessibleName('Use on next bill');
    await user.click(use);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        '₹500 of CR-2 adjusted on invoice #772',
      ),
    );
    await waitFor(() =>
      expect(rowOf('CR-2', 'payments-pending')).toHaveTextContent(
        'Adjusted · Invoice #772',
      ),
    );
  });

  it('keeps Give back from a role without the refund ability (Q-U8)', async () => {
    // A counsellor writes payments but holds no `refund`.
    renderPaymentsRoutes(PENDING, { role: 'counsellor' });
    await waitFor(() => expect(rows('payments-pending')).toHaveLength(2));
    expect(
      within(rowOf('CR-2', 'payments-pending')).queryByTestId(
        'payments-pending-row-action-settle',
      ),
    ).toBeNull();
    expect(
      within(rowOf('CR-1', 'payments-pending')).getByTestId(
        'payments-pending-row-action-settle',
      ),
    ).toHaveAccessibleName('Got it back');
  });

  it('deletes a credit with the reason confirm, offering Undo', async () => {
    const user = userEvent.setup();
    renderPaymentsRoutes(PENDING);
    await waitFor(() => expect(rows('payments-pending')).toHaveLength(2));
    await user.click(
      within(rowOf('CR-1', 'payments-pending')).getByTestId(
        'payments-pending-row-action-delete',
      ),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete this pending?',
    });
    expect(dialog).toHaveTextContent('Medline Surgicals');
    await user.click(within(dialog).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rows('payments-pending')).toHaveLength(1));
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'CR-1 deleted',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });
});
