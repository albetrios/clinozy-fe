import { renderHook } from '@testing-library/react';
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
});
