import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePhotoDayLabel } from './usePhotoDayLabel.ts';

/** 10:00 on 3 Oct 2026, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('usePhotoDayLabel', () => {
  it('names today "Today", a day this year by day and month, an older one with its year', () => {
    const { result } = renderHook(() => usePhotoDayLabel());
    expect(result.current('2026-10-03')).toBe('Today');
    expect(result.current('2026-09-24')).toMatch(/24/);
    expect(result.current('2026-09-24')).not.toMatch(/2026/);
    expect(result.current('2025-09-24')).toMatch(/2025/);
  });
});
