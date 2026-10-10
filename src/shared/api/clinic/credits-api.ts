import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';

import { createdRangeOf } from './clinic-filter-ranges.ts';
import type { CursorPage } from './clinic-fixture-store.ts';
import type { DeleteReason } from './clinic-schema.ts';
import { clinicToday } from './clinic-time.ts';
import { isContactSearchable } from './contacts-api.ts';
import { contactNameOf, contactRowWire } from './contacts-contracts.ts';
import {
  creditChangeOf,
  creditCreateBodyOf,
  type CreditInput,
  type CreditListParams,
  type CreditPartyRow,
  type CreditRow,
  creditRowWire,
  creditSettleBodyOf,
  type CreditSettlement,
  type CreditSettleResult,
  creditWire,
  type PendingCreditRecord,
  supplierNameWire,
  toCreditRow,
  toPendingCreditRecord,
} from './credits-contracts.ts';
import {
  estimatedTotalOf,
  fetchPayment,
  nextCursorOf,
  withAuthors,
} from './payments-api.ts';
import { stockVendorNameWire } from './payments-contracts.ts';

/*
 * Payments › Pending on clinozy-be (`/app/pending-credits`, api-integration §5.8): the list in
 * cursor pages of 50 by which way, state, Created and the person or `CR-` search; one credit;
 * Add pending's Who picker (the clinic's people, then its stock vendors and Medical suppliers by
 * name); add, change (with its read's `updated_at`, only while nothing is settled), delete with
 * its reason, restore, and settle — in money, or on one of the person's bills. "By" comes from
 * the team directory. Every key carries the organization; every write carries the action's key.
 */

/** TanStack Query keys for the credits — all under `['clinic', 'credits']`, each carrying the organization. */
export const creditQueryKeys = {
  all: ['clinic', 'credits'] as const,
  /** Every Pending variant — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...creditQueryKeys.all, organizationId, 'list'] as const,
  list: (organizationId: string | null, params: CreditListParams) =>
    [...creditQueryKeys.lists(organizationId), params] as const,
  detail: (organizationId: string | null, creditId: string) =>
    [...creditQueryKeys.all, organizationId, 'detail', creditId] as const,
  /** Add pending's Who picker — its pages, by the text searched. */
  parties: (organizationId: string | null) =>
    [...creditQueryKeys.all, organizationId, 'parties'] as const,
};

/** One page of Pending — the design's 50. */
const PAGE_SIZE = 50;

/** One page of the Who picker's people. */
const PARTY_PAGE_SIZE = 30;

/** How many stock vendors and Medical suppliers the Who picker lists, each. */
const SUPPLIERS_PER_GROUP = 10;

/** A list filter as the API takes it — comma-joined, none when empty. */
const listOf = (values: readonly string[] | undefined) =>
  values?.length ? values.join(',') : undefined;

/** A search as the API takes it — none when blank. */
const searchOf = (q: string | undefined) => (q?.trim() ? q.trim() : undefined);

/** Credits as rows, each with who added it. */
const creditRowsOf = (records: readonly PendingCreditRecord[]): Promise<CreditRow[]> =>
  withAuthors(records, toCreditRow);

/** One credit as its row. */
async function creditRowOf(data: unknown): Promise<CreditRow> {
  const [row] = await creditRowsOf([toPendingCreditRecord(creditWire.parse(data))]);
  if (!row) throw new Error('credits: no credit in the answer');
  return row;
}

// ── Reads ──

/** The Pending read's query for the URL's params, on the clinic's `today` — newest first. */
export function creditListQuery(params: CreditListParams, today: string = clinicToday()) {
  const created = params.created ? createdRangeOf(params.created, today) : {};
  // The API takes one way; both ways is no filter.
  const direction = params.direction?.length === 1 ? params.direction[0] : undefined;
  return {
    limit: PAGE_SIZE,
    direction,
    status: listOf(params.status),
    q: searchOf(params.q),
    contact_id: params.contactId,
    invoice_id: params.invoiceId,
    created_from: created.from,
    created_to: created.to,
  };
}

/** A page of Pending rows with the cursor of the next and the API's estimated total. */
export interface CreditPage {
  rows: CreditRow[];
  next: string | null;
  total: number | null;
}

/** One page of credits for the URL's params, each with who added it; `after` is the cursor. */
export async function listPendingCredits(
  params: CreditListParams,
  after?: string,
): Promise<CreditPage> {
  const response = await api.get('/app/pending-credits', {
    query: { ...creditListQuery(params), after },
  });
  const records = z
    .array(creditRowWire)
    .parse(response.data ?? [])
    .map(toPendingCreditRecord);
  return {
    rows: await creditRowsOf(records),
    next: nextCursorOf(response.meta),
    total: estimatedTotalOf(response.meta),
  };
}

/** One credit — a 404 when it is unknown or deleted. */
export async function fetchCredit(creditId: string): Promise<CreditRow> {
  const response = await api.get('/app/pending-credits/{pending_credit_id}', {
    params: { pending_credit_id: creditId },
  });
  return creditRowOf(response.data);
}

/** A 403 — the member may not read that list — as nothing found. */
async function readableOrNone<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    if (isHttpError(error) && error.status === 403) return [];
    throw error;
  }
}

/**
 * The stock vendors and Medical suppliers a search finds — ten of each, each name once; a list
 * the member may not read (`stock_item:read`, `medicine:read`) adds none.
 */
async function suppliersFound(q: string | undefined): Promise<CreditPartyRow[]> {
  const [vendors, suppliers] = await Promise.all([
    readableOrNone(async () => {
      const response = await api.get('/app/stock-vendors', {
        query: { q, sort: 'name', limit: SUPPLIERS_PER_GROUP },
      });
      return z.array(stockVendorNameWire).parse(response.data ?? []);
    }),
    readableOrNone(async () => {
      const response = await api.get('/app/suppliers', {
        query: { q, sort: 'name', limit: SUPPLIERS_PER_GROUP },
      });
      return z.array(supplierNameWire).parse(response.data ?? []);
    }),
  ]);
  const seen = new Set<string>();
  const firstTime = (name: string) => {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  return [
    ...vendors.map((vendor) => ({ kind: 'vendor' as const, ...vendor })),
    ...suppliers.map((supplier) => ({ kind: 'supplier' as const, ...supplier })),
  ]
    .filter((party) => firstTime(party.name))
    .map(({ kind, id, name }) => ({ kind, id, name }));
}

/** One page of the clinic's people a search finds — by name when nothing is typed. */
async function peopleFound(q: string | undefined, cursor: string | null) {
  const response = await api.get('/app/contacts', {
    query: {
      q,
      sort: q ? undefined : 'name',
      order: q ? undefined : 'asc',
      limit: PARTY_PAGE_SIZE,
      after: cursor ?? undefined,
    },
  });
  const rows = z
    .array(contactRowWire)
    .parse(response.data ?? [])
    .map((row): CreditPartyRow => {
      const name = contactNameOf(row);
      return row.patient_id
        ? {
            kind: 'patient',
            contactId: row.id,
            patientId: row.patient_id,
            seq: row.patient_number ?? 0,
            name,
            phone: row.primary_phone,
          }
        : { kind: 'contact', contactId: row.id, name, phone: row.primary_phone };
    });
  return { rows, next: nextCursorOf(response.meta) };
}

/**
 * One page of Add pending's Who picker (`payments.md:157`): the clinic's people — patients and
 * contacts — by name, number or contact number (3+ letters, 4+ digits or a whole `C-` number;
 * all of them, A–Z, for an empty search), then on their last page the stock vendors and Medical
 * suppliers the same text finds.
 */
export async function searchCreditParties(
  query: string,
  cursor: string | null = null,
): Promise<CursorPage<CreditPartyRow>> {
  const text = query.trim();
  const q = text === '' ? undefined : text;
  const people =
    q === undefined || isContactSearchable(q)
      ? await peopleFound(q, cursor)
      : { rows: [], next: null };
  const suppliers = people.next === null ? await suppliersFound(q) : [];
  return { items: [...people.rows, ...suppliers], nextCursor: people.next };
}

// ── Writes ──

/**
 * Add pending (`POST /app/pending-credits`): which way, with whom, the amount, the reason (the
 * chip's key, or the note for "Other"), For invoice, Settle by (the server opens its task) and
 * Note.
 */
export async function createCredit({
  input,
  idempotencyKey,
}: {
  input: CreditInput;
  idempotencyKey: string;
}): Promise<CreditRow> {
  const response = await api.post('/app/pending-credits', {
    body: creditCreateBodyOf(input),
    idempotencyKey,
  });
  return creditRowOf(response.data);
}

/**
 * Edit pending (`PATCH /app/pending-credits/:pending_credit_id`): only what differs, with the
 * read's `updated_at` — `409 record_changed`, and `409 credit_settled` once anything of it is
 * settled. Nothing changed sends nothing.
 */
export async function updateCredit({
  credit,
  input,
  idempotencyKey,
}: {
  credit: CreditRow;
  input: CreditInput;
  idempotencyKey: string;
}): Promise<CreditRow> {
  const change = creditChangeOf(credit, input);
  if (Object.keys(change).length === 0) return credit;
  const response = await api.patch('/app/pending-credits/{pending_credit_id}', {
    params: { pending_credit_id: credit.id },
    body: { ...change, expected_updated_at: credit.updatedAt },
    idempotencyKey,
  });
  return creditRowOf(response.data);
}

/** Delete a credit with the confirm's reason (`DELETE …?reason=&note=`, 204). */
export async function deleteCredit({
  creditId,
  reason,
  note,
}: {
  creditId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/pending-credits/{pending_credit_id}', {
    params: { pending_credit_id: creditId },
    reason,
    note: note ?? undefined,
  });
}

/** Put a deleted credit back — the Undo of its "deleted" toast. */
export async function restoreCredit(
  creditId: string,
  idempotencyKey: string,
): Promise<CreditRow> {
  const response = await api.post('/app/pending-credits/{pending_credit_id}/restore', {
    params: { pending_credit_id: creditId },
    idempotencyKey,
  });
  return creditRowOf(response.data);
}

/** What a settlement settles now, in rupees. */
function amountOf(credit: CreditRow, settled: CreditRow): number {
  return Math.round((settled.settled - credit.settled) * 100) / 100;
}

/**
 * Settle a credit (`POST /app/pending-credits/:pending_credit_id/settle`, `payment:create`): give
 * back or get back money at a branch — a patient's give-back on an invoice is a refund with its
 * credit note — or use it on one of the person's bills with a due (the receipt lands on that
 * invoice's branch, today). Part of it leaves the rest open. Then one read of the entry it wrote,
 * for the toast's numbers ("PAY-6 · CN-003").
 */
export async function settleCredit({
  credit,
  settlement,
  idempotencyKey,
}: {
  credit: CreditRow;
  settlement: CreditSettlement;
  idempotencyKey: string;
}): Promise<CreditSettleResult> {
  const response = await api.post('/app/pending-credits/{pending_credit_id}/settle', {
    params: { pending_credit_id: credit.id },
    body: creditSettleBodyOf(settlement),
    idempotencyKey,
  });
  const settled = await creditRowOf(response.data);
  const written = settled.paymentIds.find((id) => !credit.paymentIds.includes(id));
  // The settlement is written: a failed read of its entry costs the toast its numbers, never
  // the success — a "failed" settlement would be given back twice.
  const entry = written ? await fetchPayment(written).catch(() => null) : null;
  return {
    credit: settled,
    amount: amountOf(credit, settled),
    paymentSeq: entry?.seq ?? null,
    invoiceSeq: entry?.invoice?.seq ?? null,
    creditNoteSeq: entry?.creditNoteSeq ?? null,
  };
}
