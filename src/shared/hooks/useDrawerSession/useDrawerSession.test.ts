import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDrawerSession } from './useDrawerSession.ts';

describe('useDrawerSession', () => {
  it('moves on each time the drawer opens, never while it stays open or shut', () => {
    const { result, rerender } = renderHook(({ open }) => useDrawerSession(open), {
      initialProps: { open: false },
    });
    const first = result.current.session;
    rerender({ open: false });
    expect(result.current.session).toBe(first);
    rerender({ open: true });
    const opened = result.current.session;
    expect(opened).toBe(first + 1);
    rerender({ open: true });
    expect(result.current.session).toBe(opened);
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.session).toBe(opened + 1);
    expect(result.current.fresh).toBe(false);
  });

  it('restarts blank after "Create & add another", until the next opening', () => {
    const { result, rerender } = renderHook(({ open }) => useDrawerSession(open), {
      initialProps: { open: true },
    });
    const before = result.current.session;
    act(() => result.current.restart());
    expect(result.current.session).toBe(before + 1);
    expect(result.current.fresh).toBe(true);
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.fresh).toBe(false);
  });
});
