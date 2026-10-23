import type { FieldPath } from 'react-hook-form';

import { paiseOfRupees, rupeesOfPaise } from '@/lib/number-text.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { reorderQuantity } from '@/shared/api/app/medicine-stock.ts';
import type { MedicineRow } from '@/shared/api/app/medicines-contracts.ts';

import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import type {
  PurchaseOrderInput,
  PurchaseOrderLineInput,
} from '../../../shared/medical-records-contracts.ts';

/*
 * New / Edit purchase order's form (`medical.md:254–267`) — pure, so the
 * drawer, its steps' heads, its Quick fill and its checks read one set of
 * rules. A line's rate is paise, the money cell's unit, converted to the
 * API's rupees at the edge: a saved order's rupees in, the input's rupees out.
 * The totals here preview what is being typed; a saved order's are the
 * server's.
 */

/** What marks a line's medicine as typed, not picked: `new:Azel cream`. */
const TYPED_MEDICINE_PREFIX = 'new:';

/**
 * A medicine typed on a line that the store does not stock yet (MD26): its
 * line holds this key until the save, which sends the name and the server
 * adds it as a quick medicine — "Needs MRP and composition".
 */
export const typedMedicineKey = (name: string) =>
  `${TYPED_MEDICINE_PREFIX}${name.trim()}`;

/** The typed name a line's medicine key holds; null for a medicine the store stocks. */
export function typedMedicineName(medicineId: string | null): string | null {
  if (!medicineId?.startsWith(TYPED_MEDICINE_PREFIX)) return null;
  return medicineId.slice(TYPED_MEDICINE_PREFIX.length) || null;
}

/** One line of the order: the medicine (or a typed one's key), how many, the free units and the rate. */
export interface OrderLineValues {
  /** A medicine's id, or {@link typedMedicineKey} for one typed on the line. */
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

/** A line's amount, paise: qty × rate — free units cost nothing (`S:830`). */
export const lineAmount = (line: OrderLineValues) =>
  line.medicineId ? Math.round(line.qty * line.rate) : 0;

/** The order's total, paise — the summary "₹4,236". */
export const orderTotal = (lines: readonly OrderLineValues[]) =>
  lines.reduce((sum, line) => sum + lineAmount(line), 0);

/** The lines with a medicine picked or typed. */
export const pickedLines = (lines: readonly OrderLineValues[]) =>
  lines.filter((line) => line.medicineId !== null);

/** Whether the supplier prices a medicine — "From K R Medical Agency" (`medical.md:261`). */
export const pricedBy = (
  medicine: Pick<MedicineRow, 'supplierRates'>,
  supplierId: string | null,
) => medicine.supplierRates.some((rate) => rate.supplierId === supplierId);

/** This supplier's rate for a medicine, else its best rate, else nothing (0) — paise. */
export function supplierRateOf(
  medicine: Pick<MedicineRow, 'supplierRates' | 'bestRate'> | undefined,
  supplierId: string | null,
): number {
  if (!medicine) return 0;
  const own = medicine.supplierRates.find((rate) => rate.supplierId === supplierId);
  return paiseOfRupees(own?.rate ?? medicine.bestRate?.rate ?? 0);
}

/**
 * Every medicine the server reads at or below its reorder level — Out included
 * (H:5436): the "Low stock" chips.
 */
export const lowStockMedicines = <T extends Pick<MedicineRow, 'stockLevel'>>(
  medicines: readonly T[],
) => medicines.filter((row) => row.stockLevel !== 'ok');

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

/** A saved order's form — its rupees as the rate cells' paise. */
export function orderFormOf(order: PurchaseOrderRow): PurchaseOrderFormValues {
  return {
    supplierId: order.supplier.id,
    billNo: order.supplierBillNo ?? '',
    date: order.date,
    lines: order.lines.map((line) => ({
      medicineId: line.medicineId,
      qty: line.qty,
      free: line.free,
      rate: paiseOfRupees(line.rate),
    })),
  };
}

/** The indexes of picked lines with no rate ("Enter the purchase rate", validated before save). */
export const linesMissingRate = (lines: readonly OrderLineValues[]) =>
  lines.flatMap((line, index) => (line.medicineId && line.rate <= 0 ? [index] : []));

/** clinozy-be's `MEDICAL_PURCHASE_ORDER_ITEMS_MAX`: an order takes 1–50 medicines. */
export const ORDER_LINES_MAX = 50;

/** Why an order's lines cannot be sent: none picked, more than the API takes, a rate missing. */
export type OrderLinesProblem = 'empty' | 'tooMany' | 'rate';

/**
 * The one rule an order's lines answer to — the API's `items` (1–50), each with its rate: the
 * save's check and the Items step's head both read it. `null` when the lines can be sent.
 */
export function orderLinesProblem(
  lines: readonly OrderLineValues[],
): OrderLinesProblem | null {
  const count = pickedLines(lines).length;
  if (count === 0) return 'empty';
  if (count > ORDER_LINES_MAX) return 'tooMany';
  return linesMissingRate(lines).length > 0 ? 'rate' : null;
}

/**
 * A line as the API's input takes it, rupees: the medicine — or a typed one's
 * name, which the server adds (MD26).
 */
export function orderLineInputOf(
  line: Pick<OrderLineValues, 'medicineId' | 'qty' | 'free' | 'rate'>,
): PurchaseOrderLineInput {
  const typed = typedMedicineName(line.medicineId);
  return {
    medicineId: typed === null ? line.medicineId : null,
    ...(typed === null ? {} : { newMedicineName: typed }),
    qty: line.qty,
    free: line.free,
    rate: rupeesOfPaise(line.rate),
  };
}

/** The contract's fields for a form; lines without a medicine are left out. */
export function orderInputOf(values: PurchaseOrderFormValues): PurchaseOrderInput {
  return {
    supplierId: values.supplierId ?? '',
    supplierBillNo: values.billNo.trim() || null,
    date: values.date,
    items: pickedLines(values.lines).map(orderLineInputOf),
  };
}

/** A field of the drawer's form a refused save can name. */
type OrderField = FieldPath<PurchaseOrderFormValues>;

/**
 * The API's names for the form's fields (`supplierBillNumber` → `billNo`), and
 * each sent line's by its row — blank rows are not sent, so `items.1` may be
 * the third row: a refused save outlines the cell it names.
 */
export function orderServerFields(
  lines: readonly OrderLineValues[],
): Record<string, OrderField> {
  const fields: Record<string, OrderField> = {
    supplierId: 'supplierId',
    supplierBillNumber: 'billNo',
    orderDate: 'date',
    items: 'lines',
  };
  const sent = lines.flatMap((line, row) => (line.medicineId === null ? [] : [row]));
  sent.forEach((row, index) => {
    fields[`items.${index}`] = `lines.${row}.medicineId`;
    fields[`items.${index}.medicineId`] = `lines.${row}.medicineId`;
    fields[`items.${index}.newMedicineName`] = `lines.${row}.medicineId`;
    fields[`items.${index}.quantity`] = `lines.${row}.qty`;
    fields[`items.${index}.freeQuantity`] = `lines.${row}.free`;
    fields[`items.${index}.rate`] = `lines.${row}.rate`;
  });
  return fields;
}
