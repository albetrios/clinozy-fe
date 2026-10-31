import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  CONSENT_COOKIE_NAME,
  CONSENT_POLICY_VERSION,
  type ConsentPreferences,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

/** Expire the consent cookie and put the store back to "undecided", card closed. */
export function resetConsentForTests(): void {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API.
  document.cookie = `${CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`;
  useConsentStore.getState().reloadFromCookie();
  useConsentStore.setState({ preferencesOpen: false });
}

/** Turn the browser's Global Privacy Control signal on or off (`navigator.globalPrivacyControl`). */
export function setGlobalPrivacyControlForTests(on: boolean): void {
  Object.defineProperty(navigator, 'globalPrivacyControl', {
    configurable: true,
    get: () => on,
  });
}

/** The consent cookie's value as stored (decoded JSON), or `null`. */
export function readConsentCookieForTests(): Record<string, unknown> | null {
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!entry) return null;
  return JSON.parse(
    decodeURIComponent(entry.slice(CONSENT_COOKIE_NAME.length + 1)),
  ) as Record<string, unknown>;
}

/** Store a raw consent cookie (an object as JSON, or a string as is) — a reload or another tab. */
export function writeConsentCookieForTests(value: unknown): void {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API.
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(raw)}; Path=/`;
}

/**
 * Give this browser a standing answer with no side effect (no event, no receipt): the cookie as
 * the card writes it — current policy version, given now — re-read by the store, card closed.
 */
export function answerConsentForTests(preferences: ConsentPreferences): void {
  writeConsentCookieForTests({
    analytics: preferences.analytics,
    version: CONSENT_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
    // Given by whoever is signed in now — as the card records it.
    decidedBy: useAuthStore.getState().user?.id ?? null,
  });
  useConsentStore.getState().reloadFromCookie();
  useConsentStore.setState({ preferencesOpen: false });
}
