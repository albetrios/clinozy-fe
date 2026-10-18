/**
 * What `.husky/pre-push` runs for its Vitest step (`pre-push-tests.mjs`): the selected files, and
 * still everything when the selection escalates or fails.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { prePushTests } from './pre-push-tests.mjs';

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
  test('runs the selected files of every project', () => {
    const plan = prePushTests({
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
      select: () => {
        throw new Error('no merge base');
      },
    });
    assert.equal(failed.run, 'all');
    assert.match(failed.reason, /no merge base/);
    const empty = prePushTests({
      select: () => ({ mode: 'none', reasons: [], projects: {}, why: {} }),
    });
    assert.equal(empty.run, 'none');
  });

  test('is what the hook runs, against the push base', () => {
    assert.ok(PRE_PUSH.includes('pnpm test:pre-push --base "$PUSH_BASE"'));
    assert.ok(!/^\s*pnpm test$/m.test(PRE_PUSH));
  });
});
