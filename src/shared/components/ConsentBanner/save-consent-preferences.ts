import type { ConsentDecisionSource } from '@/shared/analytics/record-consent-decision.ts';
import {
  CONSENT_COOKIE_MAX_AGE_SECONDS,
  CONSENT_COOKIE_NAME,
  CONSENT_POLICY_VERSION,
  type ConsentPreferences,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

/**
 * Give this browser's answer — from the card or from Settings › Account › Privacy.
 *
 * At once: the answer goes to the consent cookie (one year, `SameSite=Lax`, `Secure` on https)
 * and to {@link useConsentStore}, which closes the card and starts or stops PostHog and Sentry's
 * recording. Then, off the critical path, `record-consent-decision.ts` (loaded on demand) sends the
 * analytics event or purges what an earlier grant stored, and the account's receipt while signed
 * in; it never fails the answer.
 *
 * @remarks
 * Here, not an action on the store: the store is on every first paint, and only these two lazy
 * surfaces ever write the cookie (~0.16 kB gzipped off the first paint, `pnpm size`).
 */
export function saveConsentPreferences(
  preferences: ConsentPreferences,
  source: ConsentDecisionSource,
): void {
  const decidedAt = new Date().toISOString();
  const stored = {
    analytics: preferences.analytics,
    version: CONSENT_POLICY_VERSION,
    decidedAt,
  };
  const attributes = [
    `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(stored))}`,
    `Max-Age=${CONSENT_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ];
  // `Secure` wherever the page is https; a plain-http dev server would have the cookie refused.
  if (globalThis.location?.protocol === 'https:') attributes.push('Secure');
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and missing from some supported browsers; the card's answer must be readable on the next line.
  document.cookie = attributes.join('; ');
  useConsentStore.setState({
    preferences: { analytics: preferences.analytics },
    decidedAt,
    preferencesOpen: false,
  });
  import('@/shared/analytics/record-consent-decision.ts')
    .then((m) => m.recordConsentDecision(preferences, source))
    .catch(() => undefined);
}
