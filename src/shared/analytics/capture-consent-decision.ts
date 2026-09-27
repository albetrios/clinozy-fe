import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import {
  captureAnalyticsEvent,
  purgeAnalyticsOnConsentRevoked,
} from '@/shared/analytics/capture.ts';
import type { ConsentDecision } from '@/shared/store/useConsentStore/index.ts';

/**
 * Record an explicit analytics-consent choice for audit/compliance.
 *
 * - **granted** — bootstraps PostHog (via registry) and captures a single event.
 * - **denied** — no third-party capture; the decision lives in {@link useConsentStore} only.
 */
export async function captureAnalyticsConsentDecision(
  decision: Exclude<ConsentDecision, null>,
): Promise<void> {
  if (decision === 'denied') {
    // Withdrawal: purge any analytics state stored under a prior grant.
    purgeAnalyticsOnConsentRevoked();
    return;
  }

  captureAnalyticsEvent(ANALYTICS_EVENTS.consentDecision, {
    decision: 'granted',
    source: 'consent_banner',
  });
}
