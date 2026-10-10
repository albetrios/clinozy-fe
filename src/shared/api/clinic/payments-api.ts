import { displayId } from './clinic-display-id.ts';
import { createdFilterMatches } from './clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CreateInput,
  type CursorPage,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import { invoiceBalance } from './clinic-money.ts';
import type { DeleteReason, MedicalPurchaseOrder, PaymentMode } from './clinic-schema.ts';
import {
  civilDayOffset,
  clinicClockTime,
  clinicInstant,
  clinicToday,
} from './clinic-time.ts';
import { assertDayOpen, ledgerDayOf, runDayCloseJob } from './day-close-api.ts';
import { ledgerContext, toLedgerRow } from './ledger-rows.ts';
import {
  type LedgerListParams,
  type LedgerRow,
  type OpenInvoice,
  type OpenSupplierBill,
  type PatientInvoiceRow,
  type PayExpenseInput,
  payExpenseInputSchema,
  type PaymentEdit,
  type PaymentPatch,
  type PaymentRecord,
  type ReceivePaymentInput,
  receivePaymentInputSchema,
} from './payments-contracts.ts';

/*
 * The Payments ledger's reads and writes (`S:1699–1711`), on the fixture world
 * until clinozy-be serves them — every call is REPLACE_WITH_API (D6). The world
 * is imported on demand, so its seed data never lands in a route chunk. Every
 * read and write first runs the auto-close job: an entry's lock is the
 * server's (`dayCloseId`, `S:662`), and a write to a closed day is a 409.
 */

/** TanStack Query keys for the ledger — all under `['clinic', 'payments']`. */
export const paymentQueryKeys = {
  all: ['clinic', 'payments'] as const,
  /** Every ledger variant — a write invalidates them all. */
  lists: () => [...paymentQueryKeys.all, 'list'] as const,
  list: (params: LedgerListParams) => [...paymentQueryKeys.lists(), params] as const,
  detail: (id: string) => [...paymentQueryKeys.all, 'detail', id] as const,
  /** A patient's invoices with a due — the Receive drawer's chips. */
  openInvoices: (patientId: string) =>
    [...paymentQueryKeys.all, 'open-invoices', patientId] as const,
  /** Every invoice of a patient, paid ones too — Add pending's "For invoice". */
  patientInvoices: (patientId: string) =>
    [...paymentQueryKeys.all, 'patient-invoices', patientId] as const,
  /** The supplier bills with a balance — Send payment's first step. */
  openBills: () => [...paymentQueryKeys.all, 'open-bills'] as const,
  /** A patient's receipts and refunds — the patient file's Payments. */
  patientPayments: (patientId: string) =>
    [...paymentQueryKeys.all, 'patient-payments', patientId] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

const DAY_CLOSED = 'Day closed';
const FROM_CREDIT = 'From';
const MORE_THAN_DUE = 'More than what is due';

// ── Search and filters (the fixture server's) ──

const squeeze = (text: string) => text.toLowerCase().replace(/[\s#·-]/g, '');

/** Whether a row matches `q`: "PAY-5512", the party, "#785" or the note (`S:1699`). */
function matchesSearch(row: LedgerRow, query: string): boolean {
  const needle = squeeze(query);
  if (!needle) return true;
  return [
    displayId.payment(row.seq),
    row.partyName,
    row.invoice ? `${row.invoice.seq}` : '',
    row.note ?? '',
    row.reference ?? '',
  ]
    .map(squeeze)
    .some((field) => field.includes(needle));
}

/**
 * Medical's own entries (`listMedicalPayments`, `S:1662`): receipts and
 * refunds on Medical invoices, payments of Medical PO bills, and expenses in
 * Medicines.
 */
function isMedical(row: LedgerRow): boolean {
  return (
    row.invoice?.type === 'medical' ||
    row.bill?.kind === 'medical_po' ||
    row.expenseCategory === 'medicines'
  );
}

/** The What filter's kind for an entry: a supplier bill is an expense. */
function whatOf(payment: PaymentRecord) {
  return payment.kind === 'supplier_bill' ? 'expense' : payment.kind;
}

/** The list params' checks, each passing while its param is unset. */
const LEDGER_CHECKS: readonly ((
  row: LedgerRow,
  params: LedgerListParams,
  today: string,
) => boolean)[] = [
  (row, { direction }) => !direction || row.direction === direction,
  (row, { kind }) => !kind?.length || (kind as readonly string[]).includes(whatOf(row)),
  (row, { mode }) =>
    !mode?.length || row.splits.some((split) => mode.includes(split.mode)),
  (row, { created }, today) =>
    !created || createdFilterMatches(row.createdAt, created, today),
  (row, { day }) => !day || ledgerDayOf(row) === day,
  (row, { branchIds }) => !branchIds?.length || branchIds.includes(row.branchId),
  (row, { scope }) => scope !== 'medical' || isMedical(row),
  (row, { q }) => matchesSearch(row, q ?? ''),
];

function passesFilters(row: LedgerRow, params: LedgerListParams, today: string): boolean {
  return LEDGER_CHECKS.every((check) => check(row, params, today));
}

/** Newest first — `paidAt`, then the newer number (`payments.md:31`). */
const newestFirst = (a: PaymentRecord, b: PaymentRecord) =>
  compareText(b.paidAt, a.paidAt) || b.seq - a.seq;

// ── Reads ──

/**
 * One cursor page of the ledger (`listLedger`, `S:1699`; REPLACE_WITH_API):
 * receipts, refunds and expenses merged, newest first, filtered by Show, What,
 * Mode, Created, `q`, the reviewed day, the header branches and — for Medical ›
 * Payments — the Medical scope. Each row names its party, invoice, bill,
 * credit, author and lock.
 */
export async function listLedger(
  params: LedgerListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<LedgerRow>> {
  await runDayCloseJob();
  const { clinicFixtures } = await fixtureWorld();
  const context = await ledgerContext();
  const today = clinicToday();
  const rows = clinicFixtures.payments
    .snapshot()
    .map((payment) => toLedgerRow(payment, context))
    .filter((row) => passesFilters(row, params, today))
    .sort(newestFirst);
  const start = cursor ? Number(cursor) : 0;
  const end = start + 50;
  return {
    items: rows.slice(start, end),
    nextCursor: end < rows.length ? String(end) : null,
  };
}

/** One ledger entry (REPLACE_WITH_API) — a 404 when it is unknown or deleted. */
export async function fetchPayment(id: string): Promise<LedgerRow> {
  await runDayCloseJob();
  const { clinicFixtures } = await fixtureWorld();
  const payment = await clinicFixtures.payments.get(id);
  return toLedgerRow(payment, await ledgerContext());
}

/** A patient's invoices, each with its items, team, bill, what is paid and due, and status — oldest first. */
async function patientInvoiceRows(patientId: string): Promise<PatientInvoiceRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const payments = clinicFixtures.payments.snapshot();
  return clinicFixtures.invoices
    .snapshot((invoice) => invoice.patientId === patientId)
    .sort((a, b) => compareText(a.date, b.date) || a.seq - b.seq)
    .map((invoice) => {
      const balance = invoiceBalance(invoice, payments);
      return {
        id: invoice.id,
        seq: invoice.seq,
        type: invoice.type,
        date: invoice.date,
        bill: balance.bill,
        paid: balance.paid,
        due: balance.due,
        items: invoice.items.map((item) => item.name),
        remark: invoice.remark,
        teamIds: invoice.teamIds,
        status: balance.status,
        saleId: invoice.saleId,
      };
    });
}

/**
 * A patient's invoices with something due (`listOpenInvoices`, `S:1702`;
 * REPLACE_WITH_API), oldest first — the Receive drawer's "Against invoice".
 */
export async function listOpenInvoices(patientId: string): Promise<OpenInvoice[]> {
  return (await patientInvoiceRows(patientId)).filter((invoice) => invoice.due > 0);
}

/**
 * Every invoice of a patient, paid ones too (REPLACE_WITH_API), newest first —
 * Add pending's "For invoice" ("Invoice #772", "₹1,000 · ₹600 due") and the
 * patient file's Invoices table (items, team, status).
 */
export async function listPatientInvoices(
  patientId: string,
): Promise<PatientInvoiceRow[]> {
  return (await patientInvoiceRows(patientId)).reverse();
}

/**
 * A patient's ledger entries — receipts and refunds — newest first: the
 * patient file's Payments table (REPLACE_WITH_API: the ledger read has no
 * patient filter).
 */
export async function listPatientPayments(patientId: string): Promise<LedgerRow[]> {
  await runDayCloseJob();
  const { clinicFixtures } = await fixtureWorld();
  const context = await ledgerContext();
  return clinicFixtures.payments
    .snapshot((payment) => payment.patientId === patientId)
    .sort(newestFirst)
    .map((payment) => toLedgerRow(payment, context));
}

/** A Medical PO's bill: Σ qty × rate — free units are not billed (`S:769`). */
function purchaseOrderBill(order: MedicalPurchaseOrder): number {
  return order.items.reduce((sum, item) => sum + item.qty * item.rate, 0);
}

/** On the same day a Medical PO comes before a Clinic stock purchase, as the picker groups them. */
const BILL_KIND_ORDER: Readonly<Record<OpenSupplierBill['kind'], number>> = {
  medical_po: 0,
  stock_po: 1,
};

/**
 * The supplier bills with a balance (`listOpenSupplierBills`, `S:1701`;
 * REPLACE_WITH_API): received Medical POs and Clinic stock purchases, oldest
 * first, each with its supplier, bill number, due and age.
 */
export async function listOpenSupplierBills(): Promise<OpenSupplierBill[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const suppliers = new Map(
    clinicFixtures.suppliers.snapshot().map((supplier) => [supplier.id, supplier.name]),
  );
  const vendors = new Map(
    clinicFixtures.stockVendors.snapshot().map((vendor) => [vendor.id, vendor.name]),
  );
  const medical = clinicFixtures.purchaseOrders
    .snapshot((order) => order.stage === 'received')
    .map((order): OpenSupplierBill => ({
      kind: 'medical_po',
      purchaseId: order.id,
      seq: order.seq,
      billNo: order.supplierBillNo ?? '',
      supplierName: suppliers.get(order.supplierId) ?? '',
      date: order.date,
      due: Math.max(0, purchaseOrderBill(order) - order.paid),
      daysPending: Math.max(0, civilDayOffset(order.date, today)),
    }));
  const stock = clinicFixtures.stockPurchases
    .snapshot()
    .map((purchase): OpenSupplierBill => ({
      kind: 'stock_po',
      purchaseId: purchase.id,
      seq: purchase.seq,
      billNo: purchase.billNo ?? '',
      supplierName: vendors.get(purchase.vendorId) ?? '',
      date: purchase.date,
      due: Math.max(0, purchase.bill - purchase.paid),
      daysPending: Math.max(0, civilDayOffset(purchase.date, today)),
    }));
  return [...medical, ...stock]
    .filter((bill) => bill.due > 0)
    .sort(
      (a, b) =>
        compareText(a.date, b.date) ||
        BILL_KIND_ORDER[a.kind] - BILL_KIND_ORDER[b.kind] ||
        a.seq - b.seq,
    );
}

// ── Writes ──

/** Σ of the split rows, in paise. */
const splitTotal = (splits: readonly { amount: number }[]) =>
  splits.reduce((sum, split) => sum + split.amount, 0);

/** The modes of the split rows, each once, in order. */
const modesOf = (splits: readonly { mode: PaymentMode }[]) => [
  ...new Set(splits.map((split) => split.mode)),
];

/** A 422 on the split rows: the amount is above what the invoice still owes (`S:1708`). */
function refuseAboveDue(): never {
  throw clinicHttpError(422, 'validation', MORE_THAN_DUE, { splits: [MORE_THAN_DUE] });
}

/** The due on an invoice, leaving out one entry (an edit's own). */
async function invoiceDue(invoiceId: string, exceptPaymentId: string | null) {
  const { clinicFixtures } = await fixtureWorld();
  const invoice = await clinicFixtures.invoices.get(invoiceId);
  const payments = clinicFixtures.payments.snapshot(
    (payment) => payment.id !== exceptPaymentId,
  );
  return { invoice, due: invoiceBalance(invoice, payments).due };
}

/**
 * What every new ledger entry starts from — a receipt, an expense, an
 * invoice's "Paid now" (`invoices-server.fixtures.ts`), Medical's Collect and
 * refunds (`medical-flows-api.ts`); the kind's fields come from the caller.
 */
export function newLedgerEntry(
  fields: Pick<
    CreateInput<PaymentRecord>,
    'direction' | 'kind' | 'branchId' | 'amount' | 'splits'
  > &
    Partial<CreateInput<PaymentRecord>>,
): CreateInput<PaymentRecord> {
  return {
    patientId: null,
    invoiceId: null,
    payeeName: null,
    expenseCategory: null,
    billRef: null,
    creditNoteId: null,
    pendingCreditId: null,
    note: null,
    dayCloseId: null,
    reference: null,
    edits: [],
    attachmentKeys: [],
    paidAt: new Date().toISOString(),
    ...fields,
  };
}

/**
 * Receive payment (`receivePayment`, `S:1708`; REPLACE_WITH_API): a receipt
 * from a patient — required — against one of their invoices or none. An amount
 * above that invoice's due is a 422; a closed day a 409. The invoice's due
 * follows from the receipts (`S:622`).
 */
export async function receivePayment(input: ReceivePaymentInput): Promise<LedgerRow> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(receivePaymentInputSchema, input);
  refuseUnknownIds(
    'patientId',
    [fields.patientId],
    clinicFixtures.patients.snapshot(),
    'Pick a patient',
  );
  const amount = splitTotal(fields.splits);
  if (fields.invoiceId) {
    const { invoice, due } = await invoiceDue(fields.invoiceId, null);
    if (invoice.patientId !== fields.patientId) {
      throw clinicHttpError(422, 'validation', 'Pick one of this patient’s invoices', {
        invoiceId: ['Pick one of this patient’s invoices'],
      });
    }
    if (amount > due) refuseAboveDue();
  }
  await assertDayOpen(fields.branchId, clinicToday());
  const payment = await clinicFixtures.payments.create(
    newLedgerEntry({
      direction: 'received',
      kind: 'receipt',
      branchId: fields.branchId,
      amount,
      splits: fields.splits,
      patientId: fields.patientId,
      invoiceId: fields.invoiceId,
      reference: fields.reference === '' ? null : fields.reference,
      note: fields.note === '' ? null : fields.note,
    }),
  );
  return toLedgerRow(payment, await ledgerContext());
}

/** The paid figure of a purchase changes by `delta` paise; a Medical PO paid in full is Paid. */
async function settleBill(
  billRef: NonNullable<PaymentRecord['billRef']>,
  delta: number,
): Promise<void> {
  const { clinicFixtures } = await fixtureWorld();
  if (billRef.kind === 'medical_po') {
    const order = await clinicFixtures.purchaseOrders.get(billRef.purchaseId);
    const paid = Math.max(0, order.paid + delta);
    const settled = paid >= purchaseOrderBill(order);
    let stage = order.stage;
    if (settled && order.stage === 'received') stage = 'paid';
    else if (!settled && order.stage === 'paid') stage = 'received';
    await clinicFixtures.purchaseOrders.update(order.id, { paid, stage });
    return;
  }
  if (billRef.kind === 'stock_po') {
    const purchase = await clinicFixtures.stockPurchases.get(billRef.purchaseId);
    await clinicFixtures.stockPurchases.update(purchase.id, {
      paid: Math.max(0, purchase.paid + delta),
    });
  }
}

/** The instant an expense paid on `day` is recorded at: now, or that day at the current clock time. */
function paidAtOn(day: string): string {
  const now = new Date();
  if (day === clinicToday(now)) return now.toISOString();
  return clinicInstant(day, clinicClockTime(now));
}

/**
 * Send payment (`payExpense`, `S:1709`; REPLACE_WITH_API): clinic spend, or a
 * payment against a supplier bill — the single PO payment path (Q-M1) — which
 * raises that purchase's paid and moves a Medical PO paid in full to Paid. A
 * closed day is a 409; more than the bill's due a 422.
 */
export async function payExpense(input: PayExpenseInput): Promise<LedgerRow> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(payExpenseInputSchema, input);
  if (fields.billRef) {
    const bills = await listOpenSupplierBills();
    const bill = bills.find((open) => open.purchaseId === fields.billRef?.purchaseId);
    if (!bill) {
      throw clinicHttpError(422, 'validation', 'This bill is already paid', {
        billRef: ['This bill is already paid'],
      });
    }
    if (fields.amount > bill.due) {
      throw clinicHttpError(422, 'validation', MORE_THAN_DUE, {
        amount: [MORE_THAN_DUE],
      });
    }
  }
  await assertDayOpen(fields.branchId, fields.paidOn);
  const payment = await clinicFixtures.payments.create(
    newLedgerEntry({
      direction: 'paid',
      kind: fields.billRef ? 'supplier_bill' : 'expense',
      branchId: fields.branchId,
      amount: fields.amount,
      splits: [{ mode: fields.mode, amount: fields.amount }],
      payeeName: fields.payeeName,
      expenseCategory: fields.expenseCategory,
      billRef: fields.billRef,
      note: fields.note === '' ? null : fields.note,
      attachmentKeys: fields.attachmentKeys,
      paidAt: paidAtOn(fields.paidOn),
    }),
  );
  if (fields.billRef) await settleBill(fields.billRef, fields.amount);
  return toLedgerRow(payment, await ledgerContext());
}

/**
 * Refuse a change to an entry a pending credit settled — it is the credit's
 * now, "PAY-5601 · From CR-2" (409; H:5105) — or whose day is closed:
 * "PAY-5509 · Day closed" (409).
 */
async function assertEntryOpen(payment: PaymentRecord): Promise<void> {
  await runDayCloseJob();
  const { clinicFixtures } = await fixtureWorld();
  const current = await clinicFixtures.payments.get(payment.id);
  if (current.pendingCreditId !== null) {
    const credit = await clinicFixtures.pendingCredits.get(current.pendingCreditId, {
      includeDeleted: true,
    });
    throw clinicHttpError(
      409,
      'conflict',
      `${displayId.payment(payment.seq)} · ${FROM_CREDIT} ${displayId.pendingCredit(credit.seq)}`,
    );
  }
  if (current.dayCloseId !== null) {
    throw clinicHttpError(
      409,
      'conflict',
      `${displayId.payment(payment.seq)} · ${DAY_CLOSED}`,
    );
  }
  await assertDayOpen(
    payment.branchId,
    ledgerDayOf(payment),
    `${displayId.payment(payment.seq)} · ${DAY_CLOSED}`,
  );
}

/** A receipt's change: its split rows, Reference and Note — still at most its invoice's due. */
async function receiptChange(
  saved: PaymentRecord,
  patch: PaymentPatch,
): Promise<Partial<PaymentRecord>> {
  const fields = validateClinicInput(receivePaymentInputSchema, {
    branchId: saved.branchId,
    patientId: saved.patientId,
    invoiceId: saved.invoiceId,
    splits: patch.splits ?? saved.splits,
    reference: patch.reference === undefined ? saved.reference : patch.reference,
    note: patch.note === undefined ? saved.note : patch.note,
  });
  const amount = splitTotal(fields.splits);
  if (saved.invoiceId) {
    const { due } = await invoiceDue(saved.invoiceId, saved.id);
    if (amount > due) refuseAboveDue();
  }
  return {
    amount,
    splits: fields.splits,
    reference: fields.reference === '' ? null : fields.reference,
    note: fields.note === '' ? null : fields.note,
  };
}

/** An expense's payee, category and mode as saved — what a patch changes. */
function savedExpense(saved: PaymentRecord) {
  return {
    payeeName: saved.payeeName ?? '',
    expenseCategory: saved.expenseCategory ?? 'misc',
    mode: saved.splits[0]?.mode ?? 'cash',
  };
}

/**
 * An expense's or a supplier bill's change: payee, category, amount, mode, note
 * and photos — a bill's purchase following the new amount.
 */
async function expenseChange(
  saved: PaymentRecord,
  patch: PaymentPatch,
): Promise<Partial<PaymentRecord>> {
  const billRef = saved.billRef?.kind === 'other' ? null : saved.billRef;
  const current = savedExpense(saved);
  const fields = validateClinicInput(payExpenseInputSchema, {
    branchId: saved.branchId,
    billRef,
    payeeName: patch.payeeName ?? current.payeeName,
    expenseCategory: patch.expenseCategory ?? current.expenseCategory,
    amount: patch.amount ?? saved.amount,
    mode: patch.mode ?? current.mode,
    paidOn: ledgerDayOf(saved),
    note: patch.note === undefined ? saved.note : patch.note,
    attachmentKeys: patch.attachmentKeys ?? saved.attachmentKeys,
  });
  if (billRef && fields.amount !== saved.amount) {
    await settleBill(billRef, fields.amount - saved.amount);
  }
  return {
    amount: fields.amount,
    splits: [{ mode: fields.mode, amount: fields.amount }],
    payeeName: fields.payeeName,
    expenseCategory: fields.expenseCategory,
    note: fields.note === '' ? null : fields.note,
    attachmentKeys: fields.attachmentKeys,
  };
}

/**
 * The entry's edit log after a change (Appendix F): a line when the amount or
 * the modes moved — "₹600 UPI → ₹700 UPI" — the log as it was otherwise.
 */
function editsAfter(
  saved: PaymentRecord,
  next: Partial<PaymentRecord>,
  byId: string,
): PaymentEdit[] {
  const from = { amount: saved.amount, modes: modesOf(saved.splits) };
  const to = { amount: next.amount ?? saved.amount, modes: modesOf(next.splits ?? []) };
  if (from.amount === to.amount && from.modes.join() === to.modes.join()) {
    return saved.edits;
  }
  return [...saved.edits, { at: new Date().toISOString(), byId, from, to }];
}

/**
 * Change an open-day entry (`updatePayment`, `S:1710`; REPLACE_WITH_API): a
 * receipt's split rows, Reference and Note — still at most its invoice's due —
 * or an expense's payee, category, amount, mode, note and photos. A change of
 * the amount or the modes is logged on the entry (Appendix F); a closed day is
 * a 409 and the drawer turns read-only.
 */
export async function updatePayment(id: string, patch: PaymentPatch): Promise<LedgerRow> {
  const { clinicFixtures } = await fixtureWorld();
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  const saved = await clinicFixtures.payments.get(id);
  await assertEntryOpen(saved);
  const next =
    saved.direction === 'received'
      ? await receiptChange(saved, patch)
      : await expenseChange(saved, patch);
  const payment = await clinicFixtures.payments.update(id, {
    ...next,
    edits: editsAfter(saved, next, FIXTURE_VIEWER_ID),
  });
  return toLedgerRow(payment, await ledgerContext());
}

/** What an uploaded bill photo files: the entry and the storage key the upload tray confirmed. */
export interface PaymentFileInput {
  paymentId: string;
  key: string;
}

/**
 * File an uploaded bill or receipt on its entry (`payExpense`'s attachments,
 * plan-only — Appendix F; REPLACE_WITH_API): the key joins the entry's
 * `attachmentKeys`. It files after the save, so the day's lock does not apply.
 */
export async function attachPaymentFile(input: PaymentFileInput): Promise<PaymentRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const payment = await clinicFixtures.payments.get(input.paymentId);
  return clinicFixtures.payments.update(
    payment.id,
    { attachmentKeys: [...payment.attachmentKeys, input.key] },
    { stamp: false },
  );
}

/**
 * Delete an open-day entry with the confirm's reason (`S:1546`;
 * REPLACE_WITH_API) — "Allowed until the day is closed" (409 after). A receipt's
 * invoice goes back to its due; a supplier bill's purchase to its balance.
 */
export async function deletePayment(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<PaymentRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.payments.get(id);
  await assertEntryOpen(saved);
  const removed = await clinicFixtures.payments.remove(id, reason, note);
  if (saved.billRef && saved.billRef.kind !== 'other') {
    await settleBill(saved.billRef, -saved.amount);
  }
  return removed;
}

/**
 * Put a deleted entry back — the Undo of its "removed" toast (`POST …/restore`,
 * D32); a 409 once its day has closed.
 */
export async function restorePayment(id: string): Promise<PaymentRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const deleted = await clinicFixtures.payments.get(id, { includeDeleted: true });
  await assertDayOpen(
    deleted.branchId,
    ledgerDayOf(deleted),
    `${displayId.payment(deleted.seq)} · ${DAY_CLOSED}`,
  );
  const restored = await clinicFixtures.payments.restore(id);
  if (restored.billRef && restored.billRef.kind !== 'other') {
    await settleBill(restored.billRef, restored.amount);
  }
  return restored;
}
