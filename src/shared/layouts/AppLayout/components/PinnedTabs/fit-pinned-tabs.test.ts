import { describe, expect, it } from 'vitest';

import {
  availableTabSpace,
  fitPinnedTabs,
  MORE_RESERVE,
  pinnedTabWidth,
} from './fit-pinned-tabs.ts';

// The default pins (Appointments · Leads · Patients · Payments) at 600 13px Inter.
const DEFAULT_PINS = [86.6, 36.4, 56.2, 61.8].map(pinnedTabWidth);

describe('pinnedTabWidth', () => {
  it('adds padding, icon, gap and 2px to the rounded-up label', () => {
    expect(pinnedTabWidth(36.4)).toBe(81);
  });
});

describe('fitPinnedTabs (H:4087–4093)', () => {
  it('shows all four default pins in the 855px the prototype measures at 1440', () => {
    expect(fitPinnedTabs(DEFAULT_PINS, 855, 1)).toEqual({
      visible: [0, 1, 2, 3],
      folded: [],
    });
  });

  it('keeps only the current tab and "More" in the 251px at 1024 and 820', () => {
    expect(fitPinnedTabs(DEFAULT_PINS, 251, 1)).toEqual({
      visible: [1],
      folded: [0, 2, 3],
    });
  });

  it('keeps pins in order until the first that does not fit, then stops', () => {
    const widths = [100, 300, 50, 50];
    // 500 > 480, so budget 480 - 84 = 396: current 50 (index 2) → 346; 100 fits → 246;
    // 300 does not → stop, even though the last 50 would still fit.
    expect(fitPinnedTabs(widths, 480, 2)).toEqual({ visible: [0, 2], folded: [1, 3] });
  });

  it('keeps the first pins when the current room is not pinned', () => {
    expect(fitPinnedTabs([120, 120, 120], 300, -1)).toEqual({
      visible: [0],
      folded: [1, 2],
    });
    expect(300 - MORE_RESERVE).toBeLessThan(240);
  });

  it('folds nothing before the header is measured', () => {
    expect(fitPinnedTabs([500, 500], null, 0)).toEqual({ visible: [0, 1], folded: [] });
  });
});

describe('availableTabSpace (H:4084–4085)', () => {
  it('subtracts the mark, the All sections wrapper, the right cluster and the search share', () => {
    expect(
      availableTabSpace({
        innerWidth: 1400,
        markWidth: 105,
        allSectionsWidth: 54,
        rightItemWidths: [1, 32],
        hasSearch: true,
      }),
    ).toBe(1400 - 20 - 105 - 4 - 60 - (7 + 38) - 170);
  });
});
