import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The empty home's copy lives in `app`: it renders only inside the org shell, which loads it. */
export const APP_HOME_EMPTY_NS = I18N_NAMESPACES.app;

/** Key paths for the org home's "nothing is switched on" state (L-63). */
export const APP_HOME_EMPTY_KEYS = {
  title: 'appHomeEmpty.title',
  description: 'appHomeEmpty.description',
} as const;
