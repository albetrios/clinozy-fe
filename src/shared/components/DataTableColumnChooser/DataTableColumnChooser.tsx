'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import type { Column, ReactTable, RowData } from '@tanstack/react-table';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  DEFAULT_TABLE_TEST_PREFIX,
  TABLE_KEYS,
  TABLE_NS,
  TABLE_TEST_IDS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { Check, Eye, Search } from '@/shared/icons/index.ts';

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

/** The 16px check tile of a multi-select option. */
function CheckTile({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 flex-none items-center justify-center rounded-sm border',
        checked
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-border-strong bg-card',
      )}
    >
      {checked ? <Check className="size-3 text-current" strokeWidth={3} /> : null}
    </span>
  );
}

/**
 * The toolbar's Columns control (KICKOFF §3.5 Columns; H:4182–4187): a 36px
 * `Eye` button with a dark badge counting hidden columns, opening a plain
 * multi-select list — "Show all columns" first (it toggles to the recommended
 * set when everything already shows), then one option per hideable column,
 * searchable above eight. It only drives the table's column visibility; bind
 * that to `useHiddenColumns` to keep the choice on this device. Hidden below
 * `md` — phone rows fold columns themselves (H:92).
 *
 * Self-contained so it can move onto the shared Picker once that lands.
 */
export function DataTableColumnChooser<TData extends RowData>({
  table,
  tableId,
  className,
}: DataTableColumnChooserProps<TData>) {
  const { t } = useTranslation(TABLE_NS);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const prefix = tableId ?? DEFAULT_TABLE_TEST_PREFIX;

  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && columnLabel(column) !== '');
  const total = columns.length;
  const shown = columns.filter((column) => column.getIsVisible()).length;
  const hidden = total - shown;
  const recommended = new Set(
    columns.filter((column) => column.columnDef.meta?.defaultHidden).map((c) => c.id),
  );
  const allShown = hidden === 0;
  const searchable = total > SEARCHABLE_ABOVE;
  // A plain substring match on the name, as the design's list searches (H:4185).
  const needle = query.trim().toLowerCase();
  const listed = needle
    ? columns.filter((column) => columnLabel(column).toLowerCase().includes(needle))
    : columns;

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

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t(TABLE_KEYS.columns.trigger)}
          title={t(TABLE_KEYS.columns.title, { shown, total })}
          data-testid={TABLE_TEST_IDS.columnsTrigger(prefix)}
          className={cn(
            'text-foreground-soft hover:bg-muted relative flex size-9 flex-none items-center justify-center rounded-lg border transition-colors duration-120 max-md:hidden',
            open ? 'border-disabled' : 'border-border',
            className,
          )}
        >
          <Eye aria-hidden="true" className="size-4" />
          {hidden > 0 ? (
            <span
              data-slot="pill"
              className="border-canvas bg-primary text-primary-foreground text-tiny absolute -end-1.75 -top-1.75 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 px-1.25 font-semibold tabular-nums"
            >
              {hidden}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        aria-label={t(TABLE_KEYS.columns.trigger)}
        className="w-auto min-w-65 overflow-hidden rounded-xl p-0"
        onOpenAutoFocus={(event) => {
          if (searchable) return;
          // No search box: arrows and Enter work on the list itself.
          event.preventDefault();
          listRef.current?.focus();
        }}
      >
        <Command
          ref={listRef}
          label={t(TABLE_KEYS.columns.trigger)}
          shouldFilter={false}
          className="rounded-none"
        >
          {searchable ? (
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t(TABLE_KEYS.columns.search)}
              icon={<Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />}
            />
          ) : null}
          <CommandList className="max-h-80">
            <CommandGroup className="border-b">
              <CommandItem
                value="__all"
                aria-checked={allShown}
                data-testid={TABLE_TEST_IDS.columnsShowAll(prefix)}
                onSelect={showAll}
                className="items-start gap-2.5 py-2"
              >
                <CheckTile checked={allShown} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-body font-medium">
                    {t(TABLE_KEYS.columns.showAll)}
                  </span>{' '}
                  <span className="text-caption text-muted-foreground">
                    {showAllHint}
                  </span>
                </span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup>
              {listed.map((column) => {
                const label = columnLabel(column);
                const visible = column.getIsVisible();
                return (
                  <CommandItem
                    key={column.id}
                    value={column.id}
                    aria-checked={visible}
                    data-testid={`${prefix}-columns-option-${column.id}`}
                    onSelect={() => column.toggleVisibility(!visible)}
                    className="text-body gap-2.5"
                  >
                    <CheckTile checked={visible} />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {listed.length === 0 ? (
            <p className="text-muted-foreground text-detail px-3 py-4 text-center">
              {t(TABLE_KEYS.columns.noMatch)}
            </p>
          ) : null}
          <div className="text-caption text-muted-foreground border-t px-3 py-2 tabular-nums">
            {t(TABLE_KEYS.columns.shown, { shown, total })}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
