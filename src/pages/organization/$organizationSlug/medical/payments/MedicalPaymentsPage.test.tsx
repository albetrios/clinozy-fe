import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStoreLedger: vi.fn(),
  exportStoreLedger: vi.fn(),
}));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: vi.fn(),
}));

import { downloadCsv } from '@/lib/csv.ts';
import { exportStoreLedger, listStoreLedger } from '@/shared/api/app/payments-api.ts';
import { ledgerRow, TEST_PAYMENT_ID } from '@/tests/utils/payments-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { MedicalPaymentsPage } from './MedicalPaymentsPage.tsx';

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

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const ROOM = '/organization/acme/medical/payments';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** The store's receipt on sale #978's invoice, an open day's. */
const receipt = ledgerRow({ partyName: 'Priya Shah' });
/** A Medicines expense on a closed day. */
const settled = ledgerRow({
  id: 'pay_settled0000000000000',
  seq: 6,
  direction: 'paid',
  kind: 'expense',
  partyName: 'Ankur Pharma',
  payeeName: 'Ankur Pharma',
  expenseCategory: 'medicines',
  invoiceId: null,
  invoice: null,
  isSettled: true,
  editCount: 0,
  lastEdit: null,
});

const rows = () => screen.getAllByTestId('medical-payments-table-row');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listStoreLedger).mockReset();
  vi.mocked(listStoreLedger).mockResolvedValue({
    rows: [receipt, settled],
    next: null,
    total: 2,
  });
  vi.mocked(exportStoreLedger).mockReset();
  vi.mocked(downloadCsv).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
});

describe('MedicalPaymentsPage', () => {
  it('is the store’s slice of the ledger under the Medical toolbar, its New sale primary', async () => {
    const { container } = renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage });
    expect(await screen.findByTestId('medical-payments-new')).toHaveTextContent(
      'New sale',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Payments');
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByTestId('medical-payments-table-end')).toHaveTextContent(
      'All Medical payments loaded',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the ledger with the URL’s filters and search', async () => {
    renderMedicalRoutes(`${ROOM}?kind=expense&mode=upi&q=Ankur`, {
      payments: MedicalPaymentsPage,
    });
    await waitFor(() => expect(listStoreLedger).toHaveBeenCalled());
    expect(vi.mocked(listStoreLedger).mock.calls[0]?.[0]).toMatchObject({
      kind: ['expense'],
      mode: ['upi'],
      q: 'Ankur',
    });
  });

  it('an open day’s entry opens in Payments', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    const row = rows().find((entry) => entry.textContent?.includes('Priya Shah'));
    await user.click(row as HTMLElement);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/payments/${TEST_PAYMENT_ID}/edit`,
      ),
    );
  });

  it('a closed day’s entry answers with its lock', async () => {
    const user = setup();
    renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    const row = rows().find((entry) => entry.textContent?.includes('PAY-6'));
    await user.click(row as HTMLElement);
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-6 · Day closed');
  });

  it('Export saves the server’s CSV of the filtered payments', async () => {
    const user = setup();
    vi.mocked(exportStoreLedger).mockResolvedValue({
      fileName: 'medical-payments-2026-10-10.csv',
      content: 'Ref,Amount\nPAY-5,150\n',
      truncated: false,
    });
    renderMedicalRoutes(`${ROOM}?kind=receipt`, { payments: MedicalPaymentsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(screen.getByTestId('medical-payments-view-action-export'));
    await waitFor(() =>
      expect(downloadCsv).toHaveBeenCalledWith(
        'medical-payments-2026-10-10.csv',
        'Ref,Amount\nPAY-5,150\n',
      ),
    );
    expect(vi.mocked(exportStoreLedger).mock.calls[0]?.[0]).toMatchObject({
      kind: ['receipt'],
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Payments exported as CSV');
  });

  it('Export says when the server cut the file short', async () => {
    const user = setup();
    vi.mocked(exportStoreLedger).mockResolvedValue({
      fileName: 'medical-payments.csv',
      content: 'Ref\n',
      truncated: true,
    });
    renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(screen.getByTestId('medical-payments-view-action-export'));
    await waitFor(() => expect(notifyMock.warning).toHaveBeenCalled());
  });

  it('offers no Export without medicine:export', async () => {
    renderMedicalRoutes(ROOM, { payments: MedicalPaymentsPage }, { role: 'pharmacist' });
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByTestId('medical-payments-view-action-export')).toBeNull();
  });

  it('shows the filtered empty state when nothing matches', async () => {
    vi.mocked(listStoreLedger).mockResolvedValue({ rows: [], next: null, total: 0 });
    renderMedicalRoutes(`${ROOM}?kind=money_back`, { payments: MedicalPaymentsPage });
    expect(await screen.findByText('No matches')).toBeVisible();
  });
});
