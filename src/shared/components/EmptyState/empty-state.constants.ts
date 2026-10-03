import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** Empty-state chrome lives in `common`: every room and panel draws one. */
export const EMPTY_STATE_NS = I18N_NAMESPACES.common;

/** Key paths for the empty state's own copy (verbatim from the design, H:4130). */
export const EMPTY_STATE_KEYS = {
  fallbackTitle: 'emptyState.fallbackTitle',
  filteredTitle: 'emptyState.filteredTitle',
  filteredHint: 'emptyState.filteredHint',
  clearFilters: 'emptyState.clearFilters',
} as const;
