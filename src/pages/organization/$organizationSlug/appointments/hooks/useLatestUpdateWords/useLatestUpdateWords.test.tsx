import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';

import { useLatestUpdateWords } from './useLatestUpdateWords.ts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
});
afterEach(() => vi.useRealTimers());

describe('useLatestUpdateWords (appointments.md:359–360)', () => {
  it('labels each pill with its mark', () => {
    const { result } = renderHook(() => useLatestUpdateWords());
    const { label } = result.current;
    expect(label({ kind: 'planReady', tone: 'sage', suggestions: 2 })).toBe(
      '✓ Plan ready',
    );
    expect(label({ kind: 'planPending', tone: 'butter' })).toBe('○ Plan pending');
    expect(label({ kind: 'moved', tone: 'butter', times: 1, from: null })).toBe(
      '✓ Moved',
    );
    expect(label({ kind: 'moved', tone: 'butter', times: 3, from: null })).toBe(
      '✓ Moved ×3',
    );
    expect(label({ kind: 'checkedIn', tone: 'mint' })).toBe('✓ Checked in');
  });

  it('says what each one means, the old slot named clinic-local', () => {
    const { result } = renderHook(() => useLatestUpdateWords());
    const { hint } = result.current;
    expect(hint({ kind: 'planReady', tone: 'sage', suggestions: 4 })).toBe(
      '4 in offering suggestions',
    );
    expect(hint({ kind: 'reminderRead', tone: 'sage' })).toBe(
      'Reminder read on WhatsApp',
    );
    expect(hint({ kind: 'repliedYes', tone: 'lav' })).toBe(
      'Confirmed automatically from a WhatsApp Yes',
    );
    expect(
      hint({
        kind: 'moved',
        tone: 'butter',
        times: 1,
        from: clinicInstant('2026-10-02', '16:30'),
      }),
    ).toMatch(/^Moved from .+ 4:30\sPM$/);
  });
});
