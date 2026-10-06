'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import type { Column, ReactTable, RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { CountBadge } from '@/shared/components/Cells/CountBadge/index.ts';
import {
  COLUMNS_SHOW_ALL_KEY,
  DEFAULT_TABLE_TEST_PREFIX,
  TABLE_KEYS,
  TABLE_NS,
  TABLE_TEST_IDS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Eye } from '@/shared/icons/index.ts';

/** More columns than this and the list gets a search box (H:4185). */
const SEARCHABLE_ABOVE = 8;

interface DataTableColumnChooserProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  /** Scopes the test ids (`<tableId>-columns-…`). */
  tableId?: string;
  className?: string;
}

/** A column's name: `meta.label`, else its string header, else its id. */
function columnLabel<TData extends RowData>(
  column: Column<DataTableFeatures, TData, unknown>,
): string {
  const header = column.columnDef.header;
  return (
    column.columnDef.meta?.label ?? (typeof header === 'string' ? header : column.id)
  );
}

/**
 * The toolbar's Columns control (KICKOFF §3.5 Columns; H:4182–4187): a 36px
 * `Eye` button with a dark badge counting hidden columns, opening the shared
 * Picker as a plain multi-select — "Show all columns" under "View" (it toggles
 * to the recommended set when everything already shows), then one option per
 * hideable column under "Columns", searchable above eight, "N of M shown"
 * underneath. It only drives the table's column visibility; bind that to
 * `useHiddenColumns` to keep the choice on this device. Hidden below `md` —
 * phone rows fold columns themselves (H:92).
 */
export function DataTableColumnChooser<TData extends RowData>({
  table,
  tableId,
  className,
}: DataTableColumnChooserProps<TData>) {
  const { t } = useTranslation(TABLE_NS);
  const prefix = tableId ?? DEFAULT_TABLE_TEST_PREFIX;

  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && columnLabel(column) !== '');
  const total = columns.length;
  const visibleIds = columns
    .filter((column) => column.getIsVisible())
    .map((column) => column.id);
  const shown = visibleIds.length;
  const hidden = total - shown;
  const recommended = new Set(
    columns.filter((column) => column.columnDef.meta?.defaultHidden).map((c) => c.id),
  );
  const allShown = hidden === 0;

  const showAll = () => {
    // Everything already shows → back to the recommended set (H:4185).
    const toRecommended = allShown && recommended.size > 0;
    table.setColumnVisibility((previous) => ({
      ...previous,
      ...Object.fromEntries(
        columns.map((column) => [
          column.id,
          !(toRecommended && recommended.has(column.id)),
        ]),
      ),
    }));
  };

  let showAllHint: string;
  if (recommended.size > 0) {
    showAllHint = allShown
      ? t(TABLE_KEYS.columns.tapForRecommended)
      : t(TABLE_KEYS.columns.recommendedHides, { count: recommended.size });
  } else {
    showAllHint = allShown
      ? t(TABLE_KEYS.columns.allShown, { count: total })
      : t(TABLE_KEYS.columns.hiddenCount, { count: hidden });
  }

  const options: PickerOption[] = [
    {
      key: COLUMNS_SHOW_ALL_KEY,
      label: t(TABLE_KEYS.columns.showAll),
      sub: showAllHint,
      group: t(TABLE_KEYS.columns.viewGroup),
    },
    ...columns.map((column) => ({
      key: column.id,
      label: columnLabel(column),
      group: t(TABLE_KEYS.columns.columnsGroup),
    })),
  ];
  const value = allShown ? [COLUMNS_SHOW_ALL_KEY, ...visibleIds] : visibleIds;

  /** One row changed: "Show all", or a column's visibility. */
  const handleChange = (keys: string[]) => {
    const toggled =
      keys.find((key) => !value.includes(key)) ??
      value.find((key) => !keys.includes(key));
    if (toggled === COLUMNS_SHOW_ALL_KEY) {
      showAll();
      return;
    }
    columns.find((column) => column.id === toggled)?.toggleVisibility();
  };

  return (
    <Picker
      multiple
      plain
      label={t(TABLE_KEYS.columns.trigger)}
      value={value}
      options={options}
      onChange={handleChange}
      searchable={total > SEARCHABLE_ABOVE}
      searchPlaceholder={t(TABLE_KEYS.columns.search)}
      minWidth={260}
      maxHeight={320}
      align="end"
      footer={() => (
        <span className="text-caption text-muted-foreground px-1 tabular-nums">
          {t(TABLE_KEYS.columns.shown, { shown, total })}
        </span>
      )}
      testId={TABLE_TEST_IDS.columns(prefix)}
      className={cn('flex-none max-md:hidden', className)}
      renderTrigger={({ open }) => (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t(TABLE_KEYS.columns.trigger)}
          title={t(TABLE_KEYS.columns.title, { shown, total })}
          data-testid={TABLE_TEST_IDS.columnsTrigger(prefix)}
          className={cn(
            'text-foreground-soft hover:bg-muted relative shadow-none duration-120',
            open ? 'border-disabled' : 'border-border',
          )}
        >
          <Eye aria-hidden="true" className="size-4" />
          {hidden > 0 ? (
            <CountBadge
              count={hidden}
              className="border-canvas absolute -end-1.75 -top-1.75 border-2"
            />
          ) : null}
        </Button>
      )}
    />
  );
}
