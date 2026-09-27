import { LOCALE_NS } from '@/lib/i18n/locale.constants.ts';

/** Stable Sonner id — one update toast at a time; safe to replace on re-poll. */
export const VERSION_UPDATE_TOAST_ID = 'app-version-update';

export const VERSION_UPDATE_NS = LOCALE_NS;

export const VERSION_UPDATE_KEYS = {
  title: 'versionUpdate.title',
  description: 'versionUpdate.description',
  refresh: 'versionUpdate.refresh',
} as const;
