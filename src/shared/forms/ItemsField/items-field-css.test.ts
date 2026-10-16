import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The quantity stepper's 44px on touch lives in `items-field.css`, loaded with
 * the items table (fix-prescription-css-budget D5). jsdom matches no
 * `pointer: coarse` query, so this reads the source, comments stripped.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'items-field.css'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ');

describe('items-field.css', () => {
  it('grows only a stepper whose row asks, and only on a coarse pointer', () => {
    expect(css.trim().startsWith('@media (pointer: coarse) {')).toBe(true);
    expect(css).toContain(
      ".items-stepper[data-touch-size='large'] { height: calc(var(--spacing) * 11); }",
    );
    expect(css).toContain(
      ".items-stepper[data-touch-size='large'] > button { width: calc(var(--spacing) * 11); }",
    );
  });
});
