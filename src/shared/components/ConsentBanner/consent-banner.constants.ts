import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The cookie card's own namespace — loaded with the card (`ConsentBannerLazy`) and with Settings
 * (`SettingsModalLazy`), never on the first paint.
 *
 * @remarks
 * Its own namespace, not a `consent` block in `common`: the whole of `common` is inlined into the
 * entry chunk, so the card's copy rode on every first paint (~0.4 kB gzipped, `pnpm size`) for a
 * card that most visits never draw. Only the two strings drawn without the card stay in `common`:
 * the title (the lazy shell's error-boundary label, `LOCALE_KEYS.consentTitle`) and the
 * signed-out frame's "Privacy choices" link (`LOCALE_KEYS.consentPrivacyChoices`).
 */
export const CONSENT_NS = I18N_NAMESPACES.consent;

/**
 * The card's strings (`banner`) and the category rows it shares with Settings › Account › Privacy
 * (`preferences`).
 */
export const CONSENT_KEYS = {
  description: 'banner.description',
  policy: 'banner.policy',
  customizeDescription: 'banner.customizeDescription',
  customize: 'banner.customize',
  customizeShort: 'banner.customizeShort',
  rejectAll: 'banner.rejectAll',
  rejectShort: 'banner.rejectShort',
  acceptAll: 'banner.acceptAll',
  acceptShort: 'banner.acceptShort',
  save: 'banner.save',
  necessaryTitle: 'preferences.necessaryTitle',
  necessaryDescription: 'preferences.necessaryDescription',
  analyticsTitle: 'preferences.analyticsTitle',
  analyticsDescription: 'preferences.analyticsDescription',
  required: 'preferences.required',
  on: 'preferences.on',
  off: 'preferences.off',
  gpcNote: 'preferences.gpcNote',
} as const;
