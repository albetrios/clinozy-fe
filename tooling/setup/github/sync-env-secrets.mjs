/**
 * Reconcile local `.env.<environment>` deploy VALUES → the matching GitHub
 * Environment. The `.env.<environment>` file is the source of truth, scoped to the
 * managed allowlist (`deploySecrets` + `deployVariables` in setup.config.json):
 *
 *   - Secrets → always pushed (GitHub hides secret values, so they can't be diffed).
 *   - Variables → pushed only when missing or changed; unchanged values are left alone.
 *   - Variables equal to their env-schema default (`envProfiles.<env>.defaults`, read
 *     via the tsx `env-registry` bridge) → not pushed, and pruned from GitHub if
 *     present (the runtime falls back to the identical default). `--keep-schema-defaults`
 *     pushes them verbatim.
 *   - A managed key declared but blank (`KEY=`) → neither pushed nor deleted.
 *   - A managed remote item no longer declared (or reclassified across kinds) → deleted.
 *
 * Unmanaged keys (outside both allowlists) are never touched. The per-key decision
 * logic is the pure, unit-tested `env-sync-plan.mjs`.
 *
 * Usage:
 *   node tooling/setup/github/sync-env-secrets.mjs development
 *   node tooling/setup/github/sync-env-secrets.mjs --all
 *   node tooling/setup/github/sync-env-secrets.mjs production --dry-run
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deleteGitHubSecret,
  deleteGitHubVariable,
  GitHubApiError,
  listGitHubEnvironmentSecretNames,
  listGitHubEnvironmentVariables,
  requireGhAuth,
  setGitHubVariable,
} from './github-shared.mjs';
import {
  findStaleManaged,
  formatSyncPreviewTable,
  planEnvironmentSyncPreview,
  splitManagedEntries,
} from './env-sync-plan.mjs';
import { parseEnvFile } from './parse-env-file.mjs';
import {
  getConfiguredEnvironmentNames,
  getDeployVariableNames,
  getEnvironmentConfig,
} from './setup-config.mjs';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../..');
const ENV_REGISTRY = resolve(PROJECT_ROOT, 'tooling/env-registry/env-registry.ts');

/**
 * Runtime-fallback schema defaults (the Zod `envSchemaBase` defaults, env-INDEPENDENT)
 * via the tsx `env-registry` bridge — the single source of truth for the
 * schema-default prune. A variable equal to this value can be pruned safely because
 * an unset var makes the runtime fall back to the identical value. (Deliberately NOT
 * the per-env `envProfiles.defaults`, which are scaffold values, not the fallback.)
 * @returns {Map<string, string>}
 */
function loadSchemaDefaults() {
  const output = execFileSync('node', ['--import', 'tsx', ENV_REGISTRY, '--defaults'], {
    encoding: 'utf-8',
    timeout: 30_000,
  });
  return new Map(Object.entries(JSON.parse(output)));
}

/**
 * @param {string} environment
 * @param {string} name
 * @param {string} value
 */
function setGitHubSecret(environment, name, value) {
  execFileSync('gh', ['secret', 'set', name, '--env', environment], {
    input: value,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
  });
}

/** Remote secret names, returning `[]` when the environment does not exist yet. */
function safeListSecretNames(environmentName) {
  try {
    return listGitHubEnvironmentSecretNames(environmentName);
  } catch (listError) {
    if (listError instanceof GitHubApiError && listError.status === 404) return [];
    const message = listError instanceof Error ? listError.message : String(listError);
    if (/HTTP 404|Not Found/i.test(message)) return [];
    throw listError;
  }
}

/**
 * Read the managed declared entries plus the classification sets for an environment.
 * @param {string} environmentName
 */
function loadManagedState(environmentName) {
  const config = getEnvironmentConfig(environmentName);
  const secretKeys = new Set(config.deploySecrets ?? []);
  const variableKeys = new Set(getDeployVariableNames(environmentName));
  const parsed = parseEnvFile(resolve(PROJECT_ROOT, `.env.${environmentName}`));
  /** @type {{ name: string, value: string }[]} */
  const declared = [];
  for (const [name, value] of parsed) {
    if (secretKeys.has(name) || variableKeys.has(name)) declared.push({ name, value });
  }
  return { declared, secretKeys, variableKeys };
}

/**
 * Compute the full reconciliation plan for an environment against its live GitHub
 * state — the shared core of check / dry-run / sync / diff.
 * @param {string} environmentName
 * @param {{ keepSchemaDefaults?: boolean, fetchRemote?: boolean }} [options]
 */
function buildPlan(environmentName, options = {}) {
  const { keepSchemaDefaults = false, fetchRemote = true } = options;
  const { declared, secretKeys, variableKeys } = loadManagedState(environmentName);
  const schemaDefaults = loadSchemaDefaults();

  const { secrets, variables, blank, schemaDefault } = splitManagedEntries(declared, {
    secretKeys,
    variableKeys,
    schemaDefaults,
    keepSchemaDefaults,
  });

  const remoteSecretNames = fetchRemote
    ? new Set(safeListSecretNames(environmentName))
    : new Set();
  const remoteVariables = fetchRemote
    ? listGitHubEnvironmentVariables(environmentName)
    : new Map();

  const schemaDefaultNames = new Set(schemaDefault.map((entry) => entry.name));
  const managedNames = new Set([...secretKeys, ...variableKeys]);
  const declaredSecretNames = new Set(
    declared.filter((entry) => secretKeys.has(entry.name)).map((entry) => entry.name),
  );
  const declaredVariableNames = new Set(
    declared
      .filter(
        (entry) => variableKeys.has(entry.name) && !schemaDefaultNames.has(entry.name),
      )
      .map((entry) => entry.name),
  );
  const staleSecrets = findStaleManaged({
    remoteKeys: [...remoteSecretNames],
    declaredNames: declaredSecretNames,
    managedNames,
  });
  const staleVariables = findStaleManaged({
    remoteKeys: [...remoteVariables.keys()],
    declaredNames: declaredVariableNames,
    managedNames,
  });

  return {
    declared,
    secretKeys,
    variableKeys,
    schemaDefaults,
    secrets,
    variables,
    blank,
    schemaDefault,
    schemaDefaultNames,
    remoteSecretNames,
    remoteVariables,
    staleSecrets,
    staleVariables,
  };
}

/**
 * Read-only per-key preview (`--diff`).
 * @param {string} environmentName
 * @param {{ keepSchemaDefaults?: boolean }} [options]
 */
export function previewEnvironmentValues(environmentName, options = {}) {
  const plan = buildPlan(environmentName, {
    keepSchemaDefaults: options.keepSchemaDefaults,
  });
  return planEnvironmentSyncPreview({
    declared: plan.declared,
    remoteVariables: plan.remoteVariables,
    remoteSecretNames: plan.remoteSecretNames,
    secretKeys: plan.secretKeys,
    variableKeys: plan.variableKeys,
    schemaDefaults: plan.schemaDefaults,
    keepSchemaDefaults: options.keepSchemaDefaults ?? false,
  });
}

/**
 * @param {string} environmentName
 * @param {'sync' | 'check' | 'dry-run'} mode
 * @param {{ keepSchemaDefaults?: boolean }} [options]
 */
export function syncEnvironmentValues(environmentName, mode, options = {}) {
  const keepSchemaDefaults = options.keepSchemaDefaults ?? false;
  // dry-run stays auth-free (no GitHub query) — it shows the local-side plan only.
  // check / sync query GitHub to diff and prune; --diff has its own preview path.
  const plan = buildPlan(environmentName, {
    keepSchemaDefaults,
    fetchRemote: mode !== 'dry-run',
  });
  const {
    secrets,
    variables,
    blank,
    schemaDefault,
    schemaDefaultNames,
    remoteVariables,
    staleSecrets,
    staleVariables,
  } = plan;

  console.log(`Environment: ${environmentName}`);
  console.log(`Source:      .env.${environmentName}`);
  console.log(
    `Plan:        push ${secrets.length} secret(s), ${variables.length} variable(s); ` +
      `${blank.length} blank; ${schemaDefault.length} schema-default; ` +
      `${staleSecrets.length + staleVariables.length} stale`,
  );
  console.log('');

  if (mode === 'check') {
    const missingSecrets = secrets.filter(
      (entry) => !plan.remoteSecretNames.has(entry.name),
    );
    const changedVariables = variables.filter(
      (entry) => remoteVariables.get(entry.name) !== entry.value,
    );
    const drift =
      missingSecrets.length +
      changedVariables.length +
      staleSecrets.length +
      staleVariables.length;
    for (const entry of missingSecrets)
      console.error(`  ${entry.name}: secret missing on GitHub`);
    for (const entry of changedVariables)
      console.error(`  ${entry.name}: variable missing/changed on GitHub`);
    for (const name of [...staleSecrets, ...staleVariables])
      console.error(`  ${name}: on GitHub but not declared locally (stale)`);
    if (drift === 0) console.log('  in sync — no drift');
    return {
      drift,
      failures: 0,
      pushed: 0,
      unchanged: 0,
      deleted: 0,
      schemaDefaultSkipped: 0,
    };
  }

  if (mode === 'dry-run') {
    // No GitHub query in dry-run (fetchRemote:false) — this is the local-side plan.
    // Use `--diff` for the remote comparison (create vs update vs prune).
    for (const entry of secrets) console.log(`  would push [secret]   ${entry.name}`);
    for (const entry of variables) console.log(`  would push [variable] ${entry.name}`);
    for (const entry of schemaDefault)
      console.log(
        `  would skip [default]  ${entry.name}=${entry.value} (equals schema default → pruned if present)`,
      );
    for (const entry of blank) console.log(`  would skip [blank]    ${entry.name}`);
    console.log(
      '  (dry-run does not query GitHub — use --diff or --check for the remote diff)',
    );
    return {
      drift: 0,
      failures: 0,
      pushed: 0,
      unchanged: 0,
      deleted: 0,
      schemaDefaultSkipped: schemaDefault.length,
    };
  }

  // ── sync ────────────────────────────────────────────────────────────────
  let pushed = 0;
  let unchanged = 0;
  let deleted = 0;
  let failures = 0;

  for (const entry of secrets) {
    try {
      setGitHubSecret(environmentName, entry.name, entry.value);
      pushed += 1;
      console.log(`  set     [secret]   ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(
        `  ${entry.name}: FAILED — ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  for (const entry of variables) {
    const remote = remoteVariables.get(entry.name);
    if (remote === entry.value) {
      unchanged += 1;
      console.log(`  unchanged [variable] ${entry.name}`);
      continue;
    }
    try {
      setGitHubVariable(environmentName, entry.name, entry.value);
      pushed += 1;
      console.log(
        `  ${remote === undefined ? 'created' : 'updated'} [variable] ${entry.name}`,
      );
    } catch (error) {
      failures += 1;
      console.error(
        `  ${entry.name}: FAILED — ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  // Stale prune (includes schema-default variables, which are excluded from the
  // declared variable set so they land here and the runtime falls back to default).
  for (const name of staleSecrets) {
    try {
      deleteGitHubSecret(environmentName, name);
      deleted += 1;
      console.log(`  deleted [secret]   ${name} (stale)`);
    } catch (error) {
      failures += 1;
      console.error(
        `  ${name}: delete FAILED — ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  for (const name of staleVariables) {
    try {
      deleteGitHubVariable(environmentName, name);
      deleted += 1;
      const note = schemaDefaultNames.has(name) ? ' (equals schema default)' : ' (stale)';
      console.log(`  deleted [variable] ${name}${note}`);
    } catch (error) {
      failures += 1;
      console.error(
        `  ${name}: delete FAILED — ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  for (const entry of blank)
    console.log(`  skipped [blank]    ${entry.name} (empty locally)`);

  return {
    drift: 0,
    failures,
    pushed,
    unchanged,
    deleted,
    schemaDefaultSkipped: schemaDefault.length,
  };
}

function parseArguments() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.includes('--help') || argumentsList.includes('-h')) {
    console.log(
      'Usage: node tooling/setup/github/sync-env-secrets.mjs [environment...] [--all] [--check | --dry-run | --diff] [--keep-schema-defaults]',
    );
    process.exit(0);
  }

  const mode = argumentsList.includes('--check')
    ? 'check'
    : argumentsList.includes('--dry-run')
      ? 'dry-run'
      : argumentsList.includes('--diff')
        ? 'diff'
        : 'sync';
  const keepSchemaDefaults = argumentsList.includes('--keep-schema-defaults');

  const all = argumentsList.includes('--all');
  const environments = argumentsList.filter(
    (argument) => !argument.startsWith('--') && /^[a-z][a-z0-9-]*$/.test(argument),
  );

  let selected = environments;
  if (all || selected.length === 0) selected = getConfiguredEnvironmentNames();

  return { mode, keepSchemaDefaults, environments: selected };
}

function main() {
  const { mode, keepSchemaDefaults, environments } = parseArguments();
  if (mode !== 'dry-run' && mode !== 'diff') requireGhAuth();

  let totalDrift = 0;
  let totalFailures = 0;

  for (const environmentName of environments) {
    if (mode === 'diff') {
      const rows = previewEnvironmentValues(environmentName, { keepSchemaDefaults });
      console.log(formatSyncPreviewTable({ rows, environment: environmentName }));
      console.log('');
      continue;
    }
    const result = syncEnvironmentValues(environmentName, mode, { keepSchemaDefaults });
    totalDrift += result.drift;
    totalFailures += result.failures;
    console.log('');
  }

  if (mode === 'check' && totalDrift > 0) {
    console.error(
      `Value drift: ${totalDrift} item(s) out of sync. Run \`pnpm github:sync\`.`,
    );
    process.exit(1);
  }
  if (totalFailures > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
