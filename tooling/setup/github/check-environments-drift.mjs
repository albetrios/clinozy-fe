/**
 * Validate GitHub Environment protection drift (committed JSON ↔ GitHub UI).
 *
 * Usage — folded into the aggregate `pnpm github:sync --check`; runnable directly
 * for the CI protection-drift check in scheduled-release-guards.yml:
 *   node tooling/setup/github/check-environments-drift.mjs
 *   SKIP_GITHUB_ENV=1 node tooling/setup/github/check-environments-drift.mjs
 */
import { join } from 'node:path';

import { isMain, parseCommandLine } from '../../ci/script.mjs';
import {
  compareGitHubEnvironmentToConfig,
  driftResultsHaveIssues,
  loadGitHubEnvironmentConfigs,
  parseGitHubEnvironmentApiResponse,
  requiredReviewersSupport,
} from './environments-util.mjs';
import { getRepositoryIdentifier, requireGhAuth, runGhJson } from './github-shared.mjs';

/**
 * Can GitHub enforce required reviewers here? Reads the repository's visibility and, for a private
 * organization repository, the organization's plan (visible to organization owners only).
 *
 * @param {string} repository
 * @returns {{ support: 'supported' | 'unsupported' | 'unknown', plan: string | undefined }}
 */
function readRequiredReviewersSupport(repository) {
  /** @type {{ private?: boolean, owner?: { login?: string, type?: string } }} */
  let repositoryInfo;
  try {
    repositoryInfo = runGhJson(['api', `repos/${repository}`]);
  } catch {
    return { support: 'unknown', plan: undefined };
  }
  const isPrivate = repositoryInfo.private === true;
  const ownerType = repositoryInfo.owner?.type ?? 'User';
  /** @type {string | undefined} */
  let ownerPlan;
  if (isPrivate && ownerType === 'Organization' && repositoryInfo.owner?.login) {
    try {
      ownerPlan = runGhJson(['api', `orgs/${repositoryInfo.owner.login}`]).plan?.name;
    } catch {
      ownerPlan = undefined;
    }
  }
  return {
    support: requiredReviewersSupport({ isPrivate, ownerType, ownerPlan }),
    plan: ownerPlan,
  };
}

/** @param {{ protection?: { requiredReviewers?: { users?: string[], teams?: string[] } } }} config */
function declaresReviewers(config) {
  const reviewers = config.protection?.requiredReviewers;
  return (reviewers?.users?.length ?? 0) + (reviewers?.teams?.length ?? 0) > 0;
}

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
  /** @type {ReturnType<typeof readRequiredReviewersSupport> | undefined} */
  let reviewersProbe;

  for (const config of selectedConfigs) {
    const configPath = join(config.filePath);
    const apiResponse = runGhJson([
      'api',
      `repos/${repository}/environments/${config.name}`,
    ]);
    const live = parseGitHubEnvironmentApiResponse(apiResponse);
    let checkReviewers = true;
    if (declaresReviewers(config)) {
      reviewersProbe ??= readRequiredReviewersSupport(repository);
      if (reviewersProbe.support !== 'supported') {
        checkReviewers = false;
        const reason =
          reviewersProbe.support === 'unsupported'
            ? `GitHub needs Enterprise for them on a private repository (this account is on ${reviewersProbe.plan ?? 'a personal plan'})`
            : "this token can't read the account's plan";
        console.log(
          `  ${config.name}: required reviewers not checked — ${reason}. The deployment branch policy still is.`,
        );
      }
    }
    const issues = compareGitHubEnvironmentToConfig(config, live, { checkReviewers });
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
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: { help: { type: 'boolean', short: 'h' }, check: { type: 'boolean' } },
  });

  if (values.help === true) {
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

if (isMain(import.meta.url)) {
  main();
}
