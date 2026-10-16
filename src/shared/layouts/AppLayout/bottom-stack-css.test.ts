import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The phone bottom stack (KICKOFF §3.5, D30) is a stylesheet contract: the tab
 * bar, a notice pill and a floating "New" each publish a height in
 * `index.css`, and whatever floats above them adds it. jsdom cannot evaluate
 * `:has()` or media queries, so — like `theme/radius-shape-css.test.ts` — this
 * reads the source, comments stripped so a rule quoted in prose cannot pass.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const rules = readFileSync(join(root, 'src/index.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/**
 * The declarations of `selector { … }`, optionally inside a given @media block.
 * The stylesheet holds several blocks for one query (the record drawer's lift
 * is `min-width: 48rem` too), so the rule is looked up inside each of them —
 * a block ends at its column-0 `}` — never in whatever follows the first.
 */
function declarations(selector: string, media?: string): string {
  if (!media) {
    const start = rules.indexOf(`${selector} {`);
    expect(start, `${selector} in the stylesheet`).toBeGreaterThan(-1);
    return rules.slice(start, rules.indexOf('}', start));
  }
  for (
    let from = rules.indexOf(`@media ${media}`);
    from !== -1;
    from = rules.indexOf(`@media ${media}`, from + 1)
  ) {
    const block = rules.slice(from, rules.indexOf('\n}', from));
    const start = block.indexOf(`${selector} {`);
    if (start !== -1) return block.slice(start, block.indexOf('}', start));
  }
  return expect.fail(`${selector} in @media ${media}`);
}

const PHONE = '(max-width: 47.9375rem) {\n  :root:has';

describe('phone bottom stack (index.css)', () => {
  it('the floating tab bar declares its geometry and reserves its top edge below md, nothing from md', () => {
    const bar = declarations(":root:has([data-slot='mobile-nav'])").replace(/\s+/g, ' ');
    expect(bar).toContain('--tab-bar-height: 3.875rem');
    expect(bar).toContain(
      '--tab-bar-gap: max(0.75rem, calc(env(safe-area-inset-bottom, 0px) - 0.75rem))',
    );
    // Its top edge less the inset — every consumer adds the inset itself.
    expect(bar).toContain(
      '--floating-bottom-offset: calc( var(--tab-bar-gap) + var(--tab-bar-height) - env(safe-area-inset-bottom, 0px) )',
    );
    expect(
      declarations(":root:has([data-slot='mobile-nav'])", '(min-width: 48rem)'),
    ).toContain('--floating-bottom-offset: 0rem');
  });

  it('the page and the feedback trigger clear the capsule, inset included', () => {
    const page = declarations(
      "[data-slot='app-main']",
      '(max-width: 39.9375rem)',
    ).replace(/\s+/g, ' ');
    expect(page).toContain(
      'calc( var(--floating-bottom-offset, 0rem) + env(safe-area-inset-bottom, 0px) + 0.75rem + var(--consent-card-height, 0px) )',
    );
    // The Report a bug trigger (feat-bug-report-2026-10-13-dgnx): 16px above the capsule.
    expect(declarations("[data-slot='feedback-trigger']").replace(/\s+/g, ' ')).toContain(
      'calc( 1rem + var(--floating-bottom-offset, 0rem) + env(safe-area-inset-bottom, 0px) )',
    );
  });

  it('draws the capsule as glass on tokens, with no colour mixed', () => {
    const capsule = declarations(
      "[data-slot='mobile-nav'] > [data-slot='floating-edge']",
    );
    expect(capsule).toContain('bottom: var(--tab-bar-gap)');
    expect(capsule).toContain('height: var(--tab-bar-height)');
    expect(capsule).toContain('backdrop-filter: blur(24px) saturate(1.5)');
    expect(capsule).toContain('outline-offset: -1px');
    // The glass is the capsule's own `::before` at 72%, over a blurred backdrop
    // (the first `::before` rule is the one it shares with the nav's fade).
    expect(rules).toContain(
      "[data-slot='mobile-nav'] > [data-slot='floating-edge']::before {\n  opacity: 0.72;",
    );
    expect(
      declarations(".dark [data-slot='mobile-nav'] > [data-slot='floating-edge']"),
    ).toContain('--glass: var(--color-muted)');
    // Every `color-mix()` ships twice (a hex fallback plus an @supports copy).
    const bar = rules.slice(
      rules.indexOf("[data-slot='mobile-nav'] {"),
      rules.indexOf("[dir='rtl'] [data-lens]"),
    );
    expect(bar).not.toContain('color-mix(');
  });

  it('places the lens a fifth of the bar per slot, mirrored for right-to-left', () => {
    const lens = declarations('[data-lens]');
    expect(lens).toContain('width: calc(20% - 0.1rem)');
    expect(lens).toContain('translate: calc(var(--lens, 0) * 100%)');
    // A glide, like every glide: 240ms on the strong ease-in-out (change-motion-consistency).
    expect(lens).toContain('transition: 240ms var(--ease-in-out-strong)');
    expect(declarations("[dir='rtl'] [data-lens]")).toContain(
      'translate: calc(var(--lens, 0) * -100%)',
    );
    for (const step of [1, 2, 3, 4]) {
      expect(declarations(`[data-lens='${step}']`)).toContain(`--lens: ${step}`);
    }
  });

  it('dips a pressed slot only when motion is allowed — 95% over 160ms on the strong ease-out', () => {
    expect(
      declarations(
        "[data-slot='mobile-nav'] :active > [data-slot='tab-content']",
        '(prefers-reduced-motion: no-preference)',
      ),
    ).toContain('scale: 0.95');
    expect(declarations("[data-slot='tab-content']")).toContain(
      'transition: scale 160ms var(--ease-out-strong)',
    );
  });

  it('a showing notice pill publishes 52px and a mounted "New" 60px, on phone only', () => {
    expect(declarations(":root:has([data-slot='notice-pill'])", PHONE)).toContain(
      '--floating-notice-height: 3.25rem',
    );
    expect(declarations(":root:has([data-slot='fab'])", PHONE)).toContain(
      '--floating-fab-height: 3.75rem',
    );
  });

  it('two notice pills — the email notice over View-as — publish both heights (L-31e)', () => {
    expect(
      declarations(
        ":root:has([data-slot='notice-pill'] ~ [data-slot='notice-pill'])",
        PHONE,
      ),
    ).toContain('--floating-notice-height: 6.5rem');
  });

  it('nothing outside a phone media query publishes the pill or the "New" height', () => {
    const outsidePhone = rules.replace(
      /@media \(max-width: 47\.9375rem\) \{[\s\S]*?\n\}/g,
      '',
    );
    expect(outsidePhone).not.toContain('--floating-notice-height:');
    expect(outsidePhone).not.toContain('--floating-fab-height:');
  });
});
