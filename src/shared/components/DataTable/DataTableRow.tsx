'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import { flexRender, type RowData } from '@tanstack/react-table';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  type DataTableRowAction,
  DataTableRowActions,
} from '@/shared/components/DataTableRowActions/index.ts';
import { Checkbox } from '@/shared/components/ui/checkbox.tsx';

import { TABLE_KEYS, TABLE_NS, TABLE_TEST_IDS } from './data-table.constants.ts';
import { buildMetaLine, type MetaLineItem } from './data-table-fold.ts';
import {
  type DataTablePhoneLayout,
  foldItem,
  type TableColumn,
  type TableRow,
} from './data-table-layout.ts';
import type { TableSelection } from './useTableSelection.ts';

// Hover `bg-canvas` 120ms, a muted hairline, the j / k focus bar (H:267, H:683).
const ROW_BASE =
  'group/row bg-card text-body relative border-s-3 border-b border-b-muted py-(--table-row-pad-y) ps-(--table-pad-start) pe-(--table-pad-x) transition-colors duration-120 outline-none hover:bg-canvas data-[selected=true]:bg-muted data-[active=true]:bg-muted data-[kfocus=true]:bg-canvas data-[kfocus=true]:shadow-[inset_2px_0_0_var(--color-border-strong)] rtl:data-[kfocus=true]:shadow-[inset_-2px_0_0_var(--color-border-strong)]';

/**
 * On the grid: on one grid with the header; on a phone: per layout (H:65,
 * H:120). The column gap is 12px unless the table sets `--dt-gap` (the
 * Agenda's 10px, H:2032) — only on a table that never folds: the fold engine
 * plans with 12px.
 */
const GRID_ROW =
  'grid min-w-(--dt-min-w) grid-cols-(--dt-cols) items-center gap-[var(--dt-gap,0.75rem)]';
const FLEX_ROW = 'flex flex-wrap items-center gap-x-3 gap-y-1.5';

// Sticky at the inline end with a solid background and a soft edge (H:225).
const STICKY_ACTIONS =
  'sticky end-0 z-1 flex items-center justify-end self-stretch bg-inherit shadow-[-8px_0_8px_-8px_oklch(0_0_0/0.08)] rtl:shadow-[8px_0_8px_-8px_oklch(0_0_0/0.08)]';

/** Everything a row needs from its table, computed once per table render. */
export interface RowContext<TData extends RowData> {
  prefix: string;
  isPhone: boolean;
  phoneLayout: DataTablePhoneLayout;
  phoneGridClassName?: string;
  phoneMetaSkip?: readonly string[];
  /** Phone `fold`: the key column leads and the primary block sits at the end. */
  phoneKeyFirst: boolean;
  /** Every visible column (phone `wrap` and `regrid` rows). */
  columns: readonly TableColumn<TData>[];
  /** Columns kept side by side, in order. */
  keptColumns: readonly TableColumn<TData>[];
  /** Columns folded into the meta line, in meta-line order. */
  foldedColumns: readonly TableColumn<TData>[];
  primaryColumn?: TableColumn<TData>;
  /** The phone key column. */
  keyColumn?: TableColumn<TData>;
  /** The primary cell is a person: indent the meta line 42px. */
  indentMeta: boolean;
  /** The grid has an actions track. */
  hasActions: boolean;
  showPrimaryLabel: boolean;
  rowActions?: (row: TableRow<TData>) => readonly DataTableRowAction[];
  selection: TableSelection<TData>;
  onRowClick?: (row: TableRow<TData>) => void;
  getRowTone?: (row: TableRow<TData>) => Tone | undefined;
  /** The open record's row keeps the `muted` fill. */
  isRowActive?: (row: TableRow<TData>) => boolean;
  keyboardNav: boolean;
  focusIndex: number | null;
  /** `aria-rowindex` of the first body row. */
  firstRowIndex: number;
}

/** Whether a row's meta line indents 42px under the primary cell's avatar. */
function indentsMeta<TData extends RowData>(
  row: TableRow<TData>,
  context: RowContext<TData>,
): boolean {
  if (context.indentMeta) return true;
  return context.primaryColumn?.columnDef.meta?.drawsAvatar?.(row.original) === true;
}

/** The folded columns under the primary cell: "<label> <value>" items (H:692). */
function MetaLine({
  items,
  indent,
}: {
  items: readonly MetaLineItem[];
  indent: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <span
      data-slot="data-table-meta"
      className={cn(
        'text-caption text-muted-foreground flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 leading-[1.4]',
        indent && 'ps-10.5',
      )}
    >
      {items.map((item) => (
        <span
          key={item.columnId}
          className="inline-flex max-w-full min-w-0 items-center gap-1.25"
        >
          {item.dotClassName ? (
            <span
              aria-hidden="true"
              className={cn('size-1.5 flex-none rounded-full', item.dotClassName)}
            />
          ) : null}
          {/* The spaces are for the text a screen reader reads; flex drops them visually. */}
          {item.label ? <span className="flex-none">{item.label}</span> : null}{' '}
          <span className="text-foreground-soft min-w-0 truncate font-medium tabular-nums">
            {item.value}
          </span>{' '}
        </span>
      ))}
    </span>
  );
}

/**
 * The 18px selection box (H:678, H:684): hidden until the row is hovered or
 * focused or anything is selected, and always shown on touch screens (H:221).
 */
export function SelectionBox({
  checked,
  label,
  visible,
  testId,
  onToggle,
}: {
  checked: boolean | 'indeterminate';
  label: string;
  visible: boolean;
  testId: string;
  onToggle: (extend: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      aria-label={label}
      data-show={visible || undefined}
      data-testid={testId}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event.shiftKey);
      }}
      className="border-border-strong data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground size-4.5 rounded-md border-[1.5px] opacity-0 transition-opacity duration-120 group-hover/row:opacity-100 focus-visible:opacity-100 data-[show=true]:opacity-100 data-[state=checked]:opacity-100 [@media(hover:none)]:opacity-100"
    />
  );
}

function renderCell<TData extends RowData>(
  row: TableRow<TData>,
  column: TableColumn<TData>,
) {
  const cell = row.getVisibleCellsByColumnId()[column.id];
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null;
}

function metaFor<TData extends RowData>(
  row: TableRow<TData>,
  context: RowContext<TData>,
) {
  return buildMetaLine(
    context.foldedColumns.map((column) => foldItem(row, column)),
    { phone: context.isPhone, skipValues: context.phoneMetaSkip },
  );
}

function RowActions<TData extends RowData>({
  row,
  context,
  className,
  keepCell = false,
}: {
  row: TableRow<TData>;
  context: RowContext<TData>;
  className: string;
  /** On the grid the actions track keeps its cell even when this row has none. */
  keepCell?: boolean;
}) {
  const actions = context.rowActions?.(row) ?? [];
  if (actions.length === 0)
    return keepCell ? <div role="cell" className={className} /> : null;
  return (
    <div role="cell" className={className}>
      <DataTableRowActions
        actions={actions}
        showPrimaryLabel={context.showPrimaryLabel}
        testIdPrefix={context.prefix}
      />
    </div>
  );
}

/** Tablet and desktop: one grid row, the primary cell carrying the meta line. */
function GridCells<TData extends RowData>({
  row,
  index,
  context,
}: {
  row: TableRow<TData>;
  index: number;
  context: RowContext<TData>;
}) {
  const { t } = useTranslation(TABLE_NS);
  const { selection, primaryColumn } = context;
  const name = primaryColumn ? foldItem(row, primaryColumn).value : '';
  return (
    <>
      {selection.enabled ? (
        <div role="cell" className="flex items-center justify-center">
          <SelectionBox
            checked={row.getIsSelected()}
            label={t(TABLE_KEYS.selection.selectRow, { name: name || row.id })}
            visible={selection.hasSelection}
            testId={TABLE_TEST_IDS.selectRow(context.prefix)}
            onToggle={(extend) => selection.toggleRow(row, index, extend)}
          />
        </div>
      ) : null}
      {context.keptColumns.map((column) => (
        <div
          key={column.id}
          role="cell"
          className="flex min-w-0 flex-col justify-center gap-1"
        >
          <div
            className={cn(
              'flex max-w-full min-w-0 items-center gap-1.5',
              column.columnDef.meta?.align === 'end' && 'justify-end text-end',
            )}
          >
            {renderCell(row, column)}
          </div>
          {column === primaryColumn ? (
            <MetaLine items={metaFor(row, context)} indent={indentsMeta(row, context)} />
          ) : null}
        </div>
      ))}
      {context.hasActions ? (
        <RowActions row={row} context={context} className={STICKY_ACTIONS} keepCell />
      ) : null}
    </>
  );
}

/**
 * Phone `fold` (H:65–75, H:4112): the primary cell takes the free width with
 * its meta line, the key column sits top-end (max 46%), any locked column
 * follows, and the actions get their own end-aligned line. With
 * `phoneKeyFirst` the two trade places: the key column leads, centred, and
 * the primary block — its meta line under it — sits at the end (Branches).
 */
function PhoneFoldCells<TData extends RowData>({
  row,
  context,
}: {
  row: TableRow<TData>;
  context: RowContext<TData>;
}) {
  const { primaryColumn, keyColumn } = context;
  const others = context.keptColumns.filter(
    (column) => column !== primaryColumn && column !== keyColumn,
  );
  const keyFirst = context.phoneKeyFirst && keyColumn !== undefined;
  const primary = primaryColumn ? (
    <div
      role="cell"
      className={cn(
        'flex min-w-0 flex-col justify-center gap-1',
        keyFirst && 'ms-auto max-w-[46%] flex-none basis-[46%] self-start',
        !keyFirst && (keyColumn ? 'flex-1 basis-0' : 'basis-full'),
      )}
    >
      <div className="flex max-w-full min-w-0 items-center gap-1.5">
        {renderCell(row, primaryColumn)}
      </div>
      <MetaLine items={metaFor(row, context)} indent={indentsMeta(row, context)} />
    </div>
  ) : null;
  return (
    <>
      {keyFirst && keyColumn ? (
        <div role="cell" className="flex min-w-0 flex-1 basis-0 items-center self-center">
          {renderCell(row, keyColumn)}
        </div>
      ) : null}
      {primary}
      {keyColumn && !keyFirst ? (
        <div
          role="cell"
          className="ms-auto flex max-w-[46%] flex-none items-center justify-end self-start text-end"
        >
          {renderCell(row, keyColumn)}
        </div>
      ) : null}
      {others.map((column) => (
        <div key={column.id} role="cell" className="flex max-w-full min-w-0 items-center">
          {renderCell(row, column)}
        </div>
      ))}
      <RowActions
        row={row}
        context={context}
        className="-mt-0.5 flex basis-full justify-end"
      />
    </>
  );
}

/**
 * Phone `wrap` (Leads, H:65): every cell in order, wrapping. `regrid`
 * (Agenda, H:120–128): each cell on its own `meta.phoneClassName` grid area.
 */
function PhoneFlowCells<TData extends RowData>({
  row,
  context,
}: {
  row: TableRow<TData>;
  context: RowContext<TData>;
}) {
  const regrid = context.phoneLayout === 'regrid';
  const columns = regrid
    ? context.columns.filter((column) => !column.columnDef.meta?.phoneHidden)
    : context.columns;
  return (
    <>
      {columns.map((column) => (
        <div
          key={column.id}
          role="cell"
          className={cn(
            'flex max-w-full min-w-0 items-center',
            regrid && column.columnDef.meta?.phoneClassName,
          )}
        >
          {renderCell(row, column)}
        </div>
      ))}
      <RowActions
        row={row}
        context={context}
        className={cn('flex justify-end', regrid ? 'col-span-full' : 'ms-auto')}
      />
    </>
  );
}

function rowLayoutClass<TData extends RowData>(context: RowContext<TData>): string {
  if (!context.isPhone) return GRID_ROW;
  if (context.phoneLayout === 'regrid') return cn('grid', context.phoneGridClassName);
  return FLEX_ROW;
}

function RowCells<TData extends RowData>({
  row,
  index,
  context,
}: {
  row: TableRow<TData>;
  index: number;
  context: RowContext<TData>;
}): ReactNode {
  if (!context.isPhone) return <GridCells row={row} index={index} context={context} />;
  if (context.phoneLayout === 'fold')
    return <PhoneFoldCells row={row} context={context} />;
  return <PhoneFlowCells row={row} context={context} />;
}

/**
 * A press on the row opens its record — but not one on a cell's own control
 * marked `data-row-click="ignore"` (a status button, a person chip), nor one in
 * a cell's portaled popover or hover card, whose events React bubbles through
 * the row although they happen outside it.
 */
function openOnClick(event: MouseEvent<HTMLDivElement>, open: () => void) {
  const row = event.currentTarget;
  const target = event.target;
  if (!(target instanceof Element && row.contains(target))) return;
  const ignored = target.closest('[data-row-click="ignore"]');
  if (ignored && row.contains(ignored)) return;
  open();
}

/** One body row of a `DataTable`, in the layout of the tier. */
export function DataTableRow<TData extends RowData>({
  row,
  index,
  entryIndex = index,
  context,
  measureRow,
}: {
  row: TableRow<TData>;
  /** The row's index among the rows (selection, j / k). */
  index: number;
  /**
   * Its index among the body's entries — group headers included — which the
   * virtualiser measures it by and `aria-rowindex` counts from (default `index`).
   */
  entryIndex?: number;
  context: RowContext<TData>;
  /** Measures the row while the list virtualises. */
  measureRow?: (node: HTMLDivElement | null) => void;
}) {
  const { onRowClick } = context;
  const tone = context.getRowTone?.(row);
  let tabIndex: number | undefined;
  if (onRowClick) tabIndex = 0;
  else if (context.keyboardNav) tabIndex = -1;
  const openOnEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onRowClick || event.key !== 'Enter' || event.target !== event.currentTarget)
      return;
    event.preventDefault();
    onRowClick(row);
  };
  return (
    <div
      ref={measureRow}
      role="row"
      data-slot="data-table-row"
      data-index={entryIndex}
      data-row-index={index}
      data-selected={(context.selection.enabled && row.getIsSelected()) || undefined}
      data-active={context.isRowActive?.(row) || undefined}
      data-kfocus={context.focusIndex === index || undefined}
      data-testid={TABLE_TEST_IDS.row(context.prefix)}
      aria-rowindex={entryIndex + context.firstRowIndex}
      tabIndex={tabIndex}
      onClick={
        onRowClick ? (event) => openOnClick(event, () => onRowClick(row)) : undefined
      }
      onKeyDown={onRowClick ? openOnEnter : undefined}
      className={cn(
        ROW_BASE,
        rowLayoutClass(context),
        tone ? TONE_CLASSES[tone].edge : 'border-s-transparent',
        onRowClick && 'cursor-pointer',
      )}
    >
      <RowCells row={row} index={index} context={context} />
    </div>
  );
}
