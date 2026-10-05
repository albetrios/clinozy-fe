import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Keyboard hints ("⌘K" in the header search, the command palette's keys, the
 * bulk bar's "Esc") keep their glyph order under `dir="rtl"`: the base layer
 * isolates every `kbd` as left to right. jsdom runs no bidi layout, so — like
 * `bottom-stack-css.test.ts` — this reads the source, comments stripped.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const rules = readFileSync(join(root, 'src/index.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ');

describe('kbd direction (RTL)', () => {
  it('isolates every keyboard hint as left to right', () => {
    const start = rules.indexOf(' kbd {');
    expect(start, 'a kbd rule in the stylesheet').toBeGreaterThan(-1);
    const body = rules.slice(rules.indexOf('{', start) + 1, rules.indexOf('}', start));
    expect(body).toContain('direction: ltr;');
    expect(body).toContain('unicode-bidi: isolate;');
  });
});
