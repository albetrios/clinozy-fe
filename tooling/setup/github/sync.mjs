/**
 * Unified GitHub IaC sync — the SINGLE entry point for rulesets, environment
 * shells, protection drift, and deploy secrets. One command, flag-driven.
 *
 * Order:
 *   0. Consistency pre-flight (all modes) — committed IaC must agree with itself
 *      (setup.config ↔ environments JSON ↔ deploy workflow ↔ rulesets). See
 *      sync-consistency.mjs.
 *   1. Scaffold missing `.env.<environment>` files
 *   2. Sync branch rulesets (`.github/rulesets/*.json`) — branch: `main` only
 *   3. Ensure GitHub Environment shells exist
 *   4. Reconcile deploy VALUES (secrets + variables) from `.env.<environment>`:
 *      secrets always pushed; variables pushed only when missing/changed and
 *      pruned when equal to their env-schema default; unmanaged keys untouched.
 *
 * Modes / flags:
 *   (default)            scaffold + rulesets + environments + values, all environments
 *   <env>                scope the values reconcile to one environment (positional)
 *   --check              read-only: consistency + remote drift, no writes
 *   --dry-run            preview the local-side values plan (no GitHub query, no writes)
 *   --diff               read-only per-variable table (default vs local vs remote vs decision)
 *   --keep-schema-defaults  push variables equal to their schema default instead of pruning
 *   --yes | -y           skip the values-push confirmation (automation)
 *   --prune              also flag/remove rulesets for branches not in config
 *                          (flags by default; removes when combined with --yes)
 *   --help | -h          usage
 *
 * Usage:
 *   pnpm github:sync
 *   pnpm github:sync production
 *   pnpm github:sync --check
 *   pnpm github:sync --dry-run
 *   pnpm github:sync --yes
 *   pnpm github:sync --prune --yes
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { validateGitHubEnvironmentsDrift } from './check-environments-drift.mjs';
import { driftResultsHaveIssues } from './environments-util.mjs';
import { formatSyncPreviewTable } from './env-sync-plan.mjs';
import { requireGhAuth } from './github-shared.mjs';
import { scaffoldGithubEnvFiles } from './scaffold-env-files.mjs';
import { getConfiguredEnvironmentNames } from './setup-config.mjs';
import { checkSyncConsistency } from './sync-consistency.mjs';
import { ensureGitHubEnvironments } from './sync-environments.mjs';
import { previewEnvironmentValues, syncEnvironmentValues } from './sync-env-secrets.mjs';

/**
 * @param {string} scriptName
 * @param {string[]} args
 */
function runNodeScript(scriptName, args) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(scriptName, import.meta.url)), ...args],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
    },
  );
  return result.status ?? 1;
}

function parseArguments() {
  const argumentsList = process.argv.slice(2);

  if (argumentsList.includes('--help') || argumentsList.includes('-h')) {
    console.log(
      'Usage: pnpm github:sync [environment...] [--check | --dry-run | --diff] [--yes] [--prune] [--keep-schema-defaults]',
    );
    console.log('');
    console.log(
      '  (default)   All environments: scaffold + branch (main) rulesets + env shells + values',
    );
    console.log('  environment Optional environment name(s), e.g. production');
    console.log('  --check     Read-only consistency + remote drift (no writes)');
    console.log(
      '  --dry-run   Preview the local-side values plan (no GitHub query, no writes)',
    );
    console.log(
      '  --diff      Per-variable table: schema default vs local vs remote vs decision (read-only)',
    );
    console.log(
      '  --keep-schema-defaults  Push variables equal to their schema default instead of pruning',
    );
    console.log('  --yes, -y   Skip the values-push confirmation prompt');
    console.log(
      '  --prune     Flag/remove rulesets for branches not in config (removes with --yes)',
    );
    process.exit(0);
  }

  const readOnlyModes = ['--check', '--dry-run', '--diff'].filter((flag) =>
    argumentsList.includes(flag),
  );
  if (readOnlyModes.length > 1) {
    throw new Error(
      `Use only one of --check / --dry-run / --diff (got ${readOnlyModes.join(', ')}).`,
    );
  }

  // Strict parse: every non-flag token must be a valid environment name, and any
  // unknown --flag is a hard error (a typo'd flag must never silently no-op).
  const allowedFlags = new Set([
    '--check',
    '--dry-run',
    '--diff',
    '--yes',
    '-y',
    '--prune',
    '--keep-schema-defaults',
  ]);
  const environments = [];
  for (const argument of argumentsList) {
    if (allowedFlags.has(argument)) continue;
    if (argument.startsWith('-')) {
      throw new Error(`Unknown argument "${argument}". Use --help for options.`);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(argument)) {
      throw new Error(
        `Invalid environment "${argument}". Use lowercase letters, digits, dashes.`,
      );
    }
    environments.push(argument);
  }

  const mode = argumentsList.includes('--check')
    ? 'check'
    : argumentsList.includes('--dry-run')
      ? 'dry-run'
      : argumentsList.includes('--diff')
        ? 'diff'
        : 'sync';

  const skipConfirmation =
    argumentsList.includes('--yes') || argumentsList.includes('-y');
  const prune = argumentsList.includes('--prune');
  const keepSchemaDefaults = argumentsList.includes('--keep-schema-defaults');

  const selectedEnvironments =
    environments.length === 0 ? getConfiguredEnvironmentNames() : environments;

  return {
    mode,
    skipConfirmation,
    prune,
    keepSchemaDefaults,
    environments: selectedEnvironments,
  };
}

/**
 * @param {string} mode
 * @param {{ prune: boolean, skipConfirmation: boolean }} options
 */
function syncRulesets(mode, { prune, skipConfirmation }) {
  const args = mode === 'check' ? ['--check'] : mode === 'dry-run' ? ['--dry-run'] : [];
  // --prune flags/removes rulesets for branches not in config; the child only
  // DELETES when --yes is also passed (otherwise it flags them).
  if (prune) args.push('--prune');
  if (skipConfirmation) args.push('--yes');
  return runNodeScript('./sync-rulesets.mjs', args);
}

async function confirmSecretsPush() {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await readline.question(
    'Push deploy secrets + variables to GitHub Environments? [y/N] ',
  );
  readline.close();
  return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
}

async function main() {
  const { mode, skipConfirmation, prune, keepSchemaDefaults, environments } =
    parseArguments();

  if (mode !== 'dry-run') {
    requireGhAuth();
  }

  console.log(`GitHub sync — mode: ${mode}`);
  console.log(`Environments: ${environments.join(', ')}`);
  console.log('');

  // Pre-flight: the committed IaC must agree with itself before we touch GitHub.
  const consistencyIssues = checkSyncConsistency();
  if (consistencyIssues.length > 0) {
    console.error('Consistency check FAILED — committed IaC disagrees with itself:');
    for (const issue of consistencyIssues) {
      console.error(`  [${issue.dimension}] ${issue.detail}`);
    }
    console.error('');
    console.error('Fix tooling/setup/setup.config.json, .github/environments/*.json,');
    console.error(
      '.github/rulesets/*.json, or reusable-netlify-deploy.yml, then re-run.',
    );
    process.exit(1);
  }
  console.log('Consistency check: OK');
  console.log('');

  // --diff is a read-only, per-variable preview of the deploy VALUES only: it
  // reads each local file, fetches the live GitHub Environment, and prints the
  // default/local/remote/decision table. It short-circuits before rulesets/env
  // shells/writes.
  if (mode === 'diff') {
    for (const environmentName of environments) {
      const rows = previewEnvironmentValues(environmentName, { keepSchemaDefaults });
      console.log(formatSyncPreviewTable({ rows, environment: environmentName }));
      console.log('');
    }
    return;
  }

  if (mode === 'sync') {
    console.log('Step 1/4 — Scaffold local .env.<environment> files');
    scaffoldGithubEnvFiles({ dryRun: false });
    console.log('');
  }

  console.log(`Step ${mode === 'sync' ? '2' : '1'}/4 — Branch rulesets`);
  const rulesetStatus = syncRulesets(mode, { prune, skipConfirmation });
  if (rulesetStatus !== 0) {
    process.exit(rulesetStatus);
  }
  console.log('');

  console.log(`Step ${mode === 'sync' ? '3' : '2'}/4 — GitHub Environment shells`);
  const environmentResult = ensureGitHubEnvironments(mode);
  if (mode === 'check' && environmentResult.drift > 0) {
    process.exit(1);
  }
  if (environmentResult.failures > 0) {
    process.exit(1);
  }
  console.log('');

  if (mode === 'check') {
    const protectionResults = validateGitHubEnvironmentsDrift();
    if (driftResultsHaveIssues(protectionResults)) {
      process.exit(1);
    }
  } else if (mode === 'dry-run') {
    console.log('  (protection drift check skipped in dry-run — use --check)');
  } else {
    const protectionResults = validateGitHubEnvironmentsDrift();
    if (driftResultsHaveIssues(protectionResults)) {
      console.warn(
        'Protection drift detected — update GitHub UI to match .github/environments/*.json.',
      );
      console.warn(
        'Secrets will still be pushed; protection must be applied manually in GitHub.',
      );
    }
  }
  console.log('');

  console.log(`Deploy values (secrets + variables)`);
  if (mode === 'check') {
    let totalDrift = 0;
    for (const environmentName of environments) {
      const result = syncEnvironmentValues(environmentName, 'check');
      totalDrift += result.drift;
    }
    if (totalDrift > 0) {
      process.exit(1);
    }
    console.log('GitHub sync check: OK.');
    return;
  }

  if (mode === 'dry-run') {
    for (const environmentName of environments) {
      syncEnvironmentValues(environmentName, 'dry-run', { keepSchemaDefaults });
    }
    console.log('Dry run complete. No changes pushed.');
    return;
  }

  if (!skipConfirmation) {
    console.log('  Secrets are always pushed; variables are pushed only when missing or');
    console.log(
      '  changed. A variable equal to its env-schema default is NOT pushed and is',
    );
    console.log(
      '  pruned from GitHub (the runtime falls back to the identical default) —',
    );
    console.log(
      '  pass --keep-schema-defaults to push them verbatim. Unmanaged keys are left',
    );
    console.log('  alone.');
    const confirmed = await confirmSecretsPush();
    if (!confirmed) {
      console.log('Values push skipped.');
      return;
    }
  }

  let failures = 0;
  let pushed = 0;
  let unchanged = 0;
  let deleted = 0;
  let schemaDefaultSkipped = 0;
  for (const environmentName of environments) {
    const result = syncEnvironmentValues(environmentName, 'sync', { keepSchemaDefaults });
    failures += result.failures;
    pushed += result.pushed;
    unchanged += result.unchanged;
    deleted += result.deleted;
    schemaDefaultSkipped += result.schemaDefaultSkipped;
    console.log('');
  }

  if (failures > 0) {
    process.exit(1);
  }

  console.log('');
  console.log(
    `GitHub sync complete — pushed ${pushed}, unchanged ${unchanged}, ` +
      `deleted ${deleted}, schema-default ${schemaDefaultSkipped}.`,
  );
  console.log('Verify: pnpm github:sync --check');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
