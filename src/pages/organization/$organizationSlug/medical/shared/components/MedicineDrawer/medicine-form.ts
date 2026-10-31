import {
  MONEY_SCALE,
  numberFromText,
  paiseOfRupees,
  rupeesOfPaise,
  textFromNumber,
} from '@/lib/number-text.ts';
import type { SupplierRate } from '@/shared/api/app/app-schema.ts';
import { cheapestRate } from '@/shared/api/app/medicine-stock.ts';
import {
  isHsnCode,
  type MedicineGst,
  type MedicineInput,
  type MedicineRow,
  PACK_LABEL_MAX,
  UNITS_PER_PACK_MAX,
} from '@/shared/api/app/medicines-contracts.ts';

/*
 * The Medicine drawer's form (`medical.md:170–188`; KICKOFF §6.7): text as
 * typed — the MRP in rupees, as the field shows it, the HSN code and the pack
 * label — the units per pack, the GST rate, the two levels in units (a pack
 * while the medicine sells whole packs; change-pharmacy-record-fields D5), and
 * the batch and supplier-price rows with money in paise (the items table's own
 * unit). {@link medicineInputOf} turns it into the contract's fields, in the
 * API's rupees.
 */

/**
 * One batch row: its id once saved, its number, "MM/YY", its units, the purchase rate and the MRP
 * printed on it in paise (a pack's; 0 = not recorded, the medicine's MRP applies — D8).
 */
export interface BatchFormRow {
  /** A saved batch's id — the API keeps the batch by it. */
  id?: string;
  batchNo: string;
  expiry: string;
  qty: number;
  purchaseRate: number;
  /** A pack's MRP printed on the batch, paise; 0 = not recorded. */
  mrp: number;
  /** Who it was bought from, as saved. */
  supplierId?: string | null;
}

/** One supplier-price row: the supplier ('' until picked), its rate in paise, free units, lead days. */
export interface SupplierRateFormRow {
  supplierId: string;
  rate: number;
  free: number;
  leadDays: number;
}

/** The Medicine drawer's values. */
export interface MedicineFormValues {
  name: string;
  manufacturerId: string | null;
  composition: string;
  prescriptionOnly: boolean;
  /** The GST HSN code as typed — 4, 6 or 8 digits, or empty. */
  hsnCode: string;
  /** The pack as printed ("1*10", "30GM"), or empty. */
  packLabel: string;
  /** Loose units in a pack: 1 sells whole packs only (D1, D5). */
  unitsPerPack: number;
  /** The MRP in rupees as typed ("650", "12.5"); GST included (D45). */
  mrp: string;
  gstPct: number;
  /** "Reorder at": the stock level that raises Low stock, in units. */
  minStock: number;
  /** "Fill up to": what a reorder fills to, in units. */
  maxStock: number;
  batches: BatchFormRow[];
  supplierRates: SupplierRateFormRow[];
}

/** The four GST rates the segmented control offers (`medical.md:179`). */
export const GST_RATES = [0, 5, 12, 18] as const;

/** The form's own limits (`medical.md:178–182`; H:2916). */
export const MEDICINE_FORM_LIMITS = {
  name: 120,
  composition: 200,
  /** The MRP field takes eight characters — digits and one point. */
  mrp: 8,
  /** The levels take four digits. */
  level: 9999,
  batchNo: 40,
  /** The longest HSN code: eight digits. */
  hsnCode: 8,
  packLabel: PACK_LABEL_MAX,
  unitsPerPack: UNITS_PER_PACK_MAX,
} as const;

/** A new record's defaults (H:5312 `blankMed`): GST 12%, reorder at 2, fill up to 10. */
const NEW_MEDICINE = { gstPct: 12, minStock: 2, maxStock: 10 } as const;

/** A lead time a new supplier price starts with (H:5367). */
export const DEFAULT_LEAD_DAYS = 2;

/** A blank batch row ("+ Add batch"). */
export const emptyBatch = (): BatchFormRow => ({
  batchNo: '',
  expiry: '',
  qty: 0,
  purchaseRate: 0,
  mrp: 0,
});

/** A new medicine's form: the typed name and the first manufacturer, over the defaults. */
export function emptyMedicineForm(
  prefill: { name?: string; manufacturerId?: string | null } = {},
): MedicineFormValues {
  return {
    name: (prefill.name ?? '').trim().slice(0, MEDICINE_FORM_LIMITS.name),
    manufacturerId: prefill.manufacturerId ?? null,
    composition: '',
    prescriptionOnly: false,
    hsnCode: '',
    packLabel: '',
    unitsPerPack: 1,
    mrp: '',
    ...NEW_MEDICINE,
    batches: [],
    supplierRates: [],
  };
}

/** A saved medicine's form — the API's rupees as the fields' paise. */
export function medicineFormOf(medicine: MedicineRow): MedicineFormValues {
  return {
    name: medicine.name,
    manufacturerId: medicine.manufacturer?.id ?? null,
    composition: medicine.composition ?? '',
    prescriptionOnly: medicine.prescriptionOnly,
    hsnCode: medicine.hsnCode ?? '',
    packLabel: medicine.packLabel ?? '',
    unitsPerPack: medicine.unitsPerPack,
    mrp: textFromNumber(paiseOfRupees(medicine.mrp), MONEY_SCALE),
    gstPct: medicine.gstPct,
    minStock: medicine.minStock,
    maxStock: medicine.maxStock,
    batches: medicine.batches.map((batch) => ({
      id: batch.id,
      batchNo: batch.batchNo,
      expiry: batch.expiry,
      qty: batch.qty,
      purchaseRate: paiseOfRupees(batch.purchaseRate ?? 0),
      mrp: paiseOfRupees(batch.mrp ?? 0),
      supplierId: batch.supplierId,
    })),
    supplierRates: medicine.supplierRates.map((rate) => ({
      supplierId: rate.supplierId,
      rate: paiseOfRupees(rate.rate),
      free: rate.free,
      leadDays: rate.leadDays,
    })),
  };
}

/** The MRP as typed, in paise; empty is 0. */
export const mrpPaiseOf = (values: Pick<MedicineFormValues, 'mrp'>): number =>
  numberFromText(values.mrp, MONEY_SCALE);

/** Σ the batch rows' units — what the medicine holds. */
export const formStock = (values: Pick<MedicineFormValues, 'batches'>): number =>
  values.batches.reduce((sum, batch) => sum + batch.qty, 0);

/** The supplier prices with a supplier picked, as the contract spells them. */
function pickedRates(values: Pick<MedicineFormValues, 'supplierRates'>): SupplierRate[] {
  return values.supplierRates.filter((row) => row.supplierId !== '');
}

/** The cheapest picked price — the "Best buy rate", the badge and the margin's cost. */
export const bestFormRate = (values: Pick<MedicineFormValues, 'supplierRates'>) =>
  cheapestRate(pickedRates(values));

/** A batch row nobody has started: no number, no expiry, no packs. */
const blankBatch = (batch: BatchFormRow) =>
  batch.batchNo.trim() === '' && batch.expiry.trim() === '' && batch.qty === 0;

/** "MM/YY" — a batch's expiry month (`expiryMonthSchema`). */
const EXPIRY = /^(0[1-9]|1[0-2])\/\d{2}$/;

/** A typed HSN code that is not 4, 6 or 8 digits (an empty one is no code). */
export const hsnCodeIsInvalid = (
  values: Pick<MedicineFormValues, 'hsnCode'>,
): boolean => {
  const code = values.hsnCode.trim();
  return code !== '' && !isHsnCode(code);
};

/**
 * Whether the units per pack are locked (D7): a saved medicine that holds stock keeps them —
 * clinozy-be refuses the change with a 409 `medicine_has_stock` — until it is sold or returned.
 */
export const unitsPerPackLocked = (
  medicine: Pick<MedicineRow, 'stock'> | null,
): boolean => medicine !== null && medicine.stock > 0;

/** A required field of the medicine drawer. */
export type MedicineRequiredField = 'name' | 'manufacturerId' | 'mrp';

/** The required fields still empty: Name, Manufacturer, MRP (`medical.md:174–178`). */
export function missingMedicineFields(
  values: Pick<MedicineFormValues, MedicineRequiredField>,
): MedicineRequiredField[] {
  const missing: MedicineRequiredField[] = [];
  if (!values.name.trim()) missing.push('name');
  if (!values.manufacturerId) missing.push('manufacturerId');
  if (mrpPaiseOf(values) <= 0) missing.push('mrp');
  return missing;
}

/**
 * The row rule a form breaks, checked before the save: a picked supplier
 * without its rate (`medical.md:182`, red rate cells), then a started batch
 * without its number or with an expiry not "MM/YY". `null` when every row holds.
 */
export function medicineRowProblem(
  values: Pick<MedicineFormValues, 'batches' | 'supplierRates'>,
):
  | { rule: 'rates'; fields: `supplierRates.${number}.rate`[] }
  | { rule: 'batchNo'; fields: `batches.${number}.batchNo`[] }
  | { rule: 'expiry'; fields: `batches.${number}.expiry`[] }
  | null {
  const rates = values.supplierRates.flatMap((row, index) =>
    row.supplierId !== '' && row.rate <= 0
      ? [`supplierRates.${index}.rate` as const]
      : [],
  );
  if (rates.length > 0) return { rule: 'rates', fields: rates };
  const started = values.batches.flatMap((batch, index) =>
    blankBatch(batch) ? [] : [{ batch, index }],
  );
  const unnumbered = started.flatMap(({ batch, index }) =>
    batch.batchNo.trim() === '' ? [`batches.${index}.batchNo` as const] : [],
  );
  if (unnumbered.length > 0) return { rule: 'batchNo', fields: unnumbered };
  const badExpiry = started.flatMap(({ batch, index }) =>
    EXPIRY.test(batch.expiry.trim()) ? [] : [`batches.${index}.expiry` as const],
  );
  return badExpiry.length > 0 ? { rule: 'expiry', fields: badExpiry } : null;
}

/**
 * The contract's fields for a form (`createMedicine` / `updateMedicine`): the
 * name and composition trimmed, the money in rupees, the batches nobody
 * started and the supplier prices with no supplier dropped. A saved batch
 * keeps its id; one without a purchase rate sends none.
 */
export function medicineInputOf(values: MedicineFormValues): MedicineInput {
  return {
    name: values.name.trim(),
    composition: values.composition.trim() || null,
    manufacturerId: values.manufacturerId ?? '',
    prescriptionOnly: values.prescriptionOnly,
    hsnCode: values.hsnCode.trim() || null,
    packLabel: values.packLabel.trim() || null,
    unitsPerPack: Math.min(
      UNITS_PER_PACK_MAX,
      Math.max(1, Math.floor(values.unitsPerPack || 1)),
    ),
    mrp: rupeesOfPaise(mrpPaiseOf(values)),
    gstPct: values.gstPct as MedicineGst,
    minStock: values.minStock,
    maxStock: values.maxStock,
    batches: values.batches
      .filter((batch) => !blankBatch(batch))
      .map((batch) => ({
        ...(batch.id ? { id: batch.id } : {}),
        batchNo: batch.batchNo.trim(),
        expiry: batch.expiry.trim(),
        qty: batch.qty,
        purchaseRate: batch.purchaseRate > 0 ? rupeesOfPaise(batch.purchaseRate) : null,
        mrp: batch.mrp > 0 ? rupeesOfPaise(batch.mrp) : null,
        supplierId: batch.supplierId ?? null,
      })),
    supplierRates: pickedRates(values).map((rate) => ({
      ...rate,
      rate: rupeesOfPaise(rate.rate),
    })),
  };
}

/**
 * The next supplier price "+ Add supplier price" offers (H:5367): a supplier
 * that distributes the maker and has no price yet, else any without one,
 * else none picked.
 */
export function nextSupplierRate(
  values: Pick<MedicineFormValues, 'supplierRates'>,
  suppliers: readonly { id: string; manufacturerIds: readonly string[] }[],
  makerId: string | null,
): SupplierRateFormRow {
  const used = new Set(values.supplierRates.map((row) => row.supplierId));
  const free = suppliers.filter((supplier) => !used.has(supplier.id));
  const next =
    free.find((supplier) => makerId && supplier.manufacturerIds.includes(makerId)) ??
    free[0];
  return { supplierId: next?.id ?? '', rate: 0, free: 0, leadDays: DEFAULT_LEAD_DAYS };
}

/**
 * Where a level sits on the bar (H:5370): a share of the scale, which reaches
 * past the fill-up level by a quarter so the overstock shows — a percent to
 * one decimal, at most 100.
 */
export function stockBarScale(now: number, min: number, max: number) {
  const cap = Math.max(max * 1.25, now, min + 1, 1);
  return (value: number) => `${Math.min(100, Math.round((value / cap) * 1000) / 10)}%`;
}
