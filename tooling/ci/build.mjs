#!/usr/bin/env node
/**
 * `pnpm build` — asks which environment's env file the build reads, then runs
 * `pnpm build:bundle` (tsc, vite build, strip-sourcemaps).
 *
 * A build reads ONE env file (`plugins/build-environment.ts`). When this runs in a terminal
 * and any environment's file is present (`.env.local`, `.env.development`, `.env.production`),
 * it lists the ones that exist and asks; the answer reaches `vite.config.ts` as
 * `BUILD_ENVIRONMENT`.
 *
 *   pnpm build                              ask (terminal, an env file present)
 *   pnpm build --env production             no question: .env.production alone
 *   BUILD_ENVIRONMENT=local pnpm build      the same, from the shell
 *   pnpm build --env production --sentry    also upload source maps to Sentry
 *   pnpm build --defaults                   no env file: the schema defaults, as CI builds
 *
 * Source maps go to Sentry only on request — `--sentry` here, or
 * `SENTRY_UPLOAD_SOURCEMAPS=true` as the deploy workflow sets it. A local build is a test
 * build, so by default it creates no Sentry release, whatever its env file holds.
 *
 * Nothing is asked in CI or when stdin or stdout is not a terminal (`pnpm health`, the
 * pre-push hook, Playwright's webServer, report scripts): the build then reads `.env.local`
 * alone — the `local` default, as clinozy-be reads an unset `NODE_ENV` — or, with no
 * `.env.local` (CI), Vite's default files, as before this script existed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

/** Mirrors `BUILD_ENVIRONMENTS` in plugins/build-environment.ts (pinned equal by a test). */
export const ENVIRONMENTS = ['local', 'development', 'production'];

const VARIABLE = 'BUILD_ENVIRONMENT';
const SENTRY_VARIABLE = 'SENTRY_UPLOAD_SOURCEMAPS';
/** Mirrors `BUILD_DEFAULTS_VARIABLE` in plugins/build-environment.ts (pinned equal by a test). */
export const DEFAULTS_VARIABLE = 'BUILD_SCHEMA_DEFAULTS';

/**
 * Reads `--env <environment>` / `--env=<environment>`, `--defaults` and `--sentry` from the
 * arguments. `--defaults` builds from no env file (the schema defaults, as CI builds), so it
 * cannot name an environment too.
 *
 * @param {string[]} argv
 * @returns {{ environment?: string, defaults?: true, sentry?: true }}
 */
export function parseBuildArguments(argv) {
  let environment;
  let defaults = false;
  let sentry = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env') {
      environment = argv[index + 1];
      index += 1;
      if (environment === undefined || environment.startsWith('--')) {
        throw new Error(`--env needs an environment: ${ENVIRONMENTS.join(', ')}.`);
      }
    } else if (argument.startsWith('--env=')) {
      environment = argument.slice('--env='.length);
    } else if (argument === '--defaults') {
      defaults = true;
    } else if (argument === '--sentry') {
      sentry = true;
    } else {
      throw new Error(
        `Unknown argument "${argument}" — pnpm build takes --env <environment>, --defaults and --sentry.`,
      );
    }
  }
  if (defaults && environment !== undefined) {
    throw new Error(
      '--defaults builds from no env file; it cannot be combined with --env.',
    );
  }
  if (environment !== undefined && !ENVIRONMENTS.includes(environment)) {
    throw new Error(
      `"${environment}" is not an environment — use ${ENVIRONMENTS.join(', ')}.`,
    );
  }
  return {
    ...(environment === undefined ? {} : { environment }),
    ...(defaults ? { defaults: true } : {}),
    ...(sentry ? { sentry: true } : {}),
  };
}

/**
 * The env the build chain runs with: the chosen environment as `BUILD_ENVIRONMENT`, and
 * `SENTRY_UPLOAD_SOURCEMAPS=true` only for `--sentry` (a value already in the shell is kept).
 * For `--defaults`, `BUILD_SCHEMA_DEFAULTS=true` and no `VITE_*` from the shell either — a
 * shell value beats every env file, so a cloud container's exported keys would otherwise reach
 * the bundle that CI builds without them.
 *
 * @param {{ environment?: string, defaults?: boolean, sentry?: boolean, env: NodeJS.ProcessEnv }} options
 * @returns {NodeJS.ProcessEnv}
 */
export function childEnvironment({ environment, defaults, sentry, env }) {
  const base = defaults
    ? Object.fromEntries(
        Object.entries(env).filter(
          ([key]) => !key.startsWith('VITE_') && key !== VARIABLE,
        ),
      )
    : env;
  return {
    ...base,
    ...(environment === undefined ? {} : { [VARIABLE]: environment }),
    ...(defaults ? { [DEFAULTS_VARIABLE]: 'true' } : {}),
    ...(sentry ? { [SENTRY_VARIABLE]: 'true' } : {}),
  };
}

/**
 * The environments whose env file exists under `root`, in {@link ENVIRONMENTS} order.
 *
 * @param {string} root
 */
export function availableEnvironments(root) {
  return ENVIRONMENTS.filter((environment) =>
    existsSync(join(root, `.env.${environment}`)),
  );
}

/**
 * Maps an answer to an environment: its number in the list, its name, or nothing for the
 * first one listed. Anything else is `undefined`.
 *
 * @param {string} answer
 * @param {string[]} available
 */
export function resolveAnswer(answer, available) {
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === '') return available[0];
  if (/^\d+$/.test(trimmed)) return available[Number(trimmed) - 1];
  return available.includes(trimmed) ? trimmed : undefined;
}

/**
 * Decides the environment, asking only when nothing chose one, the session is
 * interactive, and at least one env file exists. `undefined` means Vite's default files.
 *
 * @param {{
 *   argv: string[],
 *   env: NodeJS.ProcessEnv,
 *   root: string,
 *   interactive: boolean,
 *   ask: (available: string[]) => Promise<string>,
 * }} options
 * @returns {Promise<string | undefined>}
 */
export async function chooseEnvironment({ argv, env, root, interactive, ask }) {
  const parsed = parseBuildArguments(argv);
  if (parsed.defaults) return undefined;
  const chosen = parsed.environment ?? (env[VARIABLE] || undefined);
  const available = availableEnvironments(root);
  if (chosen !== undefined) {
    if (!available.includes(chosen)) {
      throw new Error(`There is no .env.${chosen} to build with.`);
    }
    return chosen;
  }
  if (!interactive || env.CI || available.length === 0) return undefined;
  return ask(available);
}

/**
 * Lists the available environments and asks until the answer names one.
 *
 * @param {string[]} available
 */
async function askInTerminal(available) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  readline.on('SIGINT', () => {
    readline.close();
    process.exit(130);
  });
  const width = Math.max(...available.map((environment) => environment.length));
  console.log('Which environment should this build use?');
  available.forEach((environment, index) => {
    console.log(`  ${index + 1}) ${environment.padEnd(width)}  .env.${environment}`);
  });
  try {
    for (;;) {
      const answer = await readline.question(
        `Build reads that file alone. [1 = ${available[0]}] `,
      );
      const environment = resolveAnswer(answer, available);
      if (environment !== undefined) return environment;
      console.log(`  Answer 1–${available.length} or a name: ${available.join(', ')}.`);
    }
  } finally {
    readline.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  let environment;
  let defaults = false;
  let sentry = false;
  let asked = false;
  try {
    const parsed = parseBuildArguments(argv);
    defaults = parsed.defaults === true;
    sentry = parsed.sentry === true;
    environment = await chooseEnvironment({
      argv,
      env: process.env,
      root: process.cwd(),
      interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
      ask: (available) => {
        asked = true;
        return askInTerminal(available);
      },
    });
  } catch (error) {
    console.error(
      `pnpm build: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  if (defaults) {
    console.log(
      "pnpm build: building with no env file (--defaults) — the schema defaults, as CI's Build verify lane builds.",
    );
  } else if (environment !== undefined) {
    const hint = asked
      ? ` (next time without asking: pnpm build --env ${environment}${sentry ? ' --sentry' : ''})`
      : '';
    console.log(`pnpm build: building with .env.${environment} alone${hint}.`);
  } else if (availableEnvironments(process.cwd()).includes('local')) {
    // Nobody chose and nobody could be asked (not a terminal): say what the build reads.
    console.log(
      'pnpm build: not asked (not a terminal) — building with .env.local alone, the local default. Choose another with --env <environment>.',
    );
  }
  if (sentry) console.log('pnpm build: uploading source maps to Sentry (--sentry).');
  const result = spawnSync('pnpm', ['run', 'build:bundle'], {
    stdio: 'inherit',
    env: childEnvironment({ environment, defaults, sentry, env: process.env }),
  });
  process.exit(result.status ?? 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
