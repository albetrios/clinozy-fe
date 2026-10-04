import { numberFromText, textFromNumber } from '@/lib/number-text.ts';
import type {
  MeasureUnit,
  StockCategory,
  StockUnit,
} from '@/shared/api/clinic/clinic-schema.ts';

import type { StockItemRow } from '../../stock-contracts.ts';
import type { StockItemInput } from '../../stock-records-contracts.ts';
import { MILLI } from '../../stock-units.ts';

/** The item form's values: text for the decimals, numbers for the steppers. */
export interface StockItemFormValues {
  name: string;
  category: StockCategory;
  unit: StockUnit;
  /** "Contents per <unit>" as typed ("30"); empty is none. */
  contents: string;
  measure: MeasureUnit;
  /** In stock, in units, as typed ("2.5"). */
  inStock: string;
  /** Usage per week, in units, as typed. */
  usage: string;
  minQty: number;
  maxQty: number;
  vendorId: string | null;
}

/** The units in the item drawer's chip order (`clinic-stock.md:111`). */
export const ITEM_UNITS: readonly StockUnit[] = [
  'tube',
  'bottle',
  'pack',
  'box',
  'kit',
  'piece',
  'vial',
  'ampoule',
  'sachet',
  'jar',
  'roll',
  'pair',
  'ml',
  'g',
  'litre',
];

/** The stacked New clinic item's six units (`clinic-stock.md:193`). */
export const QUICK_ITEM_UNITS: readonly StockUnit[] = [
  'piece',
  'box',
  'bottle',
  'tube',
  'pack',
  'ml',
];

/** What contents are measured in (`clinic-stock.md:113`). */
export const MEASURES: readonly MeasureUnit[] = ['ml', 'g', 'pcs', 'units'];

/** A typed figure's longest text (8 characters, `clinic-stock.md:112`). */
export const FIGURE_MAX_LENGTH = 8;

/** The steppers' ceiling. */
export const LEVEL_MAX = 9999;

/**
 * A new item's form (`openItem`, H:5240): Consumables, a pack measured in ml,
 * nothing in stock, minimum 1 and maximum 10 — the preselects the form sends
 * explicitly (the schema's defaults differ, D22).
 */
export function newItemForm(name = ''): StockItemFormValues {
  return {
    name,
    category: 'consumables',
    unit: 'pack',
    contents: '',
    measure: 'ml',
    inStock: '',
    usage: '',
    minQty: 1,
    maxQty: 10,
    vendorId: null,
  };
}

/** A saved item's form. */
export function itemFormOf(item: StockItemRow): StockItemFormValues {
  return {
    name: item.name,
    category: item.category,
    unit: item.unit,
    contents: item.sizePerUnit ? textFromNumber(item.sizePerUnit, MILLI) : '',
    measure: item.measureUnit ?? 'ml',
    inStock: textFromNumber(item.qtyMilli, MILLI),
    usage: textFromNumber(item.usagePerWeekMilli, MILLI),
    minQty: item.minQty,
    maxQty: item.maxQty,
    vendorId: item.vendorId,
  };
}

/** The contract's fields for a form: decimals ×1000, contents with their measure or neither. */
export function itemInputOf(values: StockItemFormValues): StockItemInput {
  const size = numberFromText(values.contents, MILLI);
  return {
    name: values.name.trim(),
    category: values.category,
    unit: values.unit,
    sizePerUnit: size > 0 ? size : null,
    measureUnit: size > 0 ? values.measure : null,
    minQty: values.minQty,
    maxQty: values.maxQty,
    usagePerWeekMilli: numberFromText(values.usage, MILLI),
    vendorId: values.vendorId,
    qtyMilli: numberFromText(values.inStock, MILLI),
  };
}
