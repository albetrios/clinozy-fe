import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { showUpdateAvailableToast } from './show-update-available-toast.ts';
import { VERSION_UPDATE_TOAST_ID } from './version-update.constants.ts';

const { notifyInfoMock, notifyDismissMock } = vi.hoisted(() => ({
  notifyInfoMock: vi.fn(),
  notifyDismissMock: vi.fn(),
}));

vi.mock('@/shared/notify/notify.ts', () => ({
  notify: {
    info: notifyInfoMock,
    dismiss: notifyDismissMock,
  },
}));

describe('showUpdateAvailableToast', () => {
  beforeEach(() => {
    notifyInfoMock.mockReset();
    notifyDismissMock.mockReset();
  });

  it('shows a persistent info toast with refresh action', () => {
    const reloadNow = vi.fn();
    const snooze = vi.fn();
    renderWithProviders(null);

    showUpdateAvailableToast({ buildId: 'build-NEW', reloadNow, snooze });

    expect(notifyInfoMock).toHaveBeenCalledOnce();
    const [title, opts] = notifyInfoMock.mock.calls[0] as [
      string,
      {
        id: string;
        duration: number;
        description: string;
        action: { label: string; onClick: () => void };
        onDismiss?: () => void;
      },
    ];
    expect(title).toBe('Update available');
    expect(opts.id).toBe(VERSION_UPDATE_TOAST_ID);
    expect(opts.duration).toBe(Number.POSITIVE_INFINITY);
    expect(opts.description).toBe('A new version of the app is ready.');
    expect(opts.action.label).toBe('Refresh now');

    opts.action.onClick();
    expect(notifyDismissMock).toHaveBeenCalledWith(VERSION_UPDATE_TOAST_ID);
    expect(reloadNow).toHaveBeenCalledOnce();
  });

  it('snoozes when the toast is dismissed', () => {
    const snooze = vi.fn();
    renderWithProviders(null);

    showUpdateAvailableToast({ buildId: 'build-NEW', reloadNow: vi.fn(), snooze });

    const opts = notifyInfoMock.mock.calls[0]?.[1] as { onDismiss?: () => void };
    opts.onDismiss?.();
    expect(snooze).toHaveBeenCalledOnce();
  });
});
