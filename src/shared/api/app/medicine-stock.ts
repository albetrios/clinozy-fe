import type { MedicineBatch, SupplierRate, Tone } from './app-schema.ts';
import { civilDayOffset } from './app-time.ts';

/*
 * The Medical store's stock arithmetic (KICKOFF §6.7 Data): pure, so the
 * Medicines list, the medicine drawer, New sale and the Rx hand-off read one
 * set of rules — and clinozy-be mirrors them (FEFO deduction and the stock
 * checks are server rules; the fixture server runs these). Quantities are
 * units — a pack while a medicine sells whole packs, the loose strip or tablet
 * when its `unitsPerPack` is above 1 (change-pharmacy-record-fields D5); money
 * is integer paise.
 */

/** A medicine's stock on the list: Out at 0, Low at or below its reorder level, else OK. */
export type MedicineStockLevel = 'ok' | 'low' | 'out';

/** Each list level's tone — the stock bar, the row's edge (`medical.md:45`). */
export const MEDICINE_STOCK_TONES: Readonly<Record<MedicineStockLevel, Tone>> = {
  ok: 'sage',
  low: 'butter',
  out: 'blush',
};

/** What a medicine holds: the sum of its batches. */
export function medicineStock(batches: readonly Pick<MedicineBatch, 'qty'>[]): number {
  return batches.reduce((sum, batch) => sum + batch.qty, 0);
}

/** The list's stock level for `stock` against the reorder level `minStock`. */
export function medicineStockLevel(stock: number, minStock: number): MedicineStockLevel {
  if (stock <= 0) return 'out';
  return stock <= minStock ? 'low' : 'ok';
}

/** The 5px bar's fill: stock ÷ the fill-up level, as a whole percent capped at 100. */
export function stockFillPercent(stock: number, maxStock: number): number {
  if (maxStock <= 0) return stock > 0 ? 100 : 0;
  return Math.min(100, Math.round((stock / maxStock) * 100));
}

/** The medicine drawer's stock state (`medical.md:180`): its pill and its tone. */
export type MedicineStockHealth = 'out' | 'reorder' | 'overstocked' | 'healthy';

/** Each drawer state's tone. */
export const MEDICINE_STOCK_HEALTH_TONES: Readonly<Record<MedicineStockHealth, Tone>> = {
  out: 'blush',
  reorder: 'butter',
  overstocked: 'sky',
  healthy: 'sage',
};

/** The drawer's state: Out at 0, Reorder at or below the reorder level, Overstocked above the fill-up level. */
export function medicineStockHealth(
  stock: number,
  minStock: number,
  maxStock: number,
): MedicineStockHealth {
  if (stock <= 0) return 'out';
  if (stock <= minStock) return 'reorder';
  return stock > maxStock ? 'overstocked' : 'healthy';
}

/** How many to order to fill up to `maxStock` — at least one (H:5436). */
export function reorderQuantity(stock: number, maxStock: number): number {
  return Math.max(1, maxStock - stock);
}

/** A pack's loose units as a whole number of at least one — 1 sells whole packs only. */
const perPack = (unitsPerPack: number) => Math.max(1, Math.floor(unitsPerPack));

/**
 * Units as whole packs and the loose rest (D5): 34 units of a strip of 10 are 3 packs + 4. A
 * medicine that sells whole packs has no loose rest.
 */
export function packsAndLoose(
  units: number,
  unitsPerPack: number,
): { packs: number; loose: number } {
  const per = perPack(unitsPerPack);
  const whole = Math.max(0, Math.floor(units));
  return { packs: Math.floor(whole / per), loose: whole % per };
}

/**
 * The packs to order to fill up to `maxStock` units (H:5436): an order buys whole packs, so the
 * units still wanted are rounded up — at least one pack.
 */
export function reorderPacks(
  stock: number,
  maxStock: number,
  unitsPerPack: number,
): number {
  return Math.max(1, Math.ceil(reorderQuantity(stock, maxStock) / perPack(unitsPerPack)));
}

/**
 * One unit's purchase rate, paise: a pack's rate over its units, to the paisa — what a supplier
 * credit and a sale's cost price read for a loose-selling medicine (D5).
 */
export function unitRatePaise(packPaise: number, unitsPerPack: number): number {
  return Math.round(packPaise / perPack(unitsPerPack));
}

/** The last calendar day of a batch's expiry month (`MM/YY` → `20YY-MM-<last day>`). */
export function expiryMonthEnd(expiry: string): string | null {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
  if (!match) return null;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Days from `today` to the end of a batch's expiry month — a batch is good
 * through its whole month (H:3720). A malformed expiry never expires.
 */
export function expiryDaysLeft(expiry: string, today: string): number {
  const end = expiryMonthEnd(expiry);
  return end === null ? Number.POSITIVE_INFINITY : civilDayOffset(today, end);
}

/** A batch's expiry tone: ≤ 30 days blush, ≤ 90 butter, else sage; no stock stone (`medical.md:45`). */
export function expiryTone(daysLeft: number | null): Tone {
  if (daysLeft === null) return 'stone';
  if (daysLeft <= 30) return 'blush';
  return daysLeft <= 90 ? 'butter' : 'sage';
}

/** A batch in stock with its days to expiry. */
export interface BatchExpiry {
  batch: MedicineBatch;
  daysLeft: number;
}

/** The batches in stock, nearest expiry first — the order a sale draws them in (FEFO). */
export function batchesByExpiry(
  batches: readonly MedicineBatch[],
  today: string,
): BatchExpiry[] {
  return batches
    .filter((batch) => batch.qty > 0)
    .map((batch) => ({ batch, daysLeft: expiryDaysLeft(batch.expiry, today) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** The batch in stock that expires first, or `null` when nothing is in stock. */
export function nearestExpiry(
  batches: readonly MedicineBatch[],
  today: string,
): BatchExpiry | null {
  return batchesByExpiry(batches, today)[0] ?? null;
}

/** One batch a sale draws from and how many it takes. */
export interface BatchTake {
  batchNo: string;
  qty: number;
}

/**
 * First expiry, first out: `qty` drawn from the batches in stock, nearest
 * expiry first. `short` is what the stock could not cover — a sale over
 * stock is refused ("Only 3 of Glycolac Cream in stock").
 */
export function fefoTakes(
  batches: readonly MedicineBatch[],
  qty: number,
  today: string,
): { takes: BatchTake[]; short: number } {
  let left = Math.max(0, qty);
  const takes: BatchTake[] = [];
  for (const { batch } of batchesByExpiry(batches, today)) {
    if (left === 0) break;
    const take = Math.min(batch.qty, left);
    takes.push({ batchNo: batch.batchNo, qty: take });
    left -= take;
  }
  return { takes, short: left };
}

/** The batches after `takes` are drawn from them (a batch left at 0 stays, empty). */
export function withTakes(
  batches: readonly MedicineBatch[],
  takes: readonly BatchTake[],
): MedicineBatch[] {
  return batches.map((batch) => {
    const taken = takes
      .filter((take) => take.batchNo === batch.batchNo)
      .reduce((sum, take) => sum + take.qty, 0);
    return taken > 0 ? { ...batch, qty: Math.max(0, batch.qty - taken) } : batch;
  });
}

/** The cheapest supplier price — the "Best rate" and the margin's cost. */
export function cheapestRate(rates: readonly SupplierRate[]): SupplierRate | null {
  let best: SupplierRate | null = null;
  for (const rate of rates) {
    if (rate.rate > 0 && (best === null || rate.rate < best.rate)) best = rate;
  }
  return best;
}

/** The margin on the MRP at a buy rate, a whole percent; `null` without both. */
export function marginPercent(
  mrp: number,
  rate: number | null | undefined,
): number | null {
  if (!(mrp && rate)) return null;
  return Math.round(((mrp - rate) / mrp) * 100);
}

/** The list's margin ink: sage at 30% and over, else butter (`medical.md:45`). */
export function listMarginTone(margin: number): Tone {
  return margin >= 30 ? 'sage' : 'butter';
}

/** The drawer's margin ink: sage at 30%, butter at 15%, else blush (`medical.md:179`). */
export function drawerMarginTone(margin: number): Tone {
  if (margin >= 30) return 'sage';
  return margin >= 15 ? 'butter' : 'blush';
}

/**
 * The MRP's split (`medical.md:179`): the MRP includes GST, so the price
 * before GST is MRP ÷ (1 + GST%), and the GST is the rest — paise, rounded.
 */
export function mrpSplit(mrp: number, gstPct: number): { base: number; gst: number } {
  const base = Math.round(mrp / (1 + gstPct / 100));
  return { base, gst: mrp - base };
}
