import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useViewportWidth, VIEWPORT_RESIZE_SETTLE_MS } from './useViewportWidth.ts';

const setWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
};

describe('useViewportWidth', () => {
  const initial = window.innerWidth;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: initial });
  });

  it('reads the window’s width', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    const { result } = renderHook(() => useViewportWidth());
    expect(result.current).toBe(1024);
  });

  it('follows a resize once it settles (120ms, H:4522)', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    const { result } = renderHook(() => useViewportWidth());
    act(() => setWidth(820));
    expect(result.current).toBe(1440);
    act(() => {
      vi.advanceTimersByTime(VIEWPORT_RESIZE_SETTLE_MS);
    });
    expect(result.current).toBe(820);
  });
});
