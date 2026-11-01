import { useCallback, useMemo } from 'react';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
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
      .sort((a, b) => a.localeCompare(b))
      .map((key) => [key, [...(filters[key] ?? [])].sort((a, b) => a.localeCompare(b))]),
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
 * Where one person's views of one table live in `useDevicePrefsStore.savedViews`.
 *
 * @remarks
 * Per signed-in user, not per device: a clinic PC is shared, and a view names
 * what one person filters by (their staff, their tags) — the next person to sign
 * in on it must not find it, and the first must find theirs again (F-9).
 */
export function savedViewsKey(userId: string, tableId: string): string {
  return `${userId}:${tableId}`;
}

/**
 * The signed-in user's saved filter views of one table, kept on this device
 * (`useDevicePrefsStore.savedViews[savedViewsKey(user, tableId)]`, KICKOFF §3.3):
 * filter values only, never the search text. Nobody signed in: no views, and
 * nothing is saved. Toasts are the caller's — the Filters popover says "View
 * “…” saved", the chips track "View removed".
 */
export function useSavedViews(tableId: string): {
  views: readonly SavedView[];
  save: (filters: SavedViewFilters, name: string) => SavedView;
  remove: (viewId: string) => void;
  /** The saved view with exactly these filters, if any. */
  find: (filters: SavedViewFilters) => SavedView | undefined;
} {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const key = userId === null ? null : savedViewsKey(userId, tableId);
  const views = useDevicePrefsStore(
    (state) => (key === null ? undefined : state.savedViews[key]) ?? NO_VIEWS,
  );
  const saveView = useDevicePrefsStore((state) => state.saveView);
  const removeView = useDevicePrefsStore((state) => state.removeView);

  const save = useCallback(
    (filters: SavedViewFilters, name: string) => {
      const view: SavedView = {
        id: crypto.randomUUID(),
        name,
        filters: savedViewFilters(filters),
      };
      if (key !== null) saveView(key, view);
      return view;
    },
    [saveView, key],
  );

  const remove = useCallback(
    (viewId: string) => {
      if (key !== null) removeView(key, viewId);
    },
    [removeView, key],
  );

  const find = useCallback(
    (filters: SavedViewFilters) =>
      views.find((view) => sameSavedViewFilters(view.filters, filters)),
    [views],
  );

  return useMemo(() => ({ views, save, remove, find }), [views, save, remove, find]);
}
