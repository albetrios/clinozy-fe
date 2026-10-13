import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import i18n from '@/lib/i18n/i18n.ts';
import {
  fetchPayment,
  listOpenSupplierBills,
  payExpense,
  updatePayment,
} from '@/shared/api/app/payments-api.ts';
import type { OpenSupplierBill } from '@/shared/api/app/payments-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SendPaymentDrawer } from './SendPaymentDrawer.tsx';

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
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listOpenSupplierBills: vi.fn(),
  payExpense: vi.fn(),
  updatePayment: vi.fn(),
  fetchPayment: vi.fn(),
}));

/** The upload tray: each queued file comes back as its storage key at once. */
const uploads = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({ enqueue: uploads.enqueue }),
}));

const D = 'pay-drawer';

/** Every code the Front desk holds here — Clinic stock's bills among them. */
const DESK: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
  'stock_item:read',
];

/** The open bills, oldest first: a Clinic stock purchase without a bill number, a Medical PO. */
const STOCK_2: OpenSupplierBill = {
  kind: 'stock_po',
  purchaseId: 'spur_ft5aosl5u6tyxqidd2e1a',
  seq: 2,
  billNo: null,
  supplierName: 'ZZ Research Vendor',
  date: '2026-09-25',
  due: 1710.5,
  daysPending: 15,
};
const PO_431: OpenSupplierBill = {
  kind: 'medical_po',
  purchaseId: 'mpo_7x2k9q4m1v8n3b6c5z0wa',
  seq: 431,
  billNo: '1631',
  supplierName: 'Shree Ramdev Medical Agency',
  date: '2026-10-08',
  due: 2980,
  daysPending: 2,
};

/** "Tea & snacks", ₹260 in cash — an open day's expense. */
const TEA = ledgerRow({
  id: 'pay_7tq2m4x8v1b5n9c3z6kwa',
  seq: 310,
  direction: 'paid',
  kind: 'expense',
  amount: 260,
  splits: [{ mode: 'cash', amount: 260 }],
  contactId: null,
  contact: null,
  partyName: 'Tea & snacks',
  patientId: null,
  invoiceId: null,
  invoice: null,
  payeeName: 'Tea & snacks',
  expenseCategory: 'misc',
  reference: null,
  note: null,
  editCount: 0,
  lastEdit: null,
});

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const words = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: 'payments', ...options });

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string) =>
  new HttpError('Refused', 409, '/app/payments', 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail: 'Refused' },
  });

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Sign in a member holding `codes`. */
function signIn(codes: readonly OrganizationPermission[] = DESK) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listOpenSupplierBills).mockReset().mockResolvedValue([STOCK_2, PO_431]);
  vi.mocked(payExpense).mockReset();
  vi.mocked(updatePayment).mockReset();
  vi.mocked(fetchPayment).mockReset();
  uploads.enqueue.mockReset();
  signIn();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('SendPaymentDrawer — new (payments.md:112–130)', () => {
  it('opens on "Pay against a bill" while bills are open, Expense and Payment after it', async () => {
    const { baseElement } = renderWithProviders(
      <SendPaymentDrawer open mode="create" onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByText('Send payment')).toBeInTheDocument();
    expect(part('step-bill')).toBeInTheDocument();
    expect(part('step-expense')).toHaveTextContent('Missing: Paid to');
    expect(part('step-payment')).toHaveTextContent('Missing: Amount');
    // The oldest bills, oldest first, their dues in rupees.
    const oldest = within(part('oldest')).getAllByRole('button');
    expect(oldest.map((chip) => chip.textContent)).toEqual([
      '#2 · ZZ · ₹1,710.50 · 15 days pending',
      '#431 · Shree · ₹2,980 · 2 days pending',
    ]);
    // The bills the member may read: Clinic stock's, not Medical's.
    expect(listOpenSupplierBills).toHaveBeenCalledWith({ stock: true, medical: false });
    expect(part('save')).toHaveTextContent('Add expense');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('asks for who was paid and the amount, opening the step that misses them', async () => {
    const user = setUser();
    renderWithProviders(<SendPaymentDrawer open mode="create" onClose={vi.fn()} />);
    await user.click(await screen.findByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add who was paid and the amount');
    expect(screen.getByTestId(`${D}-paid-to`)).toBeVisible();
    expect(payExpense).not.toHaveBeenCalled();
  });

  it('pays a bill from ?bill= in full: its purchase, no category — "₹1,710.50 paid against Stock PO #2"', async () => {
    const user = setUser();
    const onClose = vi.fn();
    vi.mocked(payExpense).mockResolvedValue(
      ledgerRow({
        ...TEA,
        seq: 15,
        kind: 'supplier_bill',
        amount: 1710.5,
        expenseCategory: null,
        bill: { kind: 'stock_po', purchaseId: STOCK_2.purchaseId, seq: 2, billNo: null },
      }),
    );
    renderWithProviders(
      <SendPaymentDrawer
        open
        mode="create"
        bill={STOCK_2.purchaseId}
        onClose={onClose}
      />,
    );
    expect(await screen.findByTestId(`${D}-bill`)).toHaveTextContent(
      'Stock PO #2 · ZZ Research Vendor',
    );
    // The supplier is said once.
    expect(part('summary')).toHaveTextContent(
      'Stock PO #2 · ZZ Research Vendor · ₹1,710.50',
    );
    await user.click(part('step-expense-trigger'));
    expect(part('bill-label')).toHaveTextContent('Stock PO #2 · ZZ Research Vendor');
    expect(screen.queryByTestId(`${D}-category`)).toBeNull();
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const input = vi.mocked(payExpense).mock.calls[0]?.[0].input;
    expect(input).toMatchObject({
      bill: { kind: 'stock_po', purchaseId: STOCK_2.purchaseId },
      payeeName: 'ZZ Research Vendor',
      amount: 1710.5,
      mode: 'cash',
    });
    expect(input).not.toHaveProperty('expenseCategory');
    expect(notifyMock.success).toHaveBeenCalledWith('₹1,710.50 paid against Stock PO #2');
  });

  it('adds an expense in its category from a Quick fill, then "Add & another" starts again', async () => {
    const user = setUser();
    const onClose = vi.fn();
    vi.mocked(payExpense).mockResolvedValue(TEA);
    renderWithProviders(<SendPaymentDrawer open mode="create" onClose={onClose} />);
    await user.click(await screen.findByTestId(`${D}-quick-fill-tea`));
    expect(part('summary')).toHaveTextContent('Misc · Tea & snacks · ₹260');
    await user.click(part('save-and-add'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Expense PAY-310 added'),
    );
    expect(payExpense).toHaveBeenCalledWith({
      input: expect.objectContaining({
        bill: null,
        expenseCategory: 'misc',
        payeeName: 'Tea & snacks',
        amount: 260,
      }),
      idempotencyKey: expect.any(String),
    });
    expect(onClose).not.toHaveBeenCalled();
    // A fresh form: nothing filled.
    await waitFor(() => expect(part('summary')).toHaveTextContent(/^Consumables$/));
  });

  it('offers Retry in place when the open bills can’t be read', async () => {
    const user = setUser();
    vi.mocked(listOpenSupplierBills).mockRejectedValue(new Error('offline'));
    renderWithProviders(<SendPaymentDrawer open mode="create" onClose={vi.fn()} />);
    const retry = await screen.findByTestId(`${D}-bill-retry`);
    vi.mocked(listOpenSupplierBills).mockResolvedValue([STOCK_2]);
    await user.click(retry);
    expect(await screen.findByTestId(`${D}-oldest`)).toBeInTheDocument();
  });

  it('sends expenses only for a member who may read no bills (a Counsellor)', async () => {
    signIn(['organization:read', 'payment:read', 'payment:create']);
    vi.mocked(listOpenSupplierBills).mockResolvedValue([]);
    renderWithProviders(<SendPaymentDrawer open mode="create" onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-step-expense`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-step-bill`)).toBeNull();
    expect(listOpenSupplierBills).toHaveBeenCalledWith({ stock: false, medical: false });
  });

  it('says so when the bill was paid meanwhile (409 more_than_due)', async () => {
    const user = setUser();
    vi.mocked(payExpense).mockRejectedValue(conflict('more_than_due'));
    renderWithProviders(
      <SendPaymentDrawer open mode="create" bill={PO_431.purchaseId} onClose={vi.fn()} />,
    );
    await screen.findByTestId(`${D}-bill`);
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(words('send.moreThanDue')),
    );
    expect(part('save')).toBeInTheDocument();
  });

  it('files the bill photo on the saved entry as the tray confirms it', async () => {
    const user = setUser();
    vi.mocked(payExpense).mockResolvedValue(TEA);
    vi.mocked(fetchPayment).mockResolvedValue(TEA);
    vi.mocked(updatePayment).mockResolvedValue({
      ...TEA,
      attachmentKeys: ['org/bill.jpg'],
    });
    renderWithProviders(<SendPaymentDrawer open mode="create" onClose={vi.fn()} />);
    await user.click(await screen.findByTestId(`${D}-quick-fill-tea`));
    await user.click(part('step-payment-trigger'));
    await user.upload(
      part('files-input'),
      new File(['jpg'], 'bill.jpg', { type: 'image/jpeg' }),
    );
    await user.click(part('save'));
    await waitFor(() => expect(uploads.enqueue).toHaveBeenCalledTimes(1));
    const [, target] = uploads.enqueue.mock.calls[0] as [
      File[],
      { onUploaded: (key: string) => Promise<void> },
    ];
    await target.onUploaded('org/bill.jpg');
    expect(fetchPayment).toHaveBeenCalledWith(TEA.id);
    expect(updatePayment).toHaveBeenCalledWith({
      record: TEA,
      patch: { attachmentKeys: ['org/bill.jpg'] },
      idempotencyKey: `payment-file:${TEA.id}:org/bill.jpg`,
    });
  });
});

describe('SendPaymentDrawer — edit (S:1710)', () => {
  it('saves an open day’s expense — what changed, against the read — its day fixed', async () => {
    const user = setUser();
    const onClose = vi.fn();
    vi.mocked(updatePayment).mockResolvedValue({ ...TEA, amount: 300 });
    renderWithProviders(
      <SendPaymentDrawer open mode="edit" entry={TEA} onClose={onClose} />,
    );
    expect(await screen.findByText('Edit payment out')).toBeInTheDocument();
    expect(part('tag')).toHaveTextContent('PAY-310');
    expect(screen.queryByTestId(`${D}-step-bill`)).toBeNull();
    await user.click(part('step-payment-trigger'));
    expect(part('date')).toBeDisabled();
    const amount = part('amount');
    await user.clear(amount);
    await user.type(amount, '300');
    await user.click(part('save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updatePayment).toHaveBeenCalledWith({
      record: TEA,
      patch: expect.objectContaining({
        amount: 300,
        mode: 'cash',
        expenseCategory: 'misc',
      }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('PAY-310 saved · change logged');
  });

  it('opens a supplier bill’s payment with its bill, no category', async () => {
    const paid = {
      ...TEA,
      kind: 'supplier_bill' as const,
      expenseCategory: null,
      payeeName: 'ZZ Research Vendor',
      partyName: 'ZZ Research Vendor',
      bill: {
        kind: 'stock_po' as const,
        purchaseId: STOCK_2.purchaseId,
        seq: 2,
        billNo: null,
      },
    };
    renderWithProviders(
      <SendPaymentDrawer open mode="edit" entry={paid} onClose={vi.fn()} />,
    );
    await screen.findByText('Edit payment out');
    // An edit has no bill step: it opens on Expense.
    expect(part('bill-label')).toHaveTextContent('Stock PO #2 · ZZ Research Vendor');
    expect(screen.queryByTestId(`${D}-category`)).toBeNull();
  });

  it('turns view only when the day closed meanwhile (409 day_closed)', async () => {
    const user = setUser();
    vi.mocked(updatePayment).mockRejectedValue(conflict('day_closed'));
    renderWithProviders(
      <SendPaymentDrawer open mode="edit" entry={TEA} onClose={vi.fn()} />,
    );
    await screen.findByText('Edit payment out');
    await user.type(part('note'), ' x');
    await user.click(part('save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Day closed · this can’t be saved now',
      ),
    );
    await waitFor(() => expect(screen.queryByTestId(`${D}-save`)).toBeNull());
  });

  it('offers Delete with payment:delete, which asks with the ledger’s reasons', async () => {
    const user = setUser();
    renderWithProviders(
      <SendPaymentDrawer open mode="edit" entry={TEA} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByTestId(`${D}-delete`));
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(within(confirm).getByText('Delete this payment?')).toBeInTheDocument();
    expect(within(confirm).getByTestId('confirm-record')).toHaveTextContent('PAY-310');
  });

  it('offers no Delete without payment:delete', async () => {
    signIn(['organization:read', 'payment:read', 'payment:update']);
    renderWithProviders(
      <SendPaymentDrawer open mode="edit" entry={TEA} onClose={vi.fn()} />,
    );
    await screen.findByText('Edit payment out');
    expect(screen.queryByTestId(`${D}-delete`)).toBeNull();
    expect(part('save')).toBeInTheDocument();
  });
});
