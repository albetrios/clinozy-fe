import { describe, expect, it } from 'vitest';

import { drawerStepSummary } from './drawer-step-summary.ts';

describe('drawerStepSummary (H:3840)', () => {
  it('joins the filled values with " · ", skipping the empty ones', () => {
    expect(drawerStepSummary(['Adajan', undefined, '', null, 'Riya S.'], '—')).toBe(
      'Adajan · Riya S.',
    );
  });

  it('names four values at most', () => {
    expect(drawerStepSummary(['a', 'b', 'c', 'd', 'e'], '—')).toBe('a · b · c · d');
  });

  it('reads the empty text when nothing is filled', () => {
    expect(drawerStepSummary([undefined, ''], 'Not filled yet')).toBe('Not filled yet');
  });
});
