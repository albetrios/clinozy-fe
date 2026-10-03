import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import { type AppIcon, Check, X } from '@/shared/icons/index.ts';

/** One action of the bulk bar, run over the selected rows. */
export interface DataTableBulkAction<TRow> {
  id: string;
  label: string;
  icon: AppIcon;
  /** Receives the selected rows' originals. */
  onSelect: (rows: readonly TRow[]) => void;
  /** Destructive: the caller routes it through the delete confirm. */
  destructive?: boolean;
}

interface DataTableBulkBarProps<TRow> {
  /** Rows selected now. */
  selected: readonly TRow[];
  /** Rows that could be selected (the loaded list). */
  total: number;
  actions?: readonly DataTableBulkAction<TRow>[];
  onSelectAll: () => void;
  onClear: () => void;
  /** Test-id prefix (`<prefix>-table-bulk-…`). */
  testIdPrefix?: string;
}

/**
 * The dark 44px bar that docks into a table's footer while rows are selected
 * (KICKOFF §3.5 Selection; H:698): check tile · "<N> selected" · "Select all
 * <N>" when partial · divider · actions · Esc · Clear selection. It keeps the
 * light ramp in dark mode (`data-surface="light-pinned"`, H:14), so it stays
 * dark on both themes. Esc itself is wired by the table.
 */
export function DataTableBulkBar<TRow>({
  selected,
  total,
  actions = [],
  onSelectAll,
  onClear,
  testIdPrefix = 'data',
}: DataTableBulkBarProps<TRow>) {
  const { t } = useTranslation(TABLE_NS);
  const count = selected.length;

  return (
    <div
      role="toolbar"
      aria-label={t(TABLE_KEYS.selection.bulkActions)}
      data-surface="light-pinned"
      data-testid={`${testIdPrefix}-table-bulk-bar`}
      className="animate-bulk-in bg-primary text-primary-foreground flex h-11 [scrollbar-width:none] items-center gap-1 overflow-x-auto ps-3.5 pe-2 whitespace-nowrap"
    >
      <span
        aria-hidden="true"
        className="bg-primary-foreground text-primary flex size-4.5 flex-none items-center justify-center rounded-md"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span aria-live="polite" className="text-body px-1.5 font-semibold tabular-nums">
        {t(TABLE_KEYS.selection.selected, { count })}
      </span>
      {count < total ? (
        <button
          type="button"
          onClick={onSelectAll}
          data-testid={`${testIdPrefix}-table-bulk-select-all`}
          className="text-detail text-primary-foreground/70 hover:text-primary-foreground h-7 flex-none rounded-md px-2 font-medium underline underline-offset-3"
        >
          {t(TABLE_KEYS.selection.selectAllCount, { count: total })}
        </button>
      ) : null}
      <span
        aria-hidden="true"
        className="bg-primary-foreground/25 mx-1.5 h-4.5 w-px flex-none"
      />
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => action.onSelect(selected)}
            data-testid={`${testIdPrefix}-table-bulk-${action.id}`}
            className={cn(
              'text-detail hover:bg-primary-foreground/10 flex h-7.5 flex-none items-center gap-1.5 rounded-lg px-2.5 font-medium',
              action.destructive && 'text-destructive-border',
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {action.label}
          </button>
        );
      })}
      <span className="flex-1" />
      <kbd className="border-primary-foreground/25 text-tiny text-primary-foreground/60 flex h-5 flex-none items-center rounded-sm border px-1.5 font-mono">
        {t(TABLE_KEYS.selection.escape)}
      </kbd>
      <button
        type="button"
        onClick={onClear}
        aria-label={t(TABLE_KEYS.selection.clear)}
        title={t(TABLE_KEYS.selection.clearHint)}
        data-testid={`${testIdPrefix}-table-bulk-clear`}
        className="text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground flex size-7.5 flex-none items-center justify-center rounded-lg"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
