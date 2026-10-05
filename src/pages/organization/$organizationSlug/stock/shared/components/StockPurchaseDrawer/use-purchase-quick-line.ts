import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { STOCK_CATEGORY_VALUES } from '@/shared/api/clinic/clinic-schema.ts';
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

import { STOCK_KEYS } from '../../../stock.constants.ts';
import { useStockItemCatalogue } from '../../hooks/useStockLists/index.ts';
import { useStockWords } from '../../hooks/useStockWords/index.ts';
import { useQuickCreateStockItem } from '../../hooks/useStockWrites/index.ts';
import type { StockItemRow } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { fromMilli } from '../../stock-units.ts';
import {
  isBlankLine,
  lineFor,
  type PurchaseLineValues,
  type StockPurchaseFormValues,
} from './stock-purchase-form.ts';

const K = STOCK_DRAWER_KEYS.purchase.fields;

/** What a clinic purchase line reads (`clinic-stock.md:149`): "10 = qty · @250 = rate". */
const PURCHASE_LINE_TERMS: readonly QuickLineTerm[] = ['qty', 'rate'];

/** How many "Low stock" chips the line offers (H:5276 `slice(0, 6)`). */
const LOW_STOCK_CHIPS = 6;

/** An item as the line lists it, searched with its category's name. */
type PurchaseEntry = QuickLineItem<StockItemRow> & QuickLineSearchable;

/** What the line reads and writes. */
export interface PurchaseQuickLineInput {
  form: UseFormReturn<StockPurchaseFormValues>;
  lines: readonly PurchaseLineValues[];
  /** The bill's vendor: a quick item comes from them. */
  vendorId: string | null;
  testId: string;
}

/**
 * The clinic purchase's quick line (`clinic-stock.md:149`; H:5276): "gloves
 * 10 @250" — ten nitrile gloves at ₹250 — on the shared shorthand; a pick
 * without a quantity orders what fills the item up to its maximum. "Low
 * stock" chips ("Nitrile gloves (M) · 6 left") for the low items the bill
 * lacks; a typed name the list lacks becomes a quick clinic item ("Cotton
 * rolls added to clinic items"). Browse: All · Low stock · the categories, a
 * tile's [− n +], and "New clinic item".
 */
export function usePurchaseQuickLine({
  form,
  lines,
  vendorId,
  testId,
}: PurchaseQuickLineInput): QuickLineProps<StockItemRow, QuickLineTermValues> {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const catalogue = useStockItemCatalogue().data ?? [];
  const quickItem = useQuickCreateStockItem({
    successMessage: (item) => t(STOCK_DRAWER_KEYS.quickItem.added, { name: item.name }),
  });
  const entries: PurchaseEntry[] = catalogue.map((item) => ({
    key: item.id,
    label: item.name,
    sub: t(STOCK_DRAWER_KEYS.pickers.inStock, {
      quantity: words.figure(fromMilli(item.qtyMilli)),
    }),
    keywords: words.category(item.category).label,
    data: item,
  }));
  const parse = useQuickLineTerms({
    numbers: nameNumbers(entries.map((entry) => entry.label)),
    terms: PURCHASE_LINE_TERMS,
    max: ITEMS_QTY_MAX,
  });

  const setLines = (next: PurchaseLineValues[]) =>
    form.setValue('lines', next, { shouldDirty: true });
  const addLine = (line: PurchaseLineValues) =>
    setLines(withQuickLineRow(form.getValues('lines'), line, isBlankLine));
  const create = (name: string, values: QuickLineTermValues) => {
    void quickItem
      .mutateAsync({ name, vendorId })
      .then((item) => addLine(lineFor(item, values)))
      .catch(() => undefined);
  };
  const countOf = (item: QuickLineItem<StockItemRow>) =>
    quickLineCount(lines, (line) => line.itemId === item.key);

  const isLow = (entry: PurchaseEntry) => entry.data.level !== 'ok';
  // The low items the bill lacks: the chips, and the first suggestions.
  const lacking = entries
    .filter((entry) => isLow(entry) && !lines.some((line) => line.itemId === entry.key))
    .slice(0, LOW_STOCK_CHIPS);
  const categories = STOCK_CATEGORY_VALUES.filter((category) =>
    entries.some((entry) => entry.data.category === category),
  );
  const groups = [
    { id: 'all', label: t(STOCK_KEYS.filters.all) },
    ...(entries.some(isLow)
      ? [{ id: 'low', label: t(STOCK_KEYS.filters.lowStock) }]
      : []),
    ...categories.map((category) => ({
      id: category,
      label: words.category(category).label,
    })),
  ];
  const inGroup = (entry: PurchaseEntry, group: string) => {
    if (group === 'all') return true;
    if (group === 'low') return isLow(entry);
    return entry.data.category === group;
  };

  return {
    placeholder: t(K.quickLine),
    hint: t(K.quickHint),
    parse,
    matches: (typed) => quickLineMatches(entries, typed, lacking),
    typedName: (typed) => quickLineTypedName(entries, typed),
    onPick: (item, values) => addLine(lineFor(item, values)),
    onCreate: create,
    frequent: {
      label: t(STOCK_KEYS.filters.lowStock),
      items: lacking.map((entry) => ({
        ...entry,
        chip: t(K.lowStockChip, {
          name: entry.label,
          quantity: words.figure(fromMilli(entry.data.qtyMilli)),
        }),
      })),
    },
    browse: {
      groups,
      tiles: (group, typed) =>
        entries.filter(
          (entry) => inGroup(entry, group) && quickLineBrowseMatches(entry, typed),
        ),
      count: countOf,
      added: entries.filter((entry) => countOf(entry) > 0).length,
      onStep: (item, step) =>
        setLines(
          withSteppedQuickLineRow(form.getValues('lines'), step, {
            isBlank: isBlankLine,
            holds: (line) => line.itemId === item.key,
            newRow: () => lineFor(item.data),
            max: ITEMS_QTY_MAX,
          }),
        ),
      newItem: {
        placeholder: t(STOCK_DRAWER_KEYS.pickers.newItem),
        onAdd: (name) => create(name, {}),
      },
    },
    testId: `${testId}-quick-line`,
  };
}
