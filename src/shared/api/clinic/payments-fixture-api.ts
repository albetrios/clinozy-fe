import { rupeesOfPaise } from '@/lib/number-text.ts';

import { displayId } from './clinic-display-id.ts';
import { createdFilterMatches } from './clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CreateInput,
  type CursorPage,
  FIXTURE_ACTOR_ID,
} from './clinic-fixture-store.ts';
import { invoiceBalance } from './clinic-money.ts';
import type { DeleteReason, MedicalPurchaseOrder } from './clinic-schema.ts';
import { clinicClockTime, clinicInstant, clinicToday } from './clinic-time.ts';
import { assertDayOpen, ledgerDayOf, runDayCloseJob } from './day-close-fixture-api.ts';
import { patientName } from './patients-fixture-contracts.ts';
import type {
  LedgerInvoice,
  LedgerPerson,
  LedgerRow,
  LedgerSplit,
  MoneyMode,
  PaymentEdit,
} from './payments-contracts.ts';
import type {
  FixtureLedgerListParams,
  FixtureSupplierBill,
  PaymentRecord,
} from './payments-fixture-contracts.ts';

/*
 * The fixture ledger the parked Medical room reads (D153 seam) — Medical › Payments' list, its
 * "Pay all received" bills, the Undo of a Collect and the confirm's delete — and the entry every
 * fixture money write starts from. The rows come out in the live ledger's shape (`LedgerRow`,
 * rupees) so the shared ledger table draws them; the world stays in paise. The Payments room reads
 * clinozy-be (`payments-api.ts`); this goes with the Medical room's move.
 */

/** TanStack Query keys for the fixture ledger — all under `['clinic', 'fixture-payments']`. */
export const fixtureLedgerQueryKeys = {
  all: ['clinic', 'fixture-payments'] as const,
  /** Every fixture ledger variant — a fixture money write invalidates them all. */
  lists: () => [...fixtureLedgerQueryKeys.all, 'list'] as const,
  list: (params: FixtureLedgerListParams) =>
    [...fixtureLedgerQueryKeys.lists(), params] as const,
  /** The fixture supplier bills with a balance. */
  openBills: () => [...fixtureLedgerQueryKeys.all, 'open-bills'] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

const DAY_CLOSED = 'Day closed';
const FROM_CREDIT = 'From';
const MORE_THAN_DUE = 'More than what is due';

// ── The rows ──

/** What a row names beside its entry, from the world. */
interface LedgerContext {
  patients: ReadonlyMap<string, string>;
  invoices: ReadonlyMap<string, LedgerInvoice>;
  creditNotes: ReadonlyMap<string, number>;
  purchases: ReadonlyMap<string, number>;
  credits: ReadonlyMap<string, number>;
  staff: ReadonlyMap<string, LedgerPerson>;
  viewerId: string;
}

/** The joins every fixture ledger read needs. */
async function ledgerContext(): Promise<LedgerContext> {
  const { clinicFixtures: world } = await fixtureWorld();
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  const payments = world.payments.snapshot();
  const bySeq = <T extends { id: string; seq: number }>(rows: readonly T[]) =>
    new Map(rows.map((row) => [row.id, row.seq]));
  return {
    patients: new Map(
      world.patients.snapshot().map((patient) => [patient.id, patientName(patient)]),
    ),
    invoices: new Map(
      world.invoices.snapshot().map((invoice) => [
        invoice.id,
        {
          seq: invoice.seq,
          number: displayId.invoice(invoice.seq),
          type: invoice.type,
          due: rupeesOfPaise(invoiceBalance(invoice, payments).due),
        },
      ]),
    ),
    creditNotes: bySeq(world.creditNotes.snapshot()),
    purchases: new Map([
      ...bySeq(world.purchaseOrders.snapshot()),
      ...bySeq(world.stockPurchases.snapshot()),
    ]),
    credits: bySeq(world.pendingCredits.snapshot()),
    staff: new Map(
      world.staff.snapshot().map((member) => [
        member.id,
        {
          id: member.id,
          name: [member.firstName, member.lastName].filter(Boolean).join(' '),
          initials: member.initials,
          tone: member.tone,
        },
      ]),
    ),
    viewerId: FIXTURE_VIEWER_ID,
  };
}

/** The value `id` names in `map`, null when there is no id or no such entry. */
function lookup<T>(map: ReadonlyMap<string, T>, id: string | null): T | null {
  return id === null ? null : (map.get(id) ?? null);
}

/** Splits in rupees. */
const splitsOf = (splits: PaymentRecord['splits']): LedgerSplit[] =>
  splits.map((split) => ({ mode: split.mode, amount: rupeesOfPaise(split.amount) }));

/** A side of a fixture edit as splits: its amount on its first mode. */
const editSplitsOf = (side: PaymentRecord['edits'][number]['from']): LedgerSplit[] =>
  side.modes.map((mode, index) => ({
    mode,
    amount: index === 0 ? rupeesOfPaise(side.amount) : 0,
  }));

/** The last logged edit of a fixture entry as the live ledger reads one. */
function lastEditOf(payment: PaymentRecord): PaymentEdit | null {
  const last = payment.edits.at(-1);
  if (!last) return null;
  return {
    id: `${payment.id}:${payment.edits.length}`,
    at: last.at,
    authorId: last.byId,
    changes: { splits: { from: editSplitsOf(last.from), to: editSplitsOf(last.to) } },
  };
}

/** The supplier bill an entry paid. */
function billOf(payment: PaymentRecord, context: LedgerContext): LedgerRow['bill'] {
  const { billRef } = payment;
  if (!billRef || billRef.kind === 'other') return null;
  return {
    kind: billRef.kind,
    purchaseId: billRef.purchaseId,
    seq: context.purchases.get(billRef.purchaseId) ?? 0,
    billNo: billRef.billNo,
  };
}

/** A fixture entry as a live ledger row: rupees, the names it points at, its lock. */
function toLedgerRow(payment: PaymentRecord, context: LedgerContext): LedgerRow {
  const authorId =
    payment.createdById === FIXTURE_ACTOR_ID ? context.viewerId : payment.createdById;
  const by = context.staff.get(authorId) ?? null;
  const billRef = payment.billRef?.kind === 'other' ? null : payment.billRef;
  return {
    id: payment.id,
    seq: payment.seq,
    direction: payment.direction,
    kind: payment.kind,
    branchId: payment.branchId,
    amount: rupeesOfPaise(payment.amount),
    splits: splitsOf(payment.splits),
    paidAt: payment.paidAt,
    contactId: null,
    contact: null,
    partyName: lookup(context.patients, payment.patientId) ?? payment.payeeName ?? '',
    patientId: payment.patientId,
    invoiceId: payment.invoiceId,
    creditNoteId: payment.creditNoteId,
    pendingCreditId: payment.pendingCreditId,
    stockPurchaseId: billRef?.kind === 'stock_po' ? billRef.purchaseId : null,
    medicalPurchaseOrderId: billRef?.kind === 'medical_po' ? billRef.purchaseId : null,
    reversesPaymentId: null,
    reversedByPaymentId: null,
    payeeName: payment.payeeName,
    expenseCategory: payment.expenseCategory,
    reference: payment.reference,
    note: payment.note,
    attachmentKeys: payment.attachmentKeys,
    isSettled: payment.dayCloseId !== null,
    editCount: payment.edits.length,
    lastEdit: lastEditOf(payment),
    createdById: by?.id ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    invoice: lookup(context.invoices, payment.invoiceId),
    creditNoteSeq: lookup(context.creditNotes, payment.creditNoteId),
    pendingCreditSeq: lookup(context.credits, payment.pendingCreditId),
    bill: billOf(payment, context),
    by,
  };
}

/** Fixture entries as live ledger rows, newest first. */
export async function fixtureLedgerRows(
  payments: readonly PaymentRecord[],
): Promise<LedgerRow[]> {
  const context = await ledgerContext();
  return [...payments].sort(newestFirst).map((payment) => toLedgerRow(payment, context));
}

// ── Search and filters (the fixture server's) ──

const squeeze = (text: string) => text.toLowerCase().replace(/[\s#·-]/g, '');

/** Whether a row matches `q`: "PAY-5512", the party, "#785", the note or the reference. */
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

/** Medical's own entries: on Medical invoices, Medical PO bills, expenses in Medicines (`S:1662`). */
const isMedical = (row: LedgerRow) =>
  row.invoice?.type === 'medical' ||
  row.bill?.kind === 'medical_po' ||
  row.expenseCategory === 'medicines';

/** The What filter's kind for an entry: a supplier bill is an expense. */
const whatOf = (row: LedgerRow) => (row.kind === 'supplier_bill' ? 'expense' : row.kind);

/** The list params' checks, each passing while its param is unset. */
const LEDGER_CHECKS: readonly ((
  row: LedgerRow,
  params: FixtureLedgerListParams,
  today: string,
) => boolean)[] = [
  (row, { direction }) => !direction || row.direction === direction,
  (row, { kind }) => !kind?.length || (kind as readonly string[]).includes(whatOf(row)),
  (row, { mode }) =>
    !mode?.length || row.splits.some((split) => mode.includes(split.mode)),
  (row, { created }, today) =>
    !created || createdFilterMatches(row.createdAt, created, today),
  (row, { branchIds }) => !branchIds?.length || branchIds.includes(row.branchId),
  (row, { scope }) => scope !== 'medical' || isMedical(row),
  (row, { q }) => matchesSearch(row, q ?? ''),
];

/** Newest first — `paidAt`, then the newer number. */
const newestFirst = (
  a: Pick<PaymentRecord, 'paidAt' | 'seq'>,
  b: Pick<PaymentRecord, 'paidAt' | 'seq'>,
) => compareText(b.paidAt, a.paidAt) || b.seq - a.seq;

// ── Reads ──

/**
 * One cursor page of the fixture ledger, newest first, filtered by Show, What, Mode, Created,
 * `q`, the header branches and — for Medical › Payments — the Medical scope.
 */
export async function listFixtureLedger(
  params: FixtureLedgerListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<LedgerRow>> {
  await runDayCloseJob();
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const rows = (await fixtureLedgerRows(clinicFixtures.payments.snapshot())).filter(
    (row) => LEDGER_CHECKS.every((check) => check(row, params, today)),
  );
  const start = cursor ? Number(cursor) : 0;
  const end = start + 50;
  return {
    items: rows.slice(start, end),
    nextCursor: end < rows.length ? String(end) : null,
  };
}

/** A Medical PO's bill: Σ qty × rate — free units are not billed (`S:769`). */
function purchaseOrderBill(order: MedicalPurchaseOrder): number {
  return order.items.reduce((sum, item) => sum + item.qty * item.rate, 0);
}

/** On the same day a Medical PO comes before a Clinic stock purchase. */
const BILL_KIND_ORDER: Readonly<Record<FixtureSupplierBill['kind'], number>> = {
  medical_po: 0,
  stock_po: 1,
};

/**
 * The fixture supplier bills with a balance — received Medical POs and Clinic stock purchases,
 * oldest first, each with its supplier, bill number and due (paise).
 */
export async function listFixtureOpenSupplierBills(): Promise<FixtureSupplierBill[]> {
  const { clinicFixtures } = await fixtureWorld();
  const suppliers = new Map(
    clinicFixtures.suppliers.snapshot().map((supplier) => [supplier.id, supplier.name]),
  );
  const vendors = new Map(
    clinicFixtures.stockVendors.snapshot().map((vendor) => [vendor.id, vendor.name]),
  );
  const medical = clinicFixtures.purchaseOrders
    .snapshot((order) => order.stage === 'received')
    .map((order): FixtureSupplierBill => ({
      kind: 'medical_po',
      purchaseId: order.id,
      seq: order.seq,
      billNo: order.supplierBillNo ?? '',
      supplierName: suppliers.get(order.supplierId) ?? '',
      date: order.date,
      due: Math.max(0, purchaseOrderBill(order) - order.paid),
    }));
  const stock = clinicFixtures.stockPurchases
    .snapshot()
    .map((purchase): FixtureSupplierBill => ({
      kind: 'stock_po',
      purchaseId: purchase.id,
      seq: purchase.seq,
      billNo: purchase.billNo ?? '',
      supplierName: vendors.get(purchase.vendorId) ?? '',
      date: purchase.date,
      due: Math.max(0, purchase.bill - purchase.paid),
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

/**
 * What every new fixture ledger entry starts from — the fixture invoices server's "Paid now",
 * Medical's Collect and refunds; the kind's fields come from the caller.
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

/** The paid figure of a fixture purchase moves by `delta` paise; a Medical PO paid in full is Paid. */
async function settleBill(
  world: FixtureWorld,
  billRef: NonNullable<PaymentRecord['billRef']>,
  delta: number,
): Promise<void> {
  if (billRef.kind === 'medical_po') {
    const order = await world.purchaseOrders.get(billRef.purchaseId);
    const paid = Math.max(0, order.paid + delta);
    const settled = paid >= purchaseOrderBill(order);
    let stage = order.stage;
    if (settled && order.stage === 'received') stage = 'paid';
    else if (!settled && order.stage === 'paid') stage = 'received';
    await world.purchaseOrders.update(order.id, { paid, stage });
    return;
  }
  if (billRef.kind === 'stock_po') {
    const purchase = await world.stockPurchases.get(billRef.purchaseId);
    await world.stockPurchases.update(purchase.id, {
      paid: Math.max(0, purchase.paid + delta),
    });
  }
}

/** What a fixture expense or supplier-bill payment sends (paise). */
export interface FixtureExpenseInput {
  branchId: string;
  billRef: { kind: 'medical_po' | 'stock_po'; purchaseId: string; billNo: string } | null;
  payeeName: string;
  expenseCategory: NonNullable<PaymentRecord['expenseCategory']>;
  amount: number;
  mode: MoneyMode;
  /** The clinic day it was paid. */
  paidOn: string;
  note: string | null;
}

/** The instant an entry paid on `day` is recorded at: now, or that day at the current clock time. */
function paidAtOn(day: string): string {
  const now = new Date();
  if (day === clinicToday(now)) return now.toISOString();
  return clinicInstant(day, clinicClockTime(now));
}

/**
 * A fixture expense, or a payment against a fixture supplier bill — which raises that purchase's
 * paid. A closed day is a 409; more than the bill's due a 422.
 */
export async function payFixtureExpense(input: FixtureExpenseInput): Promise<LedgerRow> {
  const { clinicFixtures } = await fixtureWorld();
  if (input.billRef) {
    const bills = await listFixtureOpenSupplierBills();
    const bill = bills.find((open) => open.purchaseId === input.billRef?.purchaseId);
    if (!bill || input.amount > bill.due) {
      throw clinicHttpError(422, 'validation', MORE_THAN_DUE, {
        amount: [MORE_THAN_DUE],
      });
    }
  }
  await assertDayOpen(input.branchId, input.paidOn);
  const payment = await clinicFixtures.payments.create(
    newLedgerEntry({
      direction: 'paid',
      kind: input.billRef ? 'supplier_bill' : 'expense',
      branchId: input.branchId,
      amount: input.amount,
      splits: [{ mode: input.mode, amount: input.amount }],
      payeeName: input.payeeName,
      expenseCategory: input.expenseCategory,
      billRef: input.billRef,
      note: input.note,
      paidAt: paidAtOn(input.paidOn),
    }),
  );
  if (input.billRef) await settleBill(clinicFixtures, input.billRef, input.amount);
  const [row] = await fixtureLedgerRows([payment]);
  if (!row) throw new Error('payments: the entry did not map');
  return row;
}

/**
 * Refuse a change to a fixture entry a pending credit settled ("PAY-5601 · From CR-2") or whose
 * day is closed ("PAY-5509 · Day closed"), 409.
 */
async function assertEntryOpen(world: FixtureWorld, payment: PaymentRecord) {
  await runDayCloseJob();
  const current = await world.payments.get(payment.id);
  if (current.pendingCreditId !== null) {
    const credit = await world.pendingCredits.get(current.pendingCreditId, {
      includeDeleted: true,
    });
    throw clinicHttpError(
      409,
      'conflict',
      `${displayId.payment(payment.seq)} · ${FROM_CREDIT} ${displayId.pendingCredit(credit.seq)}`,
    );
  }
  const closed = `${displayId.payment(payment.seq)} · ${DAY_CLOSED}`;
  if (current.dayCloseId !== null) throw clinicHttpError(409, 'conflict', closed);
  await assertDayOpen(payment.branchId, ledgerDayOf(payment), closed);
}

/**
 * Delete an open-day fixture entry with the confirm's reason — a 409 once its day closed. A
 * supplier bill's purchase goes back to its balance.
 */
export async function deleteFixturePayment(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<PaymentRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.payments.get(id);
  await assertEntryOpen(clinicFixtures, saved);
  const removed = await clinicFixtures.payments.remove(id, reason, note);
  if (saved.billRef && saved.billRef.kind !== 'other') {
    await settleBill(clinicFixtures, saved.billRef, -saved.amount);
  }
  return removed;
}

/** Put a deleted fixture entry back — the Undo; a 409 once its day closed. */
export async function restoreFixturePayment(id: string): Promise<PaymentRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const deleted = await clinicFixtures.payments.get(id, { includeDeleted: true });
  await assertDayOpen(
    deleted.branchId,
    ledgerDayOf(deleted),
    `${displayId.payment(deleted.seq)} · ${DAY_CLOSED}`,
  );
  const restored = await clinicFixtures.payments.restore(id);
  if (restored.billRef && restored.billRef.kind !== 'other') {
    await settleBill(clinicFixtures, restored.billRef, restored.amount);
  }
  return restored;
}
