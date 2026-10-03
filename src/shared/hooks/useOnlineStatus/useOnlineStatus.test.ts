import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readOnline, useOnlineStatus } from './useOnlineStatus.ts';

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads navigator.onLine', () => {
    setOnline(true);
    expect(readOnline()).toBe(true);
    setOnline(false);
    expect(readOnline()).toBe(false);
  });

  it('follows the window online and offline events', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('stops listening once unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
