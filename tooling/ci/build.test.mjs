import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

it('parseBuildArguments reads --env in both spellings', () => {
  expect(parseBuildArguments([])).toStrictEqual({});
  expect(parseBuildArguments(['--env', 'production'])).toStrictEqual({
    environment: 'production',
  });
  expect(parseBuildArguments(['--env=development'])).toStrictEqual({
    environment: 'development',
  });
});

it('parseBuildArguments rejects an unknown environment, a missing value and other flags', () => {
  expect(() => parseBuildArguments(['--env', 'staging'])).toThrow(
    /"staging" is not an environment/,
  );
  expect(() => parseBuildArguments(['--env'])).toThrow(/--env needs an environment/);
  expect(() => parseBuildArguments(['--env', '--mode'])).toThrow(
    /--env needs an environment/,
  );
  expect(() => parseBuildArguments(['--mode', 'x'])).toThrow(/Unknown argument "--mode"/);
});

it('availableEnvironments lists the env files that exist, in a fixed order', async () => {
  await withEnvFiles(['production', 'local'], (root) => {
    expect(availableEnvironments(root)).toStrictEqual(['local', 'production']);
  });
  await withEnvFiles([], (root) => {
    expect(availableEnvironments(root)).toStrictEqual([]);
  });
});

it('resolveAnswer takes a number, a name, or Enter for the first listed', () => {
  const available = ['local', 'development', 'production'];
  expect(resolveAnswer('', available)).toBe('local');
  expect(resolveAnswer('  ', available)).toBe('local');
  expect(resolveAnswer('2', available)).toBe('development');
  expect(resolveAnswer(' Production ', available)).toBe('production');
  expect(resolveAnswer('4', available)).toBe(undefined);
  expect(resolveAnswer('0', available)).toBe(undefined);
  expect(resolveAnswer('staging', available)).toBe(undefined);
  expect(resolveAnswer('', ['development'])).toBe('development');
});

it('asks in a terminal when .env.local exists, offering every env file present', async () => {
  await withEnvFiles(['local', 'development', 'production'], async (root) => {
    const { environment, asked } = await choose(root, { answer: 'development' });
    expect(environment).toBe('development');
    expect(asked).toStrictEqual([['local', 'development', 'production']]);
  });
});

it('asks when only .env.development exists', async () => {
  await withEnvFiles(['development'], async (root) => {
    const { environment, asked } = await choose(root, { answer: 'development' });
    expect(environment).toBe('development');
    expect(asked).toStrictEqual([['development']]);
  });
});

it('--env and BUILD_ENVIRONMENT choose without asking', async () => {
  await withEnvFiles(['local', 'production'], async (root) => {
    const flag = await choose(root, { argv: ['--env', 'production'] });
    expect(flag).toStrictEqual({ environment: 'production', asked: [] });
    const shell = await choose(root, { env: { BUILD_ENVIRONMENT: 'local' } });
    expect(shell).toStrictEqual({ environment: 'local', asked: [] });
  });
});

it('a chosen environment without its env file stops before the build', async () => {
  await withEnvFiles(['local'], async (root) => {
    await expect(choose(root, { argv: ['--env', 'production'] })).rejects.toThrow(
      /no \.env\.production/,
    );
  });
});

it('never asks in CI, outside a terminal, or with no env file — Vite defaults apply', async () => {
  await withEnvFiles(['local', 'development'], async (root) => {
    expect(await choose(root, { env: { CI: 'true' } })).toStrictEqual({
      environment: undefined,
      asked: [],
    });
    expect(await choose(root, { interactive: false })).toStrictEqual({
      environment: undefined,
      asked: [],
    });
  });
  await withEnvFiles([], async (root) => {
    expect(await choose(root)).toStrictEqual({ environment: undefined, asked: [] });
  });
});

it('--sentry is read alongside --env, in either order', () => {
  expect(parseBuildArguments(['--sentry'])).toStrictEqual({ sentry: true });
  expect(parseBuildArguments(['--env', 'production', '--sentry'])).toStrictEqual({
    environment: 'production',
    sentry: true,
  });
  expect(parseBuildArguments(['--sentry', '--env=development'])).toStrictEqual({
    environment: 'development',
    sentry: true,
  });
  expect(() => parseBuildArguments(['--env', '--sentry'])).toThrow(
    /--env needs an environment/,
  );
});

it('childEnvironment sets BUILD_ENVIRONMENT, and the Sentry upload only for --sentry', () => {
  const env = { PATH: '/usr/bin' };
  expect(childEnvironment({ env })).toStrictEqual({ PATH: '/usr/bin' });
  expect(childEnvironment({ environment: 'production', env })).toStrictEqual({
    PATH: '/usr/bin',
    BUILD_ENVIRONMENT: 'production',
  });
  expect(
    childEnvironment({ environment: 'production', sentry: true, env }),
  ).toStrictEqual({
    PATH: '/usr/bin',
    BUILD_ENVIRONMENT: 'production',
    SENTRY_UPLOAD_SOURCEMAPS: 'true',
  });
  // Without --sentry nothing is added — a value the shell set on purpose is passed through.
  expect(childEnvironment({ env: { SENTRY_UPLOAD_SOURCEMAPS: 'true' } })).toStrictEqual({
    SENTRY_UPLOAD_SOURCEMAPS: 'true',
  });
});

it('the command line stops on a bad argument before anything is built', () => {
  const script = fileURLToPath(new URL('./build.mjs', import.meta.url));
  for (const [args, message] of [
    [['--env', 'staging'], 'pnpm build: "staging" is not an environment'],
    [['--mode', 'production'], 'pnpm build: Unknown argument "--mode"'],
  ]) {
    const result = spawnSync('node', [script, ...args], { encoding: 'utf8' });
    expect(result.status, args.join(' ')).toBe(1);
    expect(result.stderr.includes(message), result.stderr).toBeTruthy();
  }
});
