import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useThemeStore } from './useThemeStore.ts';

/** A v7 save from the retired studio: a generated look, every orthogonal axis set. */
const STUDIO_SAVE = {
  state: {
    theme: 'dark',
    preset: 'custom',
    customTheme: {
      hue: 12,
      chartHue: 190,
      bodyFontId: 'serif',
      headingFontId: 'mono',
      radiusId: 'sharp',
      densityId: 'compact',
      motionId: 'calm',
      elevationId: 'floating',
      contrastId: 'amoled',
      harmonyId: 'split',
      intensityId: 'max',
      separationId: 'shadow',
      shapeId: 'sharp',
      typeScaleId: 'grand',
      focusId: 'glow',
    },
    baseId: 'olive',
    menu: 'glass',
    iconWeight: 'bold',
    iconColor: 'primary',
    iconLibrary: 'phosphor',
    seed: 4242,
    layoutWidth: 'reading',
  },
  version: 7,
};

beforeEach(() => {
  useThemeStore.setState({ theme: 'light' });
  const root = document.documentElement;
  root.classList.remove('dark');
  delete root.dataset.theme;
});

afterEach(() => {
  localStorage.removeItem('theme-preference');
  localStorage.removeItem('theme-boot-vars');
});

describe('useThemeStore — the mode over the one look', () => {
  it('starts light, the design’s default', () => {
    expect(useThemeStore.getInitialState().theme).toBe('light');
  });

  it('holds only the mode — no presets, looks, seeds or axes', () => {
    const state = useThemeStore.getState() as unknown as Record<string, unknown>;
    for (const retired of [
      'preset',
      'customTheme',
      'baseId',
      'menu',
      'iconWeight',
      'iconColor',
      'iconLibrary',
      'seed',
      'layoutWidth',
      'setPreset',
      'updateLook',
      'applyThemeSeed',
      'shuffleTheme',
    ]) {
      expect(state, retired).not.toHaveProperty(retired);
    }
  });

  it('dark mode adds the .dark class; light removes it', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');

    useThemeStore.getState().setTheme('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('system mode follows the OS preference', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('dark'),
    })) as typeof window.matchMedia;
    try {
      useThemeStore.getState().setTheme('system');
      expect(document.documentElement).toHaveClass('dark');
    } finally {
      window.matchMedia = original;
    }
  });

  it('switching the mode sets no inline token', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.getAttribute('style') ?? '').toBe('');
  });
});

describe('useThemeStore — persistence and the studio’s retirement (v8)', () => {
  it('persists the mode and nothing else', () => {
    const partialize = useThemeStore.persist.getOptions().partialize;
    expect(partialize?.(useThemeStore.getState())).toEqual({ theme: 'light' });
  });

  it('migrating any earlier save keeps the mode and drops everything else', () => {
    const migrate = useThemeStore.persist.getOptions().migrate;
    expect(migrate?.(STUDIO_SAVE.state, 7)).toEqual({ theme: 'dark' });
    expect(migrate?.({ theme: 'system', toastVariant: 2 }, 3)).toEqual({
      theme: 'system',
    });
  });

  it('an old save can’t crash it: a missing, corrupt or foreign mode is light', () => {
    const migrate = useThemeStore.persist.getOptions().migrate;
    expect(migrate?.(null, 1)).toEqual({ theme: 'light' });
    expect(migrate?.('not-an-object', 2)).toEqual({ theme: 'light' });
    expect(migrate?.({ theme: 'blue' }, 5)).toEqual({ theme: 'light' });
    expect(migrate?.({ theme: 42 }, 6)).toEqual({ theme: 'light' });
  });

  it('a stored v7 studio look loads as its mode alone, on the one look, saved as v8', async () => {
    localStorage.setItem('theme-preference', JSON.stringify(STUDIO_SAVE));
    // The resolved palette the generated looks left for the boot script.
    localStorage.setItem('theme-boot-vars', JSON.stringify({ preset: 'custom' }));

    await useThemeStore.persist.rehydrate();

    expect(useThemeStore.getState().theme).toBe('dark');
    const root = document.documentElement;
    expect(root).toHaveClass('dark');
    expect(root.dataset.theme).toBe('clinozy-zinc-pastel');
    // None of the look's axes reached the page.
    for (const axis of ['base', 'menu', 'iconColor', 'shape', 'elevation', 'focus']) {
      expect(root.dataset, axis).not.toHaveProperty(axis);
    }
    expect(root.getAttribute('style') ?? '').toBe('');

    const stored = JSON.parse(localStorage.getItem('theme-preference') ?? '{}');
    expect(stored).toEqual({ state: { theme: 'dark' }, version: 8 });
    expect(localStorage.getItem('theme-boot-vars')).toBeNull();
  });

  it('a current save with a mode outside the three falls back to light', async () => {
    localStorage.setItem(
      'theme-preference',
      JSON.stringify({ state: { theme: 'sepia' }, version: 8 }),
    );

    await useThemeStore.persist.rehydrate();

    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('rehydrating puts the one look on the document', () => {
    const onRehydrate = useThemeStore.persist.getOptions().onRehydrateStorage;
    const apply = onRehydrate?.(useThemeStore.getState());

    apply?.({ ...useThemeStore.getState(), theme: 'light' });

    expect(document.documentElement.dataset.theme).toBe('clinozy-zinc-pastel');
  });
});
