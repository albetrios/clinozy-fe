import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TONE_VALUES } from '@/shared/api/app/app-schema.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(join(root, 'src/index.css'), 'utf8');
/** The stylesheet without whitespace — Prettier wraps a long `color-mix()`. */
const flat = css.replaceAll(/\s/g, '');
const theme = flat.slice(flat.indexOf('@theme{'), flat.indexOf('@themeinline{'));

describe('the picked-badge edge tokens', () => {
  it('derives every tone’s edge from its own ink and dot — declared once, in the theme', () => {
    for (const tone of TONE_VALUES.filter((value) => value !== 'stone')) {
      expect(theme).toContain(
        `--color-tone-${tone}-edge:color-mix(inoklab,var(--color-tone-${tone}-foreground)var(--tone-edge-ink),var(--color-tone-${tone}-dot));`,
      );
    }
    expect(theme).toContain(
      '--color-tone-stone-edge:color-mix(inoklab,var(--color-foreground-soft)55%,var(--color-border-strong));',
    );
  });

  it('mixes less ink into the edge in dark mode, so it never reads as a white line', () => {
    expect(css).toMatch(/:root \{\s*--tone-edge-ink: 45%;\s*\}/);
    expect(css).toMatch(/\.dark \{\s*--tone-edge-ink: 15%;/);
  });
});
