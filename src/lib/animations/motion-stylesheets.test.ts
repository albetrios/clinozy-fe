import { readdirSync, readFileSync } from 'node:fs';
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

  it('names the three curves on :root — strong ease-out, strong ease-in-out, sheet', () => {
    expect(index).toContain('--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);');
    expect(index).toContain('--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);');
    expect(index).toContain('--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);');
  });

  it("points Tailwind's own easings and the default transition curve at the strong curves", () => {
    expect(index).toContain('--ease-out: var(--ease-out-strong);');
    expect(index).toContain('--ease-in-out: var(--ease-in-out-strong);');
    expect(index).toContain(
      '--default-transition-timing-function: var(--ease-out-strong);',
    );
  });

  it('spells each curve once — the route-progress sweep is the only other literal', () => {
    expect(index.match(/cubic-bezier\(/g)).toHaveLength(4);
    expect(index).toContain('route-progress 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite');
    for (const animation of [
      'drawer-in 340ms',
      'backdrop-in 340ms',
      'bulk-in 220ms',
      'sheet-up 260ms',
    ]) {
      expect(index).toContain(`${animation} var(--ease-sheet) both`);
    }
    for (const animation of [
      'accordion-down 0.2s',
      'fade-in 0.2s',
      'route-rise 0.28s',
      'dropdown-in 160ms',
      'dropdown-up 160ms',
      'reveal 240ms',
      'fade-in 150ms',
    ]) {
      expect(index).toContain(`${animation} var(--ease-out-strong)`);
    }
  });

  it('glides the phone lens like every glide: 240ms on the strong ease-in-out', () => {
    expect(index).toContain('transition: 240ms var(--ease-in-out-strong);');
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

describe('the selection glide (selection-glide.css)', () => {
  const rules = read('src/shared/components/SelectionGlide/selection-glide.css');

  it('travels on the strong ease-in-out, 240ms — size with it', () => {
    for (const property of ['translate', 'width', 'height']) {
      expect(rules).toContain(`${property} 240ms var(--ease-in-out-strong)`);
    }
  });

  it("darkens the selected label on the thumb's own curve, so the two arrive together", () => {
    expect(rules).toContain('transition: color 240ms var(--ease-in-out-strong);');
  });
});

describe('the Payment received moment (feat-payment-celebration)', () => {
  const folder = 'src/shared/components/PaymentReceived';
  const rules = read(`${folder}/payment-received.css`);
  const animation = JSON.parse(
    readFileSync(join(root, `${folder}/payment-received.lottie.json`), 'utf8'),
  ) as { fr: number; ip: number; op: number; layers: { cl?: string }[] };

  it('paints from tokens, sizes on the Density axis, ships with the view, and moves nothing itself', () => {
    expect(readFileSync(join(root, `${folder}/PaymentReceived.tsx`), 'utf8')).toContain(
      "import './payment-received.css';",
    );
    expect(rules).not.toContain('@keyframes');
    const declarations = rules
      .split(/[;{}]/)
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration.includes(':'));
    expect(declarations.length).toBeGreaterThan(0);
    for (const declaration of declarations) {
      const [property, value] = declaration.split(':').map((part) => part.trim());
      // The view's own square (the initial-CSS budget keeps it off the first paint's stylesheet).
      if (property === 'width' || property === 'height') {
        expect(value).toMatch(/^calc\(var\(--spacing\) \* \d+\)$/);
        continue;
      }
      expect(property).toMatch(/^(fill|stroke|color)$/);
      expect(value).toMatch(/^var\(--color-[\w-]+\)$/);
    }
    expect(read('src/index.css')).not.toContain('payment-received');
  });

  it('plays under a second and names every layer the stylesheet paints', () => {
    expect((animation.op - animation.ip) / animation.fr).toBeLessThan(1);
    const classes = animation.layers.flatMap((layer) => layer.cl?.split(' ') ?? []);
    for (const [, name] of rules.matchAll(/\.(pr-[\w-]+) path/g)) {
      expect(classes).toContain(name);
    }
  });

  it('carries no expressions — the light player runs none, and CSP allows no eval', () => {
    const expressions: unknown[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          if (key === 'x' && typeof inner === 'string') expressions.push(inner);
          walk(inner);
        }
      }
    };
    walk(animation);
    expect(expressions).toEqual([]);
  });
});

describe('the app source', () => {
  const files = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return files(path);
      return /\.(css|tsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  const sources = files('src').filter(
    (path) => path !== 'src/index.css' && path !== 'src/lib/animations/motion-curves.ts',
  );

  it('writes no curve of its own — it names one of the three', () => {
    const literal = sources.filter((path) => read(path).includes('cubic-bezier('));
    expect(literal).toEqual([]);
  });

  it('never transitions `all`', () => {
    const all = sources.filter((path) =>
      /\btransition-all\b|transition:\s*all\b/.test(read(path)),
    );
    expect(all).toEqual([]);
  });
});

describe.each(STYLESHEETS)('$css', ({ css, importer, declares }) => {
  const rules = read(css);

  it('ships with the component that uses it', () => {
    const file = css.split('/').at(-1);
    expect(readFileSync(join(root, importer), 'utf8')).toContain(`import './${file}';`);
  });

  it('moves on the three named curves only (colour fades may ease)', () => {
    expect(rules).not.toMatch(/cubic-bezier\(/);
    const curves = [...rules.matchAll(/\b(\d+)ms\s+(var\(--[\w-]+\)|[\w-]+)/g)].map(
      (match) => match[2],
    );
    for (const curve of curves) {
      expect([
        'var(--ease-out-strong)',
        'var(--ease-in-out-strong)',
        'var(--ease-sheet)',
        'ease',
        'both',
      ]).toContain(curve);
    }
  });

  it('under reduced motion, keeps only fades — opacity or colour, 160ms', () => {
    const at = rules.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(at).toBeGreaterThan(-1);
    const block = rules.slice(at);
    expect(block).toContain('160ms');
    expect(block).not.toMatch(/\b(translate|scale):/);
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
