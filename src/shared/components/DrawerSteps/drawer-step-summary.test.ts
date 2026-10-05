import { describe, expect, it } from 'vitest';

import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { drawerStepSummary } from './drawer-step-summary.ts';

describe('drawerStepSummary (H:3840)', () => {
  it('joins the filled values with " · ", skipping the empty ones', () => {
    expect(
      withoutBidiMarks(
        drawerStepSummary(['Adajan', undefined, '', null, 'Riya S.'], '—'),
      ),
    ).toBe('Adajan · Riya S.');
  });

  it('isolates each value, so "Riya S." and a phone stay whole on a right-to-left page', () => {
    expect(drawerStepSummary(['Riya S.', '+91 98250 44120'], '—')).toBe(
      `${fsi('Riya S.')} · ${fsi('+91 98250 44120')}`,
    );
  });

  it('names four values at most', () => {
    expect(withoutBidiMarks(drawerStepSummary(['a', 'b', 'c', 'd', 'e'], '—'))).toBe(
      'a · b · c · d',
    );
  });

  it('reads the empty text when nothing is filled', () => {
    expect(drawerStepSummary([undefined, ''], 'Not filled yet')).toBe('Not filled yet');
  });
});
