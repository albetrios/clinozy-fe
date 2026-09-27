/**
 * Load tooling/setup/setup.config.json — environments + git config for GitHub IaC
 * sync. Single trunk: the branch is `git.defaultBranch` (not per-environment).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SETUP_CONFIG_PATH = resolve(import.meta.dirname, '../setup.config.json');

/** @typedef {{ name: string, deploySecrets?: string[], deploySecretsRequired?: string[], deployVariables?: string[] }} SetupEnvironment */

/**
 * @returns {{
 *   environments: SetupEnvironment[],
 *   repository?: string,
 * }}
 */
export function loadSetupConfig() {
  const raw = JSON.parse(readFileSync(SETUP_CONFIG_PATH, 'utf-8'));
  return {
    environments: raw.environments ?? [],
    repository: raw.providers?.github?.repository,
  };
}

/** @returns {string[]} */
export function getConfiguredEnvironmentNames() {
  return loadSetupConfig()
    .environments.map((environment) => environment.name)
    .sort();
}

/**
 * @param {string} config
 */
export function resolveGitHubEnvironmentName(config) {
  const { environments } = loadSetupConfig();
  const byName = Object.fromEntries(environments.map((env) => [env.name, env.name]));
  const shorthand = {
    dev: byName.development ?? 'development',
    prod: byName.production ?? 'production',
  };
  return byName[config] ?? shorthand[config] ?? config;
}

/**
 * @param {string} environmentName
 */
export function getEnvironmentConfig(environmentName) {
  const environment = loadSetupConfig().environments.find(
    (entry) => entry.name === environmentName,
  );
  if (!environment) {
    throw new Error(
      `Unknown environment "${environmentName}" — not in setup.config.json.`,
    );
  }
  return environment;
}

/**
 * Required deploy secrets — fail validation when missing.
 * @param {string} environmentName
 */
export function getRequiredDeploySecretNames(environmentName) {
  const environment = getEnvironmentConfig(environmentName);
  if (environment.deploySecretsRequired?.length) {
    return [...environment.deploySecretsRequired];
  }
  return ['VITE_API_BASE_URL', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'];
}

/**
 * Optional deploy secrets — warn when missing, do not fail.
 * @param {string} environmentName
 */
export function getOptionalDeploySecretNames(environmentName) {
  const environment = getEnvironmentConfig(environmentName);
  const required = new Set(getRequiredDeploySecretNames(environmentName));
  const all = environment.deploySecrets ?? [];
  return all.filter((name) => !required.has(name));
}

/**
 * Deploy VARIABLES (non-secret GitHub Environment Variables read as `vars.*` by
 * the deploy workflow) — the managed variable allowlist. Unlike secrets, these
 * are diffed against GitHub and only pushed when missing/different; a variable
 * equal to its env-schema default is pruned so the runtime falls back to the
 * identical default. Classification MUST match how the workflow reads each key
 * (`vars.*` vs `secrets.*`) — see docs/deployment/runbooks/environment-variables.md.
 * @param {string} environmentName
 * @returns {string[]}
 */
export function getDeployVariableNames(environmentName) {
  const environment = getEnvironmentConfig(environmentName);
  return [...(environment.deployVariables ?? [])];
}
