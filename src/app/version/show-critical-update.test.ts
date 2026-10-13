import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { showCriticalUpdate } from './show-critical-update.ts';
import { VERSION_UPDATE_TOAST_ID } from './version-update.constants.ts';

const { notifyDismissMock, captureMock } = vi.hoisted(() => ({
  notifyDismissMock: vi.fn(),
  captureMock: vi.fn(),
}));

vi.mock('@/shared/notify/notify.ts', () => ({
  notify: { dismiss: notifyDismissMock },
}));

vi.mock('@/shared/analytics/capture.ts', () => ({
  captureAnalyticsEvent: captureMock,
}));

describe('showCriticalUpdate', () => {
  beforeEach(() => {
    useUIStore.setState({ criticalUpdate: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
    useUIStore.setState({ criticalUpdate: null });
  });

  it('hands the countdown to the notice and records it', () => {
    showCriticalUpdate({ buildId: 'build-NEW', reloadAt: 60_000, reloadNow: vi.fn() });

    expect(useUIStore.getState().criticalUpdate).toMatchObject({
      buildId: 'build-NEW',
      reloadAt: 60_000,
    });
    expect(captureMock).toHaveBeenCalledWith(ANALYTICS_EVENTS.deploymentUpdateRequired, {
      build_id: 'build-NEW',
    });
  });

  it('takes down the "Update available" toast it supersedes', () => {
    showCriticalUpdate({ buildId: 'build-NEW', reloadAt: 60_000, reloadNow: vi.fn() });

    expect(notifyDismissMock).toHaveBeenCalledWith(VERSION_UPDATE_TOAST_ID);
  });

  it('records "Update now" and then reloads through the checker', () => {
    const reloadNow = vi.fn();
    showCriticalUpdate({ buildId: 'build-NEW', reloadAt: 60_000, reloadNow });

    useUIStore.getState().criticalUpdate?.reloadNow();

    expect(captureMock).toHaveBeenLastCalledWith(
      ANALYTICS_EVENTS.deploymentUpdateRequiredReloadClicked,
      { build_id: 'build-NEW' },
    );
    expect(reloadNow).toHaveBeenCalledOnce();
  });
});
