import { seedCommon } from '@/shared/api/app/app-fixture-seed.ts';
import type {
  MeasureUnit,
  StockCategory,
  StockCount,
  StockItem,
  StockMovement,
  StockMovementType,
  StockPurchase,
  StockUnit,
  StockVendor,
} from '@/shared/api/app/app-schema.ts';
import { appToday } from '@/shared/api/app/app-time.ts';

import { patientRef } from './patients.fixtures.ts';
import { must, paise, ref, seedAt, seedDay, seedMobile } from './refs.fixtures.ts';
import { type StaffKey, staffRef } from './staff.fixtures.ts';

/** Quantities are stored ×1000 (`qtyMilli`, `S:886`). */
const milli = (quantity: number) => Math.round(quantity * 1000);

/** When the clinic's stock lists were set up (the seeds don't say). */
const STOCK_OPENED = 'Aug 01, 2025 · 10:00';

/** `IS_SUP0` (H:3723), verbatim. */
const VENDOR_ROWS: readonly (readonly [key: number, name: string, phone: string])[] = [
  [1, 'Ankur Pharma', '97376 99706'],
  [2, 'Cranix Pharma', '93749 36667'],
  [3, 'Sidhdhi Healthcare', '99982 74712'],
  [4, 'Ibreia', '82384 50007'],
  [5, 'Shivam Water', '81605 55254'],
];

export function stockVendorSeed(today: string = appToday()): StockVendor[] {
  return VENDOR_ROWS.map(([key, name, phone]) => ({
    ...seedCommon(seedAt(STOCK_OPENED, '10:00', today), staffRef('RS')),
    id: ref.stockVendor(key),
    name,
    phone: seedMobile(phone),
    isQuick: false,
  }));
}

/** `IS_CAT` (H:3722). */
const CATEGORIES: Record<string, StockCategory> = {
  'Creams & Serums': 'creams_serums',
  'Peels & Neutralisers': 'peels',
  Masks: 'masks',
  Consumables: 'consumables',
  Equipment: 'equipment',
  'Other clinic stock': 'other',
};

interface ItemRow {
  seq: number;
  name: string;
  category: string;
  unit: StockUnit;
  qty: number;
  min: number;
  max: number;
  vendor: number | null;
  /** Used per week, in units. */
  perWeek: number;
  /** One unit's size (`size` / `mu`). */
  size: number;
  measure: MeasureUnit;
}

/** `IS_ITEM0` (H:3724), verbatim, with each item's size from the same line. */
const ITEM_ROWS: readonly ItemRow[] = [
  {
    seq: 167,
    name: 'Soframycin 30 gm',
    category: 'Creams & Serums',
    unit: 'tube',
    qty: 3,
    min: 1,
    max: 10,
    vendor: 1,
    perWeek: 0.5,
    size: 30,
    measure: 'g',
  },
  {
    seq: 166,
    name: 'Richclin Gel',
    category: 'Creams & Serums',
    unit: 'tube',
    qty: 8,
    min: 1,
    max: 10,
    vendor: 2,
    perWeek: 0.3,
    size: 20,
    measure: 'g',
  },
  {
    seq: 165,
    name: 'Noprik Plus numbing cream 50 gm',
    category: 'Creams & Serums',
    unit: 'tube',
    qty: 5,
    min: 1,
    max: 4,
    vendor: 3,
    perWeek: 1.2,
    size: 50,
    measure: 'g',
  },
  {
    seq: 164,
    name: 'Retises Nano Peel 1%',
    category: 'Peels & Neutralisers',
    unit: 'bottle',
    qty: 1,
    min: 1,
    max: 4,
    vendor: null,
    perWeek: 0.4,
    size: 30,
    measure: 'ml',
  },
  {
    seq: 163,
    name: 'Fucibet',
    category: 'Creams & Serums',
    unit: 'tube',
    qty: 4,
    min: 1,
    max: 6,
    vendor: 1,
    perWeek: 0.2,
    size: 15,
    measure: 'g',
  },
  {
    seq: 162,
    name: 'Yellow Peel (Reti peel)',
    category: 'Peels & Neutralisers',
    unit: 'kit',
    qty: 10,
    min: 1,
    max: 12,
    vendor: 4,
    perWeek: 0.6,
    size: 10,
    measure: 'ml',
  },
  {
    seq: 161,
    name: 'D-Tan Mask',
    category: 'Masks',
    unit: 'pack',
    qty: 0,
    min: 1,
    max: 6,
    vendor: null,
    perWeek: 0.8,
    size: 5,
    measure: 'pcs',
  },
  {
    seq: 160,
    name: 'Water bottles',
    category: 'Other clinic stock',
    unit: 'bottle',
    qty: 120,
    min: 20,
    max: 200,
    vendor: 5,
    perWeek: 9,
    size: 1000,
    measure: 'ml',
  },
  {
    seq: 159,
    name: 'Nitrile gloves (M)',
    category: 'Consumables',
    unit: 'box',
    qty: 6,
    min: 4,
    max: 20,
    vendor: 3,
    perWeek: 1.5,
    size: 100,
    measure: 'pcs',
  },
  {
    seq: 158,
    name: 'Gauze swabs',
    category: 'Consumables',
    unit: 'pack',
    qty: 14,
    min: 5,
    max: 30,
    vendor: 3,
    perWeek: 2,
    size: 50,
    measure: 'pcs',
  },
];

export function stockItemSeed(today: string = appToday()): StockItem[] {
  return ITEM_ROWS.map((row) => ({
    ...seedCommon(
      seedAt(STOCK_OPENED, '10:00', today),
      staffRef('RS'),
      seedAt('Sep 12 · 12:00', '12:00', today),
    ),
    id: ref.stockItem(row.seq),
    seq: row.seq,
    name: row.name,
    category: must(CATEGORIES[row.category], `stock category ${row.category}`),
    unit: row.unit,
    sizePerUnit: milli(row.size),
    measureUnit: row.measure,
    qtyMilli: milli(row.qty),
    minQty: row.min,
    maxQty: row.max,
    usagePerWeekMilli: milli(row.perWeek),
    vendorId: row.vendor === null ? null : ref.stockVendor(row.vendor),
  }));
}

/**
 * `IS_PO0` (H:3725), verbatim. Only #16's lines are known: the 24 water
 * bottles its bill "SW-77" brought in (`IS_MV0` #2), ₹50 each = its ₹1,200.
 */
const PURCHASE_ROWS: readonly {
  seq: number;
  vendor: number;
  bill: string;
  date: string;
  total: number;
  paid: number;
  lines: readonly (readonly [item: number, qty: number, rate: number])[];
}[] = [
  {
    seq: 14,
    vendor: 3,
    bill: 'A000445',
    date: '3 Oct 2025',
    total: 2750,
    paid: 2750,
    lines: [],
  },
  {
    seq: 12,
    vendor: 1,
    bill: 'AP-2291',
    date: '28 Aug 2025',
    total: 5400,
    paid: 5400,
    lines: [],
  },
  {
    seq: 15,
    vendor: 2,
    bill: 'CX-118',
    date: '22 Sep 2026',
    total: 1710,
    paid: 0,
    lines: [],
  },
  {
    seq: 16,
    vendor: 5,
    bill: 'SW-77',
    date: '25 Sep 2026',
    total: 1200,
    paid: 600,
    lines: [[160, 24, 50]],
  },
];

export function stockPurchaseSeed(today: string = appToday()): StockPurchase[] {
  return PURCHASE_ROWS.map((row) => ({
    ...seedCommon(seedAt(row.date, '12:00', today), staffRef('RS')),
    id: ref.stockPurchase(row.seq),
    seq: row.seq,
    vendorId: ref.stockVendor(row.vendor),
    billNo: row.bill,
    date: seedDay(row.date, today),
    lines: row.lines.map(([item, qty, rate]) => ({
      itemId: ref.stockItem(item),
      qtyMilli: milli(qty),
      rate: paise(rate),
    })),
    bill: paise(row.total),
    paid: paise(row.paid),
  }));
}

/** `IS_MT` (H:3727): Used, Damaged and Returned take stock out. */
const MOVEMENT_TYPES: Record<string, { type: StockMovementType; sign: 1 | -1 }> = {
  Used: { type: 'used', sign: -1 },
  Received: { type: 'received', sign: 1 },
  Damaged: { type: 'damaged', sign: -1 },
  Returned: { type: 'returned', sign: -1 },
};

/** `IS_MV0` (H:3726), verbatim; the note is the movement's "used for". */
const MOVEMENT_ROWS: readonly {
  key: number;
  item: number;
  type: string;
  qty: number;
  at: string;
  by: StaffKey;
  note: string;
  patient?: string;
  purchase?: number;
}[] = [
  {
    key: 1,
    item: 165,
    type: 'Used',
    qty: 1,
    at: 'Today 11:05',
    by: 'KP',
    note: 'LHR · Dharti Galani',
    patient: 'Dharti Galani',
  },
  {
    key: 2,
    item: 160,
    type: 'Received',
    qty: 24,
    at: '25 Sep',
    by: 'RS',
    note: 'SW-77',
    purchase: 16,
  },
  {
    key: 3,
    item: 167,
    type: 'Used',
    qty: 1,
    at: '24 Sep',
    by: 'KP',
    note: 'Mole removal',
  },
  {
    key: 4,
    item: 161,
    type: 'Damaged',
    qty: 1,
    at: '20 Sep',
    by: 'RS',
    note: 'Seal broken',
  },
];

export function stockMovementSeed(today: string = appToday()): StockMovement[] {
  return MOVEMENT_ROWS.map((row) => {
    const movement = must(MOVEMENT_TYPES[row.type], `movement type ${row.type}`);
    return {
      ...seedCommon(seedAt(row.at, '12:00', today), staffRef(row.by)),
      id: ref.stockMovement(row.key),
      itemId: ref.stockItem(row.item),
      type: movement.type,
      deltaMilli: movement.sign * milli(row.qty),
      usedFor: row.note,
      patientId: row.patient ? patientRef(row.patient) : null,
      purchaseId: row.purchase === undefined ? null : ref.stockPurchase(row.purchase),
      stockCountId: null,
      revertsId: null,
      revertedById: null,
      revertReason: null,
    };
  });
}

/** No stock check is seeded in the prototype. */
export function stockCountSeed(): StockCount[] {
  return [];
}
