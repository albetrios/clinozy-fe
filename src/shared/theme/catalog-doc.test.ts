import { describe, expect, it } from 'vitest';

import { CATALOG_OPTION_IDS } from './catalog-doc.ts';
import { BASE_COLORS, ELEVATION_LEVELS, MOTION_PRESETS } from './presets.ts';

describe('catalog-doc', () => {
  it('derives base colour ids from BASE_COLORS', () => {
    expect(CATALOG_OPTION_IDS.baseColors).toEqual(BASE_COLORS.map((c) => c.id));
  });

  it('derives elevation ids from ELEVATION_LEVELS', () => {
    expect(CATALOG_OPTION_IDS.elevation).toEqual(ELEVATION_LEVELS.map((e) => e.id));
  });

  it('derives motion ids from MOTION_PRESETS', () => {
    expect(CATALOG_OPTION_IDS.motion).toEqual(Object.keys(MOTION_PRESETS));
  });
});
