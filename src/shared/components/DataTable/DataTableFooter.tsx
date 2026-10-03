import type { RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import {
  type DataTableBulkAction,
  DataTableBulkBar,
} from '@/shared/components/DataTableBulkBar/index.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
  TABLE_TEST_IDS,
} from '@/shared/components/DataTableToolbar/data-table.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { Maximize, Minimize } from '@/shared/icons/index.ts';

import type { TableSelection } from './useTableSelection.ts';

/** "<N> columns in rows · Show all" ↔ "Fit to width" (H:4131–4132). */
function FoldToggle({
  showAll,
  foldedCount,
  onToggle,
  prefix,
}: {
  showAll: boolean;
  foldedCount: number;
  onToggle: () => void;
  prefix: string;
}) {
  const { t } = useTranslation(TABLE_NS);
  const Icon = showAll ? Minimize : Maximize;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          onClick={onToggle}
          data-testid={TABLE_TEST_IDS.foldToggle(prefix)}
          className="text-foreground-soft h-7 flex-none gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-none"
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {showAll
            ? t(TABLE_KEYS.fold.fitToWidth)
            : t(TABLE_KEYS.fold.showAll, { count: foldedCount })}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {showAll ? t(TABLE_KEYS.fold.fitToWidthHint) : t(TABLE_KEYS.fold.showAllHint)}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The 44px footer (H:698): the count at the start and the fold toggle at the
 * end — or, while rows are selected, the bulk bar docked in their place.
 */
export function DataTableFooter<TData extends RowData>({
  countLabel,
  selection,
  bulkActions,
  hasFoldControl,
  showAll,
  foldedCount,
  onToggleShowAll,
  prefix,
}: {
  countLabel?: string;
  selection: TableSelection<TData>;
  bulkActions?: readonly DataTableBulkAction<TData>[];
  hasFoldControl: boolean;
  showAll: boolean;
  foldedCount: number;
  onToggleShowAll: () => void;
  prefix: string;
}) {
  return (
    <div
      data-testid={TABLE_TEST_IDS.footer(prefix)}
      className="bg-canvas relative min-h-11 flex-none overflow-hidden border-t"
    >
      {selection.hasSelection ? (
        <DataTableBulkBar
          selected={selection.selectedRows.map((row) => row.original)}
          total={selection.selectableRows.length}
          actions={bulkActions}
          onSelectAll={selection.selectAll}
          onClear={selection.clear}
          testIdPrefix={prefix}
        />
      ) : (
        <div className="text-muted-foreground flex h-11 items-center gap-2.5 px-(--table-pad-x) text-xs">
          <span className="min-w-0 flex-1 truncate">{countLabel}</span>
          {hasFoldControl ? (
            <FoldToggle
              showAll={showAll}
              foldedCount={foldedCount}
              onToggle={onToggleShowAll}
              prefix={prefix}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
