import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
  TABLE_TEST_IDS,
} from '@/shared/components/DataTableToolbar/data-table.constants.ts';
import {
  sameSavedViewFilters,
  type SavedViewFilters,
  useSavedViews,
} from '@/shared/hooks/useSavedViews/index.ts';
import { X } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import type { SavedView } from '@/shared/store/useDevicePrefsStore/index.ts';

interface DataTableSavedViewsProps {
  /** The table whose views to list (`useDevicePrefsStore.savedViews[tableId]`). */
  tableId: string;
  /** The filters applied now — the view that matches them shows pressed. */
  activeFilters?: SavedViewFilters;
  /** Apply a view's filters (the caller writes them to the URL). */
  onApply: (view: SavedView) => void;
  className?: string;
}

/**
 * The saved-views track of a list toolbar (KICKOFF §3.5 Saved views; H:673):
 * a 36px `bg-muted` track of 28px chips — the name applies the view ("Apply
 * view"), the 18px × removes it ("Remove view", toast "View removed"). Renders
 * nothing until a view is saved.
 */
export function DataTableSavedViews({
  tableId,
  activeFilters,
  onApply,
  className,
}: DataTableSavedViewsProps) {
  const { t } = useTranslation(TABLE_NS);
  const { views, remove } = useSavedViews(tableId);
  if (views.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t(TABLE_KEYS.savedViews.label)}
      data-testid={TABLE_TEST_IDS.savedViews(tableId)}
      className={cn(
        'bg-muted flex h-9 max-w-full flex-none [scrollbar-width:none] items-center gap-0.5 overflow-x-auto rounded-lg p-0.75',
        className,
      )}
    >
      {views.map((view) => {
        const active = activeFilters
          ? sameSavedViewFilters(view.filters, activeFilters)
          : false;
        return (
          <span
            key={view.id}
            data-slot="saved-view"
            data-active={active}
            className={cn(
              'text-detail flex h-7 flex-none items-center gap-1 rounded-md ps-2.5 pe-1 font-medium whitespace-nowrap transition-colors duration-120',
              active
                ? 'bg-card text-foreground ring-border-strong ring-1'
                : 'text-foreground-soft hover:text-foreground',
            )}
          >
            <button
              type="button"
              title={t(TABLE_KEYS.savedViews.apply)}
              aria-pressed={active}
              onClick={() => onApply(view)}
              className="max-w-40 truncate"
            >
              {view.name}
            </button>
            <button
              type="button"
              aria-label={t(TABLE_KEYS.savedViews.remove)}
              title={t(TABLE_KEYS.savedViews.remove)}
              onClick={() => {
                remove(view.id);
                notify.success(t(TABLE_KEYS.savedViews.removed));
              }}
              className="text-muted-foreground hover:bg-border hover:text-foreground flex size-4.5 flex-none items-center justify-center rounded-sm"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
