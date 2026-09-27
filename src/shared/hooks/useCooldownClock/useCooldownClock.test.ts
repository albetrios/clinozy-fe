import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCooldownClock } from './useCooldownClock.ts';

describe('useCooldownClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current time when cooldown is null', () => {
    const { result } = renderHook(() => useCooldownClock(null));
    expect(result.current).toBeTypeOf('number');
  });

  it('updates now while cooldown is active', () => {
    const { result, rerender } = renderHook(({ until }) => useCooldownClock(until), {
      initialProps: { until: Date.now() + 5_000 },
    });
    const initial = result.current;
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    rerender({ until: Date.now() + 5_000 });
    expect(result.current).toBeGreaterThanOrEqual(initial);
  });
});
