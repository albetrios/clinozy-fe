'use no memo';
// TanStack Table reads live table state through its column methods on objects
// that keep their identity across state changes, so React Compiler memoisation
// would serve stale answers. The table's own `useTable` re-renders us.

import type { RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  SKELETON_TEST_IDS,
  SkeletonBar,
} from '@/shared/components/SkeletonRows/index.ts';

import { ROW_BOX, rowLayoutClass, type TableColumn } from './data-table-layout.ts';
import type { RowContext } from './DataTableRow.tsx';

/**
 * Placeholder rows while the first page loads: enough to fill a card on a
 * desktop (a 663px body holds 12 rows of 53px); the rest is clipped.
 */
const SKELETON_ROW_COUNT = 12;

/** A pill's width, cycled down the rows (What, Mode, Status …). */
const PILL_WIDTHS = ['w-18', 'w-14', 'w-16'] as const;
/** A bar's width where the cell sizes to its content (phone rows), cycled. */
const CONTENT_WIDTHS = ['w-24', 'w-16', 'w-20'] as const;

/** How a cell's width is known: its grid track, or only its content (a wrapping phone row). */
type CellSizing = 'track' | 'content';

/**
 * `count` placeholder rows, each with its place as its id: they never
 * reorder, so the position is their identity.
 */
function placeholderRows(count: number): { id: string; index: number }[] {
  return Array.from({ length: count }, (_, index) => ({ id: `row-${index}`, index }));
}

/** What a cell's placeholder looks like — the column's kind, a person when it draws an avatar. */
function placeholderKind<TData extends RowData>(
  column: TableColumn<TData>,
): 'person' | 'id' | 'badges' | 'text' {
  const meta = column.columnDef.meta;
  if (meta?.kind === 'person' || meta?.drawsAvatar) return 'person';
  return meta?.kind ?? 'text';
}

/**
 * One cell's placeholder, shaped by `meta.kind` (KICKOFF §3.5 Skeletons): a
 * person a round avatar and two stacked lines, an id a short chip, badges a
 * pill, anything else a bar at the cycling widths.
 */
function CellPlaceholder<TData extends RowData>({
  column,
  index,
  sizing,
}: {
  column: TableColumn<TData>;
  /** Picks the widths: the row's index plus the column's. */
  index: number;
  sizing: CellSizing;
}) {
  const kind = placeholderKind(column);
  const barWidth =
    sizing === 'content' ? CONTENT_WIDTHS[index % CONTENT_WIDTHS.length] : undefined;
  if (kind === 'person') {
    // The person chip's two lines, each at its type size and leading, so the
    // placeholder row is as tall as a person row.
    return (
      <>
        <SkeletonBar shape="avatar" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body flex h-[1.3em] items-center">
            <SkeletonBar index={index} className={barWidth} />
          </span>
          <span className="flex h-[calc(var(--text-xs--line-height)*1em)] items-center text-xs">
            <SkeletonBar index={index + 1} className="h-[0.6em] w-2/5" />
          </span>
        </span>
      </>
    );
  }
  if (kind === 'id') return <SkeletonBar className="h-5.5 w-14 rounded-md" />;
  if (kind === 'badges') {
    return (
      <SkeletonBar
        className={cn('h-5.5 rounded-full', PILL_WIDTHS[index % PILL_WIDTHS.length])}
      />
    );
  }
  return <SkeletonBar index={index} className={barWidth} />;
}

/** How many items a meta line shows at most (the fold engine's phone cap). */
const META_ITEMS = 4;

/**
 * The folded columns' meta line under the primary cell (`DataTableRow`'s
 * `MetaLine`): one short bar per folded column, up to four, at the line's
 * type size and leading — indented under a person's avatar.
 */
function MetaLinePlaceholder({
  count,
  indent,
  index,
}: {
  count: number;
  indent: boolean;
  index: number;
}) {
  return (
    <span
      className={cn(
        'text-caption flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5',
        indent && 'ps-10.5',
      )}
    >
      {placeholderRows(Math.min(count, META_ITEMS)).map((item) => (
        <span key={item.id} className="flex h-[1.4em] items-center">
          <SkeletonBar
            className={cn(
              'h-[0.72em]',
              CONTENT_WIDTHS[(index + item.index) % CONTENT_WIDTHS.length],
            )}
          />
        </span>
      ))}
    </span>
  );
}

/**
 * The primary cell's block: its placeholder, and under it — when columns fold
 * — the meta line's, as `DataTableRow` stacks them.
 */
function PrimaryBlock<TData extends RowData>({
  context,
  column,
  index,
  className,
}: {
  context: RowContext<TData>;
  column: TableColumn<TData>;
  index: number;
  className?: string;
}) {
  const folded = context.foldedColumns.length;
  return (
    <div className={cn('flex min-w-0 flex-col justify-center gap-1', className)}>
      <div
        className={cn(
          'flex min-h-8 min-w-0 items-center gap-2.5',
          column.columnDef.meta?.align === 'end' && 'justify-end',
        )}
      >
        <CellPlaceholder column={column} index={index} sizing="track" />
      </div>
      {folded > 0 ? (
        <MetaLinePlaceholder
          count={folded}
          indent={placeholderKind(column) === 'person'}
          index={index}
        />
      ) : null}
    </div>
  );
}

/** A placeholder cell on the grid: the column's alignment, a row's height. */
function GridCell<TData extends RowData>({
  column,
  index,
}: {
  column: TableColumn<TData>;
  index: number;
}) {
  return (
    <div
      className={cn(
        'flex min-h-8 min-w-0 items-center gap-2.5',
        column.columnDef.meta?.align === 'end' && 'justify-end',
      )}
    >
      <CellPlaceholder column={column} index={index} sizing="track" />
    </div>
  );
}

/** Tablet and desktop: the checkbox track, the kept columns, the actions track. */
function GridPlaceholders<TData extends RowData>({
  context,
  index,
}: {
  context: RowContext<TData>;
  index: number;
}) {
  return (
    <>
      {context.selection.enabled ? <div /> : null}
      {context.keptColumns.map((column, columnIndex) =>
        column === context.primaryColumn ? (
          <PrimaryBlock
            key={column.id}
            context={context}
            column={column}
            index={index + columnIndex}
          />
        ) : (
          <GridCell key={column.id} column={column} index={index + columnIndex} />
        ),
      )}
      {context.hasActions ? <div /> : null}
    </>
  );
}

/**
 * Phone `fold`: the primary block — its meta line under it — and the key
 * column at the end (or first, with `phoneKeyFirst`), any locked column after.
 */
function PhoneFoldPlaceholders<TData extends RowData>({
  context,
  index,
}: {
  context: RowContext<TData>;
  index: number;
}) {
  const { primaryColumn, keyColumn } = context;
  const keyFirst = context.phoneKeyFirst && keyColumn !== undefined;
  const others = context.keptColumns.filter(
    (column) => column !== primaryColumn && column !== keyColumn,
  );
  const key = keyColumn ? (
    <div
      className={cn(
        'flex min-h-8 min-w-0 items-center',
        keyFirst
          ? 'flex-1 basis-0 self-center'
          : 'ms-auto max-w-[46%] flex-none justify-end self-start',
      )}
    >
      <CellPlaceholder column={keyColumn} index={index + 1} sizing="content" />
    </div>
  ) : null;
  return (
    <>
      {keyFirst ? key : null}
      {primaryColumn ? (
        <PrimaryBlock
          context={context}
          column={primaryColumn}
          index={index}
          className={cn(
            keyFirst && 'ms-auto max-w-[46%] flex-none basis-[46%] self-start',
            !keyFirst && (keyColumn ? 'flex-1 basis-0' : 'basis-full'),
          )}
        />
      ) : null}
      {keyFirst ? null : key}
      {others.map((column, columnIndex) => (
        <div key={column.id} className="flex max-w-full min-w-0 items-center">
          <CellPlaceholder
            column={column}
            index={index + columnIndex + 2}
            sizing="content"
          />
        </div>
      ))}
    </>
  );
}

/**
 * Phone `wrap`: every column in order, wrapping; `regrid`: each on its own
 * `meta.phoneClassName` area, the hidden ones left out.
 */
function PhoneFlowPlaceholders<TData extends RowData>({
  context,
  index,
}: {
  context: RowContext<TData>;
  index: number;
}) {
  const regrid = context.phoneLayout === 'regrid';
  const columns = regrid
    ? context.columns.filter((column) => !column.columnDef.meta?.phoneHidden)
    : context.columns;
  return (
    <>
      {columns.map((column, columnIndex) => (
        <div
          key={column.id}
          className={cn(
            'flex max-w-full min-w-0 items-center gap-2.5',
            regrid && column.columnDef.meta?.phoneClassName,
          )}
        >
          <CellPlaceholder
            column={column}
            index={index + columnIndex}
            sizing={regrid ? 'track' : 'content'}
          />
        </div>
      ))}
    </>
  );
}

/**
 * One placeholder row in the table's own row box and layout — the grid's
 * tracks on a tablet or desktop, the phone layout's shape below `md` — with
 * a placeholder per cell. Decorative: the table announces the load.
 */
export function DataTableSkeletonRow<TData extends RowData>({
  context,
  index,
  testId,
}: {
  context: RowContext<TData>;
  /** The row's place: it cycles the bars' widths. */
  index: number;
  testId?: string;
}) {
  let cells = <PhoneFlowPlaceholders context={context} index={index} />;
  if (!context.isPhone) cells = <GridPlaceholders context={context} index={index} />;
  else if (context.phoneLayout === 'fold')
    cells = <PhoneFoldPlaceholders context={context} index={index} />;
  return (
    <div
      aria-hidden="true"
      data-slot="data-table-skeleton-row"
      data-testid={testId}
      className={cn(
        ROW_BOX,
        rowLayoutClass(context),
        'pointer-events-none shrink-0 border-s-transparent',
      )}
    >
      {cells}
    </div>
  );
}

/**
 * The table's loading state (KICKOFF §6.0 States): while the first page loads
 * the body fills with placeholder rows on the table's own grid — under the
 * header, each cell's placeholder in its column, shaped by the column's kind
 * (a person's avatar and two lines, an id's chip, a pill, a bar) and aligned
 * as the column is — so the rows land in place. Clicks are off; one polite
 * announcement says what is loading.
 */
export function DataTableSkeleton<TData extends RowData>({
  context,
  label,
  rows = SKELETON_ROW_COUNT,
}: {
  context: RowContext<TData>;
  /** What is loading ("Payments"), for screen readers. */
  label?: string;
  rows?: number;
}) {
  const { t } = useTranslation(LOCALE_NS);
  return (
    <div
      data-testid={SKELETON_TEST_IDS.rows}
      aria-busy="true"
      className="flex min-h-0 flex-1 cursor-progress flex-col overflow-hidden"
    >
      <output aria-live="polite" className="sr-only">
        {label
          ? t(LOCALE_KEYS.loadingNamed, { name: label })
          : `${t(LOCALE_KEYS.loading)}…`}
      </output>
      {placeholderRows(rows).map((row) => (
        <DataTableSkeletonRow
          key={row.id}
          context={context}
          index={row.index}
          testId={SKELETON_TEST_IDS.row}
        />
      ))}
    </div>
  );
}
