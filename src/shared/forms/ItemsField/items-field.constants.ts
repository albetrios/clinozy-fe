import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The items field's chrome copy lives in `clinic` (the namespace `CLINIC_NS`
 * names), which loads with the org shell where every drawer renders — not in
 * the entry bundle's `common`.
 */
export const ITEMS_FIELD_NS = I18N_NAMESPACES.clinic;

/** Key paths for the items field's own copy (every value verbatim from the design). */
export const ITEMS_FIELD_KEYS = {
  /** The footer button's default label, after its plus sign (H:3811). */
  addRow: 'itemsField.addRow',
  /** The row's × — its accessible name. */
  removeRow: 'itemsField.removeRow',
  /** The × column's spoken header. */
  remove: 'itemsField.remove',
  /** The quantity stepper's two buttons. */
  decrease: 'itemsField.decrease',
  increase: 'itemsField.increase',
  /** The dashed note line: its uppercase tag and its default placeholder. */
  note: 'itemsField.note',
  notePlaceholder: 'itemsField.notePlaceholder',
  /** An empty money cell's placeholder. */
  moneyPlaceholder: 'itemsField.moneyPlaceholder',
} as const;

/** A row's count cap — the quantity stepper's own (H:3811); the invoice's 1–999 passes 999. */
export const ITEMS_QTY_MAX = 9999;

/** Root test id of an items field without a `testId`; hosts pass their own (`invoice-items`). */
export const ITEMS_FIELD_TEST_ID = 'items-field';

/** The `data-testid`s of an items field's parts, derived from its root id. */
export function itemsFieldTestIds(root: string) {
  return {
    table: `${root}-table`,
    header: `${root}-header`,
    row: `${root}-row`,
    remove: `${root}-remove`,
    note: `${root}-note`,
    add: `${root}-add`,
    total: `${root}-total`,
    error: `${root}-error`,
  } as const;
}
