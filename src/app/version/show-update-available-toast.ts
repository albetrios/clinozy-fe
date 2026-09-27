import i18n from '@/lib/i18n/i18n.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { notify } from '@/shared/notify/notify.ts';

import {
  VERSION_UPDATE_KEYS,
  VERSION_UPDATE_NS,
  VERSION_UPDATE_TOAST_ID,
} from './version-update.constants.ts';

export interface ShowUpdateAvailableToastOptions {
  /** Target build id (for tests / future analytics). */
  buildId: string;
  /** Applies reload with loop guard — from {@link startVersionCheck}. */
  reloadNow: () => void;
  /** Snooze re-notification — from {@link startVersionCheck}. */
  snooze: () => void;
}

/**
 * Persistent info toast when a new deployment is detected. User can refresh
 * immediately; otherwise idle / hidden-tab reload still applies in the checker.
 */
export function showUpdateAvailableToast({
  buildId,
  reloadNow,
  snooze,
}: ShowUpdateAvailableToastOptions): void {
  captureAnalyticsEvent(ANALYTICS_EVENTS.deploymentUpdateAvailable, {
    build_id: buildId,
  });

  notify.info(i18n.t(VERSION_UPDATE_KEYS.title, { ns: VERSION_UPDATE_NS }), {
    id: VERSION_UPDATE_TOAST_ID,
    duration: Number.POSITIVE_INFINITY,
    description: i18n.t(VERSION_UPDATE_KEYS.description, { ns: VERSION_UPDATE_NS }),
    action: {
      label: i18n.t(VERSION_UPDATE_KEYS.refresh, { ns: VERSION_UPDATE_NS }),
      onClick: () => {
        captureAnalyticsEvent(ANALYTICS_EVENTS.deploymentUpdateRefreshClicked, {
          build_id: buildId,
        });
        notify.dismiss(VERSION_UPDATE_TOAST_ID);
        reloadNow();
      },
    },
    onDismiss: () => {
      captureAnalyticsEvent(ANALYTICS_EVENTS.deploymentUpdateDismissed, {
        build_id: buildId,
      });
      snooze();
      notify.dismiss(VERSION_UPDATE_TOAST_ID);
    },
  });
}
