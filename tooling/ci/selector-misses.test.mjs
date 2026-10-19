/**
 * The selector miss detector (`selector-misses.mjs`): it reads the failed files of a Vitest JSON
 * report, keeps the ones a selection would have skipped (none when everything runs), and writes
 * the fixture line `tooling/ci/selector-fixtures.json` takes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { failedTestFiles, findSelectorMisses, fixtureFor } from './selector-misses.mjs';

const ROOT = resolve(import.meta.dirname, '../..');

describe('selector misses', () => {
  it('reads the failed files of a report, repository-relative', () => {
    const report = {
      testResults: [
        { name: join(ROOT, 'src/a.test.ts'), status: 'failed' },
        { name: 'tests/ci/b.policy.test.ts', status: 'failed' },
        { name: join(ROOT, 'src/c.test.ts'), status: 'passed' },
      ],
    };
    expect(failedTestFiles({ report, repositoryRoot: ROOT })).toStrictEqual([
      'src/a.test.ts',
      'tests/ci/b.policy.test.ts',
    ]);
    expect(failedTestFiles({ report: {}, repositoryRoot: ROOT })).toStrictEqual([]);
  });

  it('a miss is a failed file the selection did not pick; none when everything runs', () => {
    const selection = {
      mode: 'selected',
      reasons: [],
      projects: { unit: ['src/a.test.ts'] },
      why: {},
    };
    const failed = ['src/a.test.ts', 'src/z.test.ts', 'src/z.test.ts'];
    expect(findSelectorMisses({ failed, selection })).toStrictEqual(['src/z.test.ts']);
    expect(
      findSelectorMisses({
        failed,
        selection: { ...selection, mode: 'all', projects: {} },
      }),
    ).toStrictEqual([]);
  });

  it('writes the fixture line the fixtures file takes', () => {
    expect(
      JSON.parse(fixtureFor({ changedFiles: ['src/a.ts'], test: 'src/z.test.ts' })),
    ).toStrictEqual({
      name: 'miss: src/z.test.ts',
      changed: ['src/a.ts'],
      mustSelect: ['src/z.test.ts'],
    });
    const fixtures = JSON.parse(
      readFileSync(join(ROOT, 'tooling/ci/selector-fixtures.json'), 'utf8'),
    );
    expect(Array.isArray(fixtures.fixtures)).toBeTruthy();
  });
});
