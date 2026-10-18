/**
 * What `.husky/pre-push` runs for its Vitest step (`pre-push-tests.mjs`): the whole suite unless
 * `PRE_PUSH_SELECTED_TESTS=1`; then the selected files, and still everything when the selection
 * escalates or fails.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { prePushTests, SELECTED_TESTS_SWITCH } from './pre-push-tests.mjs';

const PRE_PUSH = readFileSync(
  join(resolve(import.meta.dirname, '../..'), '.husky/pre-push'),
  'utf8',
);

const selected = (projects) => ({
  mode: 'selected',
  reasons: ['3 of 1281'],
  projects,
  why: {},
});

describe('pre-push tests', () => {
  test('runs the whole suite while the switch is off, without selecting', () => {
    let selects = 0;
    const plan = prePushTests({
      switchedOn: false,
      select: () => {
        selects += 1;
        return selected({ unit: ['src/a.test.ts'] });
      },
    });
    assert.equal(plan.run, 'all');
    assert.match(plan.reason, new RegExp(`${SELECTED_TESTS_SWITCH}=1 turns them on`));
    assert.equal(selects, 0);
  });

  test('runs the selected files of every project when on', () => {
    const plan = prePushTests({
      switchedOn: true,
      select: () =>
        selected({
          unit: ['src/a.test.ts'],
          security: ['tests/security/b.security.test.ts'],
        }),
    });
    assert.deepEqual(plan, {
      run: 'selected',
      files: ['src/a.test.ts', 'tests/security/b.security.test.ts'],
      reason: '2 test file(s) selected',
    });
  });

  test('runs everything when the selection escalates or fails, nothing when empty', () => {
    const escalated = prePushTests({
      switchedOn: true,
      select: () => ({
        mode: 'all',
        reasons: ['package.json escalates'],
        projects: {},
        why: {},
      }),
    });
    assert.deepEqual(escalated, {
      run: 'all',
      files: [],
      reason: 'package.json escalates',
    });
    const failed = prePushTests({
      switchedOn: true,
      select: () => {
        throw new Error('no merge base');
      },
    });
    assert.equal(failed.run, 'all');
    assert.match(failed.reason, /no merge base/);
    const empty = prePushTests({
      switchedOn: true,
      select: () => ({ mode: 'none', reasons: [], projects: {}, why: {} }),
    });
    assert.equal(empty.run, 'none');
  });

  test('is what the hook runs, against the push base', () => {
    assert.ok(PRE_PUSH.includes('pnpm test:pre-push --base "$PUSH_BASE"'));
    assert.ok(!/^\s*pnpm test$/m.test(PRE_PUSH));
  });
});
