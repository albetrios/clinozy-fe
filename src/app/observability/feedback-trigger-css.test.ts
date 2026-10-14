import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The "Report a bug" trigger (`shared/components/BugReport`, our own since iteration
 * feat-bug-report-2026-10-13-dgnx, in place of Sentry's injected widget) shares the bottom-end
 * corner with the consent card, a floating "New" and the upload tray. Which one wins is decided by
 * `:has()` rules in `index.css`, which jsdom cannot evaluate — hence a read of the source, the same
 * approach `theme/radius-shape-css.test.ts` takes.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(join(root, 'src/index.css'), 'utf8');

/** The stylesheet with comments stripped, so a rule quoted in prose can't pass. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('Report a bug trigger placement', () => {
  it('is steered from index.css at all', () => {
    expect(rules).toContain("[data-slot='feedback-trigger']");
  });

  // The trigger is pinned above everything a modal dims, so it sat lit up over
  // Settings, over a confirm dialog and over the invite form at every width
  // (QA-V3 suggestion 9).
  it('is hidden while a modal dialog is open', () => {
    const hidden =
      /:root:has\([^)]*\[data-slot='dialog-overlay'\][\s\S]{0,160}\[data-slot='feedback-trigger'\]\s*\{\s*display:\s*none/.test(
        rules,
      );
    expect(hidden).toBe(true);
  });

  // Keyed on the OVERLAY, which is what marks a surface modal: a popover or a
  // menu has no scrim and leaves the page interactive, so nothing is being
  // interrupted there and the trigger must survive.
  it('keys on the overlay, not the content, so non-modal panels keep it', () => {
    // Every block that hides the trigger — there is more than one (the consent
    // card claims the same corner below `sm`), so this asserts across all of
    // them rather than picking one and hoping it is the modal rule.
    const hidingBlocks = rules
      .split('}')
      .filter(
        (block) =>
          block.includes("[data-slot='feedback-trigger']") && block.includes('display'),
      );
    expect(hidingBlocks.length).toBeGreaterThan(0);
    expect(hidingBlocks.some((block) => block.includes('dialog-overlay'))).toBe(true);
    expect(hidingBlocks.every((block) => !block.includes('dialog-content'))).toBe(true);
  });

  // A floating "New" (the clinic rooms' phone primary) owns the same bottom
  // inline-end corner, so the trigger steps aside below `md` while one shows.
  it('steps aside on a phone while a floating "New" is mounted', () => {
    expect(rules).toMatch(
      /@media \(max-width: 47\.9375rem\) \{\s*:root:has\(\[data-slot='fab'\]\) \[data-slot='feedback-trigger'\]\s*\{\s*display:\s*none/,
    );
  });

  // The upload tray sits in the bottom inline-end corner at every width while files are
  // moving; the trigger (z 100000) would otherwise cover the tray's last row.
  it('steps aside at every width while the upload tray shows', () => {
    const outsideMedia = rules.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
    expect(outsideMedia).toMatch(
      /:root:has\(\s*\[data-slot='upload-tray'\][\s\S]{0,200}\[data-slot='feedback-trigger'\]\s*\{\s*display:\s*none/,
    );
  });

  // Pre-existing contract, asserted here so the rules above cannot be "fixed"
  // by deleting the block they share: the mobile tab bar publishes its height
  // and the trigger lifts clear of it.
  it('still lifts clear of the mobile tab bar', () => {
    expect(rules).toContain('--floating-bottom-offset');
    expect(rules).toMatch(
      /\[data-slot='feedback-trigger'\]\s*\{[^}]*bottom:[^}]*--floating-bottom-offset/,
    );
  });
});
