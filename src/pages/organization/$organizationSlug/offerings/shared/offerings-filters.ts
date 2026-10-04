import { ALL_BRANCHES } from '@/shared/api/clinic/clinic-list-filters.ts';
import type { RoomFilterField } from '@/shared/components/RoomToolbar/index.ts';

/*
 * The Offerings family's Filters (KICKOFF §6.11 Filters; `offerings.md:187`):
 * the catalogue is read whole, so — as the prototype does — a column's
 * section is built from the values its cells show across the rows, and the
 * rows are matched in place.
 */

/** The most values a section may hold (H:4164). */
const MAX_SECTION_VALUES = 10;

/**
 * A Filters section from what one column shows across the rows (H:4164): only
 * when the rows hold 2–10 distinct values, fewer than there are rows — else
 * `null` (no section). The chips follow `order`, the column's own order.
 *
 * @param rowValues Each row's values in the column (a row may show several).
 * @param order Every value the column can show, in chip order.
 */
export function presentValuesField(
  rowValues: readonly (readonly string[])[],
  order: readonly string[],
): RoomFilterField | null {
  const present = new Set(rowValues.flat());
  const values = order.filter((value) => present.has(value));
  if (
    values.length < 2 ||
    values.length > MAX_SECTION_VALUES ||
    values.length >= rowValues.length
  ) {
    return null;
  }
  return { kind: 'options', values };
}

/** Whether a row's values in a column pass its picked chips — nothing picked passes. */
export function matchesPicked(
  values: readonly string[],
  picked: readonly string[] | undefined,
): boolean {
  if (!picked || picked.length === 0) return true;
  return values.some((value) => picked.includes(value));
}

/**
 * The Branches cell's values for a record (H:5452): `all` ("All branches")
 * when it names no branch, else the open branches it names — and nothing when
 * the clinic has one open branch, where the column stays empty.
 */
export function branchValues(
  branchIds: readonly string[],
  openBranchIds: readonly string[],
): string[] {
  if (openBranchIds.length <= 1) return [];
  if (branchIds.length === 0) return [ALL_BRANCHES];
  return openBranchIds.filter((id) => branchIds.includes(id));
}

/** The Branches chips' order: "All branches", then the open branches. */
export function branchOrder(openBranchIds: readonly string[]): string[] {
  return [ALL_BRANCHES, ...openBranchIds];
}
