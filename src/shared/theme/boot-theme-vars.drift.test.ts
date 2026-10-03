import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';

import { afterEach, describe, expect, it } from 'vitest';

import {
  applyGeneratedTheme,
  applyThemePreset,
  BASE_PRESET,
  BOOT_SPLASH_VARS,
  DEFAULT_PRESET,
  generateSeededTheme,
  releaseBootThemeVars,
  THEME_PRESETS,
} from './presets.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** A value no stylesheet would ever produce: if it survives, that var is stuck. */
const BOOT_SENTINEL = 'oklch(0.123 0.456 78)';

/**
 * Every custom property `public/theme-init.js` can leave inline on `<html>` —
 * the ones it names literally, plus the snapshot keys it replays verbatim.
 */
function bootWrittenVars(): string[] {
  const source = readFileSync(join(repoRoot, 'public/theme-init.js'), 'utf8');
  const literal = [...source.matchAll(/setProperty\(\s*'(--[\w-]+)'/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
  return [...new Set([...literal, ...BOOT_SPLASH_VARS])];
}

/**
 * The boot script paints the splash from an INLINE palette on `<html>`, resolved
 * for the mode the document loaded in. An inline custom property outranks both
 * `:root` and `.dark`, so any one still there after the bundle takes over pins
 * its token to the boot mode for the life of the document — a later light/dark
 * switch then moves only the tokens the app owns and the page comes out half
 * dark, repaired only by a reload.
 *
 * So every var the boot script can write has to be either released by
 * {@link releaseBootThemeVars} or re-asserted by the look the caller applies
 * immediately after. Adding one to {@link BOOT_SPLASH_VARS} and to neither is
 * what this pins.
 */
describe('boot palette hand-off (theme-init.js ↔ shared/theme)', () => {
  afterEach(() => {
    const root = document.documentElement;
    for (const name of bootWrittenVars()) root.style.removeProperty(name);
    root.classList.remove('dark');
    delete root.dataset.theme;
  });

  it('accounts for the mode-specific palette the splash paints from', () => {
    expect(bootWrittenVars()).toEqual(
      expect.arrayContaining([
        '--color-background',
        '--color-foreground',
        '--color-muted',
      ]),
    );
  });

  const lookPaths = [
    ['named preset', () => applyThemePreset(DEFAULT_PRESET)],
    ['generated look', () => applyGeneratedTheme(generateSeededTheme(4242))],
  ] as const;

  for (const [label, applyLook] of lookPaths) {
    it(`leaves nothing the boot script wrote pinned to the boot mode (${label})`, () => {
      const root = document.documentElement;
      const written = bootWrittenVars();
      for (const name of written) root.style.setProperty(name, BOOT_SENTINEL);

      releaseBootThemeVars();
      applyLook();

      const pinned = written.filter(
        (name) => root.style.getPropertyValue(name) === BOOT_SENTINEL,
      );
      expect(pinned).toEqual([]);
    });
  }
});

/** The value of `name` inside the first `selector { … }` block of index.css. */
function cssToken(css: string, selector: string, name: string): string | undefined {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return undefined;
  const body = css.slice(start, css.indexOf('}', start));
  return new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1]?.trim();
}

/**
 * Run `public/theme-init.js` the way the browser does — before any bundle —
 * against a stored preference, and report what it left on `<html>`.
 */
function runThemeInit(stored: unknown) {
  const root = document.documentElement;
  if (stored === undefined) localStorage.removeItem('theme-preference');
  else localStorage.setItem('theme-preference', JSON.stringify(stored));
  const source = readFileSync(join(repoRoot, 'public/theme-init.js'), 'utf8');
  // As a classic <script> would: in this realm, against jsdom's globals.
  // eslint-disable-next-line sonarjs/code-eval -- the repo's own pre-paint script, under test
  runInThisContext(source, { filename: 'public/theme-init.js' });
  return {
    theme: root.dataset.theme,
    dark: root.classList.contains('dark'),
    primary: root.style.getPropertyValue('--color-primary'),
    primaryForeground: root.style.getPropertyValue('--color-primary-foreground'),
  };
}

describe('pre-paint preset (theme-init.js ↔ index.css ↔ presets.ts)', () => {
  const css = readFileSync(join(repoRoot, 'src/index.css'), 'utf8');

  afterEach(() => {
    const root = document.documentElement;
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-primary-foreground');
    root.classList.remove('dark');
    delete root.dataset.theme;
    localStorage.removeItem('theme-preference');
  });

  for (const { id } of THEME_PRESETS.filter((preset) => preset.id !== BASE_PRESET)) {
    for (const mode of ['light', 'dark'] as const) {
      it(`paints ${id} (${mode}) with the primary its index.css block declares`, () => {
        const painted = runThemeInit({ state: { theme: mode, preset: id }, version: 4 });
        const selector =
          mode === 'dark' ? `.dark[data-theme='${id}']` : `[data-theme='${id}']`;

        expect(painted.theme).toBe(id);
        expect(painted.primary).toBe(cssToken(css, selector, '--color-primary'));
        expect(painted.primaryForeground).toBe(
          cssToken(css, selector, '--color-primary-foreground'),
        );
      });
    }
  }

  it('a first visit paints the default preset in light — no flash to the base palette', () => {
    const painted = runThemeInit(undefined);
    expect(painted.theme).toBe(DEFAULT_PRESET);
    expect(painted.dark).toBe(false);
  });

  it('mirrors the v4 migration: a pre-v4 base palette was never picked', () => {
    expect(runThemeInit({ state: { preset: BASE_PRESET }, version: 3 }).theme).toBe(
      DEFAULT_PRESET,
    );
  });

  it('keeps a base palette picked on v4 attribute-free', () => {
    expect(
      runThemeInit({ state: { preset: BASE_PRESET }, version: 4 }).theme,
    ).toBeUndefined();
  });
});
