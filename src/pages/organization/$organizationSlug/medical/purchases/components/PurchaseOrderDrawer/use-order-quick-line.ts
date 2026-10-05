import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type {
  MedicineRecord,
  MedicineRow,
} from '@/shared/api/clinic/medicines-contracts.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  nameNumbers,
  quickLineBrowseMatches,
  quickLineCount,
  type QuickLineItem,
  quickLineMatches,
  type QuickLineProps,
  type QuickLineSearchable,
  type QuickLineTerm,
  type QuickLineTermValues,
  quickLineTypedName,
  useQuickLineTerms,
  withQuickLineRow,
  withSteppedQuickLineRow,
} from '@/shared/components/QuickLine/index.ts';
import { ITEMS_QTY_MAX } from '@/shared/forms/ItemsField/index.ts';
import { useQuickCreateMedicine } from '@/shared/hooks/useMedicines/index.ts';

import { MEDICAL_KEYS } from '../../../medical.constants.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import {
  emptyOrderLine,
  isBlankOrderLine,
  lowStockMedicines,
  orderLineFor,
  type OrderLineValues,
  pricedBy,
  type PurchaseOrderFormValues,
} from './purchase-order-form.ts';

const K = MEDICAL_DRAWER_KEYS.purchaseOrder.fields;

/** What an order line reads (`medical.md:261`): "20 = qty · +2 = free · @180 = rate". */
const ORDER_LINE_TERMS: readonly QuickLineTerm[] = ['qty', 'free', 'rate'];

/** How many "Low stock" chips the line offers (H:5389 `slice(0, 6)`). */
const LOW_STOCK_CHIPS = 6;

/** A medicine as the line lists it: its picker option's words, searched with its maker's name. */
type OrderEntry = QuickLineItem<MedicineRow> & QuickLineSearchable;

/**
 * "Add medicine “q”" — the picker's create row and the quick line's typed
 * name alike (`medical.md:261`): a quick medicine at MRP ₹0 linked to the
 * order's supplier, "Azel cream added · set MRP later in Stock". Resolves the
 * new record, or null when the write failed (its toast said so).
 */
export function useOrderMedicineCreate(
  supplierId: string | null,
): (name: string) => Promise<MedicineRecord | null> {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const quickMedicine = useQuickCreateMedicine({
    successMessage: (medicine) =>
      t(MEDICAL_DRAWER_KEYS.quick.medicine, { name: medicine.name }),
  });
  return (name) => quickMedicine.mutateAsync({ name, supplierId }).catch(() => null);
}

/** The medicine picker's options as the line's entries — the same words, the record behind. */
function entriesOf(options: readonly PickerOption<MedicineRow>[]): OrderEntry[] {
  return options.flatMap((option) =>
    option.data
      ? [
          {
            key: option.key,
            label: option.label,
            sub: option.sub,
            meta: option.meta,
            // Name and maker, as the order's line searches (H:5389: label + sub);
            // the composition stays the picker's and the sale's.
            keywords: option.data.manufacturer?.name,
            data: option.data,
          },
        ]
      : [],
  );
}

/** What the line reads and writes. */
export interface OrderQuickLineInput {
  form: UseFormReturn<PurchaseOrderFormValues>;
  /** The medicine picker's options (`useMedicineOptions`): the line lists the same. */
  options: readonly PickerOption<MedicineRow>[];
  lines: readonly OrderLineValues[];
  supplierId: string | null;
  /** "From K R Medical Agency" — Browse's group for what the supplier prices. */
  supplierName: string | undefined;
  testId: string;
}

/**
 * The purchase order's quick line (`medical.md:261`; H:5389): "azel 20 +2
 * @180" — Azelan, twenty and two free at ₹180 — on the shared shorthand; a
 * pick without a quantity orders what fills the medicine up to its fill-up
 * level, at the supplier's rate. "Low stock" chips ("Arganlif Hair Serum 50
 * ml · 2 left") for the low medicines the order lacks; a typed name the list
 * lacks becomes a quick medicine. Browse: All · Low stock · "From <supplier>"
 * · Other medicines, a tile's [− n +], and "New medicine name".
 */
export function useOrderQuickLine({
  form,
  options,
  lines,
  supplierId,
  supplierName,
  testId,
}: OrderQuickLineInput): QuickLineProps<MedicineRow, QuickLineTermValues> {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const createMedicine = useOrderMedicineCreate(supplierId);
  const entries = entriesOf(options);
  const low = lowStockMedicines(entries.map((entry) => entry.data)).map((row) => row.id);
  const isLow = (entry: OrderEntry) => low.includes(entry.key);
  const parse = useQuickLineTerms({
    numbers: nameNumbers(entries.map((entry) => entry.label)),
    terms: ORDER_LINE_TERMS,
    max: ITEMS_QTY_MAX,
  });

  const setLines = (next: OrderLineValues[]) =>
    form.setValue('lines', next, { shouldDirty: true });
  const addLine = (line: OrderLineValues) =>
    setLines(withQuickLineRow(form.getValues('lines'), line, isBlankOrderLine));
  const create = (name: string, values: QuickLineTermValues) => {
    void createMedicine(name).then((medicine) => {
      if (!medicine) return;
      addLine({
        medicineId: medicine.id,
        qty: values.qty ?? 1,
        free: values.free ?? 0,
        rate: values.rate ?? 0,
      });
    });
  };
  const countOf = (item: QuickLineItem<MedicineRow>) =>
    quickLineCount(lines, (line) => line.medicineId === item.key);

  // The low medicines the order lacks: the chips, and the first suggestions.
  const lacking = entries
    .filter(
      (entry) => isLow(entry) && !lines.some((line) => line.medicineId === entry.key),
    )
    .slice(0, LOW_STOCK_CHIPS);
  const lowEntries = entries.filter(isLow);
  const supplied = entries.filter((entry) => pricedBy(entry.data, supplierId));
  const groups = [
    { id: 'all', label: t(MEDICAL_KEYS.filters.all) },
    ...(lowEntries.length > 0
      ? [{ id: 'low', label: t(MEDICAL_KEYS.filters.lowStock) }]
      : []),
    ...(supplierName && supplied.length > 0
      ? [{ id: 'supplier', label: t(K.fromSupplier, { supplier: supplierName }) }]
      : []),
    ...(supplierName && supplied.length < entries.length
      ? [{ id: 'other', label: t(K.otherMedicines) }]
      : []),
  ];
  const inGroup = (entry: OrderEntry, group: string) => {
    if (group === 'low') return isLow(entry);
    if (group === 'supplier') return pricedBy(entry.data, supplierId);
    if (group === 'other') return !pricedBy(entry.data, supplierId);
    return true;
  };

  return {
    placeholder: t(K.quickLine),
    hint: t(K.quickHint),
    parse,
    matches: (words) => quickLineMatches(entries, words, lacking),
    typedName: (words) => quickLineTypedName(entries, words),
    onPick: (medicine, values) => addLine(orderLineFor(medicine, supplierId, values)),
    onCreate: create,
    frequent: {
      label: t(MEDICAL_KEYS.filters.lowStock),
      items: lacking.map((entry) => ({
        ...entry,
        chip: t(K.lowStockChip, { name: entry.label, quantity: entry.data.stock }),
      })),
    },
    browse: {
      groups,
      tiles: (group, words) =>
        entries.filter(
          (entry) => inGroup(entry, group) && quickLineBrowseMatches(entry, words),
        ),
      count: countOf,
      added: entries.filter((entry) => countOf(entry) > 0).length,
      onStep: (item, step) =>
        setLines(
          withSteppedQuickLineRow(form.getValues('lines'), step, {
            isBlank: isBlankOrderLine,
            holds: (line) => line.medicineId === item.key,
            newRow: () => orderLineFor(item.data, supplierId),
            blank: emptyOrderLine,
            max: ITEMS_QTY_MAX,
          }),
        ),
      newItem: { placeholder: t(K.newMedicineName), onAdd: (name) => create(name, {}) },
    },
    testId: `${testId}-quick-line`,
  };
}
