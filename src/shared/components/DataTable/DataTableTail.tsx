import type { RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TABLE_KEYS, TABLE_NS, TABLE_TEST_IDS } from './data-table.constants.ts';
import type { RowContext } from './DataTableRow.tsx';
import { DataTableSkeletonRow } from './DataTableSkeleton.tsx';

/** Placeholder rows under the list while the next page loads (keys). */
const LOADING_ROWS = ['first', 'second'] as const;

/**
 * What follows the last row (D7; H:6168): two placeholder rows in the rows'
 * own shape (the grid's cells, or the phone layout's) and a "Loading more
 * <records>" status while the next page loads, then — once there is no next
 * page — "All <records> loaded" between two hairlines.
 */
export function DataTableTail<TData extends RowData>({
  loading,
  ended,
  recordsLabel,
  columnCount,
  context,
}: {
  loading: boolean;
  /** Every page is loaded and the list has rows. */
  ended: boolean;
  recordsLabel?: string;
  columnCount: number;
  /** The rows' layout this render — the placeholders take their shape. */
  context: RowContext<TData>;
}) {
  const { prefix } = context;
  const { t } = useTranslation(TABLE_NS);
  if (!(loading || ended)) return null;
  const span = Math.max(1, columnCount);
  return (
    // `mt-auto`: under a short list the end line keeps to the card's foot.
    <div // NOSONAR(S6819): grid/flex ARIA table, see the note in DataTable.tsx
      role="rowgroup"
      className="mt-auto shrink-0"
    >
      {loading ? (
        <div // NOSONAR(S6819): grid/flex ARIA table, see the note in DataTable.tsx
          role="row"
          tabIndex={-1}
          data-testid={TABLE_TEST_IDS.loadingMore(prefix)}
        >
          <div // NOSONAR(S6819): grid/flex ARIA table, see the note in DataTable.tsx
            role="cell"
            aria-colspan={span}
          >
            <output className="sr-only">
              {t(TABLE_KEYS.length.loadingMore, { records: recordsLabel ?? '' })}
            </output>
            {LOADING_ROWS.map((item, index) => (
              <DataTableSkeletonRow key={item} context={context} index={index} />
            ))}
          </div>
        </div>
      ) : (
        <div // NOSONAR(S6819): grid/flex ARIA table, see the note in DataTable.tsx
          role="row"
          tabIndex={-1}
          data-testid={TABLE_TEST_IDS.end(prefix)}
        >
          <div // NOSONAR(S6819): grid/flex ARIA table, see the note in DataTable.tsx
            role="cell"
            aria-colspan={span}
            className="text-muted-foreground flex min-w-(--dt-min-w) items-center gap-3 px-(--table-pad-x) pt-4 pb-5.5 text-xs"
          >
            <span aria-hidden="true" className="bg-muted h-px flex-1" />
            {t(TABLE_KEYS.length.allLoaded, { records: recordsLabel })}
            <span aria-hidden="true" className="bg-muted h-px flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}
