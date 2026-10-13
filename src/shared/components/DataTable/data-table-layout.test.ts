import { type ColumnDef, useTable } from '@tanstack/react-table';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { PenLine, Receipt, Trash } from '@/shared/icons/index.ts';

import type { FoldColumn } from './data-table-fold.ts';
import {
  CHECKBOX_TRACK,
  columnLabel,
  foldItem,
  planTableLayout,
  summariseRowActions,
  type TableLayoutInput,
  type TableRow,
} from './data-table-layout.ts';
import { type DataTableFeatures, dataTableFeatures } from './table-features.ts';

const COLUMNS: FoldColumn[] = [
  { id: 'name', label: 'Name', track: 'minmax(200px,1fr)', kind: 'person' },
  { id: 'status', label: 'Status', track: '96px' },
  { id: 'due', label: 'Due', track: '96px', align: 'end' },
];

const input = (overrides: Partial<TableLayoutInput> = {}): TableLayoutInput => ({
  columns: COLUMNS,
  actions: { track: 0, renderTrack: 0, primaryLabelLength: 0 },
  width: 0,
  isPhone: false,
  phoneLayout: 'fold',
  fold: true,
  showAll: false,
  selection: false,
  ...overrides,
});

describe('planTableLayout', () => {
  it('prepends the checkbox track when rows select', () => {
    expect(planTableLayout(input({ selection: true })).template).toBe(
      `${CHECKBOX_TRACK}px minmax(200px,1fr) 96px 96px`,
    );
  });

  it('pins a min-width only when the row keeps every column side by side', () => {
    expect(planTableLayout(input({ fold: false })).minWidth).toBe(
      200 + 96 + 96 + 24 + 43,
    );
    expect(planTableLayout(input({ showAll: true })).minWidth).toBe(
      200 + 96 + 96 + 24 + 43,
    );
    expect(planTableLayout(input({ width: 900 })).minWidth).toBe(0);
    expect(planTableLayout(input({ fold: false, minWidth: 830 })).minWidth).toBe(830);
  });

  it('offers the fold toggle once columns fold, and while "Show all" is on', () => {
    expect(planTableLayout(input({ width: 900 })).hasFoldControl).toBe(false);
    expect(planTableLayout(input({ width: 300 })).hasFoldControl).toBe(true);
    expect(planTableLayout(input({ showAll: true })).hasFoldControl).toBe(true);
    expect(planTableLayout(input({ fold: false, width: 300 })).hasFoldControl).toBe(
      false,
    );
  });

  it('labels the primary action when the row has room, and widens its track', () => {
    const roomy = planTableLayout(
      input({
        width: 1400,
        actions: { track: 100, renderTrack: 100, primaryLabelLength: 11 },
      }),
    );
    expect(roomy.showPrimaryLabel).toBe(true);
    expect(roomy.template.endsWith(`${100 + Math.round(11 * 7.2 + 10)}px`)).toBe(true);

    const tight = planTableLayout(
      input({
        width: 560,
        actions: { track: 100, renderTrack: 100, primaryLabelLength: 11 },
      }),
    );
    expect(tight.showPrimaryLabel).toBe(false);
  });

  it('never grows the actions past 210px for a label', () => {
    expect(
      planTableLayout(
        input({
          width: 1400,
          actions: { track: 190, renderTrack: 190, primaryLabelLength: 12 },
        }),
      ).showPrimaryLabel,
    ).toBe(false);
  });

  it('plans a phone fold, a phone wrap, and always labels on a phone', () => {
    const fold = planTableLayout(input({ isPhone: true }));
    expect(fold.plan.keyId).toBe('due');
    expect(fold.showPrimaryLabel).toBe(true);
    expect(fold.hasFoldControl).toBe(false);
    const wrap = planTableLayout(input({ isPhone: true, phoneLayout: 'wrap' }));
    expect(wrap.plan.folded).toEqual([]);
  });
});

describe('summariseRowActions', () => {
  const action = (
    id: string,
    extra: Partial<DataTableRowAction> = {},
  ): DataTableRowAction => ({
    id,
    label: id,
    icon: PenLine,
    onSelect: vi.fn(),
    ...extra,
  });

  it('sizes the track for the widest row and finds the longest primary label', () => {
    const rows = [{ id: 'a' }, { id: 'b' }] as unknown as TableRow<{ id: string }>[];
    const summary = summariseRowActions(
      rows,
      (row) =>
        row.id === 'a'
          ? [action('edit')]
          : [
              action('New invoice', { icon: Receipt, primary: true }),
              action('edit'),
              action('delete', { icon: Trash, destructive: true }),
            ],
      32,
    );
    expect(summary).toEqual({
      track: 3 * 32 + 2 * 6 + 13 + 24,
      renderTrack: 3 * 32 + 2 * 6 + 13 + 24,
      primaryLabelLength: 11,
    });
  });

  it('is empty without row actions', () => {
    expect(summariseRowActions([], undefined, 32)).toEqual({
      track: 0,
      renderTrack: 0,
      primaryLabelLength: 0,
    });
  });

  it('plans with 32px buttons but renders the tablet’s 36px ones', () => {
    const rows = [{ id: 'a' }] as unknown as TableRow<{ id: string }>[];
    const summary = summariseRowActions(rows, () => [action('edit'), action('open')], 36);
    expect(summary.track).toBe(2 * 32 + 6 + 24);
    expect(summary.renderTrack).toBe(2 * 36 + 6 + 24);
  });
});

describe('planTableLayout on a tablet (H:141)', () => {
  /** Patients' visible columns (KICKOFF §6.5) and its four actions. */
  const PATIENTS: FoldColumn[] = [
    { id: 'id', label: 'ID', track: '64px', kind: 'id' },
    { id: 'patient', label: 'Patient', track: 'minmax(200px,1.4fr)', kind: 'person' },
    { id: 'type', label: 'Type', track: 'minmax(120px,1fr)', kind: 'badges' },
    { id: 'status', label: 'Status', track: '96px', kind: 'badges' },
    { id: 'followUp', label: 'Follow-up', track: '150px', kind: 'badges' },
    { id: 'due', label: 'Due', track: '96px', align: 'end' },
    { id: 'updated', label: 'Updated', track: 'minmax(150px,1fr)' },
  ];
  const tablet = (width: number) =>
    planTableLayout(
      input({
        columns: PATIENTS,
        width,
        selection: true,
        actions: { track: 183, renderTrack: 199, primaryLabelLength: 0 },
      }),
    );

  it('folds what the design folds at 1024 and 820, drawing 36px buttons', () => {
    expect(tablet(1024 - 24 - 2).plan.folded).toEqual(['id', 'updated']);
    expect(tablet(820 - 24 - 2).plan.folded).toEqual([
      'id',
      'status',
      'followUp',
      'updated',
    ]);
    expect(tablet(1024 - 24 - 2).template.endsWith(' 199px')).toBe(true);
  });

  it('relaxes the minimums when the wider buttons only just miss the room', () => {
    // Fits at 32px buttons with 10px to spare — the 16px they grow needs the slack.
    const width = 1143 + 78 + 10;
    const layout = tablet(width);
    expect(layout.plan.folded).toEqual([]);
    expect(layout.template).toContain('minmax(0,1.4fr)');
    expect(tablet(width + 40).template).toContain('minmax(200px,1.4fr)');
  });
});

describe('foldItem and columnLabel', () => {
  interface Patient {
    id: string;
    name: string;
    tags: string[];
    due: number;
  }
  const columns: ColumnDef<DataTableFeatures, Patient>[] = [
    { accessorKey: 'id', header: 'ID', meta: { kind: 'id' } },
    { accessorKey: 'name', header: () => 'Patient', meta: { label: 'Patient' } },
    { accessorKey: 'tags', header: 'Tags' },
    {
      accessorKey: 'due',
      header: 'Due',
      meta: {
        foldValue: (row: Patient) =>
          row.due > 0
            ? { value: `₹${row.due}`, dotClassName: 'bg-tone-blush-dot' }
            : null,
      },
    },
  ];
  const data: Patient[] = [
    { id: '#3508', name: 'Priya', tags: ['VIP', 'New'], due: 2000 },
    { id: '#3509', name: 'Ravi', tags: [], due: 0 },
  ];

  function setup() {
    const { result } = renderHook(() =>
      useTable({ features: dataTableFeatures, data, columns }),
    );
    const table = result.current;
    const column = (id: string) => {
      const found = table.getColumn(id);
      if (!found) throw new Error(`no column ${id}`);
      return found;
    };
    return { rows: table.getRowModel().rows, column };
  }

  it('labels a column from meta, else its string header, else its id', () => {
    const { column } = setup();
    expect(columnLabel(column('name'))).toBe('Patient');
    expect(columnLabel(column('tags'))).toBe('Tags');
  });

  it('folds ids bare, lists by comma, and honours foldValue', () => {
    const { rows, column } = setup();
    const [priya, ravi] = rows;
    if (!(priya && ravi)) throw new Error('rows missing');
    expect(foldItem(priya, column('id'))).toMatchObject({ label: '', value: '#3508' });
    expect(foldItem(priya, column('tags'))).toMatchObject({
      label: 'Tags',
      value: 'VIP, New',
    });
    expect(foldItem(priya, column('due'))).toMatchObject({
      value: '₹2000',
      dotClassName: 'bg-tone-blush-dot',
    });
    expect(foldItem(ravi, column('due')).value).toBe('');
  });
});
