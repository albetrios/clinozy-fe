import { describe, expect, it } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';

import {
  LEADS_COLUMNS,
  leadTableMinWidth,
  leadUpdatedLabel,
} from './leads-table-layout.ts';

describe('leadTableMinWidth (H:4181)', () => {
  it('is 830px with all six columns', () => {
    expect(leadTableMinWidth(LEADS_COLUMNS.map((column) => column.id))).toBe(830);
  });

  it('recomputes as columns hide: the sum of minimums, 12px gaps, plus 60', () => {
    // Lead 160 + Team 150 + Updated 84, two gaps, 60.
    expect(leadTableMinWidth(['name', 'team', 'updated'])).toBe(160 + 150 + 84 + 24 + 60);
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

describe('leadUpdatedLabel (H:6149)', () => {
  // 30 Sep 2026, 11:00 clinic time.
  const now = new Date(clinicInstant('2026-09-30', '11:00'));
  const at = (date: string, time: string) => clinicInstant(date, time);

  it('words today in minutes and hours', () => {
    expect(leadUpdatedLabel(at('2026-09-30', '11:00'), now)).toEqual({ kind: 'justNow' });
    expect(leadUpdatedLabel(at('2026-09-30', '10:59'), now)).toEqual({ kind: 'justNow' });
    expect(leadUpdatedLabel(at('2026-09-30', '10:32'), now)).toEqual({
      kind: 'minutes',
      count: 28,
    });
    expect(leadUpdatedLabel(at('2026-09-30', '07:00'), now)).toEqual({
      kind: 'hours',
      count: 4,
    });
  });

  it('words earlier days on the clinic calendar', () => {
    expect(leadUpdatedLabel(at('2026-09-29', '23:30'), now)).toEqual({
      kind: 'yesterday',
    });
    expect(leadUpdatedLabel(at('2026-09-26', '10:00'), now)).toEqual({
      kind: 'days',
      count: 4,
    });
    expect(leadUpdatedLabel(at('2026-09-16', '10:00'), now)).toEqual({
      kind: 'weeks',
      count: 2,
    });
    expect(leadUpdatedLabel(at('2026-08-16', '10:00'), now)).toEqual({ kind: 'date' });
  });

  it('reads a clock running ahead as just now', () => {
    expect(leadUpdatedLabel(at('2026-09-30', '11:05'), now)).toEqual({ kind: 'justNow' });
  });
});
