import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import { createdFilterMatches } from './clinic-filter-match.ts';
import {
  CLINIC_PAGE_SIZE,
  clinicHttpError,
  type CursorPage,
  definedFields,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import type { DeleteReason } from './clinic-schema.ts';
import { clinicToday } from './clinic-time.ts';
import {
  cheapestRate,
  marginPercent,
  medicineStock,
  nearestExpiry,
} from './medicine-stock.ts';
import {
  type MedicineInput,
  medicineInputSchema,
  type MedicineListParams,
  type MedicineMaker,
  type MedicineRecord,
  type MedicineRow,
  type MedicineSortKey,
  type QuickMedicineInput,
} from './medicines-contracts.ts';

/*
 * The Medical store's medicines (`S:1660–1671`), on the fixture world until
 * clinozy-be serves them — every call is REPLACE_WITH_API (D6). The world is
 * imported on demand, so its seed data never lands in a route chunk. A row
 * carries what the list derives (stock, nearest expiry, best rate, margin) —
 * a backend request (Appendix F).
 */

/**
 * The prefix of the Medical room's own reads (sales, orders, suppliers,
 * manufacturers, MRs — `medicalQueryKeys`): a medicine write refreshes them
 * too, since they join medicine names, rates and counts.
 */
export const MEDICAL_ROOM_QUERY_KEY = ['clinic', 'medical'] as const;

/** TanStack Query keys for the medicines — all under `['clinic', 'medicines']`. */
export const medicineQueryKeys = {
  all: ['clinic', 'medicines'] as const,
  /** Every list variant — a write invalidates them all. */
  lists: () => [...medicineQueryKeys.all, 'list'] as const,
  list: (params: MedicineListParams) => [...medicineQueryKeys.lists(), params] as const,
  /** Every live medicine — the pickers' catalogue. */
  catalogue: () => [...medicineQueryKeys.all, 'catalogue'] as const,
  detail: (id: string) => [...medicineQueryKeys.all, 'detail', id] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** The quick record's defaults (H:5316): MRP ₹0, 12% GST, reorder at 2, fill up to 10. */
const QUICK_DEFAULTS = { mrp: 0, gstPct: 12, minStock: 2, maxStock: 10 } as const;

/** A quick record's supplier price: the order's supplier, its rate still to come (H:5316). */
const QUICK_LEAD_DAYS = 2;

// ── Joins (the fixture server's) ──

interface ReadContext {
  today: string;
  makers: Map<string, MedicineMaker>;
  suppliers: Map<string, string>;
}

function readContext(world: FixtureWorld): ReadContext {
  return {
    today: clinicToday(),
    makers: new Map(
      world.manufacturers
        .snapshot()
        .map((maker) => [maker.id, { id: maker.id, name: maker.name, tone: maker.tone }]),
    ),
    suppliers: new Map(
      world.suppliers.snapshot().map((supplier) => [supplier.id, supplier.name]),
    ),
  };
}

/** A medicine as its list row: the stock, its maker, the batch first to expire, the best price. */
export function toMedicineRow(
  medicine: MedicineRecord,
  context: {
    today: string;
    makers: ReadonlyMap<string, MedicineMaker>;
    suppliers: ReadonlyMap<string, string>;
  },
): MedicineRow {
  const nearest = nearestExpiry(medicine.batches, context.today);
  const best = cheapestRate(medicine.supplierRates);
  return {
    ...medicine,
    stock: medicineStock(medicine.batches),
    manufacturer: context.makers.get(medicine.manufacturerId) ?? null,
    nearest: nearest
      ? {
          batchNo: nearest.batch.batchNo,
          expiry: nearest.batch.expiry,
          daysLeft: nearest.daysLeft,
        }
      : null,
    bestRate: best
      ? {
          supplierId: best.supplierId,
          supplierName: context.suppliers.get(best.supplierId) ?? '',
          rate: best.rate,
        }
      : null,
    margin: marginPercent(medicine.mrp, best?.rate),
  };
}

// ── Search, filters and order (the fixture server's) ──

/** Whether a row matches `q`: name, composition, manufacturer, a supplier or "#458" (H:5329). */
function matchesSearch(row: MedicineRow, query: string, context: ReadContext): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const suppliers = row.supplierRates.map(
    (rate) => context.suppliers.get(rate.supplierId) ?? '',
  );
  return [
    row.name,
    row.composition ?? '',
    row.manufacturer?.name ?? '',
    ...suppliers,
    `#${row.seq}`,
  ]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

/** Whether a row passes the Stock, Nearest expiry, Manufacturer and Created filters. */
function passesFilters(row: MedicineRow, params: MedicineListParams, today: string) {
  if (params.stock === 'low' && row.stock > row.minStock) return false;
  if (params.expiry && !(row.nearest && row.nearest.daysLeft <= Number(params.expiry))) {
    return false;
  }
  if (params.manufacturer?.length && !params.manufacturer.includes(row.manufacturerId)) {
    return false;
  }
  return !params.created || createdFilterMatches(row.createdAt, params.created, today);
}

const ORDER: Readonly<
  Record<MedicineSortKey, (a: MedicineRow, b: MedicineRow) => number>
> = {
  seq: (a, b) => a.seq - b.seq,
  name: (a, b) => a.name.localeCompare(b.name),
  manufacturer: (a, b) =>
    (a.manufacturer?.name ?? '').localeCompare(b.manufacturer?.name ?? ''),
  stock: (a, b) => a.stock - b.stock,
  mrp: (a, b) => a.mrp - b.mrp,
  margin: (a, b) => (a.margin ?? -1) - (b.margin ?? -1),
};

// ── Reads ──

/**
 * One cursor page of live medicines (`listMedicines`, `S:1660`;
 * REPLACE_WITH_API): searched, filtered, by name unless a column sort is
 * asked for.
 */
export async function listMedicines(
  params: MedicineListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<MedicineRow>> {
  const { clinicFixtures } = await fixtureWorld();
  const context = readContext(clinicFixtures);
  const rows = clinicFixtures.medicines
    .snapshot()
    .map((medicine) => toMedicineRow(medicine, context))
    .filter(
      (row) =>
        matchesSearch(row, params.q ?? '', context) &&
        passesFilters(row, params, context.today),
    );
  // The contract's default is the name, A to Z (`S:1660`); an asked-for sort runs either way.
  const key = params.sort ?? 'name';
  const direction = params.order === 'desc' ? -1 : 1;
  rows.sort((a, b) => direction * ORDER[key](a, b) || b.seq - a.seq);
  const start = cursor ? Number(cursor) : 0;
  const end = start + CLINIC_PAGE_SIZE;
  return {
    items: rows.slice(start, end),
    nextCursor: end < rows.length ? String(end) : null,
  };
}

/** Every live medicine matching `params` — each cursor page in turn (the pickers' catalogue). */
export function fetchAllMedicines(
  params: MedicineListParams = {},
): Promise<MedicineRow[]> {
  return collectAllPages(async (cursor) => {
    const page = await listMedicines(params, cursor);
    return { rows: page.items, next: page.nextCursor };
  }, 'medicines');
}

/** One medicine as its row (REPLACE_WITH_API) — a 404 when it is unknown or deleted. */
export async function fetchMedicine(id: string): Promise<MedicineRow> {
  const { clinicFixtures } = await fixtureWorld();
  const medicine = await clinicFixtures.medicines.get(id);
  return toMedicineRow(medicine, readContext(clinicFixtures));
}

// ── Writes ──

/** Refuse what the contract's server refuses: an unknown manufacturer or supplier. */
async function checkMedicine(fields: MedicineInput): Promise<void> {
  const { clinicFixtures } = await fixtureWorld();
  refuseUnknownIds(
    'manufacturerId',
    [fields.manufacturerId],
    clinicFixtures.manufacturers.snapshot(),
    'Pick a manufacturer',
  );
  refuseUnknownIds(
    'supplierRates',
    fields.supplierRates.map((rate) => rate.supplierId),
    clinicFixtures.suppliers.snapshot(),
    'Pick suppliers the store buys from',
  );
}

/**
 * Create a medicine (`createMedicine`, `S:1669`; REPLACE_WITH_API) — a full
 * record, never a quick one. A 422 names the broken rule ("Add a name",
 * "Enter the MRP", "Enter a rate for every supplier price").
 */
export async function createMedicine(input: MedicineInput): Promise<MedicineRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(medicineInputSchema, input);
  await checkMedicine(fields);
  return clinicFixtures.medicines.create({
    ...fields,
    isQuick: false,
    nearExpiryDiscountPct: 0,
  });
}

/**
 * Save a medicine (`updateMedicine`, `S:1669`; REPLACE_WITH_API): the patch
 * merged into the saved record and the whole checked again. A full save
 * drops the quick record's "Needs MRP and composition" flag (`medical.md:187`).
 */
export async function updateMedicine(
  id: string,
  patch: Partial<MedicineInput>,
): Promise<MedicineRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.medicines.get(id);
  const fields = validateClinicInput(medicineInputSchema, {
    ...saved,
    ...definedFields(patch),
  });
  await checkMedicine(fields);
  return clinicFixtures.medicines.update(id, { ...fields, isQuick: false });
}

/**
 * A quick medicine from a picker (`quickCreateMedicine`, `S:1670`;
 * REPLACE_WITH_API): the typed name at MRP ₹0, the first manufacturer unless
 * one is given, and a supplier price on the order's supplier — "Needs MRP and
 * composition" until a full save.
 */
export async function quickCreateMedicine(
  input: QuickMedicineInput,
): Promise<MedicineRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const name = input.name.trim();
  if (!name) {
    throw clinicHttpError(422, 'validation', 'Add a name', { name: ['Add a name'] });
  }
  const makers = clinicFixtures.manufacturers.snapshot();
  const manufacturerId = input.manufacturerId ?? makers[0]?.id;
  if (!manufacturerId) {
    throw clinicHttpError(422, 'validation', 'Add a manufacturer first', {
      manufacturerId: ['Add a manufacturer first'],
    });
  }
  return clinicFixtures.medicines.create({
    name,
    composition: null,
    manufacturerId,
    ...QUICK_DEFAULTS,
    batches: [],
    supplierRates: input.supplierId
      ? [{ supplierId: input.supplierId, rate: 0, free: 0, leadDays: QUICK_LEAD_DAYS }]
      : [],
    isQuick: true,
    prescriptionOnly: false,
    nearExpiryDiscountPct: 0,
  });
}

/**
 * Turn the near-expiry discount on or off for these medicines — the row's
 * "Sell at 20% off (near expiry)" and the toolbar's "Sell all at 20% off"
 * (Q-M3; a plan field, Appendix F; REPLACE_WITH_API).
 */
export async function setNearExpiryDiscount(
  ids: readonly string[],
  pct: number,
): Promise<MedicineRecord[]> {
  const { clinicFixtures } = await fixtureWorld();
  return Promise.all(
    ids.map((id) => clinicFixtures.medicines.update(id, { nearExpiryDiscountPct: pct })),
  );
}

/** Soft-delete a medicine with the Reason confirm's choice (`S:1546`; REPLACE_WITH_API). */
export async function deleteMedicine(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<MedicineRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.medicines.remove(id, reason, note);
}

/** Restore a deleted medicine — the Undo of its "deleted" toast (`POST …/restore`, D32). */
export async function restoreMedicine(id: string): Promise<MedicineRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.medicines.restore(id);
}
