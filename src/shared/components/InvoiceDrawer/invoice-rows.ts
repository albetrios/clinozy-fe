import { INVOICE_QTY_MAX } from '@/shared/api/clinic/invoices-contracts.ts';

import { blankLine, type InvoiceLineForm } from './invoice-form.ts';
import { type InvoiceCatalogItem, lineFromCatalog } from './invoice-lines.ts';
import type { InvoiceLineValues } from './invoice-quick-line.ts';

/*
 * What the quick line and Browse do to the item rows (H:5058 `addI`,
 * `step`): add into the first blank row, or step a row's quantity up and down.
 * Pure — the items field sets the result on the form.
 */

/** The rows after adding `item`: into the first blank row, else at the end (H:5058 `addI`). */
export function withAddedLine(
  rows: readonly InvoiceLineForm[],
  item: InvoiceCatalogItem,
  values: InvoiceLineValues = {},
): InvoiceLineForm[] {
  const line = lineFromCatalog(item, values);
  const blank = rows.findIndex((row) => row.name.trim() === '');
  if (blank === -1) return [...rows, line];
  return rows.map((row, index) => (index === blank ? line : row));
}

/** The rows after a Browse tile's "+" or "−": one more, or one fewer — none left drops the row. */
export function withSteppedLine(
  rows: readonly InvoiceLineForm[],
  item: InvoiceCatalogItem,
  step: 1 | -1,
): InvoiceLineForm[] {
  const index = rows.findIndex(
    (row) => (row.offeringId ?? row.medicineId) === item.key && row.name.trim() !== '',
  );
  if (index === -1) return step > 0 ? withAddedLine(rows, item) : [...rows];
  const qty = (rows[index]?.qty ?? 0) + step;
  const next =
    qty <= 0
      ? rows.filter((_, at) => at !== index)
      : rows.map((row, at) =>
          at === index ? { ...row, qty: Math.min(INVOICE_QTY_MAX, qty) } : row,
        );
  return next.length > 0 ? next : [blankLine()];
}
