import { describe, expect, it } from 'vitest';

import { LEADS_COLUMNS, leadTableMinWidth } from './leads-table-layout.ts';

describe('leadTableMinWidth (H:4181)', () => {
  it('is 830px with all six columns', () => {
    expect(leadTableMinWidth(LEADS_COLUMNS.map((column) => column.id))).toBe(830);
  });

  it('recomputes as columns hide: the sum of minimums, 12px gaps, plus 60', () => {
    // Lead 160 + Team 150 + Updated 84, two gaps, 60.
    expect(leadTableMinWidth(['name', 'team', 'activity'])).toBe(
      160 + 150 + 84 + 24 + 60,
    );
    expect(leadTableMinWidth(['name'])).toBe(220);
    expect(leadTableMinWidth([])).toBe(0);
  });

  it('keeps the prototype tracks, Lead first and Updated a fixed 84px', () => {
    expect(LEADS_COLUMNS.map((column) => column.track)).toEqual([
      'minmax(160px,1.5fr)',
      'minmax(104px,.8fr)',
      'minmax(116px,.7fr)',
      'minmax(96px,.9fr)',
      'minmax(150px,1.2fr)',
      '84px',
    ]);
  });
});
