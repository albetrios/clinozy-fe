#!/usr/bin/env node
/**
 * `pnpm test:select` — the Vitest files a change can affect, and why (the rules:
 * `tooling/ci/test-selection.mjs`).
 *
 * Usage:
 *   pnpm test:select                    # changes since the merge base with the upstream (or
 *                                       # origin/<trunk>) + the working tree
 *   pnpm test:select --base <ref>       # another base
 *   pnpm test:select --files a.ts,b.md  # these files instead of git
 *   pnpm test:select --why              # every selected test and why it was selected
 *   pnpm test:select --json             # the whole selection as JSON
 *   pnpm test:select --run              # run it in one Vitest process (`pnpm test` when
 *                                       # everything is selected)
 *   pnpm test:select --changed-only     # only the tests picked for the change: no always-run
 *                                       # tests, and nothing when everything is selected
 *   pnpm test:select --exclude <glob>   # leave out the tests that match (repeatable)
 *
 * It fails closed: git that cannot name the changes, like any selector error, selects everything.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { git, resolveBase } from './git-environment.mjs';
import { isMain, parseCommandLine } from './script.mjs';
import { changedOnly, selectTests, withoutTests } from './test-selection.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');

/**
 * Parses the command line.
 *
 * @param {readonly string[]} argv
 * @returns {{ base: string | undefined, files: string[] | undefined, why: boolean, json: boolean, run: boolean, changedOnly: boolean, exclude: string[] }}
 */
export function parseSelectArguments(argv) {
  const { values } = parseCommandLine(argv, {
    options: {
      base: { type: 'string' },
      files: { type: 'string' },
      why: { type: 'boolean' },
      json: { type: 'boolean' },
      run: { type: 'boolean' },
      'changed-only': { type: 'boolean' },
      exclude: { type: 'string', multiple: true },
    },
  });
  return {
    base: values.base,
    files:
      values.files === undefined ? undefined : values.files.split(',').filter(Boolean),
    why: values.why === true,
    json: values.json === true,
    run: values.run === true,
    changedOnly: values['changed-only'] === true,
    exclude: values.exclude ?? [],
  };
}

/** Everything since the merge base with the base (`resolveBase`), the working tree, untracked files. */
function changedFiles(given) {
  const at = { cwd: REPOSITORY_ROOT };
  const mergeBase = git(['merge-base', 'HEAD', resolveBase({ base: given, ...at })], at);
  const lines = [
    ...git(['diff', '--name-only', mergeBase], at).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard'], at).split('\n'),
  ];
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

/**
 * The selection for a command line, and the lines that describe it.
 *
 * @param {readonly string[]} argv
 * @returns {{ selection: import('./test-selection.mjs').TestSelection, lines: string[] }}
 */
export function describeSelection(argv) {
  const options = parseSelectArguments(argv);
  let selection;
  try {
    selection = selectTests({
      changedFiles: options.files ?? changedFiles(options.base),
      repositoryRoot: REPOSITORY_ROOT,
    });
  } catch (error) {
    selection = {
      mode: 'all',
      reasons: [`git cannot name the changes, so everything runs: ${error.message}`],
      projects: {},
      why: {},
    };
  }
  if (options.changedOnly) selection = changedOnly(selection);
  selection = withoutTests({ selection, globs: options.exclude });
  if (options.json) return { selection, lines: [JSON.stringify(selection, null, 2)] };
  const lines = [
    `Selection: ${selection.mode}`,
    ...selection.reasons.map((r) => `  ${r}`),
  ];
  for (const [project, tests] of Object.entries(selection.projects)) {
    lines.push('', `${project} (${tests.length}):`);
    for (const test of tests) {
      lines.push(`  ${test}`);
      if (options.why)
        for (const reason of selection.why[test] ?? []) lines.push(`      ${reason}`);
    }
  }
  return { selection, lines };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const { selection, lines } = describeSelection(argv);
  console.log(lines.join('\n'));
  if (parseSelectArguments(argv).run && selection.mode !== 'none') {
    const files = Object.values(selection.projects).flat();
    const command =
      selection.mode === 'all'
        ? ['pnpm', ['test']]
        : ['pnpm', ['exec', 'vitest', 'run', ...files]];
    const result = spawnSync(command[0], command[1], {
      cwd: REPOSITORY_ROOT,
      stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
  }
}
