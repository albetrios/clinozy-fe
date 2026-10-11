import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { settleCredit } from '@/shared/api/app/credits-api.ts';
import { listOpenInvoices } from '@/shared/api/app/invoices-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  creditRow,
  invoiceRecord,
  TEST_CREDIT_ID,
  TEST_INVOICE_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import { canUseOnBill, useCreditOnBill } from './useCreditOnBill.ts';

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
vi.mock('@/shared/api/app/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  settleCredit: vi.fn(),
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listOpenInvoices: vi.fn(),
}));

/** CR-1: give Kavya ₹80, ₹30 left. */
const KAVYA = creditRow();

const words = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: 'payments', ...options });

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string) =>
  new HttpError('Refused', 409, `/app/pending-credits/${TEST_CREDIT_ID}/settle`, 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail: 'Refused' },
  });

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Use `credit` on the next bill, as the row action does. */
async function adjustOnBill(credit = KAVYA) {
  const { result } = renderHook(() => useCreditOnBill(), { wrapper });
  await act(() => result.current(credit));
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listOpenInvoices)
    .mockReset()
    .mockResolvedValue([
      invoiceRecord({ due: 20 }),
      invoiceRecord({ id: 'invc_x', seq: 9 }),
    ]);
  vi.mocked(settleCredit)
    .mockReset()
    .mockImplementation(async ({ credit, settlement }) => ({
      credit,
      amount: settlement.action === 'use_on_bill' ? settlement.amount : 0,
      paymentSeq: 12,
      invoiceSeq: 5,
      creditNoteSeq: null,
    }));
  signInTestMember();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('Use on next bill (Q-G9)', () => {
  it('is offered for an open Give credit of a patient', () => {
    expect(canUseOnBill(KAVYA)).toBe(true);
    expect(canUseOnBill({ ...KAVYA, direction: 'take' })).toBe(false);
    expect(canUseOnBill({ ...KAVYA, status: 'used' })).toBe(false);
    expect(canUseOnBill({ ...KAVYA, patientId: null })).toBe(false);
  });

  it('puts what is left, at most the due, on the oldest open invoice — method, amount and invoice only', async () => {
    await adjustOnBill();
    expect(listOpenInvoices).toHaveBeenCalledWith(TEST_MONEY_PATIENT_ID);
    expect(settleCredit).toHaveBeenCalledWith({
      credit: KAVYA,
      settlement: { action: 'use_on_bill', invoiceId: TEST_INVOICE_ID, amount: 20 },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('₹20 of CR-1 adjusted on invoice #5');
  });

  it('puts all that is left when the due is larger', async () => {
    vi.mocked(listOpenInvoices).mockResolvedValue([invoiceRecord({ due: 1_250.5 })]);
    await adjustOnBill();
    expect(vi.mocked(settleCredit).mock.calls[0]?.[0].settlement).toEqual({
      action: 'use_on_bill',
      invoiceId: TEST_INVOICE_ID,
      amount: 30,
    });
  });

  it('says nothing is due before anything is written', async () => {
    vi.mocked(listOpenInvoices).mockResolvedValue([]);
    await adjustOnBill();
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Nothing due for Kavya Mehta to adjust against',
    );
    expect(settleCredit).not.toHaveBeenCalled();
  });

  it('reads the invoices fresh, never a cached due', async () => {
    await adjustOnBill();
    await adjustOnBill();
    expect(listOpenInvoices).toHaveBeenCalledTimes(2);
  });

  it('says a closed day at the invoice’s branch in the room’s words (409 day_closed)', async () => {
    vi.mocked(settleCredit).mockRejectedValue(conflict('day_closed'));
    await adjustOnBill();
    expect(notifyMock.error).toHaveBeenCalledWith(
      words('pending.conflicts.dayClosed', { seq: 5 }),
    );
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('tells the other refusals apart: nothing due, the due changed, settled meanwhile', async () => {
    vi.mocked(settleCredit).mockRejectedValueOnce(conflict('nothing_due'));
    await adjustOnBill();
    expect(notifyMock.error).toHaveBeenLastCalledWith(
      'Nothing due for Kavya Mehta to adjust against',
    );
    vi.mocked(settleCredit).mockRejectedValueOnce(conflict('more_than_due'));
    await adjustOnBill();
    expect(notifyMock.error).toHaveBeenLastCalledWith(
      words('pending.conflicts.dueChanged', { seq: 5 }),
    );
    vi.mocked(settleCredit).mockRejectedValueOnce(conflict('credit_closed'));
    await adjustOnBill();
    expect(notifyMock.error).toHaveBeenLastCalledWith(
      words('pending.conflicts.closed', { ref: 'CR-1' }),
    );
  });

  it('says a failed invoice read and writes nothing', async () => {
    vi.mocked(listOpenInvoices).mockRejectedValue(
      new HttpError('Server error', 500, '/app/invoices', 'GET', {}),
    );
    await adjustOnBill();
    expect(notifyMock.error).toHaveBeenCalled();
    expect(settleCredit).not.toHaveBeenCalled();
  });
});
