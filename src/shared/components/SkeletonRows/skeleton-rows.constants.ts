/**
 * `data-testid`s of a skeleton block and each of its rows — `SkeletonRows`'
 * and the table's (`DataTableSkeleton`), so a test waits on a load the same
 * way anywhere.
 */
export const SKELETON_TEST_IDS = {
  rows: 'skeleton-rows',
  row: 'skeleton-row',
} as const;
