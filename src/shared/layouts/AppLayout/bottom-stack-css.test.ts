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
  it('the tab bar reserves its 58px below md and nothing from md', () => {
    expect(declarations(":root:has([data-slot='mobile-nav'])")).toContain(
      '--floating-bottom-offset: 3.625rem',
    );
    expect(
      declarations(":root:has([data-slot='mobile-nav'])", '(min-width: 48rem)'),
    ).toContain('--floating-bottom-offset: 0rem');
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
