import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

import type { ConfigEnv } from 'vite';

/**
 * The environments a build can be pointed at, one env file each (`.env.<environment>`).
 *
 * Mirrors `AppEnvironment` in `src/core/config/env-schema.ts` and `ENVIRONMENTS` in
 * `tooling/ci/build.mjs` (plain Node, so it cannot import this file); all three are pinned
 * equal by `tests/ci/build-environment.policy.test.ts`.
 */
export const BUILD_ENVIRONMENTS = ['local', 'development', 'production'] as const;

/** One of {@link BUILD_ENVIRONMENTS}. */
export type BuildEnvironment = (typeof BUILD_ENVIRONMENTS)[number];

/**
 * The variable naming the environment a build reads. `pnpm build` sets it from its question
 * or `--env` (`tooling/ci/build.mjs`); the shell may set it too. It chooses a file, so it is
 * never itself written in one.
 */
export const BUILD_ENVIRONMENT_VARIABLE = 'BUILD_ENVIRONMENT';

function isBuildEnvironment(value: string): value is BuildEnvironment {
  return (BUILD_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Points a build at one environment's env file and returns the `envDir` Vite should use.
 *
 * A build runs in mode `production`, so Vite on its own reads `.env.local` and lays
 * `.env.production` (then `.env.production.local`) over it — on a developer machine, two
 * environments mixed key by key. With {@link BUILD_ENVIRONMENT_VARIABLE} unset (CI, deploys,
 * any caller that did not choose) that is still what happens: this returns `root`. With it
 * set, `.env.<environment>` is read ALONE: its keys go into `processEnv` — a variable already
 * set in the shell keeps its value, as it would over Vite's own files — and this returns
 * `false`, so Vite reads no env file and takes every value from `processEnv`.
 *
 * Throws on an unknown environment or a missing file, before anything is built. The dev
 * server and `vite preview` are untouched.
 */
export function applyBuildEnvironment({
  command,
  root,
  processEnv = process.env,
}: {
  command: ConfigEnv['command'];
  root: string;
  processEnv?: NodeJS.ProcessEnv;
}): string | false {
  const environment = processEnv[BUILD_ENVIRONMENT_VARIABLE];
  if (command !== 'build' || environment === undefined || environment === '') return root;
  if (!isBuildEnvironment(environment)) {
    throw new Error(
      `${BUILD_ENVIRONMENT_VARIABLE}="${environment}" is not an environment — use ${BUILD_ENVIRONMENTS.join(', ')}.`,
    );
  }
  const file = join(root, `.env.${environment}`);
  if (!existsSync(file)) {
    throw new Error(
      `${BUILD_ENVIRONMENT_VARIABLE}=${environment}, but there is no .env.${environment} to build with.`,
    );
  }
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (processEnv[key] === undefined) processEnv[key] = value;
  }
  return false;
}
