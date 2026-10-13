import { describe, expect, it } from 'vitest';

import {
  LAUNCH_LAYOUT_WIDTH,
  layoutMainClassName,
  resolveEffectiveLayoutWidth,
} from './layout-width.ts';

describe('layout-width', () => {
  it('resolveEffectiveLayoutWidth takes the deployment’s forced width', () => {
    expect(resolveEffectiveLayoutWidth('reading')).toBe('reading');
    expect(resolveEffectiveLayoutWidth('contained')).toBe('contained');
  });

  it('is the launch’s full width when nothing forces one', () => {
    expect(LAUNCH_LAYOUT_WIDTH).toBe('full');
    expect(resolveEffectiveLayoutWidth(null)).toBe('full');
  });

  it('layoutMainClassName maps each width id', () => {
    expect(layoutMainClassName('full')).toBe('w-full');
    expect(layoutMainClassName('contained')).toContain('max-w-screen-2xl');
    expect(layoutMainClassName('reading')).toContain('max-w-3xl');
  });

  it('keeps the contained column growing on big monitors', () => {
    // Capped at `2xl` (1536px) it covered well under half of a 3440px ultrawide
    // and no longer lined up with the header above it.
    const classes = layoutMainClassName('contained').split(' ');
    expect(classes).toContain('3xl:max-w-[112rem]');
    expect(classes).toContain('4xl:max-w-[136rem]');
    expect(classes).toContain('mx-auto');
  });

  it('leaves the reading and full widths alone on big monitors', () => {
    expect(layoutMainClassName('reading')).not.toMatch(/[34]xl:/);
    expect(layoutMainClassName('full')).not.toMatch(/[34]xl:/);
  });
});
