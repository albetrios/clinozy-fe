import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

import type {
  PickerMaxHeightValue,
  PickerMinWidthValue,
  PickerSize,
} from './picker.types.ts';

/** Picker chrome copy lives in `common` (the shell and every room use it). */
export const PICKER_NS = I18N_NAMESPACES.common;

/** Key paths for the Picker, date and time pickers. */
export const PICKER_KEYS = {
  placeholder: 'picker.placeholder',
  search: 'picker.search',
  searchDefault: 'picker.searchDefault',
  escKey: 'picker.escKey',
  options: 'picker.options',
  recent: 'picker.recent',
  all: 'picker.all',
  create: 'picker.create',
  createNamed: 'picker.createNamed',
  createFull: 'picker.createFull',
  createFullQuery: 'picker.createFullQuery',
  fullDetails: 'picker.fullDetails',
  empty: 'picker.empty',
  noResults: 'picker.noResults',
  noResultsHint: 'picker.noResultsHint',
  noResultsRemoteHint: 'picker.noResultsRemoteHint',
  loading: 'a11y.loading',
  loadingMore: 'picker.loadingMore',
  clear: 'picker.clear',
  triggerLabel: 'picker.triggerLabel',
  date: {
    label: 'picker.date.label',
    placeholder: 'picker.date.placeholder',
    search: 'picker.date.search',
    today: 'picker.date.today',
    tomorrow: 'picker.date.tomorrow',
    yesterday: 'picker.date.yesterday',
    comingUp: 'picker.date.comingUp',
    relative: 'picker.date.relative',
  },
  time: {
    label: 'picker.time.label',
    placeholder: 'picker.time.placeholder',
  },
} as const;

/** Rows per page — static lists render this many more at a time; remote loaders return pages of it. */
export const PICKER_PAGE_SIZE = 30;

/** Static lists longer than this get the search row and (single-select) the Recent group. */
export const PICKER_SEARCH_THRESHOLD = 7;

/** Debounce before a remote search fetches (ms). */
export const PICKER_REMOTE_DEBOUNCE_MS = 300;

/** Within this many px of the list's end, the next page loads. */
export const PICKER_LOAD_MORE_EDGE_PX = 64;

/** PgUp / PgDn move the active row by this many rows. */
export const PICKER_PAGE_JUMP = 8;

/** Arrowing into the last this-many rows loads the next page. */
export const PICKER_LOAD_MORE_ROWS = 3;

/** The scroll check runs at most this often (ms). */
export const PICKER_SCROLL_THROTTLE_MS = 120;

/** The Recent group holds the last this-many picks (`withRecentPick`). */
export const PICKER_RECENT_ROWS = 3;

/** Chips a multi-select trigger shows before "+N". */
export const PICKER_MAX_CHIPS = 3;

/** Base test id when the caller passes none. */
export const PICKER_DEFAULT_TEST_ID = 'picker';

/** Trigger height and type per size: 32 / 36 / 44px, 13 / 13.5 / 13.5px. */
export const PICKER_TRIGGER_SIZE_CLASSES: Record<PickerSize, string> = {
  sm: 'min-h-8 text-body',
  md: 'min-h-9 text-field',
  lg: 'min-h-11 text-field',
};

/** Panel minimum width — width is max(trigger, this), at most the viewport − 16px. */
export const PICKER_MIN_WIDTH_CLASSES: Record<PickerMinWidthValue, string> = {
  180: 'min-w-45',
  200: 'min-w-50',
  210: 'min-w-52.5',
  220: 'min-w-55',
  230: 'min-w-57.5',
  240: 'min-w-60',
  250: 'min-w-62.5',
  260: 'min-w-65',
  280: 'min-w-70',
  290: 'min-w-72.5',
  300: 'min-w-75',
  320: 'min-w-80',
  340: 'min-w-85',
  360: 'min-w-90',
};

/** Panel maximum height: max(150px, min(this, the free space on its side)). */
export const PICKER_MAX_HEIGHT_CLASSES: Record<PickerMaxHeightValue, string> = {
  300: 'max-h-[max(9.375rem,min(18.75rem,var(--radix-popover-content-available-height)))]',
  320: 'max-h-[max(9.375rem,min(20rem,var(--radix-popover-content-available-height)))]',
  340: 'max-h-[max(9.375rem,min(21.25rem,var(--radix-popover-content-available-height)))]',
};

/** The test ids one picker derives from its base id. */
export interface PickerTestIds {
  trigger: string;
  clear: string;
  panel: string;
  search: string;
  option: (key: string) => string;
  create: string;
  createFull: string;
  empty: string;
  loading: string;
  loadingMore: string;
}

/** Test ids for a picker whose trigger carries `base`. */
export function pickerTestIds(base: string): PickerTestIds {
  return {
    trigger: base,
    clear: `${base}-clear`,
    panel: `${base}-panel`,
    search: `${base}-search`,
    option: (key) => `${base}-option-${key}`,
    create: `${base}-create`,
    createFull: `${base}-create-full`,
    empty: `${base}-empty`,
    loading: `${base}-loading`,
    loadingMore: `${base}-loading-more`,
  };
}
