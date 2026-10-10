import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { createdRangeOf } from './clinic-filter-ranges.ts';
import type { DeleteReason } from './clinic-schema.ts';
import { civilDayOffset, clinicToday } from './clinic-time.ts';
import { fetchTeamDirectory, teamDirectoryQueryKey } from './directory-api.ts';
import {
  type LedgerKindFilter,
  type LedgerListParams,
  type LedgerPerson,
  type LedgerRow,
  openMedicalBillWire,
  openStockBillWire,
  type OpenSupplierBill,
  type PayExpenseInput,
  paymentChangeOf,
  type PaymentEdit,
  paymentEditWire,
  paymentOutBodyOf,
  type PaymentPatch,
  type PaymentRecord,
  paymentRowWire,
  paymentWire,
  receiptBodyOf,
  type ReceivePaymentInput,
  stockVendorNameWire,
  type SupplierBillKind,
  toLedgerRow,
  toPaymentEdit,
  toPaymentRecord,
} from './payments-contracts.ts';

/*
 * The Payments ledger on clinozy-be (`/app/payments`, api-integration §5.8): the list in cursor
 * pages of 50 with Show, What, Mode, Created, the person or `PAY-` search, the reviewed day and
 * the header branches; one entry and its edit log; a patient's and an invoice's entries; the
 * supplier bills Send payment settles; Receive, Send, a change (with its read's `updated_at`), a
 * delete with its reason, its restore, and a settled entry's reversal. Each row's "By" comes from
 * the team directory — one cached read, never one per row. Every key carries the organization;
 * every write carries the action's key.
 */

/** TanStack Query keys for the ledger — all under `['clinic', 'payments']`, each carrying the organization. */
export const paymentQueryKeys = {
  all: ['clinic', 'payments'] as const,
  /** Every ledger variant — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...paymentQueryKeys.all, organizationId, 'list'] as const,
  list: (organizationId: string | null, params: LedgerListParams) =>
    [...paymentQueryKeys.lists(organizationId), params] as const,
  /** The ledger's count for its params — under `lists`, so every write refreshes it. */
  count: (organizationId: string | null, params: LedgerListParams) =>
    [...paymentQueryKeys.lists(organizationId), 'count', params] as const,
  detail: (organizationId: string | null, paymentId: string) =>
    [...paymentQueryKeys.all, organizationId, 'detail', paymentId] as const,
  /** An entry's edit log. */
  edits: (organizationId: string | null, paymentId: string) =>
    [...paymentQueryKeys.all, organizationId, 'edits', paymentId] as const,
  /** Every patient's entries. */
  patientPaymentLists: (organizationId: string | null) =>
    [...paymentQueryKeys.all, organizationId, 'patient'] as const,
  /** A patient's receipts and refunds — the patient file's Payments. */
  patientPayments: (organizationId: string | null, patientId: string) =>
    [...paymentQueryKeys.patientPaymentLists(organizationId), patientId] as const,
  /**
   * Every organization's open supplier bills — what a purchase or a bill payment refreshes
   * (Clinic stock's writes name it without an organization).
   */
  openBills: () => [...paymentQueryKeys.all, 'open-bills'] as const,
  /** One organization's open supplier bills — Send payment's first step. */
  openBillsOf: (organizationId: string | null) =>
    [...paymentQueryKeys.openBills(), organizationId] as const,
  /** The Clinic stock vendors' names a stock bill shows. */
  vendorNames: (organizationId: string | null) =>
    [...paymentQueryKeys.all, organizationId, 'vendor-names'] as const,
};

/** One page of the ledger — the design's 50. */
const PAGE_SIZE = 50;

/** One page of a whole list — the API's most. */
const ALL_PAGE_SIZE = 100;

/** How long the team directory and the vendors' names are reused before they are read again. */
const JOIN_STALE_MS = 5 * 60_000;

/** The organization the cached joins belong to. */
const activeOrganizationId = () => useOrganizationStore.getState().organizationId;

/** A list page's cursor: the next one while there is more. */
export function nextCursorOf(
  meta: { pagination?: { has_more?: boolean; next?: string | null } } | undefined,
): string | null {
  return meta?.pagination?.has_more ? (meta.pagination.next ?? null) : null;
}

/** The API's estimated count of the whole list — on its first page; null when left out. */
export const estimatedTotalOf = (
  meta: { pagination?: { estimated_total?: number } } | undefined,
) => meta?.pagination?.estimated_total ?? null;

/** A list filter as the API takes it — comma-joined, none when empty. */
const listOf = (values: readonly string[] | undefined) =>
  values?.length ? values.join(',') : undefined;

/** A search as the API takes it — none when blank. */
const searchOf = (q: string | undefined) => (q?.trim() ? q.trim() : undefined);

// ── Who recorded it ──

/**
 * The team by membership id as the "By" cells show them — the team directory, read once and
 * cached; a member who left is not in it (their rows show no one).
 */
export async function fetchLedgerTeam(): Promise<ReadonlyMap<string, LedgerPerson>> {
  const team = await queryClient.query({
    queryKey: teamDirectoryQueryKey(activeOrganizationId()),
    queryFn: fetchTeamDirectory,
    staleTime: JOIN_STALE_MS,
  });
  return new Map(
    team.map((member) => [
      member.id,
      { id: member.id, name: member.name, initials: member.initials, tone: member.tone },
    ]),
  );
}

/** Records with their authors — no read when none names one. */
export async function withAuthors<Item extends { createdById: string | null }, Row>(
  items: readonly Item[],
  toRow: (item: Item, team: ReadonlyMap<string, LedgerPerson>) => Row,
): Promise<Row[]> {
  const team = items.some((item) => item.createdById !== null)
    ? await fetchLedgerTeam()
    : new Map<string, LedgerPerson>();
  return items.map((item) => toRow(item, team));
}

/** Entries as ledger rows, each with its author. */
const ledgerRowsOf = (records: readonly PaymentRecord[]): Promise<LedgerRow[]> =>
  withAuthors(records, toLedgerRow);

/** One entry as its row. */
async function ledgerRowOf(data: unknown): Promise<LedgerRow> {
  const [row] = await ledgerRowsOf([toPaymentRecord(paymentWire.parse(data))]);
  if (!row) throw new Error('payments: no entry in the answer');
  return row;
}

// ── The ledger ──

/** The What filter as the API's kinds: an expense reads supplier bills too. */
const KIND_QUERY: Readonly<Record<LedgerKindFilter, string>> = {
  receipt: 'receipt',
  refund: 'refund',
  expense: 'expense,supplier_bill',
  money_back: 'money_back',
};

/** The ledger read's query for the URL's params, on the clinic's `today` — newest first. */
export function ledgerListQuery(params: LedgerListParams, today: string = clinicToday()) {
  const created = params.created ? createdRangeOf(params.created, today) : {};
  return {
    limit: PAGE_SIZE,
    direction: params.direction,
    kind: params.kind?.length
      ? params.kind.map((kind) => KIND_QUERY[kind]).join(',')
      : undefined,
    mode: listOf(params.mode),
    branch_id: listOf(params.branchIds),
    q: searchOf(params.q),
    paid_date_from: params.day,
    paid_date_to: params.day,
    created_from: created.from,
    created_to: created.to,
  };
}

/** A page of ledger rows with the cursor of the next and the API's estimated total. */
export interface LedgerPage {
  rows: LedgerRow[];
  next: string | null;
  total: number | null;
}

/** One page of the ledger for the URL's params, each row with its author; `after` is the cursor. */
export async function listLedger(
  params: LedgerListParams,
  after?: string,
): Promise<LedgerPage> {
  const response = await api.get('/app/payments', {
    query: { ...ledgerListQuery(params), after },
  });
  const records = z
    .array(paymentRowWire)
    .parse(response.data ?? [])
    .map(toPaymentRecord);
  return {
    rows: await ledgerRowsOf(records),
    next: nextCursorOf(response.meta),
    total: estimatedTotalOf(response.meta),
  };
}

/**
 * How many entries the ledger's params match — the API's count of the whole list
 * (`estimated_total`, "at least" from 10,000), read with one row; null when left out.
 */
export async function fetchLedgerCount(params: LedgerListParams): Promise<number | null> {
  const response = await api.get('/app/payments', {
    query: { ...ledgerListQuery(params), limit: 1 },
  });
  return estimatedTotalOf(response.meta);
}

/** One entry with its author — a 404 when it is unknown or deleted. */
export async function fetchPayment(paymentId: string): Promise<LedgerRow> {
  const response = await api.get('/app/payments/{payment_id}', {
    params: { payment_id: paymentId },
  });
  return ledgerRowOf(response.data);
}

/** An entry's changes, oldest first (`GET /app/payments/:payment_id/edits`, every page). */
export async function listPaymentEdits(paymentId: string): Promise<PaymentEdit[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/payments/{payment_id}/edits', {
      params: { payment_id: paymentId },
      query: { limit: ALL_PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z
        .array(paymentEditWire)
        .parse(response.data ?? [])
        .map(toPaymentEdit),
      next: nextCursorOf(response.meta),
    };
  }, 'payment-edits');
}

/** Every entry one record names — a patient's, an invoice's — newest first, with their authors. */
async function fetchAllPayments(filter: {
  patient_id?: string;
  invoice_id?: string;
  branch_id?: string;
  paid_date_from?: string;
  paid_date_to?: string;
}): Promise<LedgerRow[]> {
  const records = await collectAllPages(async (after) => {
    const response = await api.get('/app/payments', {
      query: { ...filter, limit: ALL_PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z
        .array(paymentRowWire)
        .parse(response.data ?? [])
        .map(toPaymentRecord),
      next: nextCursorOf(response.meta),
    };
  }, 'payments');
  return ledgerRowsOf(records);
}

/** A patient's entries — their contact's receipts, refunds and the rest — newest first. */
export function listPatientPayments(patientId: string): Promise<LedgerRow[]> {
  return fetchAllPayments({ patient_id: patientId });
}

/** The entries against an invoice — its receipts and refunds — newest first. */
export function listInvoicePayments(invoiceId: string): Promise<LedgerRow[]> {
  return fetchAllPayments({ invoice_id: invoiceId });
}

/** A branch-day's entries — Day close's review — newest first. */
export function listDayPayments(branchId: string, date: string): Promise<LedgerRow[]> {
  return fetchAllPayments({
    branch_id: branchId,
    paid_date_from: date,
    paid_date_to: date,
  });
}

// ── Supplier bills ──

/** Every Clinic stock vendor's name by id — read once and cached. */
async function stockVendorNames(): Promise<ReadonlyMap<string, string>> {
  const vendors = await queryClient.query({
    queryKey: paymentQueryKeys.vendorNames(activeOrganizationId()),
    queryFn: () =>
      collectAllPages(async (after) => {
        const response = await api.get('/app/stock-vendors', {
          query: { limit: ALL_PAGE_SIZE, after: after ?? undefined, sort: 'name' },
        });
        return {
          rows: z.array(stockVendorNameWire).parse(response.data ?? []),
          next: nextCursorOf(response.meta),
        };
      }, 'stock-vendor-names'),
    staleTime: JOIN_STALE_MS,
  });
  return new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
}

/** The Clinic stock purchases with a balance, oldest first, each with its vendor. */
async function openStockBills(today: string): Promise<OpenSupplierBill[]> {
  const purchases = await collectAllPages(async (after) => {
    const response = await api.get('/app/stock-purchases', {
      query: {
        payment_status: 'unpaid,partial',
        sort: 'purchase_date',
        order: 'asc',
        limit: ALL_PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z.array(openStockBillWire).parse(response.data ?? []),
      next: nextCursorOf(response.meta),
    };
  }, 'open-stock-bills');
  if (purchases.length === 0) return [];
  const vendors = await stockVendorNames();
  return purchases.map((purchase) => ({
    kind: 'stock_po',
    purchaseId: purchase.id,
    seq: purchase.stock_purchase_number,
    billNo: purchase.bill_number,
    supplierName: vendors.get(purchase.stock_vendor_id) ?? '',
    date: purchase.purchase_date,
    due: purchase.due_amount,
    daysPending: Math.max(0, civilDayOffset(purchase.purchase_date, today)),
  }));
}

/** The received Medical POs with a balance, oldest first, each with its supplier. */
async function openMedicalBills(today: string): Promise<OpenSupplierBill[]> {
  const orders = await collectAllPages(async (after) => {
    const response = await api.get('/app/medical-purchase-orders', {
      query: {
        stage: 'received',
        payment_status: 'unpaid,partial',
        sort: 'order_date',
        order: 'asc',
        limit: ALL_PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z.array(openMedicalBillWire).parse(response.data ?? []),
      next: nextCursorOf(response.meta),
    };
  }, 'open-medical-bills');
  return orders.map((order) => ({
    kind: 'medical_po',
    purchaseId: order.id,
    seq: order.purchase_order_number,
    billNo: order.supplier_bill_number,
    supplierName: order.supplier.name,
    date: order.order_date,
    due: order.due_amount,
    daysPending: Math.max(0, civilDayOffset(order.order_date, today)),
  }));
}

/** On the same day a Medical PO comes before a Clinic stock purchase, as the picker groups them. */
const BILL_KIND_ORDER: Readonly<Record<SupplierBillKind, number>> = {
  medical_po: 0,
  stock_po: 1,
};

/** Which supplier bills the member may read: Clinic stock's (`stock_item:read`), Medical's (`medicine:read`). */
export interface SupplierBillAccess {
  stock: boolean;
  medical: boolean;
}

/**
 * The supplier bills with a balance Send payment settles: Clinic stock purchases and received
 * Medical POs, oldest first, each with its supplier, bill number, due and age — only the kinds the
 * member may read (a Counsellor sends expenses only).
 */
export async function listOpenSupplierBills(
  access: SupplierBillAccess,
): Promise<OpenSupplierBill[]> {
  const today = clinicToday();
  const [stock, medical] = await Promise.all([
    access.stock ? openStockBills(today) : [],
    access.medical ? openMedicalBills(today) : [],
  ]);
  return [...medical, ...stock].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      BILL_KIND_ORDER[a.kind] - BILL_KIND_ORDER[b.kind] ||
      a.seq - b.seq,
  );
}

// ── Writes ──

/**
 * Receive payment (`POST /app/payments`, `kind: receipt`): a receipt from a patient against one
 * of their invoices or none (an advance). `409 more_than_due` above the invoice's due, `409
 * day_closed` on a closed day.
 */
export async function receivePayment({
  input,
  idempotencyKey,
}: {
  input: ReceivePaymentInput;
  idempotencyKey: string;
}): Promise<LedgerRow> {
  const response = await api.post('/app/payments', {
    body: receiptBodyOf(input),
    idempotencyKey,
  });
  return ledgerRowOf(response.data);
}

/**
 * Send payment (`POST /app/payments`): clinic spend in a category (`expense`), or a payment
 * against a supplier bill (`supplier_bill`, no category) — which raises that purchase's paid on
 * the server. `409 day_closed` on a closed day.
 */
export async function payExpense({
  input,
  idempotencyKey,
}: {
  input: PayExpenseInput;
  idempotencyKey: string;
}): Promise<LedgerRow> {
  const response = await api.post('/app/payments', {
    body: paymentOutBodyOf(input),
    idempotencyKey,
  });
  return ledgerRowOf(response.data);
}

/**
 * Change an open-day entry (`PATCH /app/payments/:payment_id`): only what differs, with the
 * read's `updated_at` — `409 record_changed` when someone saved it since, `409 day_closed` once
 * its day closed. A refund's, a reversal's and a credit's money stay as they are (400). Nothing
 * changed sends nothing and answers the entry as it is.
 */
export async function updatePayment({
  record,
  patch,
  idempotencyKey,
}: {
  record: LedgerRow;
  patch: PaymentPatch;
  idempotencyKey: string;
}): Promise<LedgerRow> {
  const change = paymentChangeOf(record, patch);
  if (Object.keys(change).length === 0) return record;
  const response = await api.patch('/app/payments/{payment_id}', {
    params: { payment_id: record.id },
    body: { ...change, expected_updated_at: record.updatedAt },
    idempotencyKey,
  });
  return ledgerRowOf(response.data);
}

/**
 * Delete an open-day entry with the confirm's reason (`DELETE …?reason=&note=`, 204) — "Allowed
 * until the day is closed" (`409 day_closed` after). A receipt's invoice goes back to its due, a
 * bill's purchase to its balance, on the server.
 */
export async function deletePayment({
  paymentId,
  reason,
  note,
}: {
  paymentId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/payments/{payment_id}', {
    params: { payment_id: paymentId },
    reason,
    note: note ?? undefined,
  });
}

/** Put a deleted entry back — the Undo of its "removed" toast; `409 day_closed` once its day closed. */
export async function restorePayment(
  paymentId: string,
  idempotencyKey: string,
): Promise<LedgerRow> {
  const response = await api.post('/app/payments/{payment_id}/restore', {
    params: { payment_id: paymentId },
    idempotencyKey,
  });
  return ledgerRowOf(response.data);
}

/**
 * Reverse a settled entry (`POST /app/payments/:payment_id/reverse`, `payment:delete`): the
 * opposite money as a `reversal` entry, today unless a day is given, the original pointing at it.
 * `409 day_open` while its day is open (delete it instead), `409 already_reversed`. Answers the
 * reversal.
 */
export async function reversePayment({
  paymentId,
  reason,
  paidAt,
  idempotencyKey,
}: {
  paymentId: string;
  reason: string;
  paidAt?: string;
  idempotencyKey: string;
}): Promise<LedgerRow> {
  const response = await api.post('/app/payments/{payment_id}/reverse', {
    params: { payment_id: paymentId },
    body: { reason: reason.trim(), ...(paidAt ? { paid_at: paidAt } : {}) },
    idempotencyKey,
  });
  return ledgerRowOf(response.data);
}
