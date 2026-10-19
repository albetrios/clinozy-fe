#!/usr/bin/env node
/**
 * `pnpm test:pre-push [--base <ref>]` — the Vitest run `.husky/pre-push` makes for the pushed
 * commits (clinozy-be's `tooling/vitest/pre-push-tests.ts`, on this repository's shape).
 *
 * The test files `pnpm test:select` picks for the pushed changes, always-run files included, in one
 * Vitest process. A change on the escalation list (dependencies, configs, plugins, locales, the
 * test setup closure) selects everything, and then the whole suite runs (`pnpm test`); so does a
 * selection that cannot be built. CI still runs every suite.
 *
 * Proven before it became the default (18 Oct 2026): eleven planted breaks, one at a time, each
 * against the whole suite — every failing test was in the selection (0 misses;
 * docs/reference/testing.md → Selected tests at push).
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, resolveBase } from './git-environment.mjs';
import { selectTests } from './test-selection.mjs';

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

function changedFiles({ base, repositoryRoot }) {
  return git(['diff', '--name-only', '--no-renames', `${base}...HEAD`], {
    cwd: repositoryRoot,
  })
    .split('\n')
    .filter(Boolean);
}

function main() {
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  const baseIndex = process.argv.indexOf('--base');
  const given = baseIndex === -1 ? undefined : process.argv[baseIndex + 1];
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
  if (plan.run === 'none') return;
  const args = plan.run === 'all' ? ['test'] : ['exec', 'vitest', 'run', ...plan.files];
  process.exitCode =
    spawnSync('pnpm', args, { cwd: repositoryRoot, stdio: 'inherit' }).status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main();
