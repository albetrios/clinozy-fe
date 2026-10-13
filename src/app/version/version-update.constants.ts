import { LOCALE_NS } from '@/lib/i18n/locale.constants.ts';

/** Stable Sonner id — one update toast at a time; safe to replace on re-poll. */
export const VERSION_UPDATE_TOAST_ID = 'app-version-update';

export const VERSION_UPDATE_NS = LOCALE_NS;

export const VERSION_UPDATE_KEYS = {
  title: 'versionUpdate.title',
  description: 'versionUpdate.description',
  refresh: 'versionUpdate.refresh',
  /** The critical update's notice (`CriticalUpdateNotice`). */
  required: {
    title: 'versionUpdate.required.title',
    countdown: 'versionUpdate.required.countdown',
    saveFirst: 'versionUpdate.required.saveFirst',
    announcement: 'versionUpdate.required.announcement',
    updateNow: 'versionUpdate.required.updateNow',
  },
} as const;

/** Test ids of the "Update required" notice and its one button (`CriticalUpdateNotice`). */
export const CRITICAL_UPDATE_TEST_IDS = {
  notice: 'critical-update-notice',
  time: 'critical-update-time',
  updateNow: 'critical-update-now',
} as const;
