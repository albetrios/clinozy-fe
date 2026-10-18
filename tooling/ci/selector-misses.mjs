#!/usr/bin/env node
/**
 * `pnpm test:selector-misses --base <ref> --results <dir>` — after the merged unit shards of a PR
 * (clinozy-be's detector): the failed test files that `pnpm test:select` would have skipped for
 * this branch's changes. Each one is a selector miss — or a flake — and becomes a fixture in
 * `tooling/ci/selector-fixtures.json`, so the selection includes it next time.
 *
 * `<dir>` holds Vitest JSON reports (`--reporter=json`). It reports only: annotations, the job
 * summary, a fixture line per miss — and exits 0.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectTests } from './test-selection.mjs';

/**
 * The failed test files of a Vitest JSON report, repository-relative.
 *
 * @param {{ report: { testResults?: { name: string, status: string }[] }, repositoryRoot: string }} options
 * @returns {string[]}
 */
export function failedTestFiles({ report, repositoryRoot }) {
  return (report.testResults ?? [])
    .filter((result) => result.status === 'failed')
    .map((result) =>
      isAbsolute(result.name) ? relative(repositoryRoot, result.name) : result.name,
    )
    .map((file) => file.split('\\').join('/'));
}

/**
 * The failed files the selection would not have run — none when it runs everything.
 *
 * @param {{ failed: readonly string[], selection: import('./test-selection.mjs').TestSelection }} options
 * @returns {string[]}
 */
export function findSelectorMisses({ failed, selection }) {
  if (selection.mode === 'all') return [];
  const selected = new Set(Object.values(selection.projects).flat());
  return [...new Set(failed)].filter((file) => !selected.has(file)).sort();
}

/**
 * The fixture line that makes the selection include `test` for `changedFiles`.
 *
 * @param {{ changedFiles: readonly string[], test: string }} options
 * @returns {string}
 */
export function fixtureFor({ changedFiles, test }) {
  return JSON.stringify({
    name: `miss: ${test}`,
    changed: [...changedFiles],
    mustSelect: [test],
  });
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function git(args) {
  const environment = { ...process.env };
  delete environment.GIT_DIR;
  delete environment.GIT_WORK_TREE;
  const result = spawnSync('git', args, { encoding: 'utf8', env: environment });
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout;
}

function main() {
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  const resultsDirectory = option('--results') ?? 'test-results';
  const base = git(['merge-base', 'HEAD', option('--base') ?? 'origin/main']).trim();
  const changedFiles = git(['diff', '--name-only', '--no-renames', `${base}...HEAD`])
    .split('\n')
    .filter(Boolean);
  const failed = existsSync(resultsDirectory)
    ? readdirSync(resultsDirectory, { recursive: true })
        .map(String)
        .filter((file) => file.endsWith('.json'))
        .flatMap((file) =>
          failedTestFiles({
            report: JSON.parse(readFileSync(join(resultsDirectory, file), 'utf8')),
            repositoryRoot,
          }),
        )
    : [];
  const selection = selectTests({ changedFiles, repositoryRoot });
  const misses = findSelectorMisses({ failed, selection });
  const lines = [
    `Selector miss check: ${failed.length} failed test file(s), selection ${selection.mode} (${selection.reasons.join('; ')}), ${misses.length} miss(es).`,
  ];
  for (const miss of misses) {
    console.log(
      `::warning file=${miss}::pnpm test:select would have skipped this failed test — a selector miss (or a flake)`,
    );
    lines.push(
      `- ${miss} — add to tooling/ci/selector-fixtures.json: ${fixtureFor({ changedFiles, test: miss })}`,
    );
  }
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Selector miss check\n\n${lines.join('\n')}\n`,
    );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main();
