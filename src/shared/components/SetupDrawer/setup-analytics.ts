import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import type { OnboardingSetupGuideItemKey } from '@/shared/api/app/onboarding-setup-contracts.ts';

/** A drawer step as the events name it. */
export type SetupEventStep = 'clinic_type' | 'location' | 'you' | 'guide';

/**
 * The clinic setup's product events (KICKOFF §6.8) through the consent-gated capture, never with
 * patient data — only steps, items, outcomes and a duration.
 */
export const setupEvents = {
  started: () => captureAnalyticsEvent(ANALYTICS_EVENTS.setupStarted),
  stepCompleted: (step: Exclude<SetupEventStep, 'guide'>) =>
    captureAnalyticsEvent(ANALYTICS_EVENTS.setupStepCompleted, { step }),
  live: () => captureAnalyticsEvent(ANALYTICS_EVENTS.setupLive),
  deferred: (step: SetupEventStep) =>
    captureAnalyticsEvent(ANALYTICS_EVENTS.setupDeferred, { step }),
  guideItem: (item: OnboardingSetupGuideItemKey, outcome: 'done' | 'skipped') =>
    captureAnalyticsEvent(ANALYTICS_EVENTS.setupGuideItem, { item, outcome }),
  guideHidden: () => captureAnalyticsEvent(ANALYTICS_EVENTS.setupGuideHidden),
  firstAppointmentBooked: (clinicCreatedAt: string, now: Date = new Date()) =>
    captureAnalyticsEvent(ANALYTICS_EVENTS.firstAppointmentBooked, {
      minutes_since_clinic_created: Math.max(
        0,
        Math.round((now.getTime() - new Date(clinicCreatedAt).getTime()) / 60_000),
      ),
    }),
};
