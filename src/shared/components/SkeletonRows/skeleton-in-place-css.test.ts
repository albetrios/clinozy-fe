import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The in-place skeleton (KICKOFF §3.5 Skeletons) is one stylesheet contract
 * keyed on `data-refreshing`: whatever subtree shows the previous params'
 * content while the next load lands carries it, and every room reads the same
 * bars — DataTable's rows, the calendars' blocks, Today's floor and queue, the
 * task list. jsdom computes no layout, so — like
 * `AppLayout/bottom-stack-css.test.ts` — this reads the source, comments
 * stripped so a rule quoted in prose cannot pass.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const rules = readFileSync(join(root, 'src/index.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ');
const sourceOf = (path: string) => readFileSync(join(root, path), 'utf8');

/** The declarations of the rule whose selector (list) is exactly `selector`. */
function declarations(selector: string): string {
  const start = rules.indexOf(`} ${selector} {`);
  expect(start, `${selector} in the stylesheet`).toBeGreaterThan(-1);
  const open = rules.indexOf('{', start + 2);
  return rules.slice(open + 1, rules.indexOf('}', open));
}

const SUBTREE = '[data-refreshing]';
const ITEM = `${SUBTREE} > :not([data-slot='data-table-group'])`;
const LEAF = `${ITEM} :where(span, a, button, p, time):not(:has(:not(.sr-only))):not(:empty):not( .sr-only, [data-slot='avatar-fallback'] ), ${SUBTREE} > :where(span, a, button, p, time):not(:has(*)):not(:empty)`;

/** Every surface that refreshes in place, and the source that marks it. */
const SURFACES = [
  'src/shared/components/DataTable/DataTable.tsx',
  'src/pages/organization/$organizationSlug/tasks/components/TaskList/TaskList.tsx',
  'src/pages/organization/$organizationSlug/appointments/components/CalendarGrid/CalendarGrid.tsx',
  'src/pages/organization/$organizationSlug/appointments/components/AppointmentsMonth/AppointmentsMonth.tsx',
  'src/pages/organization/$organizationSlug/appointments/components/AppointmentsDay/AppointmentsDay.tsx',
  'src/pages/organization/$organizationSlug/today/TodayPage.tsx',
  'src/pages/organization/$organizationSlug/today/components/WorkQueue/WorkQueue.tsx',
];

describe('the in-place skeleton (index.css)', () => {
  it('is one rule keyed on what every refreshing surface writes', () => {
    for (const path of SURFACES) {
      expect(sourceOf(path), path).toMatch(
        /data-refreshing=\{\w+(\.\w+)? \|\| undefined\}/,
      );
    }
  });

  it('turns clicks off and each leaf text run into a 0.72em muted-strong bar, 64 / 48 / 60% wide', () => {
    expect(declarations(SUBTREE)).toContain('pointer-events: none');
    const bar = declarations(LEAF);
    expect(bar).toContain('height: 0.72em');
    expect(bar).toContain('background-color: var(--color-muted-strong)');
    expect(bar).toContain('color: transparent');
    expect(bar).toContain('border-radius: var(--radius-md)');
    expect(bar).toContain('width: var(--refresh-bar)');
    expect(declarations(`${SUBTREE} > *`)).toContain('--refresh-bar: 64%');
    expect(declarations(`${SUBTREE} > :nth-child(3n + 2)`)).toContain(
      '--refresh-bar: 48%',
    );
    expect(declarations(`${SUBTREE} > :nth-child(3n)`)).toContain('--refresh-bar: 60%');
  });

  it('keeps avatars round discs, hides icons and badges — never a table’s group header', () => {
    expect(declarations(`${SUBTREE} [data-slot='avatar-fallback']`)).toContain(
      'background-color: var(--color-muted-strong)',
    );
    expect(declarations(`${ITEM} svg`)).toContain('opacity: 0');
    expect(
      declarations(`${SUBTREE} [data-slot='person-avatar'] [data-slot='pill']`),
    ).toContain('visibility: hidden');
  });

  it('is the only look: no surface draws its own bars with arbitrary variants', () => {
    const offenders = (
      readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' }) as string[]
    )
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        readFileSync(join(root, 'src', file), 'utf8').includes(':not(:empty)]:bg-'),
      );
    expect(offenders).toEqual([]);
  });
});
