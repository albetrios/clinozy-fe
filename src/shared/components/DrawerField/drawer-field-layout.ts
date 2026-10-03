/**
 * The drawer form's 6-column grid (`_patterns.md:33`, H:3836–3839): a field is
 * full (textarea, uploads, items, big chip groups), half (names, pickers) or
 * third (numbers, mobile, dates, codes ≤ 16), and the last field of a row
 * stretches to fill it.
 */
export type DrawerFieldSpan = 'full' | 'half' | 'third';

/** What the packer needs from a field. */
export interface DrawerFieldSlot {
  span: DrawerFieldSpan;
  /** False keeps the field at its span when its row has room left (pickers, names). */
  stretch?: boolean;
}

/** Columns in the drawer form's grid. */
export const DRAWER_GRID_COLUMNS = 6;

const SPAN_COLUMNS: Record<DrawerFieldSpan, number> = { full: 6, half: 3, third: 2 };

/**
 * Columns per field. Fields fill rows of six in order; a field that does not
 * fit starts the next row. A row with room left gives it to its last field
 * that is not a third and may stretch; failing that, a third alone in its row
 * widens to half, and a row of thirds shares the six evenly.
 */
export function layoutDrawerFields(fields: readonly DrawerFieldSlot[]): number[] {
  const columns = fields.map((field) => SPAN_COLUMNS[field.span]);
  let row: number[] = [];
  let used = 0;

  const closeRow = () => {
    const free = DRAWER_GRID_COLUMNS - used;
    if (row.length > 0 && free > 0) {
      const stretcher = [...row]
        .reverse()
        .find(
          (index) => fields[index]?.span !== 'third' && fields[index]?.stretch !== false,
        );
      if (stretcher !== undefined) {
        columns[stretcher] = (columns[stretcher] ?? 0) + free;
      } else if (row.length === 1) {
        const [only] = row;
        if (only !== undefined) columns[only] = SPAN_COLUMNS.half;
      } else {
        const each = Math.floor(DRAWER_GRID_COLUMNS / row.length);
        for (const index of row) columns[index] = each;
      }
    }
    row = [];
    used = 0;
  };

  columns.forEach((width, index) => {
    if (used + width > DRAWER_GRID_COLUMNS) closeRow();
    row.push(index);
    used += width;
    if (used >= DRAWER_GRID_COLUMNS) closeRow();
  });
  closeRow();
  return columns;
}

/** Literal grid-column spans (Tailwind sees whole class names only). */
export const COLUMN_SPAN_CLASS: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
};
