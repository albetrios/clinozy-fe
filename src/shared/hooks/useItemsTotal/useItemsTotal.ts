import {
  type Control,
  type FieldArray,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
  useWatch,
} from 'react-hook-form';

/**
 * The live total of an items field — the footer figure at the inline end
 * (`_patterns.md:139`). `line` maps each row to its amount: an invoice line
 * through the money module (`invoiceLineAmounts(row).net`), a purchase line as
 * qty × rate, a batch list by its qty. The rows are summed as they change; a
 * row whose amount is not a finite number adds nothing. The sum is unrounded —
 * round it once where it is shown (Q-X3).
 */
export function useItemsTotal<
  TForm extends FieldValues,
  TName extends FieldArrayPath<TForm>,
>(
  control: Control<TForm>,
  name: TName,
  line: (row: FieldArray<TForm, TName>) => number,
): number {
  const rows: unknown = useWatch({
    control,
    name: name as unknown as FieldPath<TForm>,
  });
  let total = 0;
  for (const row of Array.isArray(rows) ? (rows as FieldArray<TForm, TName>[]) : []) {
    const amount = line(row);
    if (Number.isFinite(amount)) total += amount;
  }
  return total;
}
