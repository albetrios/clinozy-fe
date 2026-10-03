import { useCallback, useMemo } from 'react';

import {
  type SavedView,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';

/** A list's filter values by filter key — what a saved view stores. */
export type SavedViewFilters = Readonly<Record<string, readonly string[]>>;

/** URL keys a saved view never stores: the free-text search (KICKOFF §3.3). */
const NEVER_SAVED = new Set(['q']);

const NO_VIEWS: readonly SavedView[] = [];

/** The filters a view keeps: no search text, no empty filter, values sorted. */
export function savedViewFilters(filters: SavedViewFilters): SavedViewFilters {
  return Object.fromEntries(
    Object.keys(filters)
      .filter((key) => !NEVER_SAVED.has(key) && (filters[key]?.length ?? 0) > 0)
      .sort()
      .map((key) => [key, [...(filters[key] ?? [])].sort()]),
  );
}

/** Whether two filter sets select the same rows (order-insensitive). */
export function sameSavedViewFilters(a: SavedViewFilters, b: SavedViewFilters): boolean {
  return JSON.stringify(savedViewFilters(a)) === JSON.stringify(savedViewFilters(b));
}

/**
 * A new view's name (H:4171): its first two values joined by " + ", or the
 * fallback ("My view") when it has none. `labelOf` names a value the way its
 * chip reads ("vip" → "VIP"); a value it returns `null` for is not named (a
 * custom range's dates).
 */
export function savedViewName(
  filters: SavedViewFilters,
  fallback: string,
  labelOf: (key: string, value: string) => string | null = (_key, value) => value,
): string {
  const labels = Object.entries(filters)
    .flatMap(([key, values]) => values.map((value) => labelOf(key, value)))
    .filter((label): label is string => label !== null)
    .slice(0, 2);
  return labels.length > 0 ? labels.join(' + ') : fallback;
}

/**
 * Saved filter views of one table, kept on this device
 * (`useDevicePrefsStore.savedViews[tableId]`, KICKOFF §3.3): filter values
 * only, never the search text. Toasts are the caller's — the Filters popover
 * says "View “…” saved", the chips track "View removed".
 */
export function useSavedViews(tableId: string): {
  views: readonly SavedView[];
  save: (filters: SavedViewFilters, name: string) => SavedView;
  remove: (viewId: string) => void;
  /** The saved view with exactly these filters, if any. */
  find: (filters: SavedViewFilters) => SavedView | undefined;
} {
  const views = useDevicePrefsStore((state) => state.savedViews[tableId] ?? NO_VIEWS);
  const saveView = useDevicePrefsStore((state) => state.saveView);
  const removeView = useDevicePrefsStore((state) => state.removeView);

  const save = useCallback(
    (filters: SavedViewFilters, name: string) => {
      const view: SavedView = {
        id: crypto.randomUUID(),
        name,
        filters: savedViewFilters(filters),
      };
      saveView(tableId, view);
      return view;
    },
    [saveView, tableId],
  );

  const remove = useCallback(
    (viewId: string) => removeView(tableId, viewId),
    [removeView, tableId],
  );

  const find = useCallback(
    (filters: SavedViewFilters) =>
      views.find((view) => sameSavedViewFilters(view.filters, filters)),
    [views],
  );

  return useMemo(() => ({ views, save, remove, find }), [views, save, remove, find]);
}
