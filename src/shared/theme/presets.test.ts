import { afterEach, describe, expect, it } from 'vitest';

import { applyTheme, nextAuthVariant, SHUFFLE_TEMP, THEME_ID } from './presets.ts';

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('the one look', () => {
  it('is the launch’s zinc pastel look', () => {
    expect(THEME_ID).toBe('clinozy-zinc-pastel');
  });

  it('applyTheme paints it through its attribute on <html>', () => {
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('clinozy-zinc-pastel');
  });

  it('applyTheme sets nothing inline — the stylesheet owns every token', () => {
    applyTheme();
    expect(document.documentElement.getAttribute('style') ?? '').toBe('');
  });
});

describe('layout previews (TEMP)', () => {
  it('nextAuthVariant returns a different design index in range (TEMP)', () => {
    // The launch's canvas (0) and the three earlier previews.
    for (const current of [0, 1, 2, 3]) {
      for (let i = 0; i < 20; i += 1) {
        const v = nextAuthVariant(current);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(4);
        expect(v).not.toBe(current);
      }
    }
  });

  it('pins the launch canvases: shuffle never rolls the auth or public layout (L-65)', () => {
    // adoption.md "Making a variant live": the default AND pinned.
    expect(SHUFFLE_TEMP.authLayout).toBe(false);
    expect(SHUFFLE_TEMP.publicLayout).toBe(false);
  });
});
