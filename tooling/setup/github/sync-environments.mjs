/**
 * Ensure GitHub Environment shells exist (protection is drift-checked separately).
 */
import { fileURLToPath } from 'node:url';

import { loadGitHubEnvironmentConfigs } from './environments-util.mjs';
import {
  createEnvironment,
  environmentExists,
  getRepositoryIdentifier,
} from './github-shared.mjs';

/**
 * @param {'sync' | 'check' | 'dry-run'} mode
 */
export function ensureGitHubEnvironments(mode) {
  const repository = getRepositoryIdentifier();
  const configs = loadGitHubEnvironmentConfigs();

  let drift = 0;
  let failures = 0;

  for (const config of configs) {
    try {
      const exists = environmentExists(repository, config.name);

      if (exists) {
        console.log(`  ${config.name}: already present`);
        continue;
      }

      if (mode === 'check') {
        console.error(`  ${config.name}: missing on remote`);
        drift += 1;
        continue;
      }

      if (mode === 'dry-run') {
        console.log(`  ${config.name}: would create`);
        continue;
      }

      createEnvironment(repository, config.name);
      console.log(`  ${config.name}: created`);
    } catch (ensureError) {
      failures += 1;
      console.error(`  ${config.name}: FAILED`);
      console.error(
        `    ${ensureError instanceof Error ? ensureError.message : String(ensureError)}`,
      );
    }
  }

  return { drift, failures };
}

function main() {
  const mode = process.argv.includes('--check')
    ? 'check'
    : process.argv.includes('--dry-run')
      ? 'dry-run'
      : 'sync';

  console.log(`Ensuring GitHub environments (mode: ${mode})`);
  const result = ensureGitHubEnvironments(mode);

  if (mode === 'check' && result.drift > 0) {
    console.error(`Drift: ${result.drift} environment(s) missing on GitHub.`);
    process.exit(1);
  }

  if (result.failures > 0) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
