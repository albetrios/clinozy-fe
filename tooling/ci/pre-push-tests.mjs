#!/usr/bin/env node
/**
 * `pnpm test:pre-push [--base <ref>]` — the Vitest run `.husky/pre-push` makes for the pushed
 * commits (clinozy-be's `tooling/vitest/pre-push-tests.ts`, on this repository's shape).
 *
 * The test files `pnpm test:select` picks for the pushed changes, always-run files included, in one
 * Vitest process. A change on the escalation list (dependencies, configs, plugins, locales, the
 * test setup closure) selects everything, and then the whole suite runs (`pnpm test`); so does a
 * selection that cannot be built. A changed test also selects the policies that read every test's
 * source, and those run first and alone (`prePushRuns`). CI still runs every suite.
 *
 * Proven before it became the default (18 Oct 2026): eleven planted breaks, one at a time, each
 * against the whole suite — every failing test was in the selection (0 misses;
 * docs/reference/testing.md → Selected tests at push).
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { git, resolveBase } from './git-environment.mjs';
import { isMain, parseCommandLine } from './script.mjs';
import { selectTests, TEST_SOURCE_POLICIES } from './test-selection.mjs';

/**
 * What pre-push runs for a change: the whole suite (`all`), nothing (`none`), or these files. A
 * selection that throws runs everything.
 *
 * @param {{ select: () => import('./test-selection.mjs').TestSelection }} options
 * @returns {{ run: 'all' | 'none' | 'selected', files: string[], reason: string }}
 */
export function prePushTests({ select }) {
  const all = (reason) => ({ run: 'all', files: [], reason });
  let selection;
  try {
    selection = select();
  } catch (error) {
    return all(`the selection failed, so everything runs: ${error.message}`);
  }
  if (selection.mode === 'all') return all(selection.reasons.join('; '));
  const files =
    selection.mode === 'selected' ? Object.values(selection.projects).flat() : [];
  if (files.length === 0) return { run: 'none', files, reason: 'no test selected' };
  return { run: 'selected', files, reason: `${files.length} test file(s) selected` };
}

/**
 * The `pnpm` runs pre-push makes, in order. The test-source policies (`TEST_SOURCE_POLICIES`) go
 * first and alone whenever they are in the run: they judge a changed test's source, so a new test
 * that would build a git repository by hand is stopped before it runs inside the hook. Then the
 * rest of the selection, or the whole suite.
 *
 * @param {{ run: 'all' | 'none' | 'selected', files: string[] }} plan
 * @returns {string[][]}
 */
export function prePushRuns(plan) {
  const vitest = (files) => ['exec', 'vitest', 'run', ...files];
  if (plan.run === 'none') return [];
  if (plan.run === 'all') return [vitest([...TEST_SOURCE_POLICIES]), ['test']];
  const policies = plan.files.filter((file) => TEST_SOURCE_POLICIES.includes(file));
  const rest = plan.files.filter((file) => !policies.includes(file));
  if (policies.length === 0) return [vitest(rest)];
  return rest.length === 0 ? [vitest(policies)] : [vitest(policies), vitest(rest)];
}

function changedFiles({ base, repositoryRoot }) {
  return git(['diff', '--name-only', '--no-renames', `${base}...HEAD`], {
    cwd: repositoryRoot,
  })
    .split('\n')
    .filter(Boolean);
}

function main() {
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: { base: { type: 'string' } },
  });
  const given = values.base;
  const plan = prePushTests({
    select: () => {
      const base = resolveBase({ base: given, cwd: repositoryRoot });
      return selectTests({
        changedFiles: changedFiles({ base, repositoryRoot }),
        repositoryRoot,
      });
    },
  });
  console.log(`Pre-push tests: ${plan.run} — ${plan.reason}`);
  for (const args of prePushRuns(plan)) {
    const status =
      spawnSync('pnpm', args, { cwd: repositoryRoot, stdio: 'inherit' }).status ?? 1;
    if (status !== 0) {
      process.exitCode = status;
      return;
    }
  }
}

if (isMain(import.meta.url)) main();
