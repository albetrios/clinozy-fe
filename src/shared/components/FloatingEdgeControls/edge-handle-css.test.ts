import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The Appearance handle steps aside while a modal surface is open. jsdom does not
 * evaluate `index.css`, so — as `feedback-trigger-css.test.ts` does for the Sentry
 * trigger — the contract is read from the stylesheet source, comments stripped so
 * a rule quoted in prose cannot pass.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const rules = readFileSync(join(root, 'src/index.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Every rule block that hides the handle. */
const handleBlocks = rules
  .split('}')
  .filter(
    (block) =>
      block.includes("[data-slot='floating-edge-controls']") &&
      /display:\s*none/.test(block),
  );

describe('Appearance handle placement', () => {
  it('is hidden by the stylesheet at all', () => {
    expect(handleBlocks.length).toBeGreaterThan(0);
  });

  // The handle sits mid-height on the inline-end edge — over a drawer's body and
  // its footer ("Next: Items →" at 1440). Every modal surface marks itself with
  // its overlay's slot: dialogs, confirms, side drawers (sheets) and the phone
  // sheets (vaul drawers).
  it.each(['dialog-overlay', 'alert-dialog-overlay', 'sheet-overlay', 'drawer-overlay'])(
    'steps aside while a %s is mounted',
    (slot) => {
      expect(handleBlocks.some((block) => block.includes(`[data-slot='${slot}']`))).toBe(
        true,
      );
    },
  );

  // Keyed on the overlay, never the content: the non-modal Appearance panel has no
  // scrim, and the record drawer's own floating × shares the `floating-edge` slot —
  // so the rule targets the handle's container slot alone.
  it('keys on overlays and the handle container only', () => {
    for (const block of handleBlocks) {
      expect(block).not.toMatch(/-content'\]/);
      expect(block).not.toContain("[data-slot='floating-edge']");
    }
  });
});
