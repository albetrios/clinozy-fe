import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appInstant } from '@/shared/api/app/app-time.ts';
import { APPOINTMENT_NOW } from '@/tests/utils/appointment-doubles.ts';

import { useLatestUpdateWords } from './useLatestUpdateWords.ts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
});
afterEach(() => vi.useRealTimers());

describe('useLatestUpdateWords (appointments.md:359–360)', () => {
  it('labels each pill with its mark — the moves counted', () => {
    const { result } = renderHook(() => useLatestUpdateWords());
    const { label } = result.current;
    expect(label({ kind: 'reminderSent', tone: 'stone' })).toBe('✓ Reminder sent');
    expect(label({ kind: 'repliedYes', tone: 'lav' })).toBe('✓ Replied Yes');
    expect(label({ kind: 'moved', tone: 'butter', times: 1, from: null })).toBe(
      '✓ Moved',
    );
    expect(label({ kind: 'moved', tone: 'butter', times: 3, from: null })).toBe(
      '✓ Moved ×3',
    );
    expect(label({ kind: 'checkedIn', tone: 'mint' })).toBe('✓ Checked in');
  });

  it('says what each one means', () => {
    const { result } = renderHook(() => useLatestUpdateWords());
    const { hint } = result.current;
    expect(hint({ kind: 'reminderSent', tone: 'stone' })).toBe('Reminder sent');
    expect(hint({ kind: 'repliedYes', tone: 'lav' })).toBe(
      'Confirmed automatically from a WhatsApp Yes',
    );
    expect(hint({ kind: 'checkedIn', tone: 'mint' })).toBe('Patient checked in');
  });

  it('names the slot a booking moved from clinic-local, or only that it moved', () => {
    const { result } = renderHook(() => useLatestUpdateWords());
    const { hint } = result.current;
    expect(
      hint({
        kind: 'moved',
        tone: 'butter',
        times: 1,
        from: appInstant('2026-10-02', '16:30'),
      }),
      // The old slot's day and time are isolated tokens in the sentence.
    ).toMatch(/^Moved from \u2068.+\u2069 \u20684:30\sPM\u2069$/);
    expect(hint({ kind: 'moved', tone: 'butter', times: 2, from: null })).toBe(
      '✓ Moved ×2',
    );
  });
});
