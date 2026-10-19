/**
 * Pins `tooling/ci/script.mjs` — the one command-line parser (node:util `parseArgs`) and entry
 * check every FE tooling script uses — and that each script reads its command line through it
 * before doing anything: an unknown option stops it, named, with a non-zero exit.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { isMain, parseCommandLine } from './script.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const TSX = join(ROOT, 'node_modules/.bin/tsx');

describe('parseCommandLine', () => {
  const shape = {
    options: {
      both: { type: 'boolean' },
      check: { type: 'boolean' },
      mode: { type: 'string' },
      sibling: { type: 'string' },
    },
    maxPositionals: 2,
    usage: 'expected <a> <b>.',
  };

  test('reads flags, --name value and --name=value options, and --sibling', () => {
    const parsed = parseCommandLine(
      ['x', '--mode', 'overlay', 'y', '--check', '--sibling', '../b'],
      shape,
    );
    assert.deepEqual(parsed.positionals, ['x', 'y']);
    assert.deepEqual(parsed.values, { mode: 'overlay', check: true, sibling: '../b' });
    assert.equal(parseCommandLine(['--mode=brief'], shape).values.mode, 'brief');
  });

  test('refuses a value option without its value, an unknown option and extra positionals', () => {
    assert.throws(() => parseCommandLine(['--mode'], shape), /--mode needs a value/);
    assert.throws(() => parseCommandLine(['--mode', '--check'], shape), /needs a value/);
    assert.throws(() => parseCommandLine(['--mode='], shape), /needs a value/);
    assert.throws(() => parseCommandLine(['--nope'], shape), /Unknown option "--nope"/);
    assert.throws(() => parseCommandLine(['a', 'b', 'c'], shape), /Too many arguments/);
  });

  test('appends the usage to a value or count error, and takes none by default', () => {
    assert.throws(
      () => parseCommandLine(['--mode'], shape),
      /^Error: --mode needs a value — expected <a> <b>\.$/,
    );
    assert.throws(() => parseCommandLine(['a'], {}), /^Error: Too many arguments: a\.$/);
    assert.throws(
      () => parseCommandLine(['--check=yes'], shape),
      /Unknown option "--check=yes"/,
    );
  });

  test('reads short options, repeated options, and positionals after --', () => {
    const parsed = parseCommandLine(['-h', '--tag', 'a', '--tag=b', '--', '--literal'], {
      options: {
        help: { type: 'boolean', short: 'h' },
        tag: { type: 'string', multiple: true },
      },
      maxPositionals: 1,
    });
    assert.deepEqual(parsed, {
      values: { help: true, tag: ['a', 'b'] },
      positionals: ['--literal'],
    });
  });

  test("words its errors the script's own way, falling back to the default", () => {
    const messages = {
      unknownOption: (option) => `no such flag ${option}`,
      needsValue: (option) =>
        option === '--sibling' ? 'give --sibling a path' : undefined,
    };
    assert.throws(
      () => parseCommandLine(['--x'], { ...shape, messages }),
      /^Error: no such flag --x$/,
    );
    assert.throws(
      () => parseCommandLine(['--sibling'], { ...shape, messages }),
      /^Error: give --sibling a path$/,
    );
    assert.throws(
      () => parseCommandLine(['--mode'], { ...shape, messages }),
      /^Error: --mode needs a value — expected <a> <b>\.$/,
    );
  });
});

describe('isMain', () => {
  test('is true only for the script node was started with', () => {
    const entry = process.argv[1];
    try {
      process.argv[1] = join(ROOT, 'tooling/ci/script.mjs');
      assert.equal(isMain(pathToFileURL(join(ROOT, 'tooling/ci/script.mjs')).href), true);
      assert.equal(isMain(import.meta.url), false);
      process.argv[1] = undefined;
      assert.equal(isMain(import.meta.url), false);
    } finally {
      process.argv[1] = entry;
    }
  });
});

/**
 * Every script that reads a command line, and how it is started. Each is run with an option no
 * script takes; it must stop on it — before any work — and name it.
 */
const SCRIPTS = [
  'agent-os/evals/check.ts',
  'agent-os/evals/trigger-eval.ts',
  'tooling/agent-os/generate.ts',
  'tooling/agent-os/lock.ts',
  'tooling/agent-os/review-marker.mjs',
  'tooling/agent-os/session-hooks.ts',
  'tooling/ci/affected.mjs',
  'tooling/ci/build.mjs',
  'tooling/ci/bulk-audit.mjs',
  'tooling/ci/check-doc-staleness.mjs',
  'tooling/ci/check-patch-coverage.mjs',
  'tooling/ci/early-checks.mjs',
  'tooling/ci/git-environment.mjs',
  'tooling/ci/pre-push-tests.mjs',
  'tooling/ci/probe-live-site.mjs',
  'tooling/ci/push-semgrep.mjs',
  'tooling/ci/run-size-limit.mjs',
  'tooling/ci/select-tests.mjs',
  'tooling/ci/selector-misses.mjs',
  'tooling/codegen/api-types.mjs',
  'tooling/codegen/app-schema.mjs',
  'tooling/data/build-pin-directory.mjs',
  'tooling/dev/setup-local.ts',
  'tooling/dev/setup-mcp.ts',
  'tooling/env-registry/env-registry.ts',
  'tooling/identity/rebrand.mjs',
  'tooling/iterations/check-iteration-freeze.mjs',
  'tooling/iterations/diff-iterations.mjs',
  'tooling/iterations/intake-iteration.mjs',
  'tooling/iterations/list-iterations.mjs',
  'tooling/iterations/new-iteration.mjs',
  'tooling/iterations/set-iteration-baseline.mjs',
  'tooling/iterations/set-iteration-status.mjs',
  'tooling/perf/measure-public-routes.mjs',
  'tooling/setup/github/check-environments-drift.mjs',
  'tooling/setup/github/governance-mode.mjs',
  'tooling/setup/github/sync-env-secrets.mjs',
  'tooling/setup/github/sync-environments.mjs',
  'tooling/setup/github/sync-rulesets.mjs',
  'tooling/setup/github/sync.mjs',
  'tooling/setup/github/validate-github-env.mjs',
  'tooling/tsdoc-coverage/check-coverage.mjs',
  'tooling/validate/client-env.ts',
  'tooling/validate/sync-env-example.ts',
];

describe('every script reads its command line with parseCommandLine', () => {
  for (const script of SCRIPTS) {
    test(`${script} stops on an unknown option and names it`, () => {
      const [command, args] = script.endsWith('.ts')
        ? [TSX, [script]]
        : [process.execPath, [script]];
      const result = spawnSync(command, [...args, '--not-an-option'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, CI: 'true', GITHUB_TOKEN: '' },
        timeout: 60_000,
      });
      assert.notEqual(result.status, 0, `${script} exited 0`);
      assert.match(`${result.stdout}${result.stderr}`, /--not-an-option/, script);
    });
  }
});
