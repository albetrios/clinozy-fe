/**
 * Pins `pnpm test:affected` (`/fe-validate --affected`) to `.husky/pre-push`: the same pnpm steps
 * in the same order, the same unit-relevant and SonarQube patterns — so the preview never describes
 * a push that no longer runs that way.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';
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
  test('lists exactly the pnpm steps the hook runs, in its order', () => {
    const hookSteps = [...PRE_PUSH.matchAll(/^\s*(pnpm [a-z][\w:.-]*)/gm)].map(
      (match) => match[1],
    );
    const previewSteps = pushSteps([])
      .map((step) => firstWords(step.command))
      .filter((command) => command.startsWith('pnpm '));
    assert.deepEqual(previewSteps, hookSteps);
  });

  test("uses the hook's unit-relevant and SonarQube patterns", () => {
    const unslash = (pattern) => pattern.source.replaceAll('\\/', '/');
    assert.ok(PRE_PUSH.includes(`'${unslash(UNIT_RELEVANT)}'`), 'unit-relevant pattern');
    assert.ok(
      PRE_PUSH.includes(`'${unslash(SONAR_RUNTIME)}'`),
      'SonarQube runtime pattern',
    );
    assert.ok(PRE_PUSH.includes(`'${unslash(SONAR_EXCLUDED)}'`), 'SonarQube exclusions');
  });

  test('says why each step runs, and summarizes the always-run tests', () => {
    const steps = pushSteps(['src/shared/auth/service.ts', 'docs/x.md']);
    const runs = (command) => steps.find((step) => step.command === command)?.runs;
    assert.equal(runs('pnpm security:semgrep:push'), true);
    assert.equal(runs('pnpm sonar:scan'), true);
    assert.equal(runs('pnpm test'), true);
    assert.equal(
      steps.find((step) => step.command === 'pnpm docs:lint:changed')?.why,
      'pushed Markdown',
    );
    const docsOnly = pushSteps(['docs/x.md']);
    assert.equal(docsOnly.find((step) => step.command === 'pnpm test')?.runs, false);
    assert.equal(
      docsOnly.find((step) => step.command === 'pnpm sonar:scan')?.runs,
      false,
    );
    const table = selectionTable({
      mode: 'selected',
      reasons: ['2 of 9'],
      projects: { unit: ['src/a.test.ts', 'src/b.test.ts'] },
      why: { 'src/a.test.ts': ['imports src/a.ts'], 'src/b.test.ts': ['always run'] },
    });
    assert.ok(table.includes('| unit | `src/a.test.ts` | imports src/a.ts |'));
    assert.ok(table.includes('| unit | 1 file(s) | always run (any source change) |'));
  });
});
