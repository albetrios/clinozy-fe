import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The drawer's own sizes live in `prescription-drawer.css`, which loads with the
 * drawer instead of the first paint (fix-prescription-css-budget D4). jsdom
 * matches no `pointer: coarse` query and computes no layout, so — like
 * `SkeletonRows/skeleton-in-place-css.test.ts` — this reads the source, comments
 * stripped so a rule quoted in prose cannot pass.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'prescription-drawer.css'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ');

/** The body of the first block that opens with `head {`, braces balanced. */
function block(source: string, head: string): string {
  const start = source.indexOf(`${head} {`);
  expect(start, `${head} in the stylesheet`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let at = open; at < source.length; at += 1) {
    if (source[at] === '{') depth += 1;
    if (source[at] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, at);
  }
  throw new Error(`${head} is not closed`);
}

const coarse = block(css, '@media (pointer: coarse)');
const outside = css.replace(block(css, '@media (pointer: coarse)'), '');
const ELEVEN = 'calc(var(--spacing) * 11)';

describe('prescription-drawer.css', () => {
  it('sets the line tracks with a mouse and on touch', () => {
    const mouse = block(outside, '.rx-tracks');
    expect(mouse).toContain('--rx-dose-track: 128px');
    expect(mouse).toContain('--rx-days-track: 200px');
    expect(mouse).toContain('--rx-directions-track: 170px');
    expect(mouse).toContain('--rx-qty-track: 88px');
    const touch = block(coarse, '.rx-tracks');
    expect(touch).toContain('--rx-dose-track: 176px');
    expect(touch).toContain('--rx-days-track: 284px');
    expect(touch).toContain('--rx-directions-track: 212px');
    expect(touch).toContain('--rx-qty-track: 120px');
  });

  it('makes the segments, the medicine picker and the note 44px on touch', () => {
    expect(block(coarse, '.rx-segment')).toContain(`height: ${ELEVEN}`);
    expect(block(coarse, '.rx-medicine-trigger')).toContain(`min-height: ${ELEVEN}`);
    expect(block(coarse, '.rx-note-input')).toContain(`height: ${ELEVEN}`);
  });

  it('keeps every touch size inside the coarse-pointer query', () => {
    for (const selector of [
      '.rx-medicine-trigger',
      '.rx-note-input',
      '.rx-small-action',
    ]) {
      expect(outside).not.toContain(`${selector} {`);
    }
  });
});
