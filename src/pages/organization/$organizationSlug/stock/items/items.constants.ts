import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Clinic stock room's namespace, as its Items tab reads it. */
export const STOCK_ITEMS_NS = I18N_NAMESPACES.clinicStock;

/** The Items tab's keys (the copy arrives with its screen row). */
export const STOCK_ITEMS_KEYS = {
  manifest: { title: 'manifest.title' },
} as const;
