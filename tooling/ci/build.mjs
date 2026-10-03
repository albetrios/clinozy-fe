#!/usr/bin/env node
/**
 * `pnpm build` — asks which environment's env file the build reads, then runs
 * `pnpm build:bundle` (tsc, vite build, strip-sourcemaps).
 *
 * A build runs in Vite mode `production`, so on its own Vite reads `.env.local` and lays
 * `.env.production` over it — on a developer machine, two environments mixed key by key.
 * When this runs in a terminal and any environment's file is present (`.env.local`,
 * `.env.development`, `.env.production`), it lists the ones that exist and asks. The answer
 * reaches `vite.config.ts` as `BUILD_ENVIRONMENT`, and that file is then read alone
 * (`plugins/build-environment.ts`).
 *
 *   pnpm build                              ask (terminal, an env file present)
 *   pnpm build --env production             no question: .env.production alone
 *   BUILD_ENVIRONMENT=local pnpm build      the same, from the shell
 *
 * Nothing is asked in CI or when stdin or stdout is not a terminal (`pnpm health`,
 * Playwright's webServer, report scripts): the build then reads Vite's default files,
 * exactly as before this script existed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

/** Mirrors `BUILD_ENVIRONMENTS` in plugins/build-environment.ts (pinned equal by a test). */
export const ENVIRONMENTS = ['local', 'development', 'production'];

const VARIABLE = 'BUILD_ENVIRONMENT';

/**
 * Reads `--env <environment>` / `--env=<environment>` from the arguments.
 *
 * @param {string[]} argv
 * @returns {{ environment?: string }}
 */
export function parseBuildArguments(argv) {
  let environment;
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
    } else {
      throw new Error(
        `Unknown argument "${argument}" — pnpm build takes only --env <environment>.`,
      );
    }
  }
  if (environment !== undefined && !ENVIRONMENTS.includes(environment)) {
    throw new Error(
      `"${environment}" is not an environment — use ${ENVIRONMENTS.join(', ')}.`,
    );
  }
  return environment === undefined ? {} : { environment };
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
  const chosen = parseBuildArguments(argv).environment ?? (env[VARIABLE] || undefined);
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
  let environment;
  let asked = false;
  try {
    environment = await chooseEnvironment({
      argv: process.argv.slice(2),
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

  if (environment !== undefined) {
    const hint = asked
      ? ` (next time without asking: pnpm build --env ${environment})`
      : '';
    console.log(`pnpm build: building with .env.${environment} alone${hint}.`);
  } else if (!process.env.CI && availableEnvironments(process.cwd()).length > 0) {
    // Nobody chose and nobody could be asked (not a terminal): say what Vite will read.
    console.log(
      "pnpm build: not asked (not a terminal) — Vite's default env files: .env.local, then .env.production on top. Choose one with --env <environment>.",
    );
  }
  const result = spawnSync('pnpm', ['run', 'build:bundle'], {
    stdio: 'inherit',
    env:
      environment === undefined
        ? process.env
        : { ...process.env, [VARIABLE]: environment },
  });
  process.exit(result.status ?? 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
