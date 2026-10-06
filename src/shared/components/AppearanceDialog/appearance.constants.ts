import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** Appearance panel copy lives in `common` beside the locale/date/money cards it hosts. */
export const APPEARANCE_NS = I18N_NAMESPACES.common;

/**
 * Key paths for the Appearance drawer's own cards: the Mode card, and the note
 * that takes its place when the deployment pins the theme.
 */
export const APPEARANCE_KEYS = {
  themeTitle: 'appearance.themeTitle',
  themeLocked: 'appearance.themeLocked',
  modeTitle: 'appearance.modeTitle',
  modeDescription: 'appearance.modeDescription',
} as const;
