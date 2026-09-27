/**
 * Validate GitHub Environment protection drift (committed JSON ↔ GitHub UI).
 *
 * Usage — folded into the aggregate `pnpm github:sync --check`; runnable directly
 * for the CI protection-drift check in scheduled-release-guards.yml:
 *   node tooling/setup/github/check-environments-drift.mjs
 *   SKIP_GITHUB_ENV=1 node tooling/setup/github/check-environments-drift.mjs
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compareGitHubEnvironmentToConfig,
  driftResultsHaveIssues,
  loadGitHubEnvironmentConfigs,
  parseGitHubEnvironmentApiResponse,
} from './environments-util.mjs';
import { getRepositoryIdentifier, requireGhAuth, runGhJson } from './github-shared.mjs';

/**
 * @param {{ environmentNames?: string[] }} [options]
 */
export function validateGitHubEnvironmentsDrift(options = {}) {
  const repository = getRepositoryIdentifier();
  const configs = loadGitHubEnvironmentConfigs();
  const selectedNames = options.environmentNames
    ? new Set(options.environmentNames.map((name) => name.trim()).filter(Boolean))
    : undefined;
  const selectedConfigs = selectedNames
    ? configs.filter((config) => selectedNames.has(config.name))
    : configs;

  if (selectedNames && selectedConfigs.length !== selectedNames.size) {
    const configuredNames = new Set(configs.map((config) => config.name));
    const missingNames = [...selectedNames].filter((name) => !configuredNames.has(name));
    throw new Error(
      `Missing GitHub environment config file for: ${missingNames.join(', ') || 'unknown'}`,
    );
  }

  console.log('Validating GitHub environment protection (config ↔ UI)');
  console.log(`  Repository: ${repository}`);
  console.log(
    `  Environments: ${selectedConfigs.map((config) => config.name).join(', ')}`,
  );
  console.log('');

  /** @type {Array<{ environment: string, configPath: string, issues: ReturnType<typeof compareGitHubEnvironmentToConfig> }>} */
  const results = [];

  for (const config of selectedConfigs) {
    const configPath = join(config.filePath);
    const apiResponse = runGhJson([
      'api',
      `repos/${repository}/environments/${config.name}`,
    ]);
    const live = parseGitHubEnvironmentApiResponse(apiResponse);
    const issues = compareGitHubEnvironmentToConfig(config, live);
    results.push({ environment: config.name, configPath, issues });

    if (issues.length === 0) {
      console.log(`  ${config.name}: OK`);
      continue;
    }

    console.error(`  ${config.name}: drift detected (${issues.length} issue(s))`);
    for (const issue of issues) {
      console.error(`    - ${issue.detail}`);
    }
  }

  console.log('');
  return results;
}

function main() {
  const argumentsList = process.argv.slice(2);

  if (argumentsList.includes('--help') || argumentsList.includes('-h')) {
    console.log(
      'Usage: node tooling/setup/github/check-environments-drift.mjs [--check]  (or `pnpm github:sync --check`)',
    );
    console.log('');
    console.log(
      '  --check   Compare .github/environments/*.json vs GitHub API (default)',
    );
    console.log('  SKIP_GITHUB_ENV=1   Skip API calls');
    process.exit(0);
  }

  const skipGitHub =
    process.env.SKIP_GITHUB_ENV === '1' || process.env.SKIP_GITHUB_ENV === 'true';
  if (skipGitHub) {
    console.log(
      'SKIP_GITHUB_ENV set — skipping GitHub environment protection drift check.',
    );
    process.exit(0);
  }

  requireGhAuth();
  const results = validateGitHubEnvironmentsDrift();

  if (!driftResultsHaveIssues(results)) {
    console.log(
      'GitHub environment protection: OK (committed config matches GitHub UI).',
    );
    process.exit(0);
  }

  console.error(
    'GitHub environment protection drift: update GitHub UI or edit .github/environments/*.json so they match.',
  );
  console.error('See .github/environments/README.md');
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
