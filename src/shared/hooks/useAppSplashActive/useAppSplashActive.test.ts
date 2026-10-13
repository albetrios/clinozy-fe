import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAppSplashActive } from './useAppSplashActive.ts';

function mountSplash(): HTMLElement {
  const splash = document.createElement('div');
  splash.id = 'app-splash';
  document.body.prepend(splash);
  return splash;
}

/** What the splash does when its exit lands: the node goes, then the event fires. */
function finishSplash(splash: HTMLElement): void {
  act(() => {
    splash.remove();
    window.dispatchEvent(new CustomEvent('app-splash-dismissed'));
  });
}

describe('useAppSplashActive', () => {
  afterEach(() => {
    document.getElementById('app-splash')?.remove();
  });

  it('is false when the page has no boot splash', () => {
    const { result } = renderHook(() => useAppSplashActive());
    expect(result.current).toBe(false);
  });

  it('is true while the splash covers the page, and false once it is dismissed', () => {
    const splash = mountSplash();
    const { result } = renderHook(() => useAppSplashActive());
    expect(result.current).toBe(true);

    finishSplash(splash);
    expect(result.current).toBe(false);
  });

  it('stays false after the dismissal — a later splash node is not this load’s', () => {
    const splash = mountSplash();
    const { result, rerender } = renderHook(() => useAppSplashActive());
    finishSplash(splash);

    mountSplash();
    rerender();
    expect(result.current).toBe(false);
  });
});
