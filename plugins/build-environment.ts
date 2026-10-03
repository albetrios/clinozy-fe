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

/** The variable a bundle reports its environment through (Sentry, PostHog). */
const IDENTITY_VARIABLE = 'VITE_APP_ENV';

function isBuildEnvironment(value: string): value is BuildEnvironment {
  return (BUILD_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Points a build at one environment's env file and returns the `envDir` Vite should use.
 *
 * A build runs in mode `production`, so Vite on its own reads `.env.local` and lays
 * `.env.production` (then `.env.production.local`) over it — two environments mixed key by
 * key. Instead the build reads ONE file: `.env.<environment>` for the environment
 * {@link BUILD_ENVIRONMENT_VARIABLE} names, or — when nothing chose one — `.env.local`, the
 * same default clinozy-be takes for an unset `NODE_ENV`. Its keys go into `processEnv` (a
 * variable already set in the shell keeps its value, as it would over Vite's own files) and
 * this returns `false`, so Vite reads no env file and takes every value from `processEnv`.
 *
 * Unlike clinozy-be, `.env.local` is never laid over a chosen deploy environment: a build
 * bakes its env into the bundle that ships, so a machine-local override would ship with it.
 *
 * `VITE_APP_ENV` follows the environment read: filled in when its file leaves it out, refused
 * when it names a different one.
 *
 * With nothing chosen and no `.env.local` (CI, deploys) this returns `root` and Vite's own
 * files load — a deploy's materialized `.env.production.local` — exactly as before. Throws on
 * an unknown environment or a missing file, before anything is built. The dev server and
 * `vite preview` are untouched.
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
  if (command !== 'build') return root;
  let environment = processEnv[BUILD_ENVIRONMENT_VARIABLE] || undefined;
  if (environment === undefined) {
    if (!existsSync(join(root, '.env.local'))) return root;
    environment = 'local';
  }
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
  // The bundle reports the environment it was built for — as the deploy workflow derives
  // VITE_APP_ENV from the resolved environment (and clinozy-be's NODE_ENV names the file it
  // reads). Filled in when the file leaves it out; a file or shell naming ANOTHER environment
  // is a mistake, refused before anything is built.
  const identity = processEnv[IDENTITY_VARIABLE];
  if (identity === undefined || identity === '') {
    processEnv[IDENTITY_VARIABLE] = environment;
  } else if (identity !== environment) {
    throw new Error(
      `A ${environment} build reads .env.${environment}, but ${IDENTITY_VARIABLE}=${identity} — it must be ${environment} (or left out).`,
    );
  }
  return false;
}
