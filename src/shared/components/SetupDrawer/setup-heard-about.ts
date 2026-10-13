import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';

/**
 * "How did you hear about us?" — moved from /onboarding to "You're live" (KICKOFF §6.1;
 * BRIEF.md:143): the answers, in their order, as their `setup` keys name them.
 */
export const HEARD_ABOUT_VALUES = [
  'search',
  'socialMedia',
  'friendOrColleague',
  'blogOrArticle',
  'other',
] as const;

/** One of {@link HEARD_ABOUT_VALUES}. */
export type HeardAbout = (typeof HEARD_ABOUT_VALUES)[number];

/** Sends the answer — analytics only, consent-gated, the stable value and never a label. */
export function captureHeardAbout(source: HeardAbout): void {
  captureAnalyticsEvent(ANALYTICS_EVENTS.setupHeardAbout, { source });
}
