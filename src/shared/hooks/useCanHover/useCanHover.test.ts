import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readCanHover, useCanHover } from './useCanHover.ts';

/** A `matchMedia` whose `(hover: none)` answer can be flipped. */
function installPointer(touch: boolean) {
  let hoverNone = touch;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return query === '(hover: none)' && hoverNone;
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
    setTouch(next: boolean) {
      hoverNone = next;
      for (const listener of [...listeners]) listener();
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCanHover', () => {
  it('is true with a pointer that hovers', () => {
    installPointer(false);
    expect(readCanHover()).toBe(true);
    expect(renderHook(() => useCanHover()).result.current).toBe(true);
  });

  it('is false on a touch screen — (hover: none)', () => {
    installPointer(true);
    expect(readCanHover()).toBe(false);
    expect(renderHook(() => useCanHover()).result.current).toBe(false);
  });

  it('follows the input when it changes (a tablet docked to a trackpad)', () => {
    const pointer = installPointer(true);
    const { result } = renderHook(() => useCanHover());
    expect(result.current).toBe(false);

    act(() => pointer.setTouch(false));
    expect(result.current).toBe(true);
  });

  it('stops listening when the last consumer unmounts', () => {
    const pointer = installPointer(false);
    const { unmount } = renderHook(() => useCanHover());
    expect(pointer.listenerCount()).toBe(1);
    unmount();
    expect(pointer.listenerCount()).toBe(0);
  });

  it('assumes hover where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(readCanHover()).toBe(true);
    expect(renderHook(() => useCanHover()).result.current).toBe(true);
  });
});
