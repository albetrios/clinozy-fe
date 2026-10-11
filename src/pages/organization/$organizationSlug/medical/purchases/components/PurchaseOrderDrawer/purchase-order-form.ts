import { appToday } from '@/shared/api/app/app-time.ts';
import { medicineStockLevel, reorderQuantity } from '@/shared/api/app/medicine-stock.ts';
import type { MedicineRow } from '@/shared/api/app/medicines-contracts.ts';

import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import type { PurchaseOrderInput } from '../../../shared/medical-flows-contracts.ts';

/*
 * New / Edit purchase order's form (`medical.md:254–267`) — pure, so the
 * drawer, its steps' heads, its Quick fill and its checks read one set of
 * rules. Money is integer paise.
 */

/** One line of the order: the medicine, how many, the free units and the rate. */
export interface OrderLineValues {
  medicineId: string | null;
  qty: number;
  free: number;
  /** The purchase rate per unit, paise. */
  rate: number;
}

/** The drawer's form. */
export interface PurchaseOrderFormValues {
  supplierId: string | null;
  billNo: string;
  date: string;
  lines: OrderLineValues[];
}

/** A blank line: "+ Add medicine". */
export const emptyOrderLine = (): OrderLineValues => ({
  medicineId: null,
  qty: 1,
  free: 0,
  rate: 0,
});

/** A line with no medicine yet: the quick line's next add fills it. */
export const isBlankOrderLine = (line: OrderLineValues) => line.medicineId === null;

/** A line's amount: qty × rate — free units cost nothing (`S:830`). */
export const lineAmount = (line: OrderLineValues) =>
  line.medicineId ? line.qty * line.rate : 0;

/** The order's total, paise — the summary "₹4,236". */
export const orderTotal = (lines: readonly OrderLineValues[]) =>
  lines.reduce((sum, line) => sum + lineAmount(line), 0);

/** The lines with a medicine picked. */
export const pickedLines = (lines: readonly OrderLineValues[]) =>
  lines.filter((line) => line.medicineId !== null);

/** Whether the supplier prices a medicine — "From K R Medical Agency" (`medical.md:261`). */
export const pricedBy = (
  medicine: Pick<MedicineRow, 'supplierRates'>,
  supplierId: string | null,
) => medicine.supplierRates.some((rate) => rate.supplierId === supplierId);

/** This supplier's rate for a medicine, else its best rate, else nothing (0). */
export function supplierRateOf(
  medicine: Pick<MedicineRow, 'supplierRates' | 'bestRate'> | undefined,
  supplierId: string | null,
): number {
  if (!medicine) return 0;
  const own = medicine.supplierRates.find((rate) => rate.supplierId === supplierId);
  return own?.rate ?? medicine.bestRate?.rate ?? 0;
}

/** Every medicine at or below its reorder level — Out included (H:5436): the "Low stock" chips. */
export const lowStockMedicines = <T extends Pick<MedicineRow, 'stock' | 'minStock'>>(
  medicines: readonly T[],
) => medicines.filter((row) => medicineStockLevel(row.stock, row.minStock) !== 'ok');

/**
 * A medicine's line as the quick line, Browse and "Reorder low stock" add it
 * (H:5389 `addP`, H:5436): the typed quantity, else what fills it up to its
 * fill-up level (at least one); the typed free units; the typed rate, else
 * the supplier's.
 */
export function orderLineFor(
  medicine: Pick<MedicineRow, 'id' | 'stock' | 'maxStock' | 'supplierRates' | 'bestRate'>,
  supplierId: string | null,
  values: { qty?: number; free?: number; rate?: number } = {},
): OrderLineValues {
  return {
    medicineId: medicine.id,
    qty: values.qty ?? reorderQuantity(medicine.stock, medicine.maxStock),
    free: values.free ?? 0,
    rate: values.rate ?? supplierRateOf(medicine, supplierId),
  };
}

/**
 * The supplier most of the low medicines buy from (H:5436): the one listed on
 * most of their supplier prices — the first listed breaking a tie — else none.
 */
export function reorderSupplier(medicines: readonly MedicineRow[]): string | null {
  const counts = new Map<string, number>();
  for (const row of lowStockMedicines(medicines)) {
    for (const rate of row.supplierRates) {
      counts.set(rate.supplierId, (counts.get(rate.supplierId) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  for (const [supplierId, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = supplierId;
  }
  return best;
}

/**
 * "⚡ Reorder low stock" (`medical.md:265`; H:5436): every medicine at or
 * below its reorder level, qty = fill-up − stock (at least one), at the
 * order's supplier's rate.
 */
export function reorderLines(
  medicines: readonly MedicineRow[],
  supplierId: string | null,
): OrderLineValues[] {
  return lowStockMedicines(medicines).map((row) => orderLineFor(row, supplierId));
}

/** A new order: the supplier given (or none yet), today, the lines given. */
export function newOrderForm(
  supplierId: string | null,
  lines: OrderLineValues[] = [],
): PurchaseOrderFormValues {
  return { supplierId, billNo: '', date: appToday(), lines };
}

/** A saved order's form. */
export function orderFormOf(order: PurchaseOrderRow): PurchaseOrderFormValues {
  return {
    supplierId: order.supplierId,
    billNo: order.supplierBillNo ?? '',
    date: order.date,
    lines: order.items.map((item) => ({
      medicineId: item.medicineId,
      qty: item.qty,
      free: item.free,
      rate: item.rate,
    })),
  };
}

/** The indexes of picked lines with no rate ("Enter the purchase rate", validated before save). */
export const linesMissingRate = (lines: readonly OrderLineValues[]) =>
  lines.flatMap((line, index) => (line.medicineId && line.rate <= 0 ? [index] : []));

/** The contract's fields for a form; lines without a medicine are left out. */
export function orderInputOf(values: PurchaseOrderFormValues): PurchaseOrderInput {
  return {
    supplierId: values.supplierId ?? '',
    supplierBillNo: values.billNo.trim() || null,
    date: values.date,
    items: pickedLines(values.lines).map((line) => ({
      medicineId: line.medicineId ?? '',
      qty: line.qty,
      free: line.free,
      rate: line.rate,
    })),
  };
}
