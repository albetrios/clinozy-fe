import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readViewportTier, useViewportTier } from './useViewportTier.ts';

/** A `matchMedia` that answers `(min-width: Nrem)` from a settable width. */
function installViewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<() => void>();
  const minWidthPx = (query: string) =>
    Number(/min-width:\s*([\d.]+)rem/.exec(query)?.[1]) * 16;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return width >= minWidthPx(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
  return {
    resize(next: number) {
      width = next;
      for (const listener of [...listeners]) listener();
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useViewportTier', () => {
  it.each([
    [375, 'phone'],
    [767, 'phone'],
    [768, 'tablet'],
    [820, 'tablet'],
    [1024, 'tablet'],
    [1279, 'tablet'],
    [1280, 'desktop'],
    [1440, 'desktop'],
  ] as const)('at %ipx reads %s', (width, tier) => {
    installViewport(width);
    expect(readViewportTier()).toBe(tier);
    expect(renderHook(() => useViewportTier()).result.current).toBe(tier);
  });

  it('follows the viewport across both boundaries', () => {
    const viewport = installViewport(767);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe('phone');

    act(() => viewport.resize(768));
    expect(result.current).toBe('tablet');
    act(() => viewport.resize(1280));
    expect(result.current).toBe('desktop');
    act(() => viewport.resize(1279));
    expect(result.current).toBe('tablet');
  });

  it('stops listening when the last consumer unmounts', () => {
    const viewport = installViewport(1024);
    const { unmount } = renderHook(() => useViewportTier());
    expect(viewport.listenerCount()).toBeGreaterThan(0);
    unmount();
    expect(viewport.listenerCount()).toBe(0);
  });

  it('assumes desktop where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(readViewportTier()).toBe('desktop');
  });
});
