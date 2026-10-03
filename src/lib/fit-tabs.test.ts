import { afterEach, describe, expect, it, vi } from 'vitest';

import { fitTabs, measureTextWidth } from './fit-tabs.ts';

/** A room toolbar's track (H:4003–4007): 8px padding + border, 2px gaps, 78px "More". */
const TRACK = { reserve: 78, gap: 2, padding: 8 };

describe('fitTabs', () => {
  it('shows every tab when they fit, padding and gaps included', () => {
    // 8 + 100 + 100 + 2 = 210.
    expect(fitTabs([100, 100], 210, 0, TRACK)).toEqual({ visible: [0, 1], folded: [] });
    expect(fitTabs([100, 100], 209, 0, TRACK).folded).toEqual([1]);
  });

  it('keeps the current tab, then tabs in order until the first that does not fit', () => {
    // Medical at 1024 (H:4155): Sales 76 · Medicines 106 (current) · Purchases 107 ·
    // Suppliers 100 · Manufacturers 132 · MRs 70 · Payments 98 in 559px.
    const widths = [76, 106, 107, 100, 132, 70, 98];
    expect(fitTabs(widths, 559, 1, TRACK)).toEqual({
      visible: [0, 1, 2, 3],
      folded: [4, 5, 6],
    });
  });

  it('stops at the first tab that does not fit, even when a later one would', () => {
    // budget 400 - 8 - 78 = 314: current 50 → 264; 100 + 2 → 162; 300 does not fit → stop.
    expect(fitTabs([100, 300, 50, 50], 400, 2, TRACK)).toEqual({
      visible: [0, 2],
      folded: [1, 3],
    });
  });

  it('keeps the first tabs when no tab is current', () => {
    expect(fitTabs([120, 120, 120], 300, -1, { reserve: 84 })).toEqual({
      visible: [0],
      folded: [1, 2],
    });
  });

  it('keeps only the current tab when nothing else fits beside "More"', () => {
    expect(fitTabs([90, 120, 90], 200, 1, TRACK)).toEqual({
      visible: [1],
      folded: [0, 2],
    });
  });

  it('folds nothing before the row is measured, or with no tabs', () => {
    expect(fitTabs([500, 500], null, 0, TRACK)).toEqual({ visible: [0, 1], folded: [] });
    expect(fitTabs([], 10, 0, TRACK)).toEqual({ visible: [], folded: [] });
  });
});

describe('measureTextWidth', () => {
  afterEach(() => vi.restoreAllMocks());

  it('estimates 7.5px a character where there is no canvas', () => {
    expect(measureTextWidth('Sales', '500 12.5px Inter')).toBe(37.5);
  });
});
