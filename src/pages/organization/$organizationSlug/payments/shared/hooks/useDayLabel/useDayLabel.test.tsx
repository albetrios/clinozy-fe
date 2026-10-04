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
    // Yesterday is a date unless asked for.
    expect(result.current('2026-10-02')).toBe('Oct 2');
  });

  it('names yesterday "Yesterday" for Day close’s titles', () => {
    const { result } = renderHook(() => useDayLabel({ yesterday: true }));
    expect(result.current('2026-10-03')).toBe('Today');
    expect(result.current('2026-10-02')).toBe('Yesterday');
    expect(result.current('2026-10-01')).toBe('Oct 1');
  });

  it('writes every day as its date when not relative ("3 entries on Oct 3")', () => {
    const { result } = renderHook(() =>
      useDayLabel({ relative: false, yesterday: true }),
    );
    expect(result.current('2026-10-03')).toBe('Oct 3');
    expect(result.current('2026-10-02')).toBe('Oct 2');
  });
});
