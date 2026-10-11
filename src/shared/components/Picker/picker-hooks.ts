import type { UIEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { recentPicksFor, withRecentPick } from '@/shared/api/app/preferences-api.ts';
import type { ListPage } from '@/shared/api/fetch-list-page.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedValue/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

import {
  PICKER_LOAD_MORE_EDGE_PX,
  PICKER_PAGE_SIZE,
  PICKER_REMOTE_DEBOUNCE_MS,
  PICKER_SCROLL_THROTTLE_MS,
  PICKER_SEARCH_THRESHOLD,
} from './picker.constants.ts';
import type { PickerLoader, PickerOption, PickerProps } from './picker.types.ts';
import type { PickerMode } from './picker-model.ts';
import { plainOption, selectedKeysOf } from './picker-model.ts';
import { buildPickerRows, type PickerRows } from './picker-rows.ts';

const EMPTY_PAGE: ListPage<never> = { rows: [], next: null, hasMore: false };
const NO_OPTIONS: readonly PickerOption<never>[] = [];

/**
 * The props a `plain` picker renders from: its static, selected and remote
 * options each drawn plain ({@link plainOption}); other props pass through.
 */
export function usePlainProps<T>(props: PickerProps<T>): PickerProps<T> {
  const { plain = false, options, selectedOptions, loadOptions } = props;
  const plainOptions = useMemo(
    () => (plain ? options?.map(plainOption) : options),
    [plain, options],
  );
  const plainSelected = useMemo(
    () => (plain ? selectedOptions?.map(plainOption) : selectedOptions),
    [plain, selectedOptions],
  );
  const plainLoader = useMemo((): PickerLoader<T> | undefined => {
    if (!plain || !loadOptions) return loadOptions;
    return (query, cursor) =>
      loadOptions(query, cursor).then((page) => ({
        ...page,
        rows: page.rows.map(plainOption),
      }));
  }, [plain, loadOptions]);
  if (!plain) return props;
  return {
    ...props,
    options: plainOptions,
    selectedOptions: plainSelected,
    loadOptions: plainLoader,
  };
}

/** Where a picker's options come from, and the loading flags its panel shows. */
export interface PickerSource<T> {
  remote: boolean;
  options: readonly PickerOption<T>[];
  /** The query the options answer (remote: the debounced one). */
  searchQuery: string;
  /** The first page is loading. */
  firstLoad: boolean;
  /** A new search is loading; the rows on screen answer the old one. */
  refreshing: boolean;
  /** Anything is in flight (the search-row spinner). */
  fetching: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

function dedupeByKey<T>(options: readonly PickerOption<T>[]): PickerOption<T>[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.key)) return false;
    seen.add(option.key);
    return true;
  });
}

/**
 * The picker's data: its static `options`, or `loadOptions` pages through
 * {@link useCursorList} — server state stays in TanStack Query, the search is
 * debounced 300ms, and nothing loads until the list opens.
 */
export function usePickerSource<T>(
  props: PickerProps<T>,
  open: boolean,
  query: string,
  fallbackKey: string,
): PickerSource<T> {
  const { loadOptions, loadOptionsKey } = props;
  const remote = loadOptions !== undefined;
  const { debounced } = useDebouncedSearch(query, PICKER_REMOTE_DEBOUNCE_MS);
  const pages = useCursorList<PickerOption<T>>({
    queryKey: [...(loadOptionsKey ?? ['picker', fallbackKey]), 'options', debounced],
    queryFn: (after) =>
      loadOptions ? loadOptions(debounced, after) : Promise.resolve(EMPTY_PAGE),
    enabled: open && remote,
  });
  const remoteOptions = useMemo(() => dedupeByKey(pages.rows), [pages.rows]);

  if (!remote) {
    return {
      remote: false,
      options: props.options ?? NO_OPTIONS,
      searchQuery: query,
      firstLoad: false,
      refreshing: false,
      fetching: false,
      hasMore: false,
      loadingMore: false,
      loadMore: () => {},
    };
  }
  return {
    remote: true,
    options: remoteOptions,
    searchQuery: debounced,
    firstLoad: pages.isPending,
    refreshing: pages.isRefreshing,
    fetching: pages.isFetching && !pages.isFetchingNextPage,
    hasMore: pages.hasNextPage,
    loadingMore: pages.isFetchingNextPage,
    loadMore: pages.fetchNextPage,
  };
}

/** A picker's Recent picks (ids, newest first) and the way to record one. */
export interface PickerRecent {
  keys: readonly string[];
  remember: (key: string) => void;
}

/**
 * Recent picks per `<room>:<field>`, kept on the user's preferences record
 * (`UserPreference.recentPicks`, D32) through {@link usePreferences} — ids
 * only, the last 3 per picker — never in local storage.
 */
export function usePickerRecent(recentKey: string | undefined): PickerRecent {
  const { preferences, update } = usePreferences();
  const { recentPicks } = preferences;
  const keys = useMemo(
    () => (recentKey ? recentPicksFor(recentPicks, recentKey) : []),
    [recentKey, recentPicks],
  );
  const remember = useCallback(
    (key: string) => {
      if (!recentKey) return;
      update({ recentPicks: withRecentPick(recentPicks, recentKey, key) });
    },
    [recentKey, recentPicks, update],
  );
  return { keys, remember };
}

/** Inputs to {@link usePickerRows} beyond the props. */
export interface PickerRowsState<T> {
  source: PickerSource<T>;
  recentKeys: readonly string[];
  mode: PickerMode;
  /** Static pages shown (30 rows each). */
  pages: number;
  labels: { recent: string; all: string };
}

/** The rows the panel renders, memoised on what changes them. */
export function usePickerRows<T>(
  props: PickerProps<T>,
  { source, recentKeys, mode, pages, labels }: PickerRowsState<T>,
): PickerRows<T> {
  const { filter, recentKey } = props;
  const { options, searchQuery, remote } = source;
  const { recent, all } = labels;
  return useMemo(
    () =>
      buildPickerRows({
        options,
        query: searchQuery,
        filter,
        serverFiltered: remote,
        recentKeys,
        recentEnabled:
          mode === 'single' &&
          recentKey !== undefined &&
          options.length > PICKER_SEARCH_THRESHOLD,
        limit: remote ? Number.POSITIVE_INFINITY : PICKER_PAGE_SIZE * pages,
        labels: { recent, all },
      }),
    [
      options,
      searchQuery,
      remote,
      filter,
      recentKey,
      recentKeys,
      mode,
      pages,
      recent,
      all,
    ],
  );
}

/** The picked options the trigger draws, and the way to keep one it may not see again. */
export interface PickerKnownOptions<T> {
  byKey: ReadonlyMap<string, PickerOption<T>>;
  /** The current picks, in pick order (keys no source knows are skipped). */
  selected: PickerOption<T>[];
  /** Keep an option the user picked (a remote page may not hold it later). */
  keep: (option: PickerOption<T>) => void;
}

/**
 * Every option the trigger can name: `selectedOptions`, the ones picked in
 * this session, the static list and the loaded pages (later sources win).
 */
export function usePickerKnownOptions<T>(
  props: PickerProps<T>,
  loaded: readonly PickerOption<T>[],
): PickerKnownOptions<T> {
  const [picked, setPicked] = useState<ReadonlyMap<string, PickerOption<T>>>(
    () => new Map(),
  );
  const { selectedOptions, options } = props;
  const byKey = useMemo(() => {
    const known = new Map<string, PickerOption<T>>();
    for (const option of selectedOptions ?? []) known.set(option.key, option);
    for (const option of picked.values()) known.set(option.key, option);
    for (const option of options ?? []) known.set(option.key, option);
    for (const option of loaded) known.set(option.key, option);
    return known;
  }, [selectedOptions, picked, options, loaded]);
  const selected = selectedKeysOf(props)
    .map((key) => byKey.get(key))
    .filter((option): option is PickerOption<T> => option !== undefined);
  const keep = useCallback((option: PickerOption<T>) => {
    setPicked((known) => new Map(known).set(option.key, option));
  }, []);
  return { byKey, selected, keep };
}

/**
 * The panel's scroll handler: within 64px of the list's end, load the next
 * page — checked at most every 120ms (H:3940).
 */
export function useLoadMoreOnScroll(
  loadMore: () => void,
): (event: UIEvent<HTMLElement>) => void {
  const lastCheck = useRef(0);
  return (event) => {
    const now = Date.now();
    if (now - lastCheck.current < PICKER_SCROLL_THROTTLE_MS) return;
    lastCheck.current = now;
    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < PICKER_LOAD_MORE_EDGE_PX) loadMore();
  };
}
