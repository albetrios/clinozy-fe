import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  availableEnvironments,
  childEnvironment,
  chooseEnvironment,
  parseBuildArguments,
  resolveAnswer,
} from './build.mjs';

/**
 * Runs `body` against a throwaway project root holding the named `.env.<environment>` files.
 * Awaited inside the `try`, so the tree outlives an async body.
 */
async function withEnvFiles(environments, body) {
  const root = mkdtempSync(join(tmpdir(), 'pnpm-build-env-'));
  try {
    for (const environment of environments) {
      writeFileSync(join(root, `.env.${environment}`), `VITE_APP_ENV=${environment}\n`);
    }
    return await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** `chooseEnvironment` with an interactive terminal whose answer is recorded, not typed. */
async function choose(
  root,
  { argv = [], env = {}, interactive = true, answer = 'local' } = {},
) {
  const asked = [];
  const environment = await chooseEnvironment({
    argv,
    env,
    root,
    interactive,
    ask: async (available) => {
      asked.push(available);
      return answer;
    },
  });
  return { environment, asked };
}

test('parseBuildArguments reads --env in both spellings', () => {
  assert.deepEqual(parseBuildArguments([]), {});
  assert.deepEqual(parseBuildArguments(['--env', 'production']), {
    environment: 'production',
  });
  assert.deepEqual(parseBuildArguments(['--env=development']), {
    environment: 'development',
  });
});

test('parseBuildArguments rejects an unknown environment, a missing value and other flags', () => {
  assert.throws(
    () => parseBuildArguments(['--env', 'staging']),
    /"staging" is not an environment/,
  );
  assert.throws(() => parseBuildArguments(['--env']), /--env needs an environment/);
  assert.throws(
    () => parseBuildArguments(['--env', '--mode']),
    /--env needs an environment/,
  );
  assert.throws(() => parseBuildArguments(['--mode', 'x']), /Unknown argument "--mode"/);
});

test('availableEnvironments lists the env files that exist, in a fixed order', async () => {
  await withEnvFiles(['production', 'local'], (root) => {
    assert.deepEqual(availableEnvironments(root), ['local', 'production']);
  });
  await withEnvFiles([], (root) => {
    assert.deepEqual(availableEnvironments(root), []);
  });
});

test('resolveAnswer takes a number, a name, or Enter for the first listed', () => {
  const available = ['local', 'development', 'production'];
  assert.equal(resolveAnswer('', available), 'local');
  assert.equal(resolveAnswer('  ', available), 'local');
  assert.equal(resolveAnswer('2', available), 'development');
  assert.equal(resolveAnswer(' Production ', available), 'production');
  assert.equal(resolveAnswer('4', available), undefined);
  assert.equal(resolveAnswer('0', available), undefined);
  assert.equal(resolveAnswer('staging', available), undefined);
  assert.equal(resolveAnswer('', ['development']), 'development');
});

test('asks in a terminal when .env.local exists, offering every env file present', async () => {
  await withEnvFiles(['local', 'development', 'production'], async (root) => {
    const { environment, asked } = await choose(root, { answer: 'development' });
    assert.equal(environment, 'development');
    assert.deepEqual(asked, [['local', 'development', 'production']]);
  });
});

test('asks when only .env.development exists', async () => {
  await withEnvFiles(['development'], async (root) => {
    const { environment, asked } = await choose(root, { answer: 'development' });
    assert.equal(environment, 'development');
    assert.deepEqual(asked, [['development']]);
  });
});

test('--env and BUILD_ENVIRONMENT choose without asking', async () => {
  await withEnvFiles(['local', 'production'], async (root) => {
    const flag = await choose(root, { argv: ['--env', 'production'] });
    assert.deepEqual(flag, { environment: 'production', asked: [] });
    const shell = await choose(root, { env: { BUILD_ENVIRONMENT: 'local' } });
    assert.deepEqual(shell, { environment: 'local', asked: [] });
  });
});

test('a chosen environment without its env file stops before the build', async () => {
  await withEnvFiles(['local'], async (root) => {
    await assert.rejects(
      choose(root, { argv: ['--env', 'production'] }),
      /no \.env\.production/,
    );
  });
});

test('never asks in CI, outside a terminal, or with no env file — Vite defaults apply', async () => {
  await withEnvFiles(['local', 'development'], async (root) => {
    assert.deepEqual(await choose(root, { env: { CI: 'true' } }), {
      environment: undefined,
      asked: [],
    });
    assert.deepEqual(await choose(root, { interactive: false }), {
      environment: undefined,
      asked: [],
    });
  });
  await withEnvFiles([], async (root) => {
    assert.deepEqual(await choose(root), { environment: undefined, asked: [] });
  });
});

test('--sentry is read alongside --env, in either order', () => {
  assert.deepEqual(parseBuildArguments(['--sentry']), { sentry: true });
  assert.deepEqual(parseBuildArguments(['--env', 'production', '--sentry']), {
    environment: 'production',
    sentry: true,
  });
  assert.deepEqual(parseBuildArguments(['--sentry', '--env=development']), {
    environment: 'development',
    sentry: true,
  });
  assert.throws(
    () => parseBuildArguments(['--env', '--sentry']),
    /--env needs an environment/,
  );
});

test('childEnvironment sets BUILD_ENVIRONMENT, and the Sentry upload only for --sentry', () => {
  const env = { PATH: '/usr/bin' };
  assert.deepEqual(childEnvironment({ env }), { PATH: '/usr/bin' });
  assert.deepEqual(childEnvironment({ environment: 'production', env }), {
    PATH: '/usr/bin',
    BUILD_ENVIRONMENT: 'production',
  });
  assert.deepEqual(childEnvironment({ environment: 'production', sentry: true, env }), {
    PATH: '/usr/bin',
    BUILD_ENVIRONMENT: 'production',
    SENTRY_UPLOAD_SOURCEMAPS: 'true',
  });
  // Without --sentry nothing is added — a value the shell set on purpose is passed through.
  assert.deepEqual(childEnvironment({ env: { SENTRY_UPLOAD_SOURCEMAPS: 'true' } }), {
    SENTRY_UPLOAD_SOURCEMAPS: 'true',
  });
});

test('the command line stops on a bad argument before anything is built', () => {
  const script = fileURLToPath(new URL('./build.mjs', import.meta.url));
  for (const [args, message] of [
    [['--env', 'staging'], 'pnpm build: "staging" is not an environment'],
    [['--mode', 'production'], 'pnpm build: Unknown argument "--mode"'],
  ]) {
    const result = spawnSync('node', [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1, args.join(' '));
    assert.ok(result.stderr.includes(message), result.stderr);
  }
});
