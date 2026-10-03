import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const blockerState = vi.hoisted(() => ({
  proceed: vi.fn(),
  reset: vi.fn(),
  status: 'idle' as 'idle' | 'blocked',
}));

vi.mock('@tanstack/react-router', () => ({
  useBlocker: () => ({
    proceed: blockerState.proceed,
    reset: blockerState.reset,
    status: blockerState.status,
  }),
}));

import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.tsx';

describe('useUnsavedChangesGuard', () => {
  it('returns a guard dialog element', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ when: true, title: 'Leave?' }),
    );
    expect(result.current.guardDialog).toBeTruthy();
    expect(result.current.isBlocked).toBe(false);
  });

  it('reports blocked status from the router blocker', () => {
    blockerState.status = 'blocked';
    const { result } = renderHook(() => useUnsavedChangesGuard({ when: true }));
    expect(result.current.isBlocked).toBe(true);
    blockerState.status = 'idle';
  });

  it('runs a guarded exit at once when there is nothing to lose', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard({ when: false }));
    const exit = vi.fn();

    act(() => result.current.confirmDiscard(exit));

    expect(exit).toHaveBeenCalledTimes(1);
    expect(result.current.isBlocked).toBe(false);
  });

  it('holds a guarded exit and opens the prompt while dirty', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard({ when: true }));
    const exit = vi.fn();

    act(() => result.current.confirmDiscard(exit));

    expect(exit).not.toHaveBeenCalled();
    expect(result.current.isBlocked).toBe(true);
  });
});
