/*
 * The Tasks list's window (G-2): above VIRTUALIZE_ABOVE entries only the rows on screen render,
 * yet every group keeps its own rowgroup and its sticky header. The virtualizer counts each
 * group's header and rows as one flat list of entries; a group on screen renders its header and
 * its rows in view between two spacers, a group off screen is one spacer as tall as it is.
 */

/** Lists longer than this, headers counted, render only the rows in view (DataTable's 60, D7). */
export const VIRTUALIZE_ABOVE = 60;

/** One entry as the virtualizer counts it: a group's header, or one of its rows. */
export interface TaskListEntry {
  kind: 'header' | 'row';
  /** The group it belongs to, by index. */
  group: number;
  /** Stable across renders — the virtualizer keys its measurements by it. */
  key: string;
}

/** The groups as entries, in order, and where each group's header and last entry sit. */
export interface TaskListLayout {
  entries: TaskListEntry[];
  /** Per group: its header's entry index. */
  headerAt: number[];
  /** Per group: its last entry's index — its header's when it has no rows. */
  lastAt: number[];
}

/** Lay the groups out as one list of entries: each group's header, then its rows. */
export function taskListLayout(
  groups: readonly { id: string; rows: readonly { id: string }[] }[],
): TaskListLayout {
  const entries: TaskListEntry[] = [];
  const headerAt: number[] = [];
  const lastAt: number[] = [];
  groups.forEach((group, index) => {
    headerAt.push(entries.length);
    entries.push({ kind: 'header', group: index, key: `group:${group.id}` });
    for (const row of group.rows) {
      entries.push({ kind: 'row', group: index, key: `row:${row.id}` });
    }
    lastAt.push(entries.length - 1);
  });
  return { entries, headerAt, lastAt };
}

/**
 * The virtualizer's range plus the header of every group it reaches, ascending — a group in view
 * always renders its header, which sticks at the top while its rows scroll under it.
 */
export function withGroupHeaders(
  indexes: readonly number[],
  layout: TaskListLayout,
): number[] {
  const kept = new Set(indexes);
  for (const index of indexes) {
    const entry = layout.entries[index];
    const header = entry ? layout.headerAt[entry.group] : undefined;
    if (header !== undefined) kept.add(header);
  }
  return [...kept].sort((left, right) => left - right);
}

/** Where an entry sits in the scroller, in px. */
export interface EntrySpan {
  start: number;
  end: number;
}

/** What one group draws while the list virtualises. */
export interface GroupWindow {
  /** Out of view entirely: one spacer this tall (px) stands in for the group. */
  hiddenHeight: number | null;
  /** The rows to render, by entry index (contiguous). */
  rows: number[];
  /** The height of the group's rows above the rendered ones (px). */
  padBefore: number;
  /** The height of the group's rows below the rendered ones (px). */
  padAfter: number;
}

/**
 * Each group's window: which of its rows render and the space the others hold, from the entries
 * rendered (`rendered`, always with their groups' headers — {@link withGroupHeaders}) and where
 * each entry sits (`spanOf`, measured or estimated).
 */
export function groupWindows(
  layout: TaskListLayout,
  rendered: ReadonlySet<number>,
  spanOf: (index: number) => EntrySpan,
): GroupWindow[] {
  return layout.headerAt.map((header, group) => {
    const last = layout.lastAt[group] ?? header;
    const rows: number[] = [];
    for (let index = header + 1; index <= last; index += 1) {
      if (rendered.has(index)) rows.push(index);
    }
    if (!rendered.has(header) && rows.length === 0) {
      return {
        hiddenHeight: spanOf(last).end - spanOf(header).start,
        rows,
        padBefore: 0,
        padAfter: 0,
      };
    }
    const first = rows[0];
    const lastRendered = rows.at(-1) ?? header;
    return {
      hiddenHeight: null,
      rows,
      padBefore: first === undefined ? 0 : spanOf(first).start - spanOf(header).end,
      padAfter: spanOf(last).end - spanOf(lastRendered).end,
    };
  });
}
