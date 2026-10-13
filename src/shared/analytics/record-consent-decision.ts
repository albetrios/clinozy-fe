import { api } from '@/core/http/api.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import {
  captureAnalyticsEvent,
  purgeAnalyticsOnConsentRevoked,
} from '@/shared/analytics/capture.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  CONSENT_POLICY_VERSION,
  type ConsentPreferences,
} from '@/shared/store/useConsentStore/index.ts';

/** Where an answer was given — the card (first time or Privacy choices) or Settings › Privacy. */
export type ConsentDecisionSource = 'consent_banner' | 'settings';

/**
 * Send the answer to the signed-in person's account as a receipt (`PATCH /users/me/settings`,
 * with the policy version it answers); clinozy-be audits it as the proof of consent (its CC2).
 * Never read back: this browser's cookie decides what runs.
 */
async function saveConsentReceipt(analytics: boolean): Promise<void> {
  await api.patch('/users/me/settings', {
    body: {
      analytics_consent: analytics ? 'granted' : 'denied',
      analytics_consent_version: CONSENT_POLICY_VERSION,
    },
  });
}

/**
 * Act on an answer the person just gave in this browser (already saved to the cookie).
 *
 * - **Analytics on** — one `analytics_consent_decision` event (which bootstraps PostHog).
 * - **Analytics off** — no third-party capture; anything PostHog stored under an earlier grant is
 *   purged (claude.com deletes a refused category's cookies too).
 * - **Signed in** — the answer also goes to the account as a receipt; signed out, nothing is sent.
 *
 * @remarks Never throws: consent must not stand between a person and the app, so a failed receipt
 * is dropped — the cookie still holds the answer.
 */
export async function recordConsentDecision(
  preferences: ConsentPreferences,
  source: ConsentDecisionSource = 'consent_banner',
): Promise<void> {
  if (preferences.analytics) {
    captureAnalyticsEvent(ANALYTICS_EVENTS.consentDecision, {
      decision: 'granted',
      source,
    });
  } else {
    purgeAnalyticsOnConsentRevoked();
  }
  if (useAuthStore.getState().user === null) return;
  await saveConsentReceipt(preferences.analytics).catch(() => undefined);
}
