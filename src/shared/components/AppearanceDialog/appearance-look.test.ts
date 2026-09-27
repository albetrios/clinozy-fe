import { describe, expect, it } from 'vitest';

import {
  ACCENT_COLORS,
  GENERATED_FONTS,
  GENERATED_RADII,
  normalizeLook,
} from '@/shared/theme/index.ts';

import { accentIdForHue, customLookLabel, lookFields } from './appearance-look.ts';

describe('appearance-look', () => {
  it('accentIdForHue maps a catalog hue back to its id, unknown hue to null', () => {
    const first = ACCENT_COLORS[0];
    expect(first).toBeDefined();
    expect(accentIdForHue(first!.hue)).toBe(first!.id);
    expect(accentIdForHue(-999)).toBeNull();
  });

  it('customLookLabel joins known font + radius labels with a separator', () => {
    const label = customLookLabel('inter', 'default');
    expect(label).toContain(GENERATED_FONTS.inter?.label ?? 'Inter');
    expect(label).toContain(GENERATED_RADII.default?.label ?? '');
    expect(label).toContain(' · ');
  });

  it('customLookLabel drops unknown ids without crashing (object-injection safe)', () => {
    // Keys are catalog-validated upstream; an unknown id must yield '' — never a
    // thrown error or a prototype-chain hit.
    expect(customLookLabel('__missing__', '__missing__')).toBe('');
    expect(customLookLabel('constructor', 'toString')).toBe('');
  });

  it('lookFields returns safe defaults for a null look', () => {
    expect(lookFields(null)).toEqual({
      accentId: null,
      chartId: null,
      bodyFontId: 'inter',
      headingFontId: 'inter',
      radiusId: 'default',
      customLook: '',
    });
  });

  it('lookFields derives accent/chart ids + a label from a concrete look', () => {
    const accent = ACCENT_COLORS[0];
    expect(accent).toBeDefined();
    const look = normalizeLook({
      hue: accent!.hue,
      chartHue: accent!.hue,
      bodyFontId: 'inter',
      radiusId: 'default',
    });

    const fields = lookFields(look);
    expect(fields.accentId).toBe(accent!.id);
    expect(fields.chartId).toBe(accent!.id);
    expect(fields.bodyFontId).toBe('inter');
    expect(fields.radiusId).toBe('default');
    expect(fields.customLook).toContain(' · ');
  });
});
