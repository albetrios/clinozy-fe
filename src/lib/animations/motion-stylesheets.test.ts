import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The motion of change-motion-polish is a stylesheet contract (its `BRIEF.md`
 * › Rules): two named curves, every element under 300ms, and only transform,
 * opacity, a short blur, colours — and the one glide thumb's box — animate.
 * jsdom runs no animation, so — like `bottom-stack-css.test.ts` — this reads
 * the sources, comments stripped so a rule quoted in prose cannot pass.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Each motion stylesheet and the component that imports it — the lazy chunk it ships with. */
const STYLESHEETS = [
  {
    css: 'src/shared/components/SelectionGlide/selection-glide.css',
    importer: 'src/shared/components/SelectionGlide/SelectionGlide.tsx',
    declares: true,
  },
  {
    css: 'src/shared/components/RollingNumber/rolling-number.css',
    importer: 'src/shared/components/RollingNumber/RollingNumber.tsx',
    declares: true,
  },
  {
    css: 'src/pages/organization/$organizationSlug/today/components/LanePanel/lane-panel.css',
    importer:
      'src/pages/organization/$organizationSlug/today/components/LanePanel/LanePanel.tsx',
    declares: true,
  },
  {
    css: 'src/shared/components/ui/checkbox.css',
    importer: 'src/shared/components/ui/checkbox.tsx',
    declares: true,
  },
  {
    css: 'src/shared/components/ui/switch.css',
    importer: 'src/shared/components/ui/switch.tsx',
    // Times the thumb's utility transition; declares none of its own.
    declares: false,
  },
] as const;

/** What may animate: transform's longhands, opacity, the blur, colours and the thumb's box. */
const ANIMATABLE = new Set([
  'translate',
  'scale',
  'opacity',
  'filter',
  'background-color',
  'border-color',
  'color',
  'width',
  'height',
]);

describe('the motion curves (src/index.css)', () => {
  const index = read('src/index.css');

  it('names the sheet curve and the strong ease-out on :root', () => {
    expect(index).toContain('--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);');
    expect(index).toContain('--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);');
  });

  it('spells the sheet curve once — its users read the name', () => {
    expect(index.match(/cubic-bezier\(0\.32, 0\.72, 0, 1\)/g)).toHaveLength(1);
    for (const animation of [
      'drawer-in 340ms',
      'backdrop-in 340ms',
      'bulk-in 220ms',
      'sheet-up 260ms',
    ]) {
      expect(index).toContain(`${animation} var(--ease-sheet) both`);
    }
  });

  it('keeps the new motion out of the first-paint stylesheet', () => {
    for (const name of [
      'selection-glide',
      'rolling-number',
      'lane-card-rise',
      'checkbox-tick',
    ]) {
      expect(index).not.toContain(name);
    }
  });
});

describe.each(STYLESHEETS)('$css', ({ css, importer, declares }) => {
  const rules = read(css);

  it('ships with the component that uses it', () => {
    const file = css.split('/').at(-1);
    expect(readFileSync(join(root, importer), 'utf8')).toContain(`import './${file}';`);
  });

  it('moves on the two named curves only (colour fades may ease)', () => {
    expect(rules).not.toMatch(/cubic-bezier\(/);
    const curves = [...rules.matchAll(/\b(\d+)ms\s+(var\(--[\w-]+\)|[\w-]+)/g)].map(
      (match) => match[2],
    );
    for (const curve of curves) {
      expect(['var(--ease-sheet)', 'var(--ease-out-strong)', 'ease', 'both']).toContain(
        curve,
      );
    }
  });

  it('keeps every element under 300ms', () => {
    for (const [, duration] of rules.matchAll(/\b(\d+)ms\b/g)) {
      expect(Number(duration)).toBeLessThan(300);
    }
  });

  it('animates only transform longhands, opacity, a blur, colours and the thumb box', () => {
    const declarations = (text: string) =>
      text
        .split(/[;{}]/)
        .map((declaration) => declaration.trim())
        .filter((declaration) => declaration.includes(':'));
    const transitioned = declarations(rules)
      .filter((declaration) => declaration.startsWith('transition:'))
      .flatMap((declaration) =>
        declaration
          .slice('transition:'.length)
          .split(',')
          .map((entry) => entry.trim().split(' ')[0] ?? ''),
      );
    const keyframed = rules
      .split('@keyframes')
      .slice(1)
      .flatMap((block) => declarations(block.slice(0, block.indexOf('\n}'))))
      .map((declaration) => declaration.slice(0, declaration.indexOf(':')).trim());
    expect(transitioned.length + keyframed.length > 0).toBe(declares);
    for (const property of [...transitioned, ...keyframed]) {
      expect(ANIMATABLE).toContain(property);
    }
    expect(rules).not.toMatch(/transition:\s*all\b/);
  });
});
