import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  type ClinicInvoiceType,
  invoiceChangeOf,
  invoiceCreateBodyOf,
  type InvoiceDetail,
  type InvoiceInput,
  invoiceListMetaWire,
  type InvoiceListParams,
  type InvoicePage,
  invoicePartyOf,
  type InvoicePresets,
  type InvoicePreview,
  invoicePreviewBodyOf,
  invoicePreviewWire,
  type InvoiceRecord,
  type InvoiceRepeatSource,
  invoiceRowWire,
  type InvoiceSaveResult,
  type InvoiceSheet,
  invoiceSheetBranchWire,
  invoiceSheetOrganizationWire,
  type InvoiceTotals,
  invoiceWire,
  planLinkedLines,
  toInvoicePreview,
  toInvoiceRecord,
  toInvoiceSheetBranch,
} from './invoices-contracts.ts';
import { listPatientPackages, patientPackageQueryKeys } from './patient-packages-api.ts';
import { estimatedTotalOf, listInvoicePayments, nextCursorOf } from './payments-api.ts';

/*
 * Invoices on clinozy-be (`/app/invoices`, api-integration §5.8): a person's invoices (a page
 * with what is due and paid over all of them — `meta.due_total`, `meta.paid_total`, D81 — or
 * every one), one invoice with its ledger entries and the sheet's clinic and branch, Quick fill's
 * reads, the previews (D81 Q2), and bill, change (with its read's `updated_at`), delete with its
 * reason and restore. The server prices every line (the best live offer, the lowest price, GST,
 * M26). Every key carries the organization; every write carries the action's key.
 */

/**
 * TanStack Query keys for invoices — all under `['clinic', 'invoices']`, each carrying the
 * organization, but the previews: they sit under `['clinic', 'invoice-previews']`, so a write that
 * refreshes the invoices never asks a preview again — after a save, the drawer's last preview would
 * bill sessions that are now billed (a 400).
 */
export const invoiceQueryKeys = {
  all: ['clinic', 'invoices'] as const,
  /** Every invoice list and total — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...invoiceQueryKeys.all, organizationId, 'list'] as const,
  /** A paged list (the patient file's Invoices) — its pages and totals. */
  list: (organizationId: string | null, params: InvoiceListParams) =>
    [...invoiceQueryKeys.lists(organizationId), 'page', params] as const,
  /** Every invoice the params match, in one array (Receive's chips, "For invoice"). */
  every: (organizationId: string | null, params: InvoiceListParams) =>
    [...invoiceQueryKeys.lists(organizationId), 'every', params] as const,
  /** What one person still owes and has paid, over all their invoices. */
  totals: (organizationId: string | null, params: InvoiceListParams) =>
    [...invoiceQueryKeys.lists(organizationId), 'totals', params] as const,
  detail: (organizationId: string | null, invoiceId: string) =>
    [...invoiceQueryKeys.all, organizationId, 'detail', invoiceId] as const,
  /** Quick fill's reads for a patient. */
  presets: (organizationId: string | null, patientId: string) =>
    [...invoiceQueryKeys.all, organizationId, 'presets', patientId] as const,
  /** Every preview the drawer asked for — outside {@link invoiceQueryKeys.all} (no write refetches one). */
  previews: (organizationId: string | null) =>
    ['clinic', 'invoice-previews', organizationId] as const,
  /** The preview of a bill (no invoice yet) or of a change to an invoice, by what was sent. */
  preview: (organizationId: string | null, invoiceId: string | null, body: object) =>
    [...invoiceQueryKeys.previews(organizationId), invoiceId, body] as const,
  /** The printed sheet's clinic and branches. */
  sheet: (organizationId: string | null) =>
    [...invoiceQueryKeys.all, organizationId, 'sheet'] as const,
};

/** One page of a list — the design's 50. */
const PAGE_SIZE = 50;

/** One page of a whole list — the API's most. */
const ALL_PAGE_SIZE = 100;

/** How long the sheet's clinic and branches are reused before they are read again. */
const SHEET_STALE_MS = 5 * 60_000;

/** The organization the cached reads belong to. */
const activeOrganizationId = () => useOrganizationStore.getState().organizationId;

/** The list's filters as the API takes them. */
function invoiceFilterQuery(params: InvoiceListParams) {
  return {
    patient_id: params.patientId,
    contact_id: params.contactId,
    payment_status: params.status?.length ? params.status.join(',') : undefined,
    sort: params.oldestFirst ? ('invoice_date' as const) : undefined,
    order: params.oldestFirst ? ('asc' as const) : undefined,
    branch_id: params.branchIds?.length ? params.branchIds.join(',') : undefined,
    invoice_date_from: params.day,
    invoice_date_to: params.day,
  };
}

/** Invoices from a list answer. */
const recordsOf = (data: unknown) =>
  z
    .array(invoiceRowWire)
    .parse(data ?? [])
    .map(toInvoiceRecord);

/** The list answer's totals — what is due and paid over every page its filters match. */
function totalsOf(meta: unknown): InvoiceTotals | null {
  const totals = invoiceListMetaWire.safeParse(meta);
  return totals.success
    ? { due: totals.data.due_total, paid: totals.data.paid_total }
    : null;
}

// ── Lists ──

/** One page of a person's invoices with their totals; `after` is the cursor. */
export async function listInvoices(
  params: InvoiceListParams,
  after?: string,
): Promise<InvoicePage> {
  const response = await api.get('/app/invoices', {
    query: { ...invoiceFilterQuery(params), limit: PAGE_SIZE, after },
  });
  return {
    rows: recordsOf(response.data),
    next: nextCursorOf(response.meta),
    total: estimatedTotalOf(response.meta),
    totals: totalsOf(response.meta),
  };
}

/** Every invoice the params match (every page). */
export async function fetchAllInvoices(
  params: InvoiceListParams,
): Promise<InvoiceRecord[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/invoices', {
      query: {
        ...invoiceFilterQuery(params),
        limit: ALL_PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return { rows: recordsOf(response.data), next: nextCursorOf(response.meta) };
  }, 'invoices');
}

/** A patient's invoices with a due, oldest first — the Receive drawer's "Against invoice". */
export function listOpenInvoices(patientId: string): Promise<InvoiceRecord[]> {
  return fetchAllInvoices({
    patientId,
    status: ['unpaid', 'partial'],
    oldestFirst: true,
  });
}

/**
 * What a person owes and has paid over all their invoices (`meta.due_total`, `meta.paid_total`,
 * D81) and how many there are (`estimated_total` — the patient file's "2 invoices · ₹4,800 due")
 * — one read of one row; nothing when the answer leaves the totals out.
 */
export async function fetchInvoiceTotals(
  params: Pick<InvoiceListParams, 'patientId' | 'contactId'>,
): Promise<InvoiceTotals | null> {
  const response = await api.get('/app/invoices', {
    query: { ...invoiceFilterQuery(params), limit: 1 },
  });
  const totals = totalsOf(response.meta);
  const count = estimatedTotalOf(response.meta);
  return totals && count !== null ? { ...totals, count } : totals;
}

// ── One invoice ──

/** The sheet's clinic and the member's branches — read once and cached. */
async function sheetOf(branchId: string): Promise<InvoiceSheet> {
  const sheet = await queryClient.query({
    queryKey: invoiceQueryKeys.sheet(activeOrganizationId()),
    queryFn: async () => {
      const [organization, branches] = await Promise.all([
        api.get('/tenancy/organization'),
        api.get('/app/branches/my'),
      ]);
      return {
        organization: invoiceSheetOrganizationWire.parse(organization.data),
        branches: z
          .array(invoiceSheetBranchWire)
          .parse(branches.data ?? [])
          .map(toInvoiceSheetBranch),
      };
    },
    staleTime: SHEET_STALE_MS,
  });
  return {
    organization: sheet.organization,
    branch: sheet.branches.find((branch) => branch.id === branchId) ?? null,
  };
}

/** An invoice with what reads beside it: its party, its ledger entries and the sheet. */
async function detailOf(invoice: InvoiceRecord): Promise<InvoiceDetail> {
  const [payments, sheet] = await Promise.all([
    listInvoicePayments(invoice.id),
    sheetOf(invoice.branchId),
  ]);
  return { invoice, party: invoicePartyOf(invoice), sale: null, payments, sheet };
}

/**
 * One invoice with who it bills, the ledger entries against it and the sheet's clinic and branch
 * — a 404 when it is unknown, deleted or another branch's for a member without `branch:read`.
 */
export async function fetchInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const response = await api.get('/app/invoices/{invoice_id}', {
    params: { invoice_id: invoiceId },
  });
  return detailOf(toInvoiceRecord(invoiceWire.parse(response.data)));
}

// ── Quick fill ──

/** A patient's newest invoice of a type, as a Repeat. */
async function lastInvoiceOf(
  patientId: string,
  type: ClinicInvoiceType,
): Promise<InvoiceRepeatSource | undefined> {
  const response = await api.get('/app/invoices', {
    query: { patient_id: patientId, type, limit: 1 },
  });
  const [invoice] = recordsOf(response.data);
  return invoice && invoice.type !== 'medical'
    ? {
        id: invoice.id,
        seq: invoice.seq,
        type: invoice.type,
        items: invoice.items,
        teamIds: invoice.teamIds,
      }
    : undefined;
}

/**
 * What Quick fill reads for a patient (G-P7): the packages they hold with sessions left (their
 * offerings read, cached with the patient file's), their last clinic and consultation invoices,
 * and the team the newer of those named.
 */
export async function fetchInvoicePresets(patientId: string): Promise<InvoicePresets> {
  const [packages, clinic, consultation] = await Promise.all([
    queryClient.query({
      queryKey: patientPackageQueryKeys.patient(activeOrganizationId(), patientId),
      queryFn: () => listPatientPackages(patientId),
    }),
    lastInvoiceOf(patientId, 'clinic'),
    lastInvoiceOf(patientId, 'consultation'),
  ]);
  const latest = [clinic, consultation]
    .filter((invoice) => invoice !== undefined)
    .sort((a, b) => b.seq - a.seq)[0];
  return {
    packages: packages
      .filter((row) => row.status === 'active' && row.sessionsLeft > 0)
      .map((row) => ({ offeringId: row.offeringId })),
    lastByType: {
      ...(clinic ? { clinic } : {}),
      ...(consultation ? { consultation } : {}),
    },
    recentTeamIds: latest?.teamIds ?? [],
  };
}

// ── Previews ──

/**
 * What a bill would come to — the server's lines and totals, nothing written (`POST
 * /app/invoices/preview`, `payment:create`, D81 Q2): the create body without "Paid now". The
 * person may be left out until picked.
 */
export async function previewInvoice(input: InvoiceInput): Promise<InvoicePreview> {
  const response = await api.post('/app/invoices/preview', {
    body: invoicePreviewBodyOf(input),
  });
  return toInvoicePreview(invoicePreviewWire.parse(response.data));
}

/**
 * What a change would come to (`POST /app/invoices/:invoice_id/preview`, `payment:update`) —
 * only what differs from the invoice, nothing written; none = the stored lines' totals. It
 * answers a PATCH's 409s (a settled invoice, below what is paid).
 */
export async function previewInvoiceChange({
  invoice,
  input,
}: {
  invoice: InvoiceRecord;
  input: InvoiceInput;
}): Promise<InvoicePreview> {
  const response = await api.post('/app/invoices/{invoice_id}/preview', {
    params: { invoice_id: invoice.id },
    body: invoiceChangeOf(invoice, input),
  });
  return toInvoicePreview(invoicePreviewWire.parse(response.data));
}

// ── Writes ──

/** A saved invoice as the drawer reads it back, with how many plan rows it bills. */
async function saveResultOf(data: unknown): Promise<InvoiceSaveResult> {
  const invoice = toInvoiceRecord(invoiceWire.parse(data));
  return { detail: await detailOf(invoice), planLinked: planLinkedLines(invoice) };
}

/**
 * Bill a clinic or consultation invoice (`POST /app/invoices`, `payment:create`) — the server
 * prices each line, applies the best live offer and records "Paid now" as one receipt. `400
 * below_lowest_price` names its lines (`items/<n>`), `400 patient_file_required`.
 */
export async function createInvoice({
  input,
  idempotencyKey,
}: {
  input: InvoiceInput;
  idempotencyKey: string;
}): Promise<InvoiceSaveResult> {
  const response = await api.post('/app/invoices', {
    body: invoiceCreateBodyOf(input),
    idempotencyKey,
  });
  return saveResultOf(response.data);
}

/**
 * Change an invoice (`PATCH /app/invoices/:invoice_id`, `payment:update`): only what differs,
 * the kept lines by id, with the read's `updated_at` — `409 record_changed`, `invoice_settled`,
 * `below_paid`, `offering_in_use`. Nothing changed sends nothing.
 */
export async function updateInvoice({
  invoice,
  input,
  idempotencyKey,
}: {
  invoice: InvoiceRecord;
  input: InvoiceInput;
  idempotencyKey: string;
}): Promise<InvoiceSaveResult> {
  const change = invoiceChangeOf(invoice, input);
  if (Object.keys(change).length === 0) {
    return { detail: await detailOf(invoice), planLinked: planLinkedLines(invoice) };
  }
  const response = await api.patch('/app/invoices/{invoice_id}', {
    params: { invoice_id: invoice.id },
    body: { ...change, expected_updated_at: invoice.updatedAt },
    idempotencyKey,
  });
  return saveResultOf(response.data);
}

/**
 * Delete an unpaid invoice with the confirm's reason (`DELETE …?reason=&note=`, 204,
 * `payment:delete`) — `409 invoice_paid`, `offering_in_use`.
 */
export async function deleteInvoice({
  invoiceId,
  reason,
  note,
}: {
  invoiceId: string;
  reason: string;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/invoices/{invoice_id}', {
    params: { invoice_id: invoiceId },
    reason,
    note: note ?? undefined,
  });
}

/** Bring a deleted invoice back — the Undo of its toast. */
export async function restoreInvoice(
  invoiceId: string,
  idempotencyKey: string,
): Promise<InvoiceRecord> {
  const response = await api.post('/app/invoices/{invoice_id}/restore', {
    params: { invoice_id: invoiceId },
    idempotencyKey,
  });
  return toInvoiceRecord(invoiceWire.parse(response.data));
}
