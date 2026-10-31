import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collectSale: vi.fn(),
}));
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deletePayment: vi.fn(),
}));

import { deletePayment } from '@/shared/api/app/payments-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { paidSaleRow, saleRow } from '@/tests/utils/medical-doubles.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { collectSale } from '../../../shared/medical-records-api.ts';
import { SaleDrawer } from './SaleDrawer.tsx';

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

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const D = 'sale-drawer';
const RECEIPT_ID = 'pay_receipt00000000000000';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(collectSale).mockResolvedValue(ledgerRow({ id: RECEIPT_ID, amount: 1300 }));
  vi.mocked(deletePayment).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
  vi.mocked(collectSale).mockReset();
  vi.mocked(deletePayment).mockReset();
});

describe('SaleDrawer (medical.md:333–338)', () => {
  it('an unpaid sale: its badges and medicines, "Collect ₹1,300" on the ledger with Undo', async () => {
    const user = setup();
    const sale = saleRow();
    renderMedicalDrawer(
      <SaleDrawer open sale={sale} onClose={vi.fn()} onReturn={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Sale');
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#978');
    expect(drawer).toHaveTextContent('Priya Shah');
    const badges = within(drawer).getByTestId(`${D}-badges`);
    expect(badges).toHaveTextContent('Unpaid');
    expect(badges).toHaveTextContent('Invoice #INV-25-0042 · in patient file');
    expect(badges).toHaveTextContent('₹1,300');
    const [line] = within(drawer).getAllByTestId(`${D}-lines-row`);
    expect(line).toHaveTextContent('Azelaic gel 15g');
    expect(line).toHaveTextContent('026-312');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      '1 medicine · ₹1,300',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    const collect = within(drawer).getByTestId(`${D}-save`);
    expect(collect).toHaveTextContent('Collect ₹1,300');
    await user.click(collect);
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        '₹1,300 received',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect(collectSale).toHaveBeenCalledWith(
      expect.objectContaining({ sale, mode: 'upi', idempotencyKey: expect.any(String) }),
    );

    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    await waitFor(() =>
      expect(deletePayment).toHaveBeenCalledWith({
        paymentId: RECEIPT_ID,
        reason: 'mistake',
        note: null,
      }),
    );
  });

  it('a Pharmacist collects without an Undo — deleting a payment is not theirs', async () => {
    const user = setup();
    renderMedicalDrawer(
      <SaleDrawer open sale={saleRow()} onClose={vi.fn()} onReturn={vi.fn()} />,
      { role: 'pharmacist' },
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('₹1,300 received'),
    );
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('offers Void on an unpaid sale with nothing paid or returned', async () => {
    const user = setup();
    renderMedicalDrawer(
      <SaleDrawer open sale={saleRow()} onClose={vi.fn()} onReturn={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    const voidButton = within(drawer).getByTestId(`${D}-delete`);
    expect(voidButton).toHaveTextContent('Void sale');
    await user.click(voidButton);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Void this sale?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('1 medicine · ₹1,300');
  });

  it('a sale paid in full offers "Return medicines" and its returned amount', async () => {
    const user = setup();
    const onReturn = vi.fn();
    const sale = paidSaleRow({ status: 'returned', returned: 239 });
    renderMedicalDrawer(
      <SaleDrawer open sale={sale} onClose={vi.fn()} onReturn={onReturn} />,
    );
    const drawer = await screen.findByTestId(D);
    const badges = within(drawer).getByTestId(`${D}-badges`);
    expect(badges).toHaveTextContent('Paid');
    expect(badges).toHaveTextContent('Returned ₹239');
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(onReturn).toHaveBeenCalledWith(expect.objectContaining({ id: sale.id }));
  });

  it('never offers a return to a Pharmacist (`payment:delete`, MD23)', async () => {
    renderMedicalDrawer(
      <SaleDrawer open sale={paidSaleRow()} onClose={vi.fn()} onReturn={vi.fn()} />,
      { role: 'pharmacist' },
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
  });

  it('a buyer with no patient file names no invoice, and a viewer gets only Close', async () => {
    renderMedicalDrawer(
      <SaleDrawer
        open
        sale={saleRow({
          customer: {
            id: 'con_walkin0000000000000000',
            name: 'Meera Joshi',
            phone: null,
            patientId: null,
          },
        })}
        onClose={vi.fn()}
        onReturn={vi.fn()}
      />,
      { role: 'doctor' },
    );
    const drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent('Meera Joshi');
    expect(within(drawer).getByTestId(`${D}-badges`)).not.toHaveTextContent('Invoice');
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(within(drawer).getByTestId(`${D}-dismiss`)).toHaveTextContent('Close');
  });

  it('shows a line’s description under its medicine', async () => {
    const sale = saleRow();
    renderMedicalDrawer(
      <SaleDrawer
        open
        sale={{
          ...sale,
          lines: sale.lines.map((line) => ({ ...line, description: 'Apply at night' })),
        }}
        onClose={vi.fn()}
        onReturn={vi.fn()}
      />,
    );
    const drawer = await screen.findByTestId(D);
    const [line] = within(drawer).getAllByTestId(`${D}-lines-row`);
    expect(line).toHaveTextContent('Azelaic gel 15g');
    expect(line).toHaveTextContent('Apply at night');
  });

  it('shimmers until the sale is read', async () => {
    renderMedicalDrawer(
      <SaleDrawer open sale={undefined} onClose={vi.fn()} onReturn={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
