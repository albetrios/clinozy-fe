/**
 * Pins `pnpm test:affected` (`/fe-validate --affected`) to `.husky/pre-push`: the same pnpm steps
 * in the same order, the same unit-relevant and SonarQube patterns — so the preview never describes
 * a push that no longer runs that way.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  pushSteps,
  SONAR_EXCLUDED,
  SONAR_RUNTIME,
  selectionTable,
  UNIT_RELEVANT,
} from './affected.mjs';

const PRE_PUSH = readFileSync(
  join(resolve(import.meta.dirname, '../..'), '.husky/pre-push'),
  'utf8',
);
const firstWords = (command) => command.split(' ').slice(0, 2).join(' ');

describe('test:affected mirrors .husky/pre-push', () => {
  it('lists exactly the pnpm steps the hook runs, in its order', () => {
    const hookSteps = [...PRE_PUSH.matchAll(/^\s*(pnpm [a-z][\w:.-]*)/gm)].map(
      (match) => match[1],
    );
    const previewSteps = pushSteps([])
      .map((step) => firstWords(step.command))
      .filter((command) => command.startsWith('pnpm '));
    expect(previewSteps).toStrictEqual(hookSteps);
  });

  it("uses the hook's unit-relevant and SonarQube patterns", () => {
    const unslash = (pattern) => pattern.source.replaceAll('\\/', '/');
    expect(
      PRE_PUSH.includes(`'${unslash(UNIT_RELEVANT)}'`),
      'unit-relevant pattern',
    ).toBeTruthy();
    expect(
      PRE_PUSH.includes(`'${unslash(SONAR_RUNTIME)}'`),
      'SonarQube runtime pattern',
    ).toBeTruthy();
    expect(
      PRE_PUSH.includes(`'${unslash(SONAR_EXCLUDED)}'`),
      'SonarQube exclusions',
    ).toBeTruthy();
  });

  it('says why each step runs, and summarizes the always-run tests', () => {
    const steps = pushSteps(['src/shared/auth/service.ts', 'docs/x.md']);
    const runs = (command) => steps.find((step) => step.command === command)?.runs;
    expect(runs('pnpm security:semgrep:push')).toBe(true);
    expect(runs('pnpm sonar:scan')).toBe(true);
    expect(runs('pnpm test:pre-push')).toBe(true);
    expect(steps.find((step) => step.command === 'pnpm docs:lint:changed')?.why).toBe(
      'pushed Markdown',
    );
    const docsOnly = pushSteps(['docs/x.md']);
    expect(docsOnly.find((step) => step.command === 'pnpm test:pre-push')?.runs).toBe(
      false,
    );
    expect(docsOnly.find((step) => step.command === 'pnpm sonar:scan')?.runs).toBe(false);
    const table = selectionTable({
      mode: 'selected',
      reasons: ['2 of 9'],
      projects: { unit: ['src/a.test.ts', 'src/b.test.ts'] },
      why: { 'src/a.test.ts': ['imports src/a.ts'], 'src/b.test.ts': ['always run'] },
    });
    expect(table.includes('| unit | `src/a.test.ts` | imports src/a.ts |')).toBeTruthy();
    expect(
      table.includes('| unit | 1 file(s) | always run (any source change) |'),
    ).toBeTruthy();
  });
});
