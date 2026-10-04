import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A refreshing table's bars (KICKOFF §3.5 Skeletons) are a stylesheet
 * contract keyed on what `DataTable` writes: `data-refreshing` on the rows'
 * rowgroup while the new rows load — the only element that carries it, its
 * rows its children. jsdom computes no layout, so — like
 * `AppLayout/bottom-stack-css.test.ts` — this reads the source, comments
 * stripped so a rule quoted in prose cannot pass.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const rules = readFileSync(join(root, 'src/index.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ');
const source = readFileSync(
  join(root, 'src/shared/components/DataTable/DataTable.tsx'),
  'utf8',
);

/** The declarations of the rule whose selector is exactly `selector`. */
function declarations(selector: string): string {
  const start = rules.indexOf(`} ${selector} {`);
  expect(start, `${selector} in the stylesheet`).toBeGreaterThan(-1);
  const open = rules.indexOf('{', start + 2);
  return rules.slice(open + 1, rules.indexOf('}', open));
}

const ROW = "[data-refreshing] > [data-slot='data-table-row']";
const LEAF = `${ROW} :where(span, a, button, p, time):not(:has(:not(.sr-only))):not(:empty):not( .sr-only, [data-slot='avatar-fallback'] )`;

describe('the refreshing table’s bars (index.css)', () => {
  it('is keyed on the rowgroup DataTable marks, its rows its children', () => {
    expect(source).toContain('data-slot="data-table-body"');
    expect(source).toContain('data-refreshing={refreshing || undefined}');
    expect(source.match(/data-refreshing=/g)).toHaveLength(1);
  });

  it('turns each leaf text run into a 0.72em muted-strong bar, 64 / 48 / 60% wide', () => {
    const bar = declarations(LEAF);
    expect(bar).toContain('height: 0.72em');
    expect(bar).toContain('background-color: var(--color-muted-strong)');
    expect(bar).toContain('color: transparent');
    expect(bar).toContain('border-radius: var(--radius-md)');
    expect(bar).toContain('width: var(--refresh-bar)');
    expect(declarations(ROW)).toContain('--refresh-bar: 64%');
    expect(declarations(`${ROW}:nth-child(3n + 2)`)).toContain('--refresh-bar: 48%');
    expect(declarations(`${ROW}:nth-child(3n)`)).toContain('--refresh-bar: 60%');
  });

  it('keeps avatars round discs, hides icons and badges — in the rows, never a group header', () => {
    expect(rules).not.toMatch(/\[data-refreshing\] (?!> \[data-slot='data-table-row'\])/);
    expect(declarations(`${ROW} [data-slot='avatar-fallback']`)).toContain(
      'background-color: var(--color-muted-strong)',
    );
    expect(declarations(`${ROW} svg`)).toContain('opacity: 0');
    expect(
      declarations(`${ROW} [data-slot='person-avatar'] [data-slot='pill']`),
    ).toContain('visibility: hidden');
  });
});
