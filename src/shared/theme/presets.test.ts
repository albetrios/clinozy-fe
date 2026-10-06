import { afterEach, describe, expect, it } from 'vitest';

import { applyTheme, THEME_ID } from './presets.ts';

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
