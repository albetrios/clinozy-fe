import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collectSale: vi.fn(),
}));
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deletePayment: vi.fn(),
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoice: vi.fn(),
}));

import type { Role } from '@/shared/api/app/app-schema.ts';
import { fetchInvoice } from '@/shared/api/app/invoices-api.ts';
import { deletePayment } from '@/shared/api/app/payments-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { holdPreset } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { invoiceDetail } from '@/tests/utils/invoice-doubles.ts';
import {
  paidSaleRow,
  saleRow,
  TEST_SALE_INVOICE_ID,
} from '@/tests/utils/medical-doubles.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import type { SaleReturn } from '../../../shared/medical-contracts.ts';
import { collectSale } from '../../../shared/medical-records-api.ts';
import { salePaymentOf, useSaleActions } from './useSaleActions.ts';

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

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const RECEIPT_ID = 'pay_receipt00000000000000';

/** One return the server wrote on a sale. */
const RETURN: SaleReturn = {
  id: 'msrt_back00000000000000000',
  reason: 'unused',
  refundMode: 'cash',
  note: null,
  amount: 650,
  creditNoteId: 'icn_back00000000000000000',
  pendingCreditId: null,
  items: [],
  returnedById: null,
  at: NOW.toISOString(),
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The hook for a member holding the `role` preset's codes, once their access has answered. */
async function actionsAs(role: Role) {
  holdPreset(role);
  const view = renderHook(useSaleActions, { wrapper });
  await waitFor(() => expect(view.result.current.canReturn).toBeDefined());
  return view;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of [...Object.values(notifyMock), printMock]) fn.mockReset();
  signInTestMember();
  vi.mocked(collectSale).mockResolvedValue(ledgerRow({ id: RECEIPT_ID, amount: 1300 }));
  vi.mocked(deletePayment).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearPermissions();
  for (const fn of [collectSale, deletePayment, fetchInvoice]) vi.mocked(fn).mockReset();
});

describe('useSaleActions (medical.md:29, 338)', () => {
  it('an Admin collects and voids an unpaid sale with nothing on it, and returns one paid in full', async () => {
    const unpaid = saleRow();
    const paid = paidSaleRow();
    const { result } = await actionsAs('admin');
    await waitFor(() => expect(result.current.canVoid(unpaid)).toBe(true));
    expect(result.current.canCollect(unpaid)).toBe(true);
    expect(result.current.canReturn(unpaid)).toBe(false);
    expect(result.current.canReturn(paid)).toBe(true);
    expect(result.current.canCollect(paid)).toBe(false);
    expect(result.current.canVoid(paid)).toBe(false);
    // A return on it keeps it: a void would undo stock already counted back.
    expect(result.current.canVoid({ ...unpaid, returns: [RETURN] })).toBe(false);
    // Everything back already: nothing left to return.
    const line = paid.lines[0];
    if (!line) throw new Error('expected a line');
    expect(
      result.current.canReturn({ ...paid, lines: [{ ...line, returnedQty: line.qty }] }),
    ).toBe(false);
  });

  it('a Pharmacist collects but never returns or voids; an Accountant collects and returns (MD23)', async () => {
    const unpaid = saleRow();
    const paid = paidSaleRow();
    const pharmacist = await actionsAs('pharmacist');
    await waitFor(() => expect(pharmacist.result.current.canCollect(unpaid)).toBe(true));
    expect(pharmacist.result.current.canVoid(unpaid)).toBe(false);
    expect(pharmacist.result.current.canReturn(paid)).toBe(false);
    pharmacist.unmount();
    const accountant = await actionsAs('accountant');
    await waitFor(() => expect(accountant.result.current.canReturn(paid)).toBe(true));
    expect(accountant.result.current.canCollect(unpaid)).toBe(true);
    expect(accountant.result.current.canVoid(unpaid)).toBe(false);
  });

  it('reads Paid and Unpaid off the server’s due', () => {
    expect(salePaymentOf(saleRow())).toBe('unpaid');
    expect(salePaymentOf(paidSaleRow())).toBe('paid');
  });

  it('Collect puts the due on the ledger; its Undo deletes the receipt', async () => {
    const { result } = await actionsAs('admin');
    const onDone = vi.fn();
    const sale = saleRow();
    act(() => result.current.collect(sale, onDone));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(collectSale).toHaveBeenCalledWith(
      expect.objectContaining({ sale, mode: 'upi' }),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith(
      '₹1,300 received',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    act(() => options.onUndo());
    await waitFor(() =>
      expect(deletePayment).toHaveBeenCalledWith({
        paymentId: RECEIPT_ID,
        reason: 'mistake',
        note: null,
      }),
    );
  });

  it('Print reads the sale’s invoice and prints it; a failed read is told', async () => {
    vi.mocked(fetchInvoice).mockResolvedValueOnce(invoiceDetail());
    const { result } = await actionsAs('admin');
    act(() => result.current.print(saleRow()));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    expect(printMock.mock.calls[0]?.[0]).toMatchObject({
      props: { sale: { seq: saleRow().seq } },
    });
    expect(fetchInvoice).toHaveBeenCalledWith(TEST_SALE_INVOICE_ID);
    vi.mocked(fetchInvoice).mockRejectedValueOnce(
      new HttpError('gone', 404, '/app/invoices', 'GET', {
        error: { detail: 'Invoice not found' },
      }),
    );
    const { invoice } = saleRow();
    act(() =>
      result.current.print({
        seq: 983,
        invoice: invoice && { ...invoice, id: 'invc_gone' },
      }),
    );
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
  });
});
