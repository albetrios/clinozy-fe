/*
 * What a quick line and Browse do to an items field's rows (H:5058 `addI` /
 * `step`, H:5389 `addP`, H:5276 `addL`, H:4806): a pick fills the first blank
 * row, or comes last; Browse's "+" adds an item no row holds, or counts one
 * more on the row that does, and "−" counts one fewer — none left drops the
 * row, the table keeping a blank one when it asks to. Pure: the host sets the
 * result on its form.
 */

/** The rows with `row` added: into the first blank row, else at the end (H:5058 `addI`). */
export function withQuickLineRow<TRow>(
  rows: readonly TRow[],
  row: TRow,
  isBlank: (row: TRow) => boolean,
): TRow[] {
  const blank = rows.findIndex(isBlank);
  if (blank === -1) return [...rows, row];
  return rows.map((current, index) => (index === blank ? row : current));
}

/** How Browse's "−" / "+" reads a host's rows. */
export interface QuickLineStepRules<TRow extends { qty: number }> {
  /** The table's blank row: the next add fills it. */
  isBlank: (row: TRow) => boolean;
  /** Whether a row holds the stepped item. */
  holds: (row: TRow) => boolean;
  /** The row a first "+" adds. */
  newRow: () => TRow;
  /** The row the table keeps when its last one goes; without it, none. */
  blank?: () => TRow;
  /** The count's cap — the row's stepper's. */
  max?: number;
}

/**
 * The rows after Browse's "+" (1) or "−" (−1) on an item (H:5058 `step`): "+"
 * adds it when no row holds it, else counts one more on the first row that
 * does; "−" counts one fewer there, dropping the row at none.
 */
export function withSteppedQuickLineRow<TRow extends { qty: number }>(
  rows: readonly TRow[],
  step: 1 | -1,
  rules: QuickLineStepRules<TRow>,
): TRow[] {
  const index = rows.findIndex(rules.holds);
  if (index === -1) {
    return step > 0 ? withQuickLineRow(rows, rules.newRow(), rules.isBlank) : [...rows];
  }
  const qty = (rows[index]?.qty ?? 0) + step;
  const max = rules.max ?? Number.POSITIVE_INFINITY;
  const next =
    qty <= 0
      ? rows.filter((_, at) => at !== index)
      : rows.map((row, at) => (at === index ? { ...row, qty: Math.min(max, qty) } : row));
  return next.length === 0 && rules.blank ? [rules.blank()] : next;
}

/** How many of an item the rows hold — a Browse tile's count (H:5058 `qOf`). */
export function quickLineCount<TRow extends { qty: number }>(
  rows: readonly TRow[],
  holds: (row: TRow) => boolean,
): number {
  return rows.filter(holds).reduce((sum, row) => sum + row.qty, 0);
}
