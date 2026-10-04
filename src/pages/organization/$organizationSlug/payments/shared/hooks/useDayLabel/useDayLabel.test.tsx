import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDayLabel } from './useDayLabel.ts';

describe('useDayLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T04:30:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('names today "Today" and any other day by its date', () => {
    const { result } = renderHook(() => useDayLabel());
    expect(result.current('2026-10-03')).toBe('Today');
    expect(result.current('2026-09-24')).toBe('Sep 24');
  });
});
