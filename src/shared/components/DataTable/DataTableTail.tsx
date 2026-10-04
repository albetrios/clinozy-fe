import { useTranslation } from 'react-i18next';

import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';

import { TABLE_KEYS, TABLE_NS, TABLE_TEST_IDS } from './data-table.constants.ts';

/** Placeholder rows under the list while the next page loads (keys). */
const LOADING_ROWS = ['first', 'second', 'third'] as const;

/**
 * What follows the last row (D7; H:6168): three placeholder rows and a
 * "Loading more <records>" status while the next page loads, then — once
 * there is no next page — "All <records> loaded" between two hairlines.
 */
export function DataTableTail({
  loading,
  ended,
  recordsLabel,
  columnCount,
  prefix,
}: {
  loading: boolean;
  /** Every page is loaded and the list has rows. */
  ended: boolean;
  recordsLabel?: string;
  columnCount: number;
  prefix: string;
}) {
  const { t } = useTranslation(TABLE_NS);
  if (!(loading || ended)) return null;
  const span = Math.max(1, columnCount);
  return (
    // `mt-auto`: under a short list the end line keeps to the card's foot.
    <div role="rowgroup" className="mt-auto shrink-0">
      {loading ? (
        <div role="row" tabIndex={-1} data-testid={TABLE_TEST_IDS.loadingMore(prefix)}>
          <div role="cell" aria-colspan={span}>
            <span role="status" className="sr-only">
              {t(TABLE_KEYS.length.loadingMore, { records: recordsLabel ?? '' })}
            </span>
            {LOADING_ROWS.map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="border-b-muted flex h-14 items-center gap-3 border-b px-(--table-pad-x)"
              >
                <SkeletonBar shape="avatar" />
                <SkeletonBar className="w-3/5" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div role="row" tabIndex={-1} data-testid={TABLE_TEST_IDS.end(prefix)}>
          <div
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
