import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RTL_LOCALES } from '@/lib/i18n/locales.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('locale-init.js drift', () => {
  const source = readFileSync(join(root, 'public/locale-init.js'), 'utf8');

  it('reads the same persist key as useLocaleStore', () => {
    expect(source).toContain("localStorage.getItem('locale-preference')");
  });

  it('mirrors RTL_LOCALES for the FOUC path', () => {
    for (const locale of RTL_LOCALES) {
      expect(source).toMatch(new RegExp(`${locale}\\s*:\\s*true`));
    }
  });
});

describe('theme-init.js drift', () => {
  const source = readFileSync(join(root, 'public/theme-init.js'), 'utf8');

  it('reads the same persist key as useThemeStore', () => {
    expect(source).toContain("localStorage.getItem('theme-preference')");
  });

  it('puts the one look on <html> before anything can throw', () => {
    // Before the `try`: a storage error must not cost the page its look.
    const look = source.indexOf("root.dataset.theme = 'clinozy-zinc-pastel'");
    expect(look).toBeGreaterThan(-1);
    expect(look).toBeLessThan(source.indexOf('try {'));
  });

  it('writes no inline custom property — none can pin a colour to the boot mode', () => {
    // An inline token outranks `:root` and `.dark`: one left behind turned a
    // later mode switch into a half-dark page that only a reload repaired.
    expect(source).not.toMatch(/style\.setProperty\(/);
  });
});

describe('boot splash shape drift (index.html ↔ AppSplashSlot ↔ BrandLoader)', () => {
  // Under the Sharp shape nothing in the app is round, and the splash is the
  // first thing on screen. The files have to agree or the loader changes shape
  // half way through the boot: index.css squares the `pill` slots — the
  // progress track and bar the React slot renders inside the splash, and
  // BrandLoader's, which takes over from it.
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const css = readFileSync(join(root, 'src/index.css'), 'utf8');
  const loader = readFileSync(
    join(root, 'src/shared/components/BrandLoader/BrandLoader.tsx'),
    'utf8',
  );
  const slot = readFileSync(
    join(root, 'src/shared/components/AppSplashSlot/AppSplashSlot.tsx'),
    'utf8',
  );

  it('the splash’s progress track and bar are pills, squared by index.css', () => {
    for (const part of ['app-splash-track', 'app-splash-bar']) {
      expect(slot).toMatch(new RegExp(`className="${part}[^"]*"\\s+data-slot="pill"`));
    }
    // No Sharp override of its own: one rule (index.css) squares every pill.
    expect(html).not.toContain("[data-shape='sharp']");
  });

  it('draws the same fixed-corner product mark in the HTML splash and the React loader', () => {
    // The mark is a brand asset (L-59): it keeps its corner under every shape,
    // in the HTML splash and in ProductMark alike, so the handoff never changes it.
    const mark = readFileSync(
      join(root, 'src/shared/components/ProductMark/ProductMark.tsx'),
      'utf8',
    );
    for (const source of [html, mark]) {
      expect(source).toContain('rx="8"');
      expect(source).toContain('M18.6 9.1a6.4 6.4 0 1 0 0 9.8');
    }
    expect(html).not.toContain("html[data-shape='sharp'] .app-splash-mark");
  });

  it('index.css squares the matching React slots', () => {
    // The Sharp rule lists its slots inside `:is( … )` (one prefix for the whole
    // list), so read the list rather than looking for a long-hand selector.
    // `\s*`: Prettier decides whether `:is(` stays on the prefix's line.
    const start = css.search(/\[data-shape='sharp'\]\s*:is\(/);
    expect(start).toBeGreaterThan(-1);
    const sharpSlots = css.slice(start, css.indexOf('{', start));

    expect(sharpSlots).toContain("[data-slot='icon-chip']");
    expect(sharpSlots).toContain("[data-slot='pill']");
  });

  it('BrandLoader renders the product mark and its track through the pill slots', () => {
    expect(loader).toContain('<ProductMark');
    expect(loader.match(/data-slot="pill"/g)).toHaveLength(2);
  });
});
