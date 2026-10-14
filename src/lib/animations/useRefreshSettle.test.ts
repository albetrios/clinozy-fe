import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REFRESH_SETTLE, settleRefreshed, useRefreshSettle } from './useRefreshSettle.ts';

vi.mock('./prefers-reduced-motion.ts', () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

const { prefersReducedMotion } = await import('./prefers-reduced-motion.ts');

/** MutationObserver callbacks are microtasks: let them run. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

let animate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  animate = vi.fn();
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: animate,
  });
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

afterEach(() => {
  document.body.replaceChildren();
  delete (Element.prototype as { animate?: unknown }).animate;
});

function list(refreshing: boolean): HTMLElement {
  const element = document.createElement('div');
  if (refreshing) element.setAttribute('data-refreshing', '');
  document.body.append(element);
  return element;
}

describe('useRefreshSettle', () => {
  it('settles a subtree from half opacity when the skeleton leaves it', async () => {
    const { unmount } = renderHook(() => useRefreshSettle());
    const rows = list(true);
    await flush();
    rows.removeAttribute('data-refreshing');
    await flush();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.instances[0]).toBe(rows);
    expect(animate).toHaveBeenCalledWith(
      [{ opacity: REFRESH_SETTLE.from }, { opacity: 1 }],
      {
        duration: REFRESH_SETTLE.duration,
        easing: REFRESH_SETTLE.fallbackEasing,
      },
    );
    unmount();
  });

  it('does nothing when the skeleton arrives — only its leaving settles', async () => {
    const { unmount } = renderHook(() => useRefreshSettle());
    const rows = list(false);
    rows.setAttribute('data-refreshing', '');
    await flush();
    expect(animate).not.toHaveBeenCalled();
    unmount();
  });

  it('does nothing when the skeleton leaves and returns before the observer runs', async () => {
    const { unmount } = renderHook(() => useRefreshSettle());
    const rows = list(true);
    rows.removeAttribute('data-refreshing');
    rows.setAttribute('data-refreshing', '');
    await flush();
    expect(animate).not.toHaveBeenCalled();
    unmount();
  });

  it('lands at once under reduced motion', async () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);
    const { unmount } = renderHook(() => useRefreshSettle());
    const rows = list(true);
    rows.removeAttribute('data-refreshing');
    await flush();
    expect(animate).not.toHaveBeenCalled();
    unmount();
  });

  it('stops watching when the shell unmounts', async () => {
    const { unmount } = renderHook(() => useRefreshSettle());
    unmount();
    const rows = list(true);
    rows.removeAttribute('data-refreshing');
    await flush();
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('settleRefreshed', () => {
  it('reads the strong ease-out the stylesheet declares', () => {
    document.documentElement.style.setProperty(
      '--ease-out-strong',
      'cubic-bezier(0, 0, 1, 1)',
    );
    const rows = list(false);
    settleRefreshed(rows);
    expect(animate).toHaveBeenCalledWith(expect.any(Array), {
      duration: REFRESH_SETTLE.duration,
      easing: 'cubic-bezier(0, 0, 1, 1)',
    });
    document.documentElement.style.removeProperty('--ease-out-strong');
  });

  it('does nothing without Web Animations', () => {
    delete (Element.prototype as { animate?: unknown }).animate;
    expect(() => settleRefreshed(list(false))).not.toThrow();
  });
});
