#!/usr/bin/env node
/**
 * The files that must never be committed: the gitignored ones that hold real secrets or machine
 * state. One list for the two checks that refuse them — the before-commit guard's step 8 (the
 * staged files) and the PR governance workflow's guard (the PR diff) — which pipe their file
 * lists here:
 *
 *   git diff --cached --name-only --diff-filter=d | node tooling/validate/never-committed.mjs
 *
 * Prints each listed path that must not be committed and exits 1; exits 0 when there is none.
 * Tested by `never-committed.test.mjs`, the before-commit step included.
 */
import { readFileSync } from 'node:fs';

import { isMain, parseCommandLine } from '../ci/script.mjs';

/** The committed env template — the one `.env*` file that is tracked. */
export const ENV_TEMPLATE = '.env.example';

/**
 * Each never-committed file: its pattern over a repository-relative path, and what it holds. All
 * of them are gitignored, so only a forced `git add -f` can stage one.
 */
export const NEVER_COMMITTED_FILES = Object.freeze([
  {
    pattern: /^\.env(\.|$)/,
    holds: `real env values (every .env* but ${ENV_TEMPLATE}; deploys inject env from GitHub Environments)`,
  },
  { pattern: /(^|\/)\.sentryclirc$/, holds: 'the Sentry CLI auth token' },
  {
    pattern: /^tests\/e2e\/\.e2e-auth-headers\.json$/,
    holds: 'the E2E captcha-bypass header cache',
  },
  { pattern: /^\.netlify\/state\.json$/, holds: 'the Netlify CLI site state' },
]);

/**
 * True when `path` (repository-relative) is a file that must never be committed.
 *
 * @param {string} path
 * @returns {boolean}
 */
export function isNeverCommitted(path) {
  return (
    path !== ENV_TEMPLATE &&
    NEVER_COMMITTED_FILES.some(({ pattern }) => pattern.test(path))
  );
}

/**
 * The paths in `paths` that must never be committed, in their order.
 *
 * @param {readonly string[]} paths
 * @returns {string[]}
 */
export function neverCommittedPaths(paths) {
  return paths.filter((path) => isNeverCommitted(path));
}

if (isMain(import.meta.url)) {
  parseCommandLine(process.argv.slice(2));
  const listed = process.stdin.isTTY ? '' : readFileSync(0, 'utf8');
  const found = neverCommittedPaths(
    listed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
  for (const path of found) console.log(path);
  process.exitCode = found.length > 0 ? 1 : 0;
}
