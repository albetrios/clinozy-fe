/**
 * Ensure GitHub Environment shells exist (protection is drift-checked separately).
 */

import { isMain, parseCommandLine } from '../../ci/script.mjs';
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
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: { check: { type: 'boolean' }, 'dry-run': { type: 'boolean' } },
  });
  const mode =
    values.check === true ? 'check' : values['dry-run'] === true ? 'dry-run' : 'sync';

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

if (isMain(import.meta.url)) {
  main();
}
