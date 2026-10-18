import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The upload tray is fixed at z 95 in the bottom inline-end corner — where every drawer and
 * dialog puts its footer. A pending or failed upload sat over "Save" and took its clicks,
 * expanded or collapsed (QA PAT-01). While a modal is open, a `:has()` rule in `index.css`
 * drops the tray beneath the modal layer; jsdom cannot evaluate `:has()` or stacking, so the
 * rule is read from the source, as `feedback-trigger-css.test.ts` does for the bug trigger.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const css = readFileSync(join(root, 'src/index.css'), 'utf8');
const sheet = readFileSync(join(root, 'src/shared/components/ui/sheet.tsx'), 'utf8');
const tray = readFileSync(
  join(root, 'src/shared/components/UploadTray/UploadTray.tsx'),
  'utf8',
);

/** The stylesheet with comments stripped, so a rule quoted in prose can't pass. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every overlay that marks a surface modal — the four the bug trigger also steps aside for. */
const MODAL_OVERLAYS = [
  'dialog-overlay',
  'alert-dialog-overlay',
  'sheet-overlay',
  'drawer-overlay',
] as const;

/** The block that restacks the tray: its selector and its declarations. */
function trayUnderModalRule(): { selector: string; body: string } {
  const match = /(:root:has\([^{]*\)\s*\[data-slot='upload-tray'\])\s*\{([^}]*)\}/.exec(
    rules,
  );
  if (!match?.[1] || match[2] === undefined)
    throw new Error('no upload-tray :has() rule');
  return { selector: match[1], body: match[2] };
}

/** A Tailwind `z-50` / `z-[95]` class's number. */
function zIndexOf(source: string, pattern: RegExp): number {
  const value = pattern.exec(source)?.[1];
  if (value === undefined) throw new Error(`no z-index matching ${pattern}`);
  return Number(value);
}

describe('upload tray stacking under a modal', () => {
  it('drops beneath every modal overlay while one is open', () => {
    const { selector } = trayUnderModalRule();
    for (const overlay of MODAL_OVERLAYS) {
      expect(selector).toContain(`[data-slot='${overlay}']`);
    }
  });

  // The footer is reachable only if the tray ends up under the modal's own layer: the scrim
  // and the panel (sheet, drawer, dialog) are z 50, the tray's resting place is z 95.
  it('stacks below the modal layer, which stacks below the tray at rest', () => {
    const restacked = Number(/z-index:\s*(\d+)/.exec(trayUnderModalRule().body)?.[1]);
    const modalLayer = zIndexOf(sheet, /fixed inset-0 z-(\d+)/);
    const atRest = zIndexOf(tray, /fixed end-5 z-\[(\d+)\]/);
    expect(atRest).toBeGreaterThan(modalLayer);
    expect(restacked).toBeLessThan(modalLayer);
  });

  // Tailwind's utilities sit in `@layer utilities`; only an unlayered rule outranks `z-[95]`
  // whatever its specificity, so the rule must not move into a layer.
  it('is unlayered, so it outranks the z-[95] utility', () => {
    const start = rules.indexOf(trayUnderModalRule().selector);
    const opened = (rules.slice(0, start).match(/\{/g) ?? []).length;
    const closed = (rules.slice(0, start).match(/\}/g) ?? []).length;
    expect(opened - closed).toBe(0);
  });

  // Keyed on the overlay, not the content: a popover or a menu has no scrim and leaves the
  // page live, so the tray stays on top of it.
  it('keys on the overlay, not on non-modal content', () => {
    const { selector } = trayUnderModalRule();
    expect(selector).not.toMatch(/-content'\]/);
    expect(selector).not.toContain('popover');
  });
});
