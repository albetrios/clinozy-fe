import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { pageOf } from '@/core/http/pagination.ts';
import { createdRangeOf } from '@/shared/api/app/app-filter-ranges.ts';
import type { CreatedFilter } from '@/shared/api/app/app-list-filters.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { invoiceSheetOrganizationWire } from '@/shared/api/app/invoices-contracts.ts';
import { MEDICAL_ROOM_QUERY_KEY } from '@/shared/api/app/medicines-api.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import {
  type ManufacturerListParams,
  type ManufacturerRow,
  manufacturerWire,
  type MedicalListSummary,
  medicalRepVisitWire,
  medicalRepWire,
  type MrListParams,
  type MrRow,
  type MrVisitRow,
  type PrescriptionToFill,
  prescriptionToFillWire,
  type PurchaseOrderListParams,
  type PurchaseOrderRow,
  type PurchaseOrderSheet,
  purchaseOrderWire,
  saleDueWire,
  type SaleListParams,
  type SaleReminders,
  type SaleRow,
  saleWire,
  type SupplierAccountRow,
  type SupplierCreditListParams,
  type SupplierCreditRow,
  supplierCreditWire,
  supplierListMetaWire,
  type SupplierListParams,
  type SupplierRow,
  supplierWire,
  toManufacturerRow,
  toMrRow,
  toMrVisitRow,
  toPrescriptionToFill,
  toPurchaseOrderRow,
  toSaleReminder,
  toSaleRow,
  toSupplierCreditRow,
  toSupplierRow,
} from './medical-contracts.ts';

/*
 * The Medical store's reads on clinozy-be (api-integration §5.5): each tab in cursor pages of 50,
 * one record of each, the whole manufacturer, supplier and MR lists the pickers and the Filters'
 * sections read (every page, 100 at a time), a supplier's Account, an MR's visits, "Send payment
 * reminders", a purchase order's print sheet and the footer figures — one read of a single row.
 * Every key carries the organization. Medicines are the shared `medicines-api.ts`; the store's
 * payments and customer credits are the shared ledger's and Pending's slices.
 */

/** TanStack Query keys for the Medical store — all under `['app', 'medical']`, each carrying the organization. */
export const medicalQueryKeys = {
  all: MEDICAL_ROOM_QUERY_KEY,
  /** Every read of one organization. */
  organization: (organizationId: string | null) =>
    [...medicalQueryKeys.all, organizationId] as const,
  sales: (organizationId: string | null, params: SaleListParams) =>
    [...medicalQueryKeys.organization(organizationId), 'sales', params] as const,
  sale: (organizationId: string | null, id: string) =>
    [...medicalQueryKeys.organization(organizationId), 'sale', id] as const,
  /** "Send payment reminders": who owes on the sales the list's search and Created match. */
  saleReminders: (organizationId: string | null, params: SaleListParams) =>
    [...medicalQueryKeys.organization(organizationId), 'sale-reminders', params] as const,
  purchaseOrders: (organizationId: string | null, params: PurchaseOrderListParams) =>
    [
      ...medicalQueryKeys.organization(organizationId),
      'purchase-orders',
      params,
    ] as const,
  purchaseOrder: (organizationId: string | null, id: string) =>
    [...medicalQueryKeys.organization(organizationId), 'purchase-order', id] as const,
  /** What an order's A4 sheet prints beyond the order. */
  purchaseOrderSheet: (organizationId: string | null, id: string) =>
    [
      ...medicalQueryKeys.organization(organizationId),
      'purchase-order-sheet',
      id,
    ] as const,
  suppliers: (organizationId: string | null, params: SupplierListParams) =>
    [...medicalQueryKeys.organization(organizationId), 'suppliers', params] as const,
  supplier: (organizationId: string | null, id: string) =>
    [...medicalQueryKeys.organization(organizationId), 'supplier', id] as const,
  supplierAccount: (organizationId: string | null, id: string) =>
    [...medicalQueryKeys.organization(organizationId), 'supplier-account', id] as const,
  supplierCredits: (organizationId: string | null, params: SupplierCreditListParams) =>
    [
      ...medicalQueryKeys.organization(organizationId),
      'supplier-credits',
      params,
    ] as const,
  manufacturers: (organizationId: string | null, params: ManufacturerListParams) =>
    [...medicalQueryKeys.organization(organizationId), 'manufacturers', params] as const,
  manufacturer: (organizationId: string | null, id: string) =>
    [...medicalQueryKeys.organization(organizationId), 'manufacturer', id] as const,
  mrs: (organizationId: string | null, params: MrListParams) =>
    [...medicalQueryKeys.organization(organizationId), 'mrs', params] as const,
  mr: (organizationId: string | null, id: string) =>
    [...medicalQueryKeys.organization(organizationId), 'mr', id] as const,
  /** An MR's logged visits. */
  mrVisits: (organizationId: string | null, id: string) =>
    [...medicalQueryKeys.organization(organizationId), 'medical-rep-visits', id] as const,
  /** "Prescriptions to fill" — the pharmacy queue. */
  prescriptionsToFill: (organizationId: string | null) =>
    [...medicalQueryKeys.organization(organizationId), 'prescriptions-to-fill'] as const,
  /** A list's footer figures, by tab and params. */
  summary: (organizationId: string | null, tab: MedicalSummaryTab, params: object) =>
    [...medicalQueryKeys.organization(organizationId), 'summary', tab, params] as const,
  /** A whole list the Filters' sections and the pickers read. */
  catalogue: (
    organizationId: string | null,
    kind: 'manufacturers' | 'suppliers' | 'mrs',
  ) => [...medicalQueryKeys.organization(organizationId), 'catalogue', kind] as const,
};

/** One page of a tab — the design's 50. */
const PAGE_SIZE = 50;

/** One page of a whole list — the API's most. */
const CATALOGUE_PAGE_SIZE = 100;

/** How many customers "Send payment reminders" lists — the dues read's most. */
const REMINDERS_LIMIT = 100;

/** A page of rows with the cursor of the next and the API's estimated total. */
export interface MedicalPage<T> {
  rows: T[];
  next: string | null;
  total: number | null;
}

/** The Created filter as the API's range, on the clinic's `today`. */
function createdQuery(created: CreatedFilter | undefined, today: string) {
  const range = created ? createdRangeOf(created, today) : {};
  return { created_from: range.from, created_to: range.to };
}

/** A search as the API takes it — none when blank. */
const searchOf = (q: string | undefined) => (q?.trim() ? q.trim() : undefined);

// ── Sales ──

/** The Sales sorts as the API names them; none is the sale time, the latest first. */
const SALE_SORTS = {
  seq: 'sale_number',
  customer: 'contact_name',
  bill: 'total',
} as const;

/** The Sales filters as the API takes them, on the clinic's `today`. */
function saleFilterQuery(
  params: Pick<SaleListParams, 'q' | 'status' | 'created'>,
  today: string,
) {
  return {
    q: searchOf(params.q),
    status: params.status,
    ...createdQuery(params.created, today),
  };
}

/** The Sales read's query for the URL's params, on the clinic's `today`. */
export function saleListQuery(params: SaleListParams, today: string = appToday()) {
  return {
    limit: PAGE_SIZE,
    ...saleFilterQuery(params, today),
    sort: params.sort ? SALE_SORTS[params.sort] : undefined,
    order: params.sort ? params.order : undefined,
  };
}

/** One page of sales; `after` is the cursor. */
export async function listMedicalSales(
  params: SaleListParams = {},
  after?: string,
): Promise<MedicalPage<SaleRow>> {
  const response = await api.get('/app/medical-sales', {
    query: { ...saleListQuery(params), after },
  });
  return {
    rows: z
      .array(saleWire)
      .parse(response.data ?? [])
      .map(toSaleRow),
    ...pageOf(response.meta?.pagination),
  };
}

/** One sale as its row — a voided one too (its void and Undo read it); a 404 when unknown. */
export async function fetchMedicalSale(id: string): Promise<SaleRow> {
  const response = await api.get('/app/medical-sales/{medical_sale_id}', {
    params: { medical_sale_id: id },
  });
  return toSaleRow(saleWire.parse(response.data));
}

/** The clinic's name — what a reminder is from. */
async function clinicName(): Promise<string> {
  const response = await api.get('/tenancy/organization');
  return z.object({ name: z.string() }).parse(response.data).name;
}

/**
 * Who "Send payment reminders" lists (`GET /app/medical-sales/dues`, MD25): each customer with
 * unpaid sales the list's search and Created match, what they owe and those sales, the largest due
 * first; a sale with no buyer on record has no one to remind. The clinic's name comes with them,
 * for the message. Nothing is sent by the app (D167).
 */
export async function listSaleReminders(
  params: SaleListParams = {},
  today: string = appToday(),
): Promise<SaleReminders> {
  const [response, name] = await Promise.all([
    api.get('/app/medical-sales/dues', {
      query: {
        limit: REMINDERS_LIMIT,
        q: searchOf(params.q),
        ...createdQuery(params.created, today),
      },
    }),
    clinicName(),
  ]);
  return {
    clinicName: name,
    customers: z
      .array(saleDueWire)
      .parse(response.data ?? [])
      .flatMap((row) => {
        const reminder = toSaleReminder(row);
        return reminder ? [reminder] : [];
      }),
  };
}

/** How many prescriptions "Prescriptions to fill" lists. */
const TO_FILL_LIMIT = 20;

/**
 * "Prescriptions to fill" — the approved prescriptions no live sale has filled yet, the latest
 * first, at most 20 (`GET /app/patient-prescriptions?status=approved&is_filled=false`), each with
 * its patient (MD29).
 */
export async function listPrescriptionsToFill(): Promise<PrescriptionToFill[]> {
  const response = await api.get('/app/patient-prescriptions', {
    query: {
      limit: TO_FILL_LIMIT,
      status: 'approved',
      is_filled: 'false',
      sort: 'prescription_date',
      order: 'desc',
    },
  });
  return z
    .array(prescriptionToFillWire)
    .parse(response.data ?? [])
    .flatMap((row) => {
      const prescription = toPrescriptionToFill(row);
      return prescription ? [prescription] : [];
    });
}

// ── Purchase orders ──

/** The Purchases sorts as the API names them; none is the order date, the latest first. */
const PURCHASE_SORTS = {
  seq: 'purchase_order_number',
  date: 'order_date',
  total: 'total',
} as const;

/** The Stage filter as the API's: Paid is a received order paid in full. */
function stageQuery(stage: PurchaseOrderListParams['stage']) {
  if (stage === 'ordered') return { stage: 'ordered' };
  if (stage === 'received')
    return { stage: 'received', payment_status: 'unpaid,partial' };
  if (stage === 'paid') return { stage: 'received', payment_status: 'paid' };
  return {};
}

/** The Purchases filters as the API takes them, on the clinic's `today`. */
function purchaseFilterQuery(
  params: Pick<PurchaseOrderListParams, 'q' | 'stage' | 'created'>,
  today: string,
) {
  return {
    q: searchOf(params.q),
    ...stageQuery(params.stage),
    ...createdQuery(params.created, today),
  };
}

/** The Purchases read's query for the URL's params, on the clinic's `today`. */
export function purchaseOrderListQuery(
  params: PurchaseOrderListParams,
  today: string = appToday(),
) {
  return {
    limit: PAGE_SIZE,
    ...purchaseFilterQuery(params, today),
    sort: params.sort ? PURCHASE_SORTS[params.sort] : undefined,
    order: params.sort ? params.order : undefined,
  };
}

/** One page of purchase orders; `after` is the cursor. */
export async function listPurchaseOrders(
  params: PurchaseOrderListParams = {},
  after?: string,
): Promise<MedicalPage<PurchaseOrderRow>> {
  const response = await api.get('/app/medical-purchase-orders', {
    query: { ...purchaseOrderListQuery(params), after },
  });
  return {
    rows: z
      .array(purchaseOrderWire)
      .parse(response.data ?? [])
      .map(toPurchaseOrderRow),
    ...pageOf(response.meta?.pagination),
  };
}

/** One purchase order as its row — a 404 when it is unknown or cancelled. */
export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrderRow> {
  const response = await api.get(
    '/app/medical-purchase-orders/{medical_purchase_order_id}',
    { params: { medical_purchase_order_id: id } },
  );
  return toPurchaseOrderRow(purchaseOrderWire.parse(response.data));
}

/**
 * A supplier's oldest received order still due — what "Pay ₹X" opens Send payment on, as Clinic
 * stock's Vendors do; none once they are paid up.
 */
export async function fetchOldestOpenPurchaseOrder(
  supplierId: string,
): Promise<PurchaseOrderRow | null> {
  const response = await api.get('/app/medical-purchase-orders', {
    query: {
      supplier_id: supplierId,
      stage: 'received',
      payment_status: 'unpaid,partial',
      sort: 'order_date',
      order: 'asc',
      limit: 1,
    },
  });
  const [oldest] = z.array(purchaseOrderWire).parse(response.data ?? []);
  return oldest ? toPurchaseOrderRow(oldest) : null;
}

/**
 * A purchase order and what its A4 sheet prints with it (Q-M7, N21): the clinic, and its main
 * branch's phone and GSTIN (`GET /app/branches/my` — any member), as an order names no branch. The
 * supplier's phone and GSTIN come on the order, a deleted supplier's too.
 */
export async function fetchPurchaseOrderSheet(id: string): Promise<PurchaseOrderSheet> {
  const [order, organization, branches] = await Promise.all([
    fetchPurchaseOrder(id),
    api.get('/tenancy/organization'),
    api.get('/app/branches/my'),
  ]);
  const clinic = invoiceSheetOrganizationWire.parse(organization.data);
  const mine = z
    .array(
      z.object({
        is_main: z.boolean(),
        phone: z.string(),
        gst_number: z.string().nullable(),
      }),
    )
    .parse(branches.data ?? []);
  const branch = mine.find((row) => row.is_main) ?? mine[0];
  return {
    order,
    organization: clinic,
    branch: { phone: branch?.phone ?? '', gstNumber: branch?.gst_number ?? null },
  };
}

// ── Suppliers ──

/** The Suppliers filters as the API takes them, on the clinic's `today`. */
function supplierFilterQuery(params: SupplierListParams, today: string) {
  return {
    q: searchOf(params.q),
    manufacturer_id: params.manufacturer,
    has_payable: params.hasPayable ? ('true' as const) : undefined,
    ...createdQuery(params.created, today),
  };
}

/** One page of suppliers; `after` is the cursor. */
export async function listSuppliers(
  params: SupplierListParams = {},
  after?: string,
): Promise<MedicalPage<SupplierRow>> {
  const response = await api.get('/app/suppliers', {
    query: {
      limit: PAGE_SIZE,
      ...supplierFilterQuery(params, appToday()),
      sort: params.sort,
      order: params.sort ? params.order : undefined,
      after,
    },
  });
  return {
    rows: z
      .array(supplierWire)
      .parse(response.data ?? [])
      .map(toSupplierRow),
    ...pageOf(response.meta?.pagination),
  };
}

/** Every live supplier as its row, by name — the pickers' and the Filters' list. */
export function fetchAllSuppliers(): Promise<SupplierRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/suppliers', {
      query: { limit: CATALOGUE_PAGE_SIZE, after: after ?? undefined, sort: 'name' },
    });
    return {
      rows: z
        .array(supplierWire)
        .parse(response.data ?? [])
        .map(toSupplierRow),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'suppliers');
}

/** One supplier as its row — a 404 when it is unknown or deleted. */
export async function fetchSupplier(id: string): Promise<SupplierRow> {
  const response = await api.get('/app/suppliers/{supplier_id}', {
    params: { supplier_id: id },
  });
  return toSupplierRow(supplierWire.parse(response.data));
}

/** Every credit of one supplier, newest first (`GET /app/suppliers/:supplier_id/credits`, MD34). */
function fetchAllSupplierCredits(supplierId: string): Promise<SupplierCreditRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/suppliers/{supplier_id}/credits', {
      params: { supplier_id: supplierId },
      query: { limit: CATALOGUE_PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z
        .array(supplierCreditWire)
        .parse(response.data ?? [])
        .map(toSupplierCreditRow),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'supplier-credits');
}

/** Every live order of one supplier, the latest first. */
function fetchAllSupplierOrders(supplierId: string): Promise<PurchaseOrderRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/medical-purchase-orders', {
      query: {
        limit: CATALOGUE_PAGE_SIZE,
        after: after ?? undefined,
        supplier_id: supplierId,
      },
    });
    return {
      rows: z
        .array(purchaseOrderWire)
        .parse(response.data ?? [])
        .map(toPurchaseOrderRow),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'supplier-orders');
}

/**
 * A supplier's Account (`medical.md:200`): every live order — its stage, total and what is still
 * owed on it — and every credit it gave for returned stock ("Credit · 026-312"), latest first.
 */
export async function fetchSupplierAccount(id: string): Promise<SupplierAccountRow[]> {
  const [orders, credits] = await Promise.all([
    fetchAllSupplierOrders(id),
    fetchAllSupplierCredits(id),
  ]);
  const rows: SupplierAccountRow[] = [
    ...credits.map((credit) => ({
      kind: 'credit' as const,
      id: credit.id,
      batchNo: credit.batchNo,
      date: credit.createdAt.slice(0, 10),
      amount: credit.amount,
    })),
    ...orders.map((order) => ({
      kind: 'order' as const,
      id: order.id,
      seq: order.seq,
      billNo: order.supplierBillNo,
      date: order.date,
      stage: order.stage,
      amount: order.total,
      due: order.due,
    })),
  ];
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

// ── Supplier credits ──

/**
 * One page of supplier credits, newest first — every supplier's (`GET /app/supplier-credits`, the
 * Credits tab) or one supplier's (`GET /app/suppliers/:supplier_id/credits`); `after` is the cursor.
 */
export async function listSupplierCredits(
  params: SupplierCreditListParams = {},
  after?: string,
): Promise<MedicalPage<SupplierCreditRow>> {
  const query = { limit: PAGE_SIZE, status: params.status, after };
  const response = params.supplier
    ? await api.get('/app/suppliers/{supplier_id}/credits', {
        params: { supplier_id: params.supplier },
        query,
      })
    : await api.get('/app/supplier-credits', { query });
  return {
    rows: z
      .array(supplierCreditWire)
      .parse(response.data ?? [])
      .map(toSupplierCreditRow),
    ...pageOf(response.meta?.pagination),
  };
}

// ── Manufacturers ──

/** The Manufacturers filters as the API takes them, on the clinic's `today`. */
function manufacturerFilterQuery(params: ManufacturerListParams, today: string) {
  return {
    q: searchOf(params.q),
    supplier_id: params.supplier,
    medical_rep_id: params.mr,
    ...createdQuery(params.created, today),
  };
}

/** One page of manufacturers, by name; `after` is the cursor. */
export async function listManufacturers(
  params: ManufacturerListParams = {},
  after?: string,
): Promise<MedicalPage<ManufacturerRow>> {
  const response = await api.get('/app/manufacturers', {
    query: {
      limit: PAGE_SIZE,
      ...manufacturerFilterQuery(params, appToday()),
      sort: 'name',
      order: params.order,
      after,
    },
  });
  return {
    rows: z
      .array(manufacturerWire)
      .parse(response.data ?? [])
      .map(toManufacturerRow),
    ...pageOf(response.meta?.pagination),
  };
}

/** Every live manufacturer as its row, by name — the pickers' and the Filters' list. */
export function fetchAllManufacturers(): Promise<ManufacturerRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/manufacturers', {
      query: { limit: CATALOGUE_PAGE_SIZE, after: after ?? undefined, sort: 'name' },
    });
    return {
      rows: z
        .array(manufacturerWire)
        .parse(response.data ?? [])
        .map(toManufacturerRow),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'manufacturers');
}

/** One manufacturer as its row — a 404 when it is unknown or deleted. */
export async function fetchManufacturer(id: string): Promise<ManufacturerRow> {
  const response = await api.get('/app/manufacturers/{manufacturer_id}', {
    params: { manufacturer_id: id },
  });
  return toManufacturerRow(manufacturerWire.parse(response.data));
}

// ── MRs ──

/** One page of MRs, by name; `after` is the cursor. */
export async function listMedicalReps(
  params: MrListParams = {},
  after?: string,
): Promise<MedicalPage<MrRow>> {
  const response = await api.get('/app/medical-reps', {
    query: {
      limit: PAGE_SIZE,
      q: searchOf(params.q),
      ...createdQuery(params.created, appToday()),
      sort: 'name',
      order: params.order,
      after,
    },
  });
  return {
    rows: z
      .array(medicalRepWire)
      .parse(response.data ?? [])
      .map(toMrRow),
    ...pageOf(response.meta?.pagination),
  };
}

/** Every live MR as their row, by name — the pickers' list. */
export function fetchAllMedicalReps(): Promise<MrRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/medical-reps', {
      query: { limit: CATALOGUE_PAGE_SIZE, after: after ?? undefined, sort: 'name' },
    });
    return {
      rows: z
        .array(medicalRepWire)
        .parse(response.data ?? [])
        .map(toMrRow),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'medical-reps');
}

/** One MR as their row — a 404 when they are unknown or deleted. */
export async function fetchMedicalRep(id: string): Promise<MrRow> {
  const response = await api.get('/app/medical-reps/{medical_rep_id}', {
    params: { medical_rep_id: id },
  });
  return toMrRow(medicalRepWire.parse(response.data));
}

/** An MR's logged visits, the latest first. */
export function fetchMrVisits(mrId: string): Promise<MrVisitRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/medical-reps/{medical_rep_id}/visits', {
      params: { medical_rep_id: mrId },
      query: {
        limit: CATALOGUE_PAGE_SIZE,
        after: after ?? undefined,
        sort: 'visit_date',
        order: 'desc',
      },
    });
    return {
      rows: z
        .array(medicalRepVisitWire)
        .parse(response.data ?? [])
        .map(toMrVisitRow),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'medical-rep-visits');
}

// ── Footer figures ──

/** The tabs with a footer. */
export type MedicalSummaryTab =
  'sales' | 'purchases' | 'suppliers' | 'manufacturers' | 'mrs' | 'supplierCredits';

/** A footer read: how many rows match, read with one. */
const countOf = (response: { meta?: { pagination?: object } }): MedicalListSummary => ({
  total: pageOf(response.meta?.pagination).total ?? 0,
  payable: 0,
});

/** Each tab's footer read for its list's own filters, on the clinic's `today`. */
const SUMMARY_READS: Readonly<
  Record<
    MedicalSummaryTab,
    (params: object, today: string) => Promise<MedicalListSummary>
  >
> = {
  sales: async (params, today) =>
    countOf(
      await api.get('/app/medical-sales', {
        query: { ...saleFilterQuery(params as SaleListParams, today), limit: 1 },
      }),
    ),
  purchases: async (params, today) =>
    countOf(
      await api.get('/app/medical-purchase-orders', {
        query: {
          ...purchaseFilterQuery(params as PurchaseOrderListParams, today),
          limit: 1,
        },
      }),
    ),
  suppliers: async (params, today) => {
    const response = await api.get('/app/suppliers', {
      query: { ...supplierFilterQuery(params as SupplierListParams, today), limit: 1 },
    });
    const meta = supplierListMetaWire.safeParse(response.meta);
    return { ...countOf(response), payable: meta.success ? meta.data.payable_total : 0 };
  },
  manufacturers: async (params, today) =>
    countOf(
      await api.get('/app/manufacturers', {
        query: {
          ...manufacturerFilterQuery(params as ManufacturerListParams, today),
          limit: 1,
        },
      }),
    ),
  mrs: async (params, today) => {
    const mrs = params as MrListParams;
    return countOf(
      await api.get('/app/medical-reps', {
        query: { q: searchOf(mrs.q), ...createdQuery(mrs.created, today), limit: 1 },
      }),
    );
  },
  supplierCredits: async (params) =>
    countOf(
      await api.get('/app/supplier-credits', {
        query: { status: (params as SupplierCreditListParams).status, limit: 1 },
      }),
    ),
};

/**
 * A list's footer figures (`medical.md:19`): how many rows the read matches and, on Suppliers,
 * what they are owed (`meta.payable_total`, over every page) — each one read of a single row, for
 * the list's own filters.
 */
export function medicalListSummary(
  tab: MedicalSummaryTab,
  params: object,
  today: string = appToday(),
): Promise<MedicalListSummary> {
  return SUMMARY_READS[tab](params, today);
}
