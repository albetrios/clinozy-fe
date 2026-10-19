#!/usr/bin/env node
// Claude Code Stop hook for clinozy-fe, registered with `asyncRewake` (clinozy-be's
// fe-turn-end-tests.mjs): at turn end, in the background, it runs the tests the uncommitted changes
// affect — `pnpm test:select`, the tests it picks for the change itself (`--changed-only`: the
// always-run security and scanner sets stay with the push, a page change's full selection takes
// over a minute) — within a 60-second budget, one run at a time. A failure exits 2, which wakes
// the model with the failing tests; a pass, a timeout, a skip or any error exits 0 and says
// nothing. When the selection is everything, the next push runs the whole suite: it says so,
// once per reason in a session — an exit 2 that is a heads-up, not a failure.
//
// It skips a tree it already passed (same changes) and a change no test reaches.
//
// Only this repository is judged: a session that holds several repositories runs every
// repository's hooks, each with its own CLAUDE_PROJECT_DIR (tooling/agent-os/session-hooks.ts).
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const HOOK_ID = 'fe-turn-end-tests';
const TEST_BUDGET_MILLISECONDS = 60_000;
const SELECTION_BUDGET_MILLISECONDS = 20_000;
const FAILURE_LINES = 40;
/** How every always-run reason starts (tooling/ci/test-selection.mjs › ALWAYS_RUN_REASON). */
const ALWAYS_RUN_REASON = 'always run';

const repositoryRoot =
  process.env.CLAUDE_PROJECT_DIR ||
  resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stateRoot = join(process.env.TMPDIR || '/tmp', 'clinozy-fe-hooks');
const lockPath = join(stateRoot, `${HOOK_ID}.lock`);
const passedPath = join(stateRoot, `${HOOK_ID}.passed`);

/** The Stop payload's session id, or `unknown-session`. */
function sessionId() {
  try {
    return JSON.parse(readFileSync(0, 'utf8')).session_id || 'unknown-session';
  } catch {
    return 'unknown-session';
  }
}

/** Holds the one-run lock, or returns false while a live run holds it. */
function takeLock() {
  mkdirSync(stateRoot, { recursive: true });
  if (existsSync(lockPath)) {
    const holder = Number(readFileSync(lockPath, 'utf8'));
    try {
      if (holder > 0) {
        process.kill(holder, 0);
        return false;
      }
    } catch {
      /* the holder is gone: take the lock over */
    }
  }
  writeFileSync(lockPath, String(process.pid));
  return true;
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : '';
}

/** Uncommitted paths that still exist (a rename counts as its new path). */
function changedFiles() {
  return git(['status', '--porcelain', '-unormal'])
    .split('\n')
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).split(' -> ').pop())
    .filter(
      (path) =>
        existsSync(join(repositoryRoot, path)) &&
        statSync(join(repositoryRoot, path)).isFile(),
    );
}

/** Changes with the tree's uncommitted state: the diff against HEAD and each file's size and time. */
function fingerprint(files) {
  const hash = createHash('sha1').update(git(['diff', 'HEAD']));
  for (const file of files) {
    const { size, mtimeMs } = statSync(join(repositoryRoot, file));
    hash.update(`${file}:${size}:${mtimeMs}\n`);
  }
  return hash.digest('hex');
}

/** `pnpm test:select --files … --json`, or null when it cannot answer. */
function select(files) {
  const result = spawnSync(
    process.execPath,
    ['tooling/ci/select-tests.mjs', '--files', files.join(','), '--json'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: SELECTION_BUDGET_MILLISECONDS,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.status !== 0) return null;
  const start = result.stdout.indexOf('{');
  return start === -1 ? null : JSON.parse(result.stdout.slice(start));
}

/** Says once per reason in a session that the next push runs the whole suite. */
function warnFullPush({ session, reasons }) {
  const reason = reasons[0] ?? 'everything is selected';
  const key = createHash('sha1').update(`${session}\n${reason}`).digest('hex');
  const marker = join(stateRoot, `${HOOK_ID}.warned-${key}`);
  if (existsSync(marker)) return 'silent';
  writeFileSync(marker, reason);
  process.stderr.write(
    `Turn-end tests (a heads-up, nothing failed): the next push runs the whole Vitest suite — ${reason}. ` +
      'No turn-end run for it; run `pnpm test` before pushing if you want the result first.\n',
  );
  return 'warned';
}

function run(session) {
  if (!takeLock()) return 'busy';
  try {
    const files = changedFiles();
    if (files.length === 0) return 'silent';
    const tree = fingerprint(files);
    if (existsSync(passedPath) && readFileSync(passedPath, 'utf8') === tree)
      return 'already-passed';
    const selection = select(files);
    if (!selection) return 'silent';
    if (selection.mode === 'all')
      return warnFullPush({ session, reasons: selection.reasons });
    if (selection.mode !== 'selected') return 'silent';
    const tests = Object.values(selection.projects)
      .flat()
      .filter((test) =>
        (selection.why[test] ?? []).some(
          (reason) => !reason.startsWith(ALWAYS_RUN_REASON),
        ),
      );
    if (tests.length === 0) return 'silent';

    const result = spawnSync(
      join(repositoryRoot, 'node_modules', '.bin', 'vitest'),
      ['run', ...tests],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        timeout: TEST_BUDGET_MILLISECONDS,
        killSignal: 'SIGKILL',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0' },
      },
    );
    if (result.error || result.signal) return 'timeout';
    if (result.status === 0) {
      writeFileSync(passedPath, tree);
      return 'passed';
    }
    // Vitest still colors a piped run under some terminals: the wake message is plain text.
    const output = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`);
    const failures = output
      .split('\n')
      .filter((line) => /FAIL|×|✗|AssertionError|Error:/.test(line))
      .slice(0, FAILURE_LINES);
    process.stderr.write(
      [
        `Turn-end tests: the tests your uncommitted changes affect failed (${tests.length} file(s)):`,
        ...failures,
        'Re-run: pnpm exec vitest run <file> — or pnpm test:select --why',
      ].join('\n') + '\n',
    );
    return 'failed';
  } finally {
    rmSync(lockPath, { force: true });
  }
}

let outcome = 'error';
try {
  outcome = run(sessionId());
} catch {
  /* fail-open */
}
process.exit(outcome === 'failed' || outcome === 'warned' ? 2 : 0);
