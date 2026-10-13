import type { CriticalUpdateContext } from '@/core/version/check.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { notify } from '@/shared/notify/notify.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { VERSION_UPDATE_TOAST_ID } from './version-update.constants.ts';

/**
 * Raises the "Update required" notice for a critical update
 * (`startVersionCheck`'s `onCriticalUpdate`): records it, takes down any
 * "Update available" toast it supersedes, and hands the countdown to the
 * root-mounted {@link CriticalUpdateNotice}. The reload itself stays with the
 * checker — it happens at `reloadAt` whatever the notice does.
 */
export function showCriticalUpdate({
  buildId,
  reloadAt,
  reloadNow,
}: CriticalUpdateContext): void {
  captureAnalyticsEvent(ANALYTICS_EVENTS.deploymentUpdateRequired, { build_id: buildId });
  notify.dismiss(VERSION_UPDATE_TOAST_ID);
  useUIStore.getState().setCriticalUpdate({
    buildId,
    reloadAt,
    reloadNow: () => {
      captureAnalyticsEvent(ANALYTICS_EVENTS.deploymentUpdateRequiredReloadClicked, {
        build_id: buildId,
      });
      reloadNow();
    },
  });
}
