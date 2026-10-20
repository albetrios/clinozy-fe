#!/usr/bin/env node
/**
 * Semgrep at push on the code where a hole is a session or tenant leak — the auth runtime, the HTTP
 * client and the CSP builders — an early check in `.husky/pre-push`. The PR's Semgrep lane scans
 * everything (clinozy-be's `pnpm security:semgrep:push`, on this repository's surface).
 *
 * Usage:
 *   pnpm security:semgrep:push                # files changed since the upstream (or origin/<trunk>)
 *   pnpm security:semgrep:push --base <ref>   # files changed since <ref>
 *
 * Same rules as CI (`--config p/default`), only findings new since the base. Semgrep missing, or a
 * Semgrep error (no network for the registry rules), warns and passes — CI still scans. A finding
 * blocks (`tooling/ci/early-checks.mjs`).
 */
import { spawnSync } from 'node:child_process';
import { reportEarlyCheck } from './early-checks.mjs';
import { resolveBase, tryGit } from './git-environment.mjs';
import { requireTool } from './require-tool.mjs';
import { isMain, parseCommandLine } from './script.mjs';

/** The code Semgrep scans at push: the auth runtime, the HTTP client, the CSP builders. */
export const PUSH_SEMGREP_PATTERNS = [
  /^src\/shared\/auth\/.+\.tsx?$/,
  /^src\/core\/http\/.+\.tsx?$/,
  /^src\/lib\/csp-api-origin\.ts$/,
  /^plugins\/csp-api-origin\.ts$/,
];

/**
 * The changed files Semgrep scans at push — test files excluded.
 *
 * @param {readonly string[]} changedFiles
 * @returns {string[]}
 */
export function pushSemgrepTargets(changedFiles) {
  return changedFiles.filter(
    (file) =>
      PUSH_SEMGREP_PATTERNS.some((pattern) => pattern.test(file)) &&
      !/\.test\.tsx?$/.test(file),
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
    console.log('Semgrep at push: no auth, HTTP client or CSP changes.');
    return;
  }
  // A warning, not a block: the PR's Semgrep lane scans everything.
  if (!requireTool({ name: 'semgrep', mode: 'warn', purpose: 'Semgrep at push' })) return;
  console.log(`Semgrep at push: ${targets.length} file(s) in auth, the HTTP client, CSP`);
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
