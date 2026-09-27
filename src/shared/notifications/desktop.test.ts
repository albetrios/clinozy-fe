import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDesktopPermission,
  isDesktopSupported,
  requestDesktopPermission,
  showDesktopNotification,
} from './desktop.ts';

const ctorSpy = vi.fn();
const requestSpy = vi.fn();
const permissionState = { value: 'default' as NotificationPermission };

class FakeNotification {
  static readonly requestPermission = requestSpy;
  static get permission(): NotificationPermission {
    return permissionState.value;
  }
  constructor(title: string, options?: unknown) {
    ctorSpy(title, options);
  }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
}

beforeEach(() => {
  ctorSpy.mockReset();
  requestSpy.mockReset();
  requestSpy.mockResolvedValue('granted');
  permissionState.value = 'default';
  vi.stubGlobal('Notification', FakeNotification);
  setVisibility('visible');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('desktop notifications', () => {
  it('reports support and current permission', () => {
    expect(isDesktopSupported()).toBe(true);
    expect(getDesktopPermission()).toBe('default');
  });

  it('reports unsupported when the API is absent', () => {
    vi.stubGlobal('Notification', undefined);
    expect(isDesktopSupported()).toBe(false);
    expect(getDesktopPermission()).toBe('unsupported');
  });

  it('requests permission only when undecided', async () => {
    permissionState.value = 'default';
    await expect(requestDesktopPermission()).resolves.toBe('granted');
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('short-circuits without re-prompting when already granted', async () => {
    permissionState.value = 'granted';
    await expect(requestDesktopPermission()).resolves.toBe('granted');
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('resolves unsupported without throwing when the API is absent', async () => {
    vi.stubGlobal('Notification', undefined);
    await expect(requestDesktopPermission()).resolves.toBe('unsupported');
  });

  it('does not raise when permission is not granted', () => {
    permissionState.value = 'default';
    setVisibility('hidden');
    expect(showDesktopNotification('Hi')).toBe(false);
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it('does not raise while the tab is visible', () => {
    permissionState.value = 'granted';
    setVisibility('visible');
    expect(showDesktopNotification('Hi')).toBe(false);
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it('raises when granted and the tab is backgrounded', () => {
    permissionState.value = 'granted';
    setVisibility('hidden');
    expect(showDesktopNotification('Hi', { body: 'There' })).toBe(true);
    expect(ctorSpy).toHaveBeenCalledWith('Hi', { body: 'There' });
  });
});
