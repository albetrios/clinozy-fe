/**
 * Fail-loud validation for GitHub Environment deploy secrets.
 *
 * Validates required secrets from tooling/setup/setup.config.json against either:
 *   - GitHub API (default, local `pnpm validate:deploy-env`)
 *   - Runtime env (CI: GITHUB_ENV_VALIDATION_SOURCE=runtime)
 *
 * Also checks protection drift unless SKIP_GITHUB_ENV=1.
 *
 * Usage:
 *   pnpm validate:deploy-env
 *   CONFIG=production pnpm validate:deploy-env
 *   GITHUB_ENV_VALIDATION_SOURCE=runtime CONFIG=development node tooling/setup/github/validate-github-env.mjs
 */
import { fileURLToPath } from 'node:url';

import { validateGitHubEnvironmentsDrift } from './check-environments-drift.mjs';
import { driftResultsHaveIssues } from './environments-util.mjs';
import { listGitHubEnvironmentSecretNames, requireGhAuth } from './github-shared.mjs';
import {
  getOptionalDeploySecretNames,
  getRequiredDeploySecretNames,
  resolveGitHubEnvironmentName,
} from './setup-config.mjs';

/**
 * @param {Record<string, string | undefined>} environmentValues
 * @param {readonly string[]} [allowedNames]
 */
export function getRuntimeSecretNames(environmentValues, allowedNames) {
  const keys = allowedNames ?? Object.keys(environmentValues);
  return keys.filter((name) => {
    const value = environmentValues[name];
    return typeof value === 'string' && value.trim() !== '';
  });
}

/**
 * @param {string} environment
 * @param {readonly string[]} presentNames
 */
export function validateDeploySecrets(environment, presentNames) {
  const present = new Set(presentNames);
  const required = getRequiredDeploySecretNames(environment);
  const optional = getOptionalDeploySecretNames(environment);

  const missingRequired = required.filter((name) => !present.has(name));
  const missingOptional = optional.filter((name) => !present.has(name));

  return { missingRequired, missingOptional, required, optional };
}

function validateProtectionDrift(environment) {
  const skipGitHub =
    process.env.SKIP_GITHUB_ENV === '1' || process.env.SKIP_GITHUB_ENV === 'true';
  if (skipGitHub) {
    console.log(
      'SKIP_GITHUB_ENV set — skipping GitHub environment protection drift check.',
    );
    console.log('');
    return true;
  }

  requireGhAuth();
  const results = validateGitHubEnvironmentsDrift({ environmentNames: [environment] });
  if (driftResultsHaveIssues(results)) {
    console.error(
      'GitHub environment protection drift: update GitHub UI or edit .github/environments/*.json so they match.',
    );
    console.error('See .github/environments/README.md');
    console.error('');
    return false;
  }
  return true;
}

function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.includes('--help') || argumentsList.includes('-h')) {
    console.log('Usage: pnpm validate:deploy-env');
    console.log('');
    console.log(
      '  CONFIG=<environment|branch>   Target environment (default: development)',
    );
    console.log(
      '  GITHUB_ENV_VALIDATION_SOURCE=runtime   Validate process.env (CI deploy gate)',
    );
    console.log('  SKIP_GITHUB_ENV=1             Skip protection drift check');
    console.log('');
    console.log(
      'For bundled VITE_* deploy checks, use: pnpm validate:client-env --env <local|development|production>',
    );
    process.exit(0);
  }

  const config = process.env.CONFIG ?? 'development';
  const environment = resolveGitHubEnvironmentName(config);

  if (!validateProtectionDrift(environment)) {
    process.exit(1);
  }

  console.log(`Validating GitHub environment deploy secrets: ${environment}`);
  console.log(
    'Required secrets source: tooling/setup/setup.config.json (deploySecretsRequired)',
  );
  console.log('');

  const validationSource = process.env.GITHUB_ENV_VALIDATION_SOURCE ?? 'github-api';
  /** @type {string[]} */
  let presentNames;

  if (validationSource === 'runtime') {
    const allowed = [
      ...getRequiredDeploySecretNames(environment),
      ...getOptionalDeploySecretNames(environment),
    ];
    presentNames = getRuntimeSecretNames(process.env, allowed);
    console.log('Validation source: runtime environment');
    console.log(`Runtime entries:   ${presentNames.length} deploy key(s)`);
  } else {
    requireGhAuth();
    try {
      presentNames = listGitHubEnvironmentSecretNames(environment);
    } catch (fetchError) {
      console.error(
        fetchError instanceof Error ? fetchError.message : String(fetchError),
      );
      process.exit(1);
    }
    console.log('Validation source: GitHub API');
    console.log(`GitHub secrets:    ${presentNames.length}`);
  }

  console.log('');

  const { missingRequired, missingOptional, required } = validateDeploySecrets(
    environment,
    presentNames,
  );

  if (missingRequired.length === 0) {
    console.log(
      `All ${required.length} required deploy secret(s) present for GitHub environment "${environment}".`,
    );
  } else {
    console.error(
      `${missingRequired.length} required deploy secret(s) missing from GitHub environment "${environment}":`,
    );
    for (const name of missingRequired) {
      console.error(`  ${name}`);
    }
    console.error('');
    console.error('Fix: run `pnpm github:sync` after filling .env.<environment>.');
    console.error('See .github/environments/README.md');
    console.error('');
  }

  if (missingOptional.length > 0) {
    console.warn(
      `${missingOptional.length} optional deploy secret(s) missing (cookie banner / analytics may be degraded):`,
    );
    for (const name of missingOptional) {
      console.warn(`  ${name}`);
    }
    console.log('');
  }

  if (missingRequired.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
