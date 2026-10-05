import { INVOICE_QTY_MAX } from '@/shared/api/clinic/invoices-contracts.ts';
import {
  type QuickLineTermValues,
  withQuickLineRow,
  withSteppedQuickLineRow,
} from '@/shared/components/QuickLine/index.ts';

import { blankLine, type InvoiceLineForm } from './invoice-form.ts';
import { type InvoiceCatalogItem, lineFromCatalog } from './invoice-lines.ts';

/*
 * What the quick line and Browse do to the item rows (H:5058 `addI`,
 * `step`): add into the first blank row, or step a row's quantity up and down
 * — the shared quick-line rows, with the invoice's own blank row, item and
 * 1–999 cap. Pure — the items field sets the result on the form.
 */

/** A row nothing is billed on yet: the next add fills it. */
const isBlankLine = (row: InvoiceLineForm) => row.name.trim() === '';

/** The rows after adding `item`: into the first blank row, else at the end (H:5058 `addI`). */
export function withAddedLine(
  rows: readonly InvoiceLineForm[],
  item: InvoiceCatalogItem,
  values: QuickLineTermValues = {},
): InvoiceLineForm[] {
  return withQuickLineRow(rows, lineFromCatalog(item, values), isBlankLine);
}

/** The rows after a Browse tile's "+" or "−": one more, or one fewer — none left drops the row. */
export function withSteppedLine(
  rows: readonly InvoiceLineForm[],
  item: InvoiceCatalogItem,
  step: 1 | -1,
): InvoiceLineForm[] {
  return withSteppedQuickLineRow(rows, step, {
    isBlank: isBlankLine,
    holds: (row) => (row.offeringId ?? row.medicineId) === item.key && !isBlankLine(row),
    newRow: () => lineFromCatalog(item),
    blank: blankLine,
    max: INVOICE_QTY_MAX,
  });
}
