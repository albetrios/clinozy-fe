/**
 * Scaffold gitignored `.env.development` / `.env.production` from deploy secret keys.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadSetupConfig } from './setup-config.mjs';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../..');

/**
 * @param {{ dryRun?: boolean }} [options]
 */
export function scaffoldGithubEnvFiles(options = {}) {
  const { environments } = loadSetupConfig();
  /** @type {string[]} */
  const created = [];

  for (const environment of environments) {
    const filePath = resolve(PROJECT_ROOT, `.env.${environment.name}`);
    if (existsSync(filePath)) continue;

    const secretNames = environment.deploySecrets ?? [];
    const lines = [
      `# GitHub Environment: ${environment.name}`,
      '# Fill values locally — gitignored. Push with `pnpm github:sync`.',
      '# See .env.example for the full key reference.',
      '',
      ...secretNames.map((name) => `${name}=`),
      '',
    ];

    if (options.dryRun) {
      console.log(`  would create .env.${environment.name}`);
      created.push(`.env.${environment.name}`);
      continue;
    }

    writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log(`  created .env.${environment.name}`);
    created.push(`.env.${environment.name}`);
  }

  return { created };
}
