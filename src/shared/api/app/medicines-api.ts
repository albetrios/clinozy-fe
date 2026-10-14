import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { pageOf } from '@/core/http/pagination.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { createdRangeOf } from './app-filter-ranges.ts';
import type { DeleteReason } from './app-schema.ts';
import { appToday } from './app-time.ts';
import {
  medicineChangeOf,
  medicineCreateBodyOf,
  type MedicineInput,
  type MedicineListParams,
  type MedicineRow,
  type MedicineSortKey,
  medicineWire,
  quickMedicineBodyOf,
  type QuickMedicineInput,
  toMedicineRow,
} from './medicines-contracts.ts';

/*
 * The Medical store's medicines on clinozy-be (`/app/medicines`, api-integration §5.5): the
 * Medicines tab in cursor pages of 50, the whole list every picker reads (every page, 100 at a
 * time), one medicine, and the writes — create, an edit that sends what changed with its read's
 * `updated_at`, a quick medicine from a picker, the near-expiry discount, delete with its reason
 * and restore. Every write carries its action's idempotency key; every key carries the
 * organization.
 */

/**
 * The prefix of the Medical room's own reads (sales, orders, suppliers, manufacturers, MRs — the
 * room's `medicalQueryKeys`): a medicine write refreshes them too, since they show medicine names,
 * rates and counts.
 */
export const MEDICAL_ROOM_QUERY_KEY = ['app', 'medical'] as const;

/** TanStack Query keys for the medicines — all under `['app', 'medicines']`, each carrying the organization. */
export const medicineQueryKeys = {
  all: ['app', 'medicines'] as const,
  /** Every list variant of one organization — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...medicineQueryKeys.all, organizationId, 'list'] as const,
  list: (organizationId: string | null, params: MedicineListParams) =>
    [...medicineQueryKeys.lists(organizationId), params] as const,
  /** Every live medicine — the pickers' catalogue. */
  catalogue: (organizationId: string | null) =>
    [...medicineQueryKeys.all, organizationId, 'catalogue'] as const,
  detail: (organizationId: string | null, id: string) =>
    [...medicineQueryKeys.all, organizationId, 'detail', id] as const,
};

/** The organization the cached reads belong to. */
export const activeMedicalOrganizationId = () =>
  useOrganizationStore.getState().organizationId;

/** One page of the Medicines tab — the design's 50. */
const PAGE_SIZE = 50;

/** One page of a whole list — the API's most. */
const CATALOGUE_PAGE_SIZE = 100;

/** The Medicines sorts as the API names them; none is the name, A to Z. */
const MEDICINE_SORTS: Readonly<
  Record<
    MedicineSortKey,
    | 'medicine_number'
    | 'name'
    | 'manufacturer_name'
    | 'quantity'
    | 'mrp'
    | 'margin_percent'
  >
> = {
  seq: 'medicine_number',
  name: 'name',
  manufacturer: 'manufacturer_name',
  stock: 'quantity',
  mrp: 'mrp',
  margin: 'margin_percent',
};

/** A search as the API takes it — none when blank. */
const searchOf = (q: string | undefined) => (q?.trim() ? q.trim() : undefined);

/** The Medicines read's query for the URL's params, on the clinic's `today`. */
export function medicineListQuery(
  params: MedicineListParams,
  today: string = appToday(),
) {
  const created = params.created ? createdRangeOf(params.created, today) : {};
  return {
    limit: PAGE_SIZE,
    q: searchOf(params.q),
    // Low stock is everything at or below its reorder level — the empty shelves too.
    stock_level: params.stock === 'low' ? 'low,out' : undefined,
    expiring_within_days: params.expiry,
    manufacturer_id: params.manufacturer?.length
      ? params.manufacturer.join(',')
      : undefined,
    created_from: created.from,
    created_to: created.to,
    sort: params.sort ? MEDICINE_SORTS[params.sort] : undefined,
    order: params.sort ? params.order : undefined,
  };
}

/** A page of rows with the cursor of the next and the API's estimated total. */
export interface MedicinePage {
  rows: MedicineRow[];
  next: string | null;
  total: number | null;
}

/** One page of medicines; `after` is the cursor. */
export async function listMedicines(
  params: MedicineListParams = {},
  after?: string,
): Promise<MedicinePage> {
  const today = appToday();
  const response = await api.get('/app/medicines', {
    query: { ...medicineListQuery(params, today), after },
  });
  return {
    rows: z
      .array(medicineWire)
      .parse(response.data ?? [])
      .map((wire) => toMedicineRow(wire, today)),
    ...pageOf(response.meta?.pagination),
  };
}

/** Every live medicine as its row, by name (`GET /app/medicines`, every page) — the pickers' catalogue. */
export async function fetchAllMedicines(): Promise<MedicineRow[]> {
  const today = appToday();
  return collectAllPages(async (after) => {
    const response = await api.get('/app/medicines', {
      query: { limit: CATALOGUE_PAGE_SIZE, after: after ?? undefined, sort: 'name' },
    });
    return {
      rows: z
        .array(medicineWire)
        .parse(response.data ?? [])
        .map((wire) => toMedicineRow(wire, today)),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'medicines');
}

/** One medicine as its row — a 404 when it is unknown or deleted. */
export async function fetchMedicine(id: string): Promise<MedicineRow> {
  const response = await api.get('/app/medicines/{medicine_id}', {
    params: { medicine_id: id },
  });
  return toMedicineRow(medicineWire.parse(response.data));
}

// ── Writes ──

/** A medicine's answer as its row. */
const medicineOf = (data: unknown) => toMedicineRow(medicineWire.parse(data));

/** Create a medicine from its drawer — a full record; a 400 names the field it refuses. */
export async function createMedicine(
  input: MedicineInput,
  idempotencyKey: string,
): Promise<MedicineRow> {
  const response = await api.post('/app/medicines', {
    body: medicineCreateBodyOf(input),
    idempotencyKey,
  });
  return medicineOf(response.data);
}

/**
 * Save a medicine: only what changed, with the read's `updated_at` — a 409 when someone saved it
 * meanwhile. Nothing changed answers the record as it was, with no write.
 */
export async function updateMedicine(
  record: MedicineRow,
  input: MedicineInput,
  idempotencyKey: string,
): Promise<MedicineRow> {
  const change = medicineChangeOf(record, input);
  if (change === null) return record;
  const response = await api.patch('/app/medicines/{medicine_id}', {
    params: { medicine_id: record.id },
    body: change,
    idempotencyKey,
  });
  return medicineOf(response.data);
}

/**
 * A quick medicine from a picker ("Add medicine “Azel cream”"): the typed name at MRP ₹0 —
 * "Needs MRP and composition" until a full save.
 */
export async function quickCreateMedicine(
  input: QuickMedicineInput,
  idempotencyKey: string,
): Promise<MedicineRow> {
  const response = await api.post('/app/medicines', {
    body: quickMedicineBodyOf(input),
    idempotencyKey,
  });
  return medicineOf(response.data);
}

/**
 * Turn the near-expiry discount on or off for these medicines — the row's "Sell at 20% off (near
 * expiry)" and its Undo: a change of `near_expiry_discount_percent` on each (null removes it).
 */
export async function setNearExpiryDiscount(
  medicines: readonly Pick<MedicineRow, 'id' | 'updatedAt'>[],
  pct: number,
  idempotencyKey: string,
): Promise<MedicineRow[]> {
  return Promise.all(
    medicines.map(async (medicine, index) => {
      const response = await api.patch('/app/medicines/{medicine_id}', {
        params: { medicine_id: medicine.id },
        body: { near_expiry_discount_percent: pct > 0 ? pct : null },
        idempotencyKey: `${idempotencyKey}:${index}`,
      });
      return medicineOf(response.data);
    }),
  );
}

/**
 * "Sell all at 20% off" — every medicine with stock expiring within the window, in one write
 * (`POST /app/medicines/near-expiry-discount`; null removes the discount). Answers how many
 * medicines changed.
 */
export async function setNearExpiryDiscountWithin(
  expiringWithinDays: 30 | 60 | 90,
  pct: number,
  idempotencyKey: string,
): Promise<number> {
  const response = await api.post('/app/medicines/near-expiry-discount', {
    body: {
      expiring_within_days: expiringWithinDays,
      discount_percent: pct > 0 ? pct : null,
    },
    idempotencyKey,
  });
  return z.object({ updated_count: z.number().int() }).parse(response.data).updated_count;
}

/** Soft-delete a medicine with the Reason confirm's choice. */
export async function deleteMedicine(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<void> {
  await api.delete('/app/medicines/{medicine_id}', {
    params: { medicine_id: id },
    reason,
    ...(note ? { note } : {}),
  });
}

/** Restore a deleted medicine — the Undo of its "deleted" toast. */
export async function restoreMedicine(
  id: string,
  idempotencyKey: string,
): Promise<MedicineRow> {
  const response = await api.post('/app/medicines/{medicine_id}/restore', {
    params: { medicine_id: id },
    idempotencyKey,
  });
  return medicineOf(response.data);
}
