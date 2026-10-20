#!/usr/bin/env node
/**
 * Semgrep at push on every changed app source and test file (`src/`, `plugins/`, `tests/`) — an
 * early check in `.husky/pre-push`. The PR's Semgrep lane scans everything (clinozy-be's
 * `pnpm security:semgrep:push`, on this repository's surface). It covered only the auth runtime, the
 * HTTP client and the CSP builders until the planted-bug drill (20 Oct 2026) showed a hole outside
 * them reach the PR. Test files are scanned too, as the PR's lane scans them: in clinozy-be a
 * test's `new RegExp(...)` passed the push step and failed PR SAST (albetrios/clinozy-be#124).
 *
 * Usage:
 *   pnpm security:semgrep:push                # files changed since the upstream (or origin/<trunk>)
 *   pnpm security:semgrep:push --base <ref>   # files changed since <ref>
 *
 * Same rules as CI (`--config p/default`, `tests/ci` holds the two equal), only findings new since
 * the base. Semgrep missing, or a
 * Semgrep error (no network for the registry rules), warns and passes — CI still scans. A finding
 * blocks (`tooling/ci/early-checks.mjs`).
 */
import { spawnSync } from 'node:child_process';
import { reportEarlyCheck } from './early-checks.mjs';
import { resolveBase, tryGit } from './git-environment.mjs';
import { requireTool } from './require-tool.mjs';
import { isMain, parseCommandLine } from './script.mjs';

/** The code Semgrep scans at push: the app source, the Vite plugins and the test tree. */
export const PUSH_SEMGREP_PATTERNS = [
  /^src\/.+\.tsx?$/,
  /^plugins\/.+\.ts$/,
  /^tests\/.+\.tsx?$/,
];

/**
 * The changed files Semgrep scans at push — tests included, as the PR's Semgrep lane scans them.
 *
 * @param {readonly string[]} changedFiles
 * @returns {string[]}
 */
export function pushSemgrepTargets(changedFiles) {
  return changedFiles.filter((file) =>
    PUSH_SEMGREP_PATTERNS.some((pattern) => pattern.test(file)),
  );
}

function main() {
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: { base: { type: 'string' } },
  });
  const base = resolveBase({ base: values.base });
  const mergeBase = tryGit(['merge-base', 'HEAD', base]);
  if (!mergeBase.ok) {
    console.warn(
      `⚠ Semgrep at push: cannot find the merge base with ${base}; skipped (CI scans)`,
    );
    return;
  }
  const changed = tryGit([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    `${mergeBase.output}...HEAD`,
  ]);
  const targets = pushSemgrepTargets(changed.output.split('\n'));
  if (targets.length === 0) {
    console.log(
      'Semgrep at push: no source or test changes under src/, plugins/ or tests/.',
    );
    return;
  }
  // A warning, not a block: the PR's Semgrep lane scans everything.
  if (!requireTool({ name: 'semgrep', mode: 'warn', purpose: 'Semgrep at push' })) return;
  console.log(`Semgrep at push: ${targets.length} source file(s)`);
  const scan = spawnSync(
    'semgrep',
    [
      'scan',
      '--config',
      'p/default',
      '--metrics',
      'off',
      '--error',
      '--quiet',
      '--baseline-commit',
      mergeBase.output,
      ...targets,
    ],
    { stdio: 'inherit', env: { ...process.env, SEMGREP_ENABLE_VERSION_CHECK: '0' } },
  );
  if (scan.status === 0) {
    console.log('✓ Semgrep at push: no new findings');
    return;
  }
  if (scan.status !== 1) {
    console.warn(
      `⚠ Semgrep at push: semgrep exited ${scan.status ?? 'without a code'}; skipped`,
    );
    return;
  }
  process.exitCode = reportEarlyCheck({
    check: 'Semgrep at push',
    findings: [
      `semgrep reported new findings in the ${targets.length} scanned file(s) — see above`,
    ],
  });
}

if (isMain(import.meta.url)) main();
