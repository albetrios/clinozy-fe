/**
 * Scaffold gitignored `.env.development` / `.env.production`: the environment's deploy
 * secret keys (blank, to fill in) plus its `envProfiles.<env>.defaults` from
 * `src/core/config/env-schema.ts` — `VITE_APP_ENV=<env>` and the diagnostics flags. That
 * matches `pnpm setup:local`, which writes `envProfiles.local.defaults` into `.env.local`,
 * and clinozy-be, whose scaffolded `.env.<env>` carries `NODE_ENV=<env>`. An existing file is
 * never touched.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadSetupConfig } from './setup-config.mjs';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../..');
const ENV_REGISTRY = resolve(PROJECT_ROOT, 'tooling/env-registry/env-registry.ts');

/**
 * `envProfiles.<environment>.defaults`, read through the tsx `env-registry` bridge.
 *
 * @param {string} environment
 * @returns {Record<string, string>}
 */
function loadProfileDefaults(environment) {
  const output = execFileSync(
    'node',
    ['--import', 'tsx', ENV_REGISTRY, '--profile-defaults', environment],
    { encoding: 'utf-8', timeout: 30_000 },
  );
  return JSON.parse(output);
}

/**
 * The content of a new `.env.<environment>` file.
 *
 * @param {string} environment
 * @param {string[]} secretNames
 * @param {Record<string, string>} defaults
 */
export function envFileContent(environment, secretNames, defaults) {
  return [
    `# GitHub Environment: ${environment}`,
    '# Fill values locally — gitignored. Push with `pnpm github:sync`.',
    '# See .env.example for the full key reference.',
    '',
    ...secretNames.map((name) => `${name}=`),
    '',
    `# ${environment} defaults (envProfiles.${environment}.defaults in src/core/config/env-schema.ts)`,
    ...Object.entries(defaults).map(([key, value]) => `${key}=${value}`),
    '',
  ].join('\n');
}

/**
 * @param {{
 *   dryRun?: boolean,
 *   root?: string,
 *   environments?: Array<{ name: string, deploySecrets?: string[] }>,
 *   profileDefaults?: (environment: string) => Record<string, string>,
 * }} [options]
 */
export function scaffoldGithubEnvFiles(options = {}) {
  const root = options.root ?? PROJECT_ROOT;
  const environments = options.environments ?? loadSetupConfig().environments;
  const profileDefaults = options.profileDefaults ?? loadProfileDefaults;
  /** @type {string[]} */
  const created = [];

  for (const environment of environments) {
    const filePath = resolve(root, `.env.${environment.name}`);
    if (existsSync(filePath)) continue;

    if (options.dryRun) {
      console.log(`  would create .env.${environment.name}`);
      created.push(`.env.${environment.name}`);
      continue;
    }

    const content = envFileContent(
      environment.name,
      environment.deploySecrets ?? [],
      profileDefaults(environment.name),
    );
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  created .env.${environment.name}`);
    created.push(`.env.${environment.name}`);
  }

  return { created };
}
