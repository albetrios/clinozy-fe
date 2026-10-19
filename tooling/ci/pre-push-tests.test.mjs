/**
 * What `.husky/pre-push` runs for its Vitest step (`pre-push-tests.mjs`): the selected files, and
 * still everything when the selection escalates or fails.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  it('runs the selected files of every project', () => {
    const plan = prePushTests({
      select: () =>
        selected({
          unit: ['src/a.test.ts'],
          security: ['tests/security/b.security.test.ts'],
        }),
    });
    expect(plan).toStrictEqual({
      run: 'selected',
      files: ['src/a.test.ts', 'tests/security/b.security.test.ts'],
      reason: '2 test file(s) selected',
    });
  });

  it('runs everything when the selection escalates or fails, nothing when empty', () => {
    const escalated = prePushTests({
      select: () => ({
        mode: 'all',
        reasons: ['package.json escalates'],
        projects: {},
        why: {},
      }),
    });
    expect(escalated).toStrictEqual({
      run: 'all',
      files: [],
      reason: 'package.json escalates',
    });
    const failed = prePushTests({
      select: () => {
        throw new Error('no merge base');
      },
    });
    expect(failed.run).toBe('all');
    expect(failed.reason).toMatch(/no merge base/);
    const empty = prePushTests({
      select: () => ({ mode: 'none', reasons: [], projects: {}, why: {} }),
    });
    expect(empty.run).toBe('none');
  });

  it('is what the hook runs, against the push base', () => {
    expect(PRE_PUSH.includes('pnpm test:pre-push --base "$PUSH_BASE"')).toBeTruthy();
    expect(!/^\s*pnpm test$/m.test(PRE_PUSH)).toBeTruthy();
  });
});
