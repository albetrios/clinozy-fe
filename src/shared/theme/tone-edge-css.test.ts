import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TONE_VALUES } from '@/shared/api/app/app-schema.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(join(root, 'src/index.css'), 'utf8');
/** The inline theme without whitespace — Prettier wraps a long `color-mix()`. */
const inlineTheme = css.slice(css.indexOf('@theme inline {')).replaceAll(/\s/g, '');

describe('the picked-badge edge tokens', () => {
  it('derives every tone’s edge from its own ink and dot, in the inline theme', () => {
    for (const tone of TONE_VALUES.filter((value) => value !== 'stone')) {
      expect(inlineTheme).toContain(
        `--color-tone-${tone}-edge:color-mix(inoklab,var(--color-tone-${tone}-foreground)var(--tone-edge-ink),var(--color-tone-${tone}-dot));`,
      );
    }
    expect(inlineTheme).toContain(
      '--color-tone-stone-edge:color-mix(inoklab,var(--color-foreground-soft)55%,var(--color-border-strong));',
    );
  });

  it('mixes less ink into the edge in dark mode, so it never reads as a white line', () => {
    expect(css).toMatch(/:root \{\s*--tone-edge-ink: 45%;\s*\}/);
    expect(css).toMatch(/\.dark \{\s*--tone-edge-ink: 15%;/);
  });
});
