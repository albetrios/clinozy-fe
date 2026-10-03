import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * Splash copy lives in `common`: it ships in the entry bundle, so the offline
 * line never waits on a namespace that would itself need the network (Q-S1).
 */
export const SPLASH_NS = I18N_NAMESPACES.common;

/** Key paths for the boot splash's copy (`splash.md:90–99`; KICKOFF §6.1). */
export const SPLASH_KEYS = {
  label: 'splash.label',
  greeting: {
    morning: 'splash.greeting.morning',
    afternoon: 'splash.greeting.afternoon',
    evening: 'splash.greeting.evening',
  },
  ticker: {
    opening: 'splash.ticker.opening',
    syncing: 'splash.ticker.syncing',
    ready: 'splash.ticker.ready',
  },
  offline: {
    message: 'splash.offline.message',
    retry: 'splash.offline.retry',
  },
} as const;

/** Stable hooks for the slot's regions (`fe-e2e-testids`). */
export const SPLASH_TEST_IDS = {
  block: 'app-splash-block',
  greeting: 'app-splash-greeting',
  progress: 'app-splash-progress',
  bar: 'app-splash-bar',
  ticker: 'app-splash-ticker',
  offline: 'app-splash-offline',
  retry: 'app-splash-retry',
} as const;
