import { describe, expect, it } from 'vitest';

import {
  type EntrySpan,
  groupWindows,
  type TaskListLayout,
  taskListLayout,
  VIRTUALIZE_ABOVE,
  withGroupHeaders,
} from './task-list-window.ts';

/** A header's and a row's height as the list estimates them (px). */
const HEADER = 33;
const ROW = 56;

const rowsOf = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}` }));

/** Overdue (2 rows), Due today (3 rows), Coming up (2 rows): entries 0–9. */
const GROUPS = [
  { id: 'overdue', rows: rowsOf('late', 2) },
  { id: 'today', rows: rowsOf('soon', 3) },
  { id: 'later', rows: rowsOf('later', 2) },
];

/** Where each entry sits, laid end to end at the estimated heights. */
function spansOf(layout: TaskListLayout): (index: number) => EntrySpan {
  const spans: EntrySpan[] = [];
  let start = 0;
  for (const entry of layout.entries) {
    const end = start + (entry.kind === 'header' ? HEADER : ROW);
    spans.push({ start, end });
    start = end;
  }
  return (index) => spans[index] ?? { start: 0, end: 0 };
}

/** The range the virtualizer would hand over, as a set with its groups' headers. */
const renderedOf = (indexes: number[], layout: TaskListLayout) =>
  new Set(withGroupHeaders(indexes, layout));

describe('taskListLayout (G-2)', () => {
  it('lays each group out as its header, then its rows, keyed stably', () => {
    const layout = taskListLayout(GROUPS);
    expect(layout.entries.map((entry) => entry.key)).toEqual([
      'group:overdue',
      'row:late-1',
      'row:late-2',
      'group:today',
      'row:soon-1',
      'row:soon-2',
      'row:soon-3',
      'group:later',
      'row:later-1',
      'row:later-2',
    ]);
    expect(layout.entries.map((entry) => entry.group)).toEqual([
      0, 0, 0, 1, 1, 1, 1, 2, 2, 2,
    ]);
    expect(layout.headerAt).toEqual([0, 3, 7]);
    expect(layout.lastAt).toEqual([2, 6, 9]);
  });

  it('ends a group with no rows at its own header', () => {
    const layout = taskListLayout([{ id: 'snoozed', rows: [] }]);
    expect(layout.entries).toEqual([{ kind: 'header', group: 0, key: 'group:snoozed' }]);
    expect(layout.headerAt).toEqual([0]);
    expect(layout.lastAt).toEqual([0]);
  });

  it('virtualises above DataTable’s 60 entries, headers counted', () => {
    expect(VIRTUALIZE_ABOVE).toBe(60);
  });
});

describe('withGroupHeaders (G-2)', () => {
  const layout = taskListLayout(GROUPS);

  it('adds the header of the group a range starts inside, so it can stick', () => {
    expect(withGroupHeaders([5, 6], layout)).toEqual([3, 5, 6]);
  });

  it('adds every reached group’s header once, in order', () => {
    expect(withGroupHeaders([6, 2, 1, 3, 4], layout)).toEqual([0, 1, 2, 3, 4, 6]);
    expect(withGroupHeaders([1, 8, 9], layout)).toEqual([0, 1, 7, 8, 9]);
  });

  it('keeps an empty range empty and ignores an index past the list', () => {
    expect(withGroupHeaders([], layout)).toEqual([]);
    expect(withGroupHeaders([42], layout)).toEqual([42]);
  });
});

describe('groupWindows (G-2)', () => {
  const layout = taskListLayout(GROUPS);
  const spanOf = spansOf(layout);
  const groupHeight = (group: number) => HEADER + (GROUPS[group]?.rows.length ?? 0) * ROW;

  it('stands one spacer, as tall as the group, in for a group out of view', () => {
    const windows = groupWindows(layout, renderedOf([4, 5], layout), spanOf);
    expect(windows[0]).toEqual({
      hiddenHeight: groupHeight(0),
      rows: [],
      padBefore: 0,
      padAfter: 0,
    });
    expect(windows[2]).toEqual({
      hiddenHeight: groupHeight(2),
      rows: [],
      padBefore: 0,
      padAfter: 0,
    });
  });

  it('renders a group in view with its header and the rows in view between two spacers', () => {
    const windows = groupWindows(layout, renderedOf([5], layout), spanOf);
    expect(windows[1]).toEqual({
      hiddenHeight: null,
      rows: [5],
      padBefore: ROW,
      padAfter: ROW,
    });
  });

  it('holds all of a group’s rows below its header when only the header is in view', () => {
    const windows = groupWindows(layout, renderedOf([7], layout), spanOf);
    expect(windows[2]).toEqual({
      hiddenHeight: null,
      rows: [],
      padBefore: 0,
      padAfter: 2 * ROW,
    });
  });

  it('renders a group whole, without spacers, when every entry is in view', () => {
    const all = layout.entries.map((_, index) => index);
    const windows = groupWindows(layout, renderedOf(all, layout), spanOf);
    expect(windows.map((window) => window.rows)).toEqual([
      [1, 2],
      [4, 5, 6],
      [8, 9],
    ]);
    for (const window of windows) {
      expect(window).toMatchObject({ hiddenHeight: null, padBefore: 0, padAfter: 0 });
    }
  });

  it('keeps every group as tall as it is, whichever window is in view', () => {
    const total = layout.entries.length;
    for (let start = 0; start < total; start += 1) {
      for (let end = start; end < total; end += 1) {
        const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const windows = groupWindows(layout, renderedOf(range, layout), spanOf);
        windows.forEach((window, group) => {
          const drawn =
            window.hiddenHeight ??
            HEADER + window.padBefore + window.rows.length * ROW + window.padAfter;
          expect(drawn).toBe(groupHeight(group));
        });
      }
    }
  });
});
