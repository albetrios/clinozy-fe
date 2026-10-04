import { describe, expect, it } from 'vitest';

import {
  DRAWER_VIEWPORT_GUTTER,
  DRAWER_WIDTH_CLASS,
  drawerWidthAt,
  EXPLICIT_DRAWER_WIDTHS,
  type RecordDrawerWidth,
  resolveDrawerWidth,
} from './record-drawer-width.ts';

describe('resolveDrawerWidth — automatic W (H:3850)', () => {
  it('gives a light form (≤ 8 fields, none heavy) 560px', () => {
    expect(resolveDrawerWidth({ fieldCount: 4 })).toBe(560);
    expect(resolveDrawerWidth({ fieldCount: 8 })).toBe(560);
  });

  it('gives a form of more than 8 fields 680px', () => {
    expect(resolveDrawerWidth({ fieldCount: 9 })).toBe(680);
  });

  it('gives a form with a heavy field 680px, however short', () => {
    expect(resolveDrawerWidth({ fieldCount: 2, hasHeavyField: true })).toBe(680);
  });

  it('gives a form with an items field 840px', () => {
    expect(resolveDrawerWidth({ fieldCount: 3, hasItems: true })).toBe(840);
    expect(
      resolveDrawerWidth({ fieldCount: 20, hasItems: true, hasHeavyField: true }),
    ).toBe(840);
  });

  it('falls back to the everyday 680px without a profile', () => {
    expect(resolveDrawerWidth(undefined)).toBe(680);
  });
});

describe('resolveDrawerWidth — explicit W', () => {
  it.each(EXPLICIT_DRAWER_WIDTHS)(
    'honours an explicit %ipx over the automatic width',
    (w) => {
      expect(resolveDrawerWidth({ fieldCount: 2 }, w)).toBe(w);
      expect(resolveDrawerWidth(undefined, w)).toBe(w);
    },
  );

  it('lets an items field force 840px over a narrower explicit width', () => {
    expect(resolveDrawerWidth({ fieldCount: 3, hasItems: true }, 600)).toBe(840);
    expect(resolveDrawerWidth({ fieldCount: 3, hasItems: true }, 820)).toBe(840);
  });

  it('keeps a wider explicit width with an items field', () => {
    expect(resolveDrawerWidth({ fieldCount: 3, hasItems: true }, 900)).toBe(900);
    expect(resolveDrawerWidth({ fieldCount: 3, hasItems: true }, 1040)).toBe(1040);
  });
});

describe('drawerWidthAt — min(W, 100vw − 56px)', () => {
  it('is W while the viewport has room', () => {
    expect(drawerWidthAt(560, 1440)).toBe(560);
    expect(drawerWidthAt(840, 1440)).toBe(840);
  });

  it('leaves 56px of the viewport uncovered when W does not fit', () => {
    // KICKOFF: "an 840px drawer is 764px wide at 820".
    expect(drawerWidthAt(840, 820)).toBe(764);
    expect(drawerWidthAt(1040, 1024)).toBe(968);
    expect(drawerWidthAt(720, 768)).toBe(712);
    expect(drawerWidthAt(680, 768)).toBe(680);
    // New lead: 640 at 1440, 584 on a 640px-wide window.
    expect(drawerWidthAt(640, 1440)).toBe(640);
    expect(drawerWidthAt(640, 640)).toBe(584);
  });
});

describe('DRAWER_WIDTH_CLASS — the rule as literal Tailwind classes', () => {
  const widths: RecordDrawerWidth[] = [560, 600, 640, 680, 720, 820, 840, 900, 1040];

  it.each(widths)('encodes min(%ipx, 100vw − 56px) from md up', (w) => {
    expect(DRAWER_WIDTH_CLASS[w]).toBe(
      `md:w-[min(${w}px,calc(100vw-${DRAWER_VIEWPORT_GUTTER}px))]`,
    );
  });
});
