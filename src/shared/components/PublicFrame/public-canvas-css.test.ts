import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The signed-out canvas's motion and palette, read from the source: jsdom runs no animation
 * and resolves no cascade, so the rules are pinned as text, as `upload-tray-css.test.ts` does.
 *
 * Motion: the orb's spectrum turned by animating a registered `@property` angle inside its
 * conic gradient, which repainted it on the main thread every frame; the aurora drifted
 * forever, which kept the compositor drawing a frame every vsync on an idle sign-in screen.
 * Palette: the four pastels the boot frame never reads live here, off the first paint.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (path: string) =>
  readFileSync(join(root, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const canvas = read('src/shared/components/PublicFrame/public-canvas.css');
const index = read('src/index.css');
const bootFrame = readFileSync(join(root, 'index.html'), 'utf8');

/**
 * The declarations of the first rule whose selector list is exactly `selector` — a rule at the
 * file's start or right after another rule's `}` (a plain scan, no pattern built from input).
 */
function ruleBody(css: string, selector: string): string {
  for (let open = css.indexOf('{'); open !== -1; open = css.indexOf('{', open + 1)) {
    const prelude = css.slice(css.lastIndexOf('}', open) + 1, open);
    if (!prelude.includes('{') && prelude.trim() === selector) {
      return css.slice(open + 1, css.indexOf('}', open));
    }
  }
  throw new Error(`no rule for ${selector}`);
}

/** The body of `@keyframes name`, its nested braces included. */
function keyframes(css: string, name: string): string {
  const start = css.indexOf(`@keyframes ${name}`);
  if (start === -1) throw new Error(`no @keyframes ${name}`);
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(start, index + 1);
  }
  throw new Error(`unclosed @keyframes ${name}`);
}

const ONLY_HERE = ['--pastel-sky', '--pastel-mint', '--pastel-butter', '--pastel-rose'];
const BOOT_FRAME = ['--public-canvas-base', '--pastel-lavender', '--pastel-peach'];

describe('public-canvas.css — motion the compositor runs, and rests', () => {
  it('animates no custom property: nothing repaints a gradient every frame', () => {
    expect(canvas).not.toMatch(/@property/);
    const names = [...canvas.matchAll(/@keyframes ([\w-]+)/g)].map(([, name]) => name);
    expect(names).toContain('agent-orb-spin');
    for (const name of names) {
      const declarations = keyframes(canvas, name ?? '')
        .split(/[;{}]/)
        .map((part) => part.trim());
      expect(
        declarations.filter((part) => part.startsWith('--')),
        name,
      ).toEqual([]);
    }
  });

  it('turns the orb’s spectrum as a transform of a still conic layer', () => {
    expect(ruleBody(canvas, '.agent-orb')).not.toMatch(/conic-gradient/);
    const spectrum = ruleBody(canvas, '.agent-orb::before');
    expect(spectrum).toMatch(/conic-gradient\(\s*var\(--pastel-lavender\)/);
    expect(spectrum).toMatch(/animation:\s*agent-orb-spin\s/);
    expect(keyframes(canvas, 'agent-orb-spin')).toMatch(/transform:\s*rotate\(1turn\)/);
  });

  it('drifts the aurora one pass and holds where it lands — never forever', () => {
    const blob = ruleBody(canvas, '.public-aurora-blob');
    expect(blob).toMatch(/animation:\s*public-aurora-drift\s[^;]*\bforwards\b/);
    expect(canvas).not.toMatch(/public-aurora-drift[^;]*infinite/);
  });

  it('holds the aurora, the orb and its spectrum still under reduced motion', () => {
    const media = canvas.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(media).toBeGreaterThan(-1);
    const reduced = canvas.slice(media, canvas.indexOf('animation: none', media));
    for (const selector of ['.public-aurora-blob', '.agent-orb,', '.agent-orb::before']) {
      expect(reduced).toContain(selector);
    }
  });
});

describe('the pastel palette — the boot frame’s three in index.css, the rest here', () => {
  it.each(ONLY_HERE)(
    '%s is set in light and dark here, and not in index.css',
    (token) => {
      expect(ruleBody(canvas, ':root')).toContain(`${token}:`);
      expect(ruleBody(canvas, '.dark')).toContain(`${token}:`);
      expect(index).not.toContain(`${token}:`);
      expect(bootFrame).not.toContain(token);
    },
  );

  it.each(BOOT_FRAME)('%s, which index.html paints, stays in index.css', (token) => {
    expect(index).toContain(`${token}:`);
    expect(canvas).not.toContain(`${token}:`);
  });
});
