import {
  clinicDateOf,
  createdFilterMatches,
} from '@/shared/api/clinic/clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CursorPage,
  cursorPageOf,
  directedCompare,
  searchMatches,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import {
  invoiceBalance,
  invoiceLineAmounts,
  purchaseOrderDue,
  purchaseOrderTotal,
} from '@/shared/api/clinic/clinic-money.ts';
import type {
  Invoice,
  MedicalPurchaseOrder,
  MedicalSale,
} from '@/shared/api/clinic/clinic-schema.ts';
import { civilDayOffset, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { cheapestRate } from '@/shared/api/clinic/medicine-stock.ts';
import { MEDICAL_ROOM_QUERY_KEY } from '@/shared/api/clinic/medicines-api.ts';
import type { MedicineMaker } from '@/shared/api/clinic/medicines-contracts.ts';
import { patientName } from '@/shared/api/clinic/patients-fixture-contracts.ts';

import {
  type ManufacturerListParams,
  type ManufacturerRow,
  type MedicalListSummary,
  type MrListParams,
  type MrRow,
  PURCHASE_STAGE_ORDER,
  type PurchaseOrderListParams,
  type PurchaseOrderRow,
  type PurchaseOrderSheet,
  type SaleCustomer,
  type SaleListParams,
  type SaleReminder,
  type SaleReminders,
  type SaleRow,
  type SupplierListParams,
  type SupplierRow,
} from './medical-contracts.ts';
import type { SupplierAccountRow } from './medical-partners-contracts.ts';
import { type SupplierCredit, supplierCreditStore } from './medical-supplier-credits.ts';

/*
 * The Medical family's reads and writes (`S:1655–1677`), on the fixture world
 * until clinozy-be serves them — every call is REPLACE_WITH_API (D6). The
 * world is imported on demand, so its seed data never lands in a route chunk.
 * Each list row carries what the server derives (Appendix F); medicines are
 * the shared `medicines-api.ts`.
 */

/** TanStack Query keys for the Medical family — all under `['clinic', 'medical']`. */
export const medicalQueryKeys = {
  all: MEDICAL_ROOM_QUERY_KEY,
  sales: (params: SaleListParams) => [...medicalQueryKeys.all, 'sales', params] as const,
  sale: (id: string) => [...medicalQueryKeys.all, 'sale', id] as const,
  /** "Send payment reminders": who the unpaid sales the list matches name. */
  saleReminders: (params: SaleListParams) =>
    [...medicalQueryKeys.all, 'sale-reminders', params] as const,
  purchaseOrders: (params: PurchaseOrderListParams) =>
    [...medicalQueryKeys.all, 'purchase-orders', params] as const,
  purchaseOrder: (id: string) => [...medicalQueryKeys.all, 'purchase-order', id] as const,
  /** What an order's A4 sheet prints beyond the order. */
  purchaseOrderSheet: (id: string) =>
    [...medicalQueryKeys.all, 'purchase-order-sheet', id] as const,
  suppliers: (params: SupplierListParams) =>
    [...medicalQueryKeys.all, 'suppliers', params] as const,
  supplier: (id: string) => [...medicalQueryKeys.all, 'supplier', id] as const,
  supplierAccount: (id: string) =>
    [...medicalQueryKeys.all, 'supplier-account', id] as const,
  manufacturers: (params: ManufacturerListParams) =>
    [...medicalQueryKeys.all, 'manufacturers', params] as const,
  manufacturer: (id: string) => [...medicalQueryKeys.all, 'manufacturer', id] as const,
  mrs: (params: MrListParams) => [...medicalQueryKeys.all, 'mrs', params] as const,
  mr: (id: string) => [...medicalQueryKeys.all, 'mr', id] as const,
  /** A list's footer figures, by tab and params. */
  summary: (tab: string, params: object) =>
    [...medicalQueryKeys.all, 'summary', tab, params] as const,
  /** A whole list the Filters' automatic sections and the pickers read. */
  catalogue: (kind: 'manufacturers' | 'suppliers' | 'mrs') =>
    [...medicalQueryKeys.all, 'catalogue', kind] as const,
};

const fixtureWorld = () => import('@/shared/api/clinic/fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** The credits suppliers gave for returned expiring stock (fixture state beside the world). */
async function supplierCredits(): Promise<readonly SupplierCredit[]> {
  const { onClinicFixturesReset } = await fixtureWorld();
  return supplierCreditStore(onClinicFixturesReset).list();
}

/** Whether `createdAt` passes the Created filter (none set passes). */
function createdOk(
  createdAt: string,
  created: SaleListParams['created'],
  today: string,
): boolean {
  return !created || createdFilterMatches(createdAt, created, today);
}

/** Every manufacturer as a row names it. */
function makersOf(world: FixtureWorld): Map<string, MedicineMaker> {
  return new Map(
    world.manufacturers
      .snapshot()
      .map((maker) => [maker.id, { id: maker.id, name: maker.name, tone: maker.tone }]),
  );
}

const makersFor = (ids: readonly string[], makers: Map<string, MedicineMaker>) =>
  ids.flatMap((id) => {
    const maker = makers.get(id);
    return maker ? [maker] : [];
  });

// ── Sales ──

/** The sale's buyer: the patient, else the Medical contact. */
function customerOf(sale: MedicalSale, world: FixtureWorld): SaleCustomer | null {
  if (sale.patientId) {
    const [patient] = world.patients.snapshot((row) => row.id === sale.patientId);
    if (patient) {
      return {
        kind: 'patient',
        id: patient.id,
        name: patientName(patient),
        phone: patient.phone,
      };
    }
  }
  if (sale.medicalContactId) {
    const [contact] = world.medicalContacts.snapshot(
      (row) => row.id === sale.medicalContactId,
    );
    if (contact) {
      return {
        kind: 'contact',
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      };
    }
  }
  return null;
}

/**
 * A sale as its row: its invoice's lines and bill, what came back, the cost at
 * today's best buy rates, and the due — the bill less returns and what was
 * paid net of refunds, so a refunded return leaves a paid sale Paid.
 */
function toSaleRow(
  sale: MedicalSale,
  world: FixtureWorld,
  invoices: Map<string, Invoice>,
): SaleRow {
  const invoice = invoices.get(sale.invoiceId);
  const payments = world.payments.snapshot();
  const balance = invoice
    ? invoiceBalance(invoice, payments)
    : { bill: 0, paid: 0, due: 0, status: 'unpaid' as const };
  const medicines = new Map(world.medicines.snapshot().map((row) => [row.id, row]));
  const lines = (invoice?.items ?? []).map((item) => ({
    medicineId: item.medicineId,
    name: item.name,
    qty: item.qty,
    batchNo: item.batchNo,
    amount: invoiceLineAmounts(item).net,
  }));
  const cost = (invoice?.items ?? []).reduce((sum, item) => {
    const medicine = item.medicineId ? medicines.get(item.medicineId) : undefined;
    const best = medicine ? cheapestRate(medicine.supplierRates) : null;
    return sum + item.qty * (best?.rate ?? 0);
  }, 0);
  const returned = sale.returns.reduce((sum, back) => sum + back.amount, 0);
  const due = Math.max(0, balance.bill - returned - balance.paid);
  return {
    ...sale,
    invoiceSeq: invoice?.seq ?? null,
    customer: customerOf(sale, world),
    lines,
    bill: balance.bill,
    returned,
    cost,
    paid: balance.paid,
    due,
    status: due === 0 ? 'paid' : 'unpaid',
  };
}

/** Every live, unvoided sale as its row. */
function saleRows(world: FixtureWorld): SaleRow[] {
  const invoices = new Map(
    world.invoices.snapshot().map((invoice) => [invoice.id, invoice]),
  );
  return world.medicalSales
    .snapshot((sale) => sale.voidedAt === null)
    .map((sale) => toSaleRow(sale, world, invoices));
}

const SALE_ORDER = {
  seq: (a: SaleRow, b: SaleRow) => a.seq - b.seq,
  customer: (a: SaleRow, b: SaleRow) =>
    (a.customer?.name ?? '').localeCompare(b.customer?.name ?? ''),
  bill: (a: SaleRow, b: SaleRow) => a.bill - b.bill,
};

/** The sales a list read matches, in its order. */
async function salesFor(params: SaleListParams): Promise<SaleRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const rows = saleRows(clinicFixtures).filter(
    (row) =>
      searchMatches(params.q, [row.customer?.name ?? '', `#${row.seq}`]) &&
      (params.status !== 'unpaid' || row.status === 'unpaid') &&
      (params.status !== 'returned' || row.returns.length > 0) &&
      createdOk(row.createdAt, params.created, today),
  );
  // The contract's default is the newest sale first (`S:1657`).
  return rows.sort(
    params.sort
      ? (a, b) => directedCompare(SALE_ORDER[params.sort ?? 'seq'], params.order)(a, b)
      : (a, b) => compareText(b.soldAt, a.soldAt),
  );
}

/** One cursor page of sales (`listSales`, `S:1657`; REPLACE_WITH_API). */
export async function listMedicalSales(
  params: SaleListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<SaleRow>> {
  return cursorPageOf(await salesFor(params), cursor);
}

/**
 * Who "Send payment reminders" lists (`medical.md:17`; the prototype only
 * toasts, H:5441; REPLACE_WITH_API): each customer the unpaid sales name —
 * the list's search and Created applied — with what they owe across them and
 * their sale numbers, the largest due first; a sale with no customer on
 * record has no one to remind. The clinic's name comes with them, for the
 * message.
 */
export async function listSaleReminders(
  params: SaleListParams = {},
): Promise<SaleReminders> {
  const { clinicOrganization } = await fixtureWorld();
  const rows = await salesFor({ q: params.q, created: params.created, status: 'unpaid' });
  const byCustomer = new Map<string, SaleReminder>();
  for (const row of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (!row.customer || row.due <= 0) continue;
    const key = `${row.customer.kind}:${row.customer.id}`;
    const known = byCustomer.get(key);
    if (known) {
      known.due += row.due;
      known.saleSeqs.push(row.seq);
    } else {
      byCustomer.set(key, { customer: row.customer, due: row.due, saleSeqs: [row.seq] });
    }
  }
  return {
    clinicName: clinicOrganization().name,
    customers: [...byCustomer.values()].sort(
      (a, b) => b.due - a.due || a.customer.name.localeCompare(b.customer.name),
    ),
  };
}

/** One sale as its row — a 404 when it is unknown, deleted or voided. */
export async function fetchMedicalSale(id: string): Promise<SaleRow> {
  const { clinicFixtures } = await fixtureWorld();
  const sale = await clinicFixtures.medicalSales.get(id);
  if (sale.voidedAt) throw clinicHttpError(404, 'not_found', 'Sale not found');
  const invoices = new Map(
    clinicFixtures.invoices.snapshot().map((invoice) => [invoice.id, invoice]),
  );
  return toSaleRow(sale, clinicFixtures, invoices);
}

// ── Purchase orders ──

/** An order as its row: its supplier, medicine names, free units, total and due. */
function toPurchaseOrderRow(
  order: MedicalPurchaseOrder,
  suppliers: Map<string, string>,
  medicines: Map<string, string>,
): PurchaseOrderRow {
  return {
    ...order,
    supplierName: suppliers.get(order.supplierId) ?? '',
    itemNames: order.items.map((item) => medicines.get(item.medicineId) ?? ''),
    freeCount: order.items.reduce((sum, item) => sum + item.free, 0),
    total: purchaseOrderTotal(order.items),
    due: purchaseOrderDue(order),
  };
}

/** Every live order as its row — cancelled orders leave the list (H:5351). */
function purchaseOrderRows(world: FixtureWorld): PurchaseOrderRow[] {
  const suppliers = new Map(world.suppliers.snapshot().map((row) => [row.id, row.name]));
  const medicines = new Map(world.medicines.snapshot().map((row) => [row.id, row.name]));
  return world.purchaseOrders
    .snapshot((order) => order.stage !== 'cancelled')
    .map((order) => toPurchaseOrderRow(order, suppliers, medicines));
}

const stageRank = (row: PurchaseOrderRow) =>
  PURCHASE_STAGE_ORDER.indexOf(row.stage as (typeof PURCHASE_STAGE_ORDER)[number]);

const PURCHASE_ORDER_ORDER = {
  seq: (a: PurchaseOrderRow, b: PurchaseOrderRow) => a.seq - b.seq,
  supplier: (a: PurchaseOrderRow, b: PurchaseOrderRow) =>
    a.supplierName.localeCompare(b.supplierName),
  total: (a: PurchaseOrderRow, b: PurchaseOrderRow) => a.total - b.total,
  stage: (a: PurchaseOrderRow, b: PurchaseOrderRow) => stageRank(a) - stageRank(b),
};

/** The orders a list read matches, in its order. */
async function purchaseOrdersFor(
  params: PurchaseOrderListParams,
): Promise<PurchaseOrderRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const rows = purchaseOrderRows(clinicFixtures).filter(
    (row) =>
      searchMatches(params.q, [
        `#${row.seq}`,
        row.supplierBillNo ?? '',
        row.supplierName,
      ]) &&
      (!params.stage || row.stage === params.stage) &&
      createdOk(row.createdAt, params.created, today),
  );
  // The contract's default is the latest order date first (`S:1661`).
  return rows.sort((a, b) =>
    params.sort
      ? directedCompare(PURCHASE_ORDER_ORDER[params.sort], params.order)(a, b) ||
        b.seq - a.seq
      : compareText(b.date, a.date) || b.seq - a.seq,
  );
}

/** One cursor page of purchase orders (`listPurchaseOrders`, `S:1661`; REPLACE_WITH_API). */
export async function listPurchaseOrders(
  params: PurchaseOrderListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<PurchaseOrderRow>> {
  return cursorPageOf(await purchaseOrdersFor(params), cursor);
}

/** One purchase order as its row — a 404 when it is unknown or deleted. */
export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrderRow> {
  const { clinicFixtures } = await fixtureWorld();
  const order = await clinicFixtures.purchaseOrders.get(id);
  const suppliers = new Map(
    clinicFixtures.suppliers.snapshot().map((row) => [row.id, row.name]),
  );
  const medicines = new Map(
    clinicFixtures.medicines.snapshot().map((row) => [row.id, row.name]),
  );
  return toPurchaseOrderRow(order, suppliers, medicines);
}

/**
 * A purchase order and what its A4 sheet prints with it (Q-M7;
 * REPLACE_WITH_API): its supplier — read even if since removed — and the
 * clinic with its main branch's phone and GSTIN, as an order names no branch.
 */
export async function fetchPurchaseOrderSheet(id: string): Promise<PurchaseOrderSheet> {
  const { clinicFixtures, clinicOrganization } = await fixtureWorld();
  const order = await fetchPurchaseOrder(id);
  const supplier = await clinicFixtures.suppliers.get(order.supplierId, {
    includeDeleted: true,
  });
  const branches = clinicFixtures.branches.snapshot();
  const branch = branches.find((row) => row.isMain) ?? branches[0];
  const organization = clinicOrganization();
  return {
    order,
    supplier: {
      name: supplier.name,
      phone: supplier.phone,
      gstNumber: supplier.gstNumber,
    },
    organization: {
      name: organization.name,
      specialties: organization.specialties,
      currency: organization.currency,
    },
    branch: { phone: branch?.phone ?? '', gstNumber: branch?.gstNumber ?? null },
  };
}

// ── Suppliers ──

/**
 * Every live supplier as its row: the makers it distributes, its live orders,
 * what it is owed on received orders — less the credit it gave for returned
 * stock (`medical.md:309`) — and since when (`S:830`, "N days pending → today
 * − date while due > 0").
 */
function supplierRows(
  world: FixtureWorld,
  credits: readonly SupplierCredit[],
): SupplierRow[] {
  const today = clinicToday();
  const makers = makersOf(world);
  const orders = purchaseOrderRows(world);
  return world.suppliers.snapshot().map((supplier) => {
    const own = orders.filter((order) => order.supplierId === supplier.id);
    const open = own
      .filter((order) => order.due > 0)
      .sort((a, b) => compareText(a.date, b.date) || a.seq - b.seq);
    const [oldest] = open;
    return {
      ...supplier,
      manufacturers: makersFor(supplier.manufacturerIds, makers),
      orderCount: own.length,
      orderTotal: own.reduce((sum, order) => sum + order.total, 0),
      payable: Math.max(
        0,
        open.reduce((sum, order) => sum + order.due, 0) -
          credits
            .filter((credit) => credit.supplierId === supplier.id)
            .reduce((sum, credit) => sum + credit.amount, 0),
      ),
      ageingDays: oldest ? Math.max(0, civilDayOffset(oldest.date, today)) : null,
      hasOpenOrder: own.some((order) => order.stage !== 'paid'),
      oldestOpenBill: oldest ? { id: oldest.id, seq: oldest.seq, due: oldest.due } : null,
    };
  });
}

const SUPPLIER_ORDER = {
  name: (a: SupplierRow, b: SupplierRow) => a.name.localeCompare(b.name),
  payable: (a: SupplierRow, b: SupplierRow) => a.payable - b.payable,
};

/** The suppliers a list read matches, in its order (name, A to Z, by default). */
async function suppliersFor(params: SupplierListParams): Promise<SupplierRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  return supplierRows(clinicFixtures, await supplierCredits())
    .filter(
      (row) =>
        searchMatches(params.q, [row.name]) &&
        (!params.manufacturer?.length ||
          row.manufacturerIds.some((id) => params.manufacturer?.includes(id))) &&
        createdOk(row.createdAt, params.created, today),
    )
    .sort(directedCompare(SUPPLIER_ORDER[params.sort ?? 'name'], params.order));
}

/** One cursor page of suppliers (`listSuppliers`, `S:1662`; REPLACE_WITH_API). */
export async function listSuppliers(
  params: SupplierListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<SupplierRow>> {
  return cursorPageOf(await suppliersFor(params), cursor);
}

/** Every live supplier as its row — the pickers' list. */
export function fetchAllSuppliers(params: SupplierListParams = {}) {
  return suppliersFor(params);
}

/** One supplier as its row — a 404 when it is unknown or deleted. */
export async function fetchSupplier(id: string): Promise<SupplierRow> {
  const { clinicFixtures } = await fixtureWorld();
  const [row] = supplierRows(clinicFixtures, await supplierCredits()).filter(
    (supplier) => supplier.id === id,
  );
  if (!row) throw clinicHttpError(404, 'not_found', 'Supplier not found');
  return row;
}

/**
 * A supplier's Account (`medical.md:200`): every live order — its stage, total
 * and what is still owed on it — and every credit it gave for returned stock
 * ("Credit · 026-312"), latest first (REPLACE_WITH_API).
 */
export async function fetchSupplierAccount(id: string): Promise<SupplierAccountRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const orders: SupplierAccountRow[] = purchaseOrderRows(clinicFixtures)
    .filter((order) => order.supplierId === id)
    .map((order) => ({
      kind: 'order' as const,
      id: order.id,
      seq: order.seq,
      billNo: order.supplierBillNo,
      date: order.date,
      stage: order.stage,
      amount: order.total,
      due: order.due,
    }));
  const credits: SupplierAccountRow[] = (await supplierCredits())
    .filter((credit) => credit.supplierId === id)
    .map((credit) => ({
      kind: 'credit' as const,
      id: credit.id,
      batchNo: credit.batchNo,
      date: clinicDateOf(credit.at),
      amount: credit.amount,
    }));
  return [...credits, ...orders].sort((a, b) => compareText(b.date, a.date));
}

// ── Manufacturers ──

/** Every live manufacturer as its row: its medicines, suppliers and MRs. */
function manufacturerRows(world: FixtureWorld): ManufacturerRow[] {
  const medicines = world.medicines.snapshot();
  const suppliers = world.suppliers.snapshot();
  const reps = world.medicalReps.snapshot();
  return world.manufacturers.snapshot().map((maker) => ({
    ...maker,
    medicineCount: medicines.filter((row) => row.manufacturerId === maker.id).length,
    suppliers: suppliers
      .filter((row) => row.manufacturerIds.includes(maker.id))
      .map((row) => ({ id: row.id, name: row.name })),
    mrs: reps
      .filter((row) => row.manufacturerIds.includes(maker.id))
      .map((row) => ({ id: row.id, name: row.name })),
  }));
}

/** The manufacturers a list read matches, by name. */
async function manufacturersFor(
  params: ManufacturerListParams,
): Promise<ManufacturerRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  return manufacturerRows(clinicFixtures)
    .filter(
      (row) =>
        searchMatches(params.q, [row.name]) &&
        (!params.suppliers?.length ||
          row.suppliers.some((supplier) => params.suppliers?.includes(supplier.id))) &&
        (!params.mrs?.length || row.mrs.some((mr) => params.mrs?.includes(mr.id))) &&
        createdOk(row.createdAt, params.created, today),
    )
    .sort(directedCompare((a, b) => a.name.localeCompare(b.name), params.order));
}

/** One cursor page of manufacturers (`listManufacturers`, `S:1662`; REPLACE_WITH_API). */
export async function listManufacturers(
  params: ManufacturerListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<ManufacturerRow>> {
  return cursorPageOf(await manufacturersFor(params), cursor);
}

/** Every live manufacturer as its row — the pickers' list. */
export function fetchAllManufacturers(params: ManufacturerListParams = {}) {
  return manufacturersFor(params);
}

/** One manufacturer as its row — a 404 when it is unknown or deleted. */
export async function fetchManufacturer(id: string): Promise<ManufacturerRow> {
  const { clinicFixtures } = await fixtureWorld();
  const [row] = manufacturerRows(clinicFixtures).filter((maker) => maker.id === id);
  if (!row) throw clinicHttpError(404, 'not_found', 'Manufacturer not found');
  return row;
}

// ── MRs ──

/** Every live MR as their row: the makers they represent and their last visit. */
function mrRows(world: FixtureWorld): MrRow[] {
  const makers = makersOf(world);
  const visits = world.mrVisits
    .snapshot()
    .sort((a, b) => compareText(b.date, a.date) || compareText(b.createdAt, a.createdAt));
  return world.medicalReps.snapshot().map((rep) => {
    const last = visits.find((visit) => visit.mrId === rep.id);
    return {
      ...rep,
      manufacturers: makersFor(rep.manufacturerIds, makers),
      lastVisitOn: last?.date ?? null,
      samples: last?.samples ?? null,
    };
  });
}

/** The MRs a list read matches, by name. */
async function mrsFor(params: MrListParams): Promise<MrRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  return mrRows(clinicFixtures)
    .filter(
      (row) =>
        searchMatches(params.q, [row.name]) &&
        createdOk(row.createdAt, params.created, today),
    )
    .sort(directedCompare((a, b) => a.name.localeCompare(b.name), params.order));
}

/** One cursor page of MRs (`listMRs`, `S:1662`; REPLACE_WITH_API). */
export async function listMedicalReps(
  params: MrListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<MrRow>> {
  return cursorPageOf(await mrsFor(params), cursor);
}

/** Every live MR as their row — the pickers' list. */
export function fetchAllMedicalReps(params: MrListParams = {}) {
  return mrsFor(params);
}

/** One MR as their row — a 404 when they are unknown or deleted. */
export async function fetchMedicalRep(id: string): Promise<MrRow> {
  const { clinicFixtures } = await fixtureWorld();
  const [row] = mrRows(clinicFixtures).filter((rep) => rep.id === id);
  if (!row) throw clinicHttpError(404, 'not_found', 'MR not found');
  return row;
}

// ── Footer figures ──

/**
 * A list's footer figures (`medical.md:19`): how many rows the read matches
 * and, on Suppliers, what they are owed — a fixture `total` until the list
 * contract carries one (C31, Appendix F; REPLACE_WITH_API).
 */
export async function medicalListSummary(
  tab: 'sales' | 'purchases' | 'suppliers' | 'manufacturers' | 'mrs',
  params: object,
): Promise<MedicalListSummary> {
  switch (tab) {
    case 'sales':
      return { total: (await salesFor(params)).length, payable: 0 };
    case 'purchases':
      return { total: (await purchaseOrdersFor(params)).length, payable: 0 };
    case 'suppliers': {
      const rows = await suppliersFor(params);
      return {
        total: rows.length,
        payable: rows.reduce((sum, row) => sum + row.payable, 0),
      };
    }
    case 'manufacturers':
      return { total: (await manufacturersFor(params)).length, payable: 0 };
    default:
      return { total: (await mrsFor(params)).length, payable: 0 };
  }
}
