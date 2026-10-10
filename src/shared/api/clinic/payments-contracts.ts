import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import { clinicDateOf } from './clinic-filter-match.ts';
import type { CreatedFilter } from './clinic-list-filters.ts';
import {
  type ExpenseCategory,
  expenseCategorySchema,
  type InvoiceType,
  invoiceTypeSchema,
  type PaymentDirection,
  paymentDirectionSchema,
  type PaymentKind,
  paymentKindSchema,
  type PaymentMode,
  paymentModeSchema,
  type Tone,
} from './clinic-schema.ts';
import { clinicClockTime, clinicInstant, clinicToday } from './clinic-time.ts';

/*
 * The Payments ledger on clinozy-be (`/app/payments`, api-integration §5.8): one entry — money in
 * or out — with its splits by mode, the person or payee, the record it settles (an invoice, a
 * credit note, a pending credit, a supplier bill) by id and by the numbers the server joins onto
 * the row (D81), the day's lock (`is_settled`), the edit count and the last change, and who
 * recorded it. Money is rupees as the API sends it. What Receive, Send and an edit send, and the
 * list read's params.
 */

// ── Records ──

/** One split of an entry: a mode and its amount, in rupees. */
export interface LedgerSplit {
  mode: PaymentMode;
  amount: number;
}

/** The person an entry is with — the contact it names. */
interface LedgerContact {
  /** `con_…`. */
  id: string;
  name: string;
  /** Their primary number, E.164. */
  phone: string;
}

/** The invoice an entry settles: its numbers, its type and what it still owes now (rupees). */
export interface LedgerInvoice {
  /** "#5". */
  seq: number;
  /** The statutory number, "2026-27/0005". */
  number: string;
  type: InvoiceType;
  due: number;
}

/** A supplier bill's kind: a Medical purchase order or a Clinic stock purchase. */
export type SupplierBillKind = 'medical_po' | 'stock_po';

/** The supplier bill an entry pays: its kind, the purchase, its number and the supplier's bill number. */
interface LedgerBill {
  kind: SupplierBillKind;
  /** `mpo_…` or `spur_…`. */
  purchaseId: string;
  seq: number;
  billNo: string | null;
}

/** The member behind an entry, as the "By" cell shows them — the team directory's. */
export interface LedgerPerson {
  /** `mem_…`. */
  id: string;
  name: string;
  initials: string;
  tone: Tone;
}

/** One recorded field of an entry's change: its value before and after. */
interface PaymentFieldChange<T> {
  from: T;
  to: T;
}

/** What an entry's change moved, field by field (`{ field: { from, to } }`, D81 PAY-M5). */
interface PaymentChanges {
  splits?: PaymentFieldChange<LedgerSplit[]>;
  reference?: PaymentFieldChange<string | null>;
  note?: PaymentFieldChange<string | null>;
  payeeName?: PaymentFieldChange<string | null>;
  expenseCategory?: PaymentFieldChange<ExpenseCategory | null>;
  paidAt?: PaymentFieldChange<string>;
  attachmentKeys?: PaymentFieldChange<string[]>;
  contactId?: PaymentFieldChange<string | null>;
  invoiceId?: PaymentFieldChange<string | null>;
  stockPurchaseId?: PaymentFieldChange<string | null>;
  medicalPurchaseOrderId?: PaymentFieldChange<string | null>;
}

/** One change of an entry while its day was open — the edit log's line. */
export interface PaymentEdit {
  id: string;
  /** When it was saved. */
  at: string;
  /** Who saved it (`mem_…`); null for an API key. */
  authorId: string | null;
  changes: PaymentChanges;
}

/** A ledger entry as the rooms read it. Money in rupees. */
export interface PaymentRecord {
  /** `pay_…`. */
  id: string;
  /** "PAY-12" is this number. */
  seq: number;
  direction: PaymentDirection;
  kind: PaymentKind;
  branchId: string;
  /** The splits' sum. */
  amount: number;
  splits: LedgerSplit[];
  paidAt: string;
  /** The person's contact (`con_…`), when the entry names one. */
  contactId: string | null;
  contact: LedgerContact | null;
  /** The person's name, else the payee ("Tea & snacks", "Medline Surgicals"); "" for neither. */
  partyName: string;
  patientId: string | null;
  invoiceId: string | null;
  creditNoteId: string | null;
  pendingCreditId: string | null;
  stockPurchaseId: string | null;
  medicalPurchaseOrderId: string | null;
  /** A reversal's original entry. */
  reversesPaymentId: string | null;
  /** The reversal that undid this entry. */
  reversedByPaymentId: string | null;
  payeeName: string | null;
  expenseCategory: ExpenseCategory | null;
  reference: string | null;
  note: string | null;
  attachmentKeys: string[];
  /** Its day is closed: no edit, no delete — a mistake is reversed (`S:87`). */
  isSettled: boolean;
  /** How many times it was changed ("Edited 2×"). */
  editCount: number;
  lastEdit: PaymentEdit | null;
  /** Who recorded it (`mem_…`): their live membership, else the one they left; null for an API key. */
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  /** The invoice it settles ("Invoice #5", "Sale · Invoice #5") and that invoice's due now. */
  invoice: LedgerInvoice | null;
  /** The credit note a refund wrote ("CN-003"). */
  creditNoteSeq: number | null;
  /** The pending credit it settled ("CR-1"). */
  pendingCreditSeq: number | null;
  /** The supplier bill it paid ("Stock PO #8 · bill ZZ-0001"). */
  bill: LedgerBill | null;
}

/** A ledger row: the entry and who recorded it (the team directory's member; null for one who left). */
export interface LedgerRow extends PaymentRecord {
  by: LedgerPerson | null;
}

// ── The wire ──

type ApiPaymentRow = NonNullable<ApiData<'/app/payments', 'get'>>[number];
type ApiPayment = NonNullable<ApiData<'/app/payments/{payment_id}', 'get'>>;
type ApiPaymentEdit = NonNullable<
  ApiData<'/app/payments/{payment_id}/edits', 'get'>
>[number];
/** A new entry as `POST /app/payments` takes it. */
export type ApiPaymentCreate = ApiBody<'/app/payments', 'post'>;
/** A change as `PATCH /app/payments/:payment_id` takes it. */
export type ApiPaymentChange = ApiBody<'/app/payments/{payment_id}', 'patch'>;

const splitWire = z.object({ mode: paymentModeSchema, amount: z.number() });

/** One recorded field's change on the wire. */
const fieldChangeWire = <Value extends z.ZodType>(value: Value) =>
  z.object({ from: value, to: value });

const optionalIdChange = fieldChangeWire(z.string().nullable()).optional();
const optionalTextChange = fieldChangeWire(z.string().nullable()).optional();

const paymentChangesWire = z.object({
  attachment_keys: fieldChangeWire(z.array(z.string())).optional(),
  contact_id: optionalIdChange,
  expense_category: fieldChangeWire(expenseCategorySchema.nullable()).optional(),
  invoice_id: optionalIdChange,
  medical_purchase_order_id: optionalIdChange,
  note: optionalTextChange,
  paid_at: fieldChangeWire(z.string()).optional(),
  payee_name: optionalTextChange,
  reference: optionalTextChange,
  splits: fieldChangeWire(z.array(splitWire)).optional(),
  stock_purchase_id: optionalIdChange,
});

const paymentEditFieldsWire = {
  id: z.string(),
  changes: paymentChangesWire,
  author_membership_id: z.string().nullable(),
  created_at: z.string(),
};

/** One change of an entry (`GET /app/payments/:payment_id/edits`). */
export const paymentEditWire = wireSchema<ApiPaymentEdit>()(
  z.object(paymentEditFieldsWire),
);

const paymentFieldsWire = {
  id: z.string(),
  payment_number: z.number().int(),
  direction: paymentDirectionSchema,
  kind: paymentKindSchema,
  branch_id: z.string(),
  amount: z.number(),
  splits: z.array(splitWire),
  paid_at: z.string(),
  contact: z
    .object({ id: z.string(), name: z.string(), primary_phone: z.string() })
    .nullable(),
  patient_id: z.string().nullable(),
  invoice_id: z.string().nullable(),
  invoice: z
    .object({
      invoice_sequence: z.number().int(),
      invoice_number: z.string(),
      type: invoiceTypeSchema,
      due_amount: z.number(),
    })
    .nullable(),
  invoice_credit_note_id: z.string().nullable(),
  invoice_credit_note_number: z.number().int().nullable(),
  pending_credit_id: z.string().nullable(),
  pending_credit_number: z.number().int().nullable(),
  stock_purchase_id: z.string().nullable(),
  stock_purchase: z
    .object({
      stock_purchase_number: z.number().int(),
      bill_number: z.string().nullable(),
    })
    .nullable(),
  medical_purchase_order_id: z.string().nullable(),
  medical_purchase_order: z
    .object({
      purchase_order_number: z.number().int(),
      supplier_bill_number: z.string().nullable(),
    })
    .nullable(),
  reverses_payment_id: z.string().nullable(),
  reversed_by_payment_id: z.string().nullable(),
  payee_name: z.string().nullable(),
  expense_category: expenseCategorySchema.nullable(),
  reference: z.string().nullable(),
  note: z.string().nullable(),
  attachment_keys: z.array(z.string()),
  is_settled: z.boolean(),
  edit_count: z.number().int(),
  last_edit: z.object(paymentEditFieldsWire).nullable(),
  created_by_membership_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** A ledger list row (`GET /app/payments`). */
export const paymentRowWire = wireSchema<ApiPaymentRow>()(z.object(paymentFieldsWire));

/** One entry (`GET /app/payments/:payment_id`, and every write's answer). */
export const paymentWire = wireSchema<ApiPayment>()(z.object(paymentFieldsWire));

/** An entry as the API sends it. */
type PaymentWire = z.output<typeof paymentRowWire>;

const splitOf = (split: z.output<typeof splitWire>): LedgerSplit => ({
  mode: split.mode,
  amount: split.amount,
});

/** A change's fields as the rooms name them. */
function toPaymentChanges(changes: z.output<typeof paymentChangesWire>): PaymentChanges {
  const out: PaymentChanges = {};
  if (changes.splits) {
    out.splits = {
      from: changes.splits.from.map(splitOf),
      to: changes.splits.to.map(splitOf),
    };
  }
  if (changes.reference) out.reference = changes.reference;
  if (changes.note) out.note = changes.note;
  if (changes.payee_name) out.payeeName = changes.payee_name;
  if (changes.expense_category) out.expenseCategory = changes.expense_category;
  if (changes.paid_at) out.paidAt = changes.paid_at;
  if (changes.attachment_keys) out.attachmentKeys = changes.attachment_keys;
  if (changes.contact_id) out.contactId = changes.contact_id;
  if (changes.invoice_id) out.invoiceId = changes.invoice_id;
  if (changes.stock_purchase_id) out.stockPurchaseId = changes.stock_purchase_id;
  if (changes.medical_purchase_order_id) {
    out.medicalPurchaseOrderId = changes.medical_purchase_order_id;
  }
  return out;
}

/** One change of an entry as the rooms read it. */
export function toPaymentEdit(edit: z.output<typeof paymentEditWire>): PaymentEdit {
  return {
    id: edit.id,
    at: edit.created_at,
    authorId: edit.author_membership_id,
    changes: toPaymentChanges(edit.changes),
  };
}

/** The supplier bill an entry paid, with its numbers. */
function billOf(row: PaymentWire): LedgerBill | null {
  if (row.stock_purchase_id) {
    return {
      kind: 'stock_po',
      purchaseId: row.stock_purchase_id,
      seq: row.stock_purchase?.stock_purchase_number ?? 0,
      billNo: row.stock_purchase?.bill_number ?? null,
    };
  }
  if (row.medical_purchase_order_id) {
    return {
      kind: 'medical_po',
      purchaseId: row.medical_purchase_order_id,
      seq: row.medical_purchase_order?.purchase_order_number ?? 0,
      billNo: row.medical_purchase_order?.supplier_bill_number ?? null,
    };
  }
  return null;
}

/** An entry as the rooms read it. */
export function toPaymentRecord(row: PaymentWire): PaymentRecord {
  return {
    id: row.id,
    seq: row.payment_number,
    direction: row.direction,
    kind: row.kind,
    branchId: row.branch_id,
    amount: row.amount,
    splits: row.splits.map(splitOf),
    paidAt: row.paid_at,
    contactId: row.contact?.id ?? null,
    contact: row.contact
      ? { id: row.contact.id, name: row.contact.name, phone: row.contact.primary_phone }
      : null,
    partyName: row.contact?.name ?? row.payee_name ?? '',
    patientId: row.patient_id,
    invoiceId: row.invoice_id,
    creditNoteId: row.invoice_credit_note_id,
    pendingCreditId: row.pending_credit_id,
    stockPurchaseId: row.stock_purchase_id,
    medicalPurchaseOrderId: row.medical_purchase_order_id,
    reversesPaymentId: row.reverses_payment_id,
    reversedByPaymentId: row.reversed_by_payment_id,
    payeeName: row.payee_name,
    expenseCategory: row.expense_category,
    reference: row.reference,
    note: row.note,
    attachmentKeys: row.attachment_keys,
    isSettled: row.is_settled,
    editCount: row.edit_count,
    lastEdit: row.last_edit ? toPaymentEdit(row.last_edit) : null,
    createdById: row.created_by_membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invoice: row.invoice
      ? {
          seq: row.invoice.invoice_sequence,
          number: row.invoice.invoice_number,
          type: row.invoice.type,
          due: row.invoice.due_amount,
        }
      : null,
    creditNoteSeq: row.invoice_credit_note_number,
    pendingCreditSeq: row.pending_credit_number,
    bill: billOf(row),
  };
}

/** An entry with its author, from the team directory (`mem_…` → the member). */
export function toLedgerRow(
  record: PaymentRecord,
  team: ReadonlyMap<string, LedgerPerson>,
): LedgerRow {
  return {
    ...record,
    by: record.createdById ? (team.get(record.createdById) ?? null) : null,
  };
}

/** The clinic day an entry counts on: the calendar date of `paidAt`, clinic time. */
export function ledgerDayOf(payment: Pick<PaymentRecord, 'paidAt'>): string {
  return clinicDateOf(payment.paidAt);
}

/** One side of a change of the money: the amount and the modes, each once. */
export interface PaymentEditSide {
  amount: number;
  modes: PaymentMode[];
}

const sideOf = (splits: readonly LedgerSplit[]): PaymentEditSide => ({
  amount: splits.reduce((sum, split) => sum + split.amount, 0),
  modes: [...new Set(splits.map((split) => split.mode))],
});

/**
 * The money of a change, before and after — "₹600 UPI → ₹700 UPI" (`payments.md:29`) — from its
 * recorded splits; null when the change left the money as it was.
 */
export function editSidesOf(
  edit: Pick<PaymentEdit, 'changes'>,
): { from: PaymentEditSide; to: PaymentEditSide } | null {
  const splits = edit.changes.splits;
  return splits ? { from: sideOf(splits.from), to: sideOf(splits.to) } : null;
}

// ── Writes ──

/** The modes money moves in (`payments.md:123`) — "Credit" is only ever a credit's. */
export const EXPENSE_MODE_VALUES = ['cash', 'upi', 'card'] as const;
/** One money mode. */
export type MoneyMode = (typeof EXPENSE_MODE_VALUES)[number];

/** A split of money a write sends: cash, UPI or card, above zero, in rupees. */
export interface MoneySplit {
  mode: MoneyMode;
  amount: number;
}

/** Text as a write sends it: trimmed, a blank one as none. */
const textOrNull = (text: string | null | undefined): string | null => {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

/**
 * Receive payment: a receipt from a patient — their contact, always one — against one of their
 * invoices or none (an advance), its splits (one per mode), a reference and a note. Money in
 * rupees.
 */
export interface ReceivePaymentInput {
  branchId: string;
  /** The patient's contact (`con_…`). */
  contactId: string;
  invoiceId: string | null;
  splits: MoneySplit[];
  reference: string | null;
  note: string | null;
}

/** A receipt as `POST /app/payments` takes it; it is paid now (the server stamps the time). */
export function receiptBodyOf(input: ReceivePaymentInput): ApiPaymentCreate {
  return {
    kind: 'receipt',
    branch_id: input.branchId,
    contact_id: input.contactId,
    invoice_id: input.invoiceId,
    splits: input.splits.map(({ mode, amount }) => ({ mode, amount })),
    reference: textOrNull(input.reference),
    note: textOrNull(input.note),
  };
}

/** A supplier bill as the rooms that buy name it: its kind and its purchase (`spur_…`, `mpo_…`). */
export interface SupplierBillRef {
  kind: SupplierBillKind;
  purchaseId: string;
}

/** What Send payment shares for clinic spend and for a supplier bill. Money in rupees. */
interface PaymentOutFields {
  branchId: string;
  /** Who was paid — the supplier, for a bill. */
  payeeName: string;
  amount: number;
  mode: MoneyMode;
  /** The clinic day it was paid ("Date"); today by default. */
  paidOn: string;
  note: string | null;
  /** The uploaded bill photos' storage keys (up to five). */
  attachmentKeys: string[];
}

/**
 * Send payment: clinic spend in a category, or a payment against a supplier bill — which has no
 * category (`400 "Only an expense has a category"`) and raises that purchase's paid on the
 * server (STOCK-M1/M2).
 */
export type PayExpenseInput = PaymentOutFields &
  (
    | { bill: null; expenseCategory: ExpenseCategory }
    | { bill: SupplierBillRef; expenseCategory?: never }
  );

/**
 * The instant an entry paid on `day` is recorded at: none for today (the server stamps now),
 * else that clinic day at the current clock time.
 */
export function paidAtOn(day: string, now: Date = new Date()): string | undefined {
  return day === clinicToday(now) ? undefined : clinicInstant(day, clinicClockTime(now));
}

/** Money out as `POST /app/payments` takes it: an expense with its category, or a supplier bill. */
export function paymentOutBodyOf(
  input: PayExpenseInput,
  now: Date = new Date(),
): ApiPaymentCreate {
  const fields = {
    branch_id: input.branchId,
    splits: [{ mode: input.mode, amount: input.amount }],
    payee_name: input.payeeName.trim(),
    paid_at: paidAtOn(input.paidOn, now),
    note: textOrNull(input.note),
    attachment_keys: input.attachmentKeys,
  };
  if (input.bill === null) {
    return { ...fields, kind: 'expense', expense_category: input.expenseCategory };
  }
  return input.bill.kind === 'stock_po'
    ? { ...fields, kind: 'supplier_bill', stock_purchase_id: input.bill.purchaseId }
    : {
        ...fields,
        kind: 'supplier_bill',
        medical_purchase_order_id: input.bill.purchaseId,
      };
}

/**
 * Changing an open-day entry: a receipt's splits, reference and note; money out's payee,
 * category (an expense only), amount and mode, note, photos and day. Each change of the money is
 * logged on the entry by the server.
 */
export interface PaymentPatch {
  splits?: LedgerSplit[];
  /** Money out's amount and mode — its one split. */
  amount?: number;
  mode?: MoneyMode;
  reference?: string | null;
  note?: string | null;
  payeeName?: string;
  expenseCategory?: ExpenseCategory;
  attachmentKeys?: string[];
  /** The clinic day it was paid. */
  paidOn?: string;
}

/** Whether two sets of splits hold the same amount in each mode. */
function sameSplits(a: readonly LedgerSplit[], b: readonly LedgerSplit[]): boolean {
  if (a.length !== b.length) return false;
  const amounts = new Map(a.map((split) => [split.mode, split.amount]));
  return b.every((split) => amounts.get(split.mode) === split.amount);
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** The splits a patch asks for: its own, else money out's one split from its amount and mode. */
function splitsOf(record: PaymentRecord, patch: PaymentPatch): LedgerSplit[] | undefined {
  if (patch.splits) return patch.splits;
  if (patch.amount === undefined && patch.mode === undefined) return undefined;
  return [
    {
      mode: patch.mode ?? record.splits[0]?.mode ?? 'cash',
      amount: patch.amount ?? record.amount,
    },
  ];
}

/** The text fields a patch changes: the reference, the note and the payee. */
function textChangesOf(record: PaymentRecord, patch: PaymentPatch) {
  const change: Pick<ApiPaymentChange, 'reference' | 'note' | 'payee_name'> = {};
  if (patch.reference !== undefined && textOrNull(patch.reference) !== record.reference) {
    change.reference = textOrNull(patch.reference);
  }
  if (patch.note !== undefined && textOrNull(patch.note) !== record.note) {
    change.note = textOrNull(patch.note);
  }
  if (patch.payeeName !== undefined && textOrNull(patch.payeeName) !== record.payeeName) {
    change.payee_name = textOrNull(patch.payeeName);
  }
  return change;
}

/**
 * A change of an entry as `PATCH /app/payments/:payment_id` takes it — only what differs from
 * the record (no `expected_updated_at`; the api adds it). A category goes only on an expense; a
 * day only when it moved.
 */
export function paymentChangeOf(
  record: PaymentRecord,
  patch: PaymentPatch,
  now: Date = new Date(),
): Omit<ApiPaymentChange, 'expected_updated_at'> {
  const change: Omit<ApiPaymentChange, 'expected_updated_at'> = textChangesOf(
    record,
    patch,
  );
  const splits = splitsOf(record, patch);
  if (splits && !sameSplits(splits, record.splits)) {
    change.splits = splits.map(({ mode, amount }) => ({ mode, amount }));
  }
  if (
    record.kind === 'expense' &&
    patch.expenseCategory !== undefined &&
    patch.expenseCategory !== record.expenseCategory
  ) {
    change.expense_category = patch.expenseCategory;
  }
  if (patch.attachmentKeys && !sameList(patch.attachmentKeys, record.attachmentKeys)) {
    change.attachment_keys = patch.attachmentKeys;
  }
  if (patch.paidOn !== undefined && patch.paidOn !== ledgerDayOf(record)) {
    change.paid_at = paidAtOn(patch.paidOn, now) ?? now.toISOString();
  }
  return change;
}

// ── Reads ──

/**
 * The ledger's "What" filter: the kinds as the What pill tells them apart — a supplier bill is an
 * expense ("Paid", butter), so `expense` reads both on the API.
 */
export const LEDGER_KIND_VALUES = ['receipt', 'refund', 'expense', 'money_back'] as const;

/** One "What" filter value. */
export type LedgerKindFilter = (typeof LEDGER_KIND_VALUES)[number];

/**
 * The ledger read's params: Show (`direction`), What (`kind`), Mode (`mode`), Created and `q` (a
 * `PAY-` number, the payee, or the person — their name, number, email, Instagram or contact
 * number, D81); the day Day close reviews (`day`); the header branches (`branchIds`, empty =
 * all). Newest first — the ledger has no column sort (`payments.md:31`).
 */
export interface LedgerListParams {
  direction?: PaymentDirection;
  kind?: LedgerKindFilter[];
  mode?: PaymentMode[];
  created?: CreatedFilter;
  q?: string;
  day?: string;
  branchIds?: string[];
}

/**
 * A supplier bill Send payment can settle: a received Medical PO or a Clinic stock purchase with
 * a balance — "Medical PO #431 · Shree Ramdev Medical Agency", "Bill 1631 · 8 days pending", the
 * due in rupees.
 */
export interface OpenSupplierBill extends SupplierBillRef {
  seq: number;
  billNo: string | null;
  supplierName: string;
  /** The purchase's calendar date. */
  date: string;
  due: number;
  /** Whole days since the purchase, on the clinic's today. */
  daysPending: number;
}

type ApiStockPurchaseRow = NonNullable<ApiData<'/app/stock-purchases', 'get'>>[number];
type ApiMedicalPurchaseOrderRow = NonNullable<
  ApiData<'/app/medical-purchase-orders', 'get'>
>[number];
type ApiStockVendorRow = NonNullable<ApiData<'/app/stock-vendors', 'get'>>[number];

/** A Clinic stock purchase with a balance, as Send payment reads it (`GET /app/stock-purchases`). */
export const openStockBillWire = wireSchema<ApiStockPurchaseRow>()(
  z.object({
    id: z.string(),
    stock_purchase_number: z.number().int(),
    stock_vendor_id: z.string(),
    bill_number: z.string().nullable(),
    purchase_date: z.string(),
    due_amount: z.number(),
  }),
);

/** A received Medical PO with a balance (`GET /app/medical-purchase-orders`), its supplier embedded. */
export const openMedicalBillWire = wireSchema<ApiMedicalPurchaseOrderRow>()(
  z.object({
    id: z.string(),
    purchase_order_number: z.number().int(),
    supplier: z.object({ id: z.string(), name: z.string() }),
    supplier_bill_number: z.string().nullable(),
    order_date: z.string(),
    due_amount: z.number(),
  }),
);

/** A Clinic stock vendor's name (`GET /app/stock-vendors`) — a stock bill's supplier. */
export const stockVendorNameWire = wireSchema<ApiStockVendorRow>()(
  z.object({ id: z.string(), name: z.string() }),
);

/** A supplier bill's id prefix — the kind is in the public id. */
const BILL_PREFIXES: Readonly<Record<SupplierBillKind, string>> = {
  medical_po: 'mpo_',
  stock_po: 'spur_',
};

/**
 * A supplier bill's key — its purchase's public id (`mpo_…`, `spur_…`, whose prefix names the
 * kind): Send payment's picker key and the `?bill=` that Medical's and Clinic stock's "Pay ₹X"
 * open it on (`S:86`, Q-M1).
 */
export function supplierBillKey(bill: SupplierBillRef): string {
  return bill.purchaseId;
}

/** The supplier bill a key names, by its prefix; null for a key that is no bill's. */
export function supplierBillRefOf(key: string): SupplierBillRef | null {
  for (const kind of ['medical_po', 'stock_po'] as const) {
    if (key.startsWith(BILL_PREFIXES[kind])) return { kind, purchaseId: key };
  }
  return null;
}
