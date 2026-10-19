/**
 * Sync committed branch rulesets in `.github/rulesets/*.json` to GitHub via `gh`.
 * Plain-Node port of clinozy-be's tooling/setup/github/rulesets.ts (this repo has no tsx).
 *
 * The committed JSON files are the source of truth. This script is idempotent:
 *   - If a ruleset with the same `name` does not exist on the repo, it is POSTed.
 *   - If one with the same `name` already exists, it is PUT (full replace).
 *
 * Single trunk: the only committed ruleset targets `main` (`.github/rulesets/main.json`).
 *
 * Modes:
 *   - default      : create-or-update each committed ruleset on the remote.
 *   - --check      : compare local files vs remote, report drift, exit non-zero on drift.
 *   - --dry-run    : show what would be created or updated without calling write APIs.
 *   - --prune      : flag branch rulesets on the remote that are NOT in config
 *                    (e.g. a ruleset for a deleted branch); DELETE them when combined with --yes.
 *
 * Required status checks on protected branches:
 *   - "Quality gate" (PR CI aggregate)
 *   - "unit / Unit + global" (reusable unit gate — docs-only PRs pass via skip)
 *   - "Checks" (PR Governance)
 * Other lanes roll up into Quality gate; add ruleset entries only when a check
 * must be individually required (e.g. unit gate for docs-only PRs).
 *
 * Plan requirement (private repos): repository rulesets require GitHub Pro / Team /
 * Enterprise on private repos. On the free personal plan the API returns 403 with
 * "Upgrade to GitHub Pro or make this repository public to enable this feature."
 * The script surfaces that message verbatim and exits non-zero.
 *
 * Usage — normally invoked via `pnpm github:sync`; runnable directly for the CI
 * drift check in scheduled-release-guards.yml:
 *   node tooling/setup/github/sync-rulesets.mjs             # create-or-update
 *   node tooling/setup/github/sync-rulesets.mjs --check     # drift, exit non-zero
 *   node tooling/setup/github/sync-rulesets.mjs --dry-run   # preview
 *   node tooling/setup/github/sync-rulesets.mjs --prune --yes  # delete stale rulesets
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isMain, parseCommandLine } from '../../ci/script.mjs';
import { GitHubApiError, getRepositoryIdentifier, runGhJson } from './github-shared.mjs';

const RULESETS_DIRECTORY = resolve(import.meta.dirname, '../../../.github/rulesets');

function loadLocalRulesets(directory = RULESETS_DIRECTORY) {
  const entries = readdirSync(directory)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  if (entries.length === 0) {
    throw new Error(`No ruleset files found in ${directory}.`);
  }

  return entries.map((fileName) => {
    const filePath = join(directory, fileName);
    const payload = JSON.parse(readFileSync(filePath, 'utf-8'));
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
      throw new Error(`${fileName}: missing required string field "name".`);
    }
    return { fileName, filePath, payload, name };
  });
}

/** @param {string} repository */
function listRemoteRulesets(repository) {
  return runGhJson(['api', `repos/${repository}/rulesets`, '--paginate']);
}

/**
 * Remote branch-target rulesets whose name is not among the committed files —
 * i.e. rulesets for branches no longer in config (e.g. a ruleset for a deleted branch
 * after moving to a single `main` trunk). Tag/push rulesets are never touched.
 * @param {Array<{ id: number, name: string, target?: string }>} remote
 * @param {Set<string>} localNames
 */
export function findStaleBranchRulesets(remote, localNames) {
  return remote.filter(
    (entry) => entry.target === 'branch' && !localNames.has(entry.name),
  );
}

/**
 * DELETE a remote ruleset. Returns 204 No Content (empty body), so it cannot use
 * runGhJson (which JSON.parses stdout) — call gh directly and let a non-zero exit
 * throw.
 * @param {string} repository
 * @param {number} id
 */
function deleteRemoteRuleset(repository, id) {
  execFileSync(
    'gh',
    ['api', '--method', 'DELETE', `repos/${repository}/rulesets/${id}`],
    { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30_000 },
  );
}

function explainPlanBlocker(message) {
  if (!/Upgrade to GitHub Pro/i.test(message)) return message;
  return [
    message,
    '',
    'Hint: repository rulesets require GitHub Pro / Team / Enterprise on private repos.',
    'Either upgrade the account/org plan, or make the repository public.',
  ].join('\n');
}

/**
 * @param {{
 *   repository: string,
 *   locals: ReturnType<typeof loadLocalRulesets>,
 *   mode: 'sync' | 'check' | 'dry-run',
 *   prune?: boolean,
 *   skipConfirmation?: boolean,
 * }} args
 */
function syncRulesets({
  repository,
  locals,
  mode,
  prune = false,
  skipConfirmation = false,
}) {
  let remote;
  try {
    remote = listRemoteRulesets(repository);
  } catch (listError) {
    const apiError =
      listError instanceof GitHubApiError
        ? listError
        : new GitHubApiError(null, String(listError));
    console.error(`Failed to list rulesets on ${repository}:`);
    console.error(explainPlanBlocker(apiError.message));
    return { failures: 1, drift: 0, listError: apiError };
  }

  const remoteByName = new Map(remote.map((entry) => [entry.name, entry]));
  let drift = 0;
  let failures = 0;

  for (const file of locals) {
    const existing = remoteByName.get(file.name);
    const label = `${file.fileName} (${file.name})`;

    if (mode === 'check') {
      if (existing) {
        console.log(`  ${label}: present on remote (id ${existing.id})`);
      } else {
        console.error(`  ${label}: missing on remote`);
        drift += 1;
      }
      continue;
    }

    if (mode === 'dry-run') {
      console.log(
        `  ${label}: would ${existing ? `PUT id ${existing.id}` : 'POST (create)'}`,
      );
      continue;
    }

    try {
      if (existing) {
        const updated = runGhJson(
          [
            'api',
            '--method',
            'PUT',
            '-H',
            'Accept: application/vnd.github+json',
            `repos/${repository}/rulesets/${existing.id}`,
            '--input',
            '-',
          ],
          { stdin: JSON.stringify(file.payload) },
        );
        console.log(`  ${label}: updated (id ${updated.id})`);
      } else {
        const created = runGhJson(
          [
            'api',
            '--method',
            'POST',
            '-H',
            'Accept: application/vnd.github+json',
            `repos/${repository}/rulesets`,
            '--input',
            '-',
          ],
          { stdin: JSON.stringify(file.payload) },
        );
        console.log(`  ${label}: created (id ${created.id})`);
      }
    } catch (writeError) {
      failures += 1;
      const apiError =
        writeError instanceof GitHubApiError
          ? writeError
          : new GitHubApiError(null, String(writeError));
      console.error(`  ${label}: FAILED`);
      console.error(explainPlanBlocker(apiError.message));
    }
  }

  if (prune) {
    const localNames = new Set(locals.map((file) => file.name));
    const stale = findStaleBranchRulesets(remote, localNames);

    if (stale.length === 0) {
      console.log(
        '  Prune: no stale branch rulesets — every remote branch ruleset is in config.',
      );
    } else if (mode === 'check') {
      for (const entry of stale) {
        console.error(
          `  ${entry.name} (id ${entry.id}): extra branch ruleset not in config`,
        );
      }
      drift += stale.length;
    } else if (mode === 'dry-run') {
      for (const entry of stale) {
        console.log(
          `  ${entry.name} (id ${entry.id}): would DELETE (branch not in config)`,
        );
      }
    } else if (!skipConfirmation) {
      console.warn(
        '  Prune: stale branch rulesets not in config (flagged, not removed):',
      );
      for (const entry of stale) {
        console.warn(`    - ${entry.name} (id ${entry.id})`);
      }
      console.warn('  Re-run `pnpm github:sync --prune --yes` to DELETE them.');
    } else {
      for (const entry of stale) {
        try {
          deleteRemoteRuleset(repository, entry.id);
          console.log(`  ${entry.name} (id ${entry.id}): pruned (deleted)`);
        } catch (deleteError) {
          failures += 1;
          const apiError =
            deleteError instanceof GitHubApiError
              ? deleteError
              : new GitHubApiError(null, String(deleteError));
          console.error(`  ${entry.name} (id ${entry.id}): prune FAILED`);
          console.error(explainPlanBlocker(apiError.message));
        }
      }
    }
  }

  return { failures, drift, listError: undefined };
}

function parseArguments() {
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: {
      help: { type: 'boolean', short: 'h' },
      check: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      prune: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
    },
    messages: {
      unknownOption: (option) => `Unknown argument "${option}". Use --help for options.`,
    },
  });

  if (values.help === true) {
    console.log(
      'Usage: node tooling/setup/github/sync-rulesets.mjs [--check | --dry-run] [--prune] [--yes]',
    );
    console.log('');
    console.log(
      '  Normally invoked via `pnpm github:sync`; runnable directly for CI drift checks.',
    );
    console.log(
      '  (default)   Create-or-update each .github/rulesets/*.json on the repo',
    );
    console.log('  --check     Report drift between local files and remote rulesets');
    console.log(
      '  --dry-run   Show what would be created/updated/deleted without writing',
    );
    console.log(
      '  --prune     Flag branch rulesets not in config (DELETE them with --yes)',
    );
    console.log(
      '  --yes, -y   With --prune in sync mode, actually delete the stale rulesets',
    );
    process.exit(0);
  }

  if (values.check === true && values['dry-run'] === true) {
    throw new Error('Use either --check or --dry-run, not both.');
  }

  const mode =
    values.check === true
      ? /** @type {const} */ ('check')
      : values['dry-run'] === true
        ? /** @type {const} */ ('dry-run')
        : /** @type {const} */ ('sync');
  const prune = values.prune === true;
  const skipConfirmation = values.yes === true;

  return { mode, prune, skipConfirmation };
}

function main() {
  const { mode, prune, skipConfirmation } = parseArguments();

  if (mode !== 'dry-run') {
    try {
      execSync('gh auth status', { stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000 });
    } catch {
      console.error('gh is not authenticated. Run `gh auth login` first.');
      process.exit(1);
    }
  }

  const repository = getRepositoryIdentifier();
  const locals = loadLocalRulesets();

  console.log(`Repository:  ${repository}`);
  console.log(`Source dir:  ${RULESETS_DIRECTORY}`);
  console.log(`Local files: ${locals.map((file) => file.fileName).join(', ')}`);
  console.log(`Mode:        ${mode}${prune ? ' (+prune)' : ''}`);
  console.log('');

  const result = syncRulesets({ repository, locals, mode, prune, skipConfirmation });
  console.log('');

  if (mode === 'check') {
    if (result.drift === 0 && !result.listError) {
      console.log('Rulesets in sync: every local file is present on remote (no extras).');
      return;
    }
    if (!result.listError) {
      console.error(`Drift detected: ${result.drift} ruleset(s) out of sync.`);
      console.error('Run `pnpm github:sync` to apply them.');
    }
    process.exit(1);
  }

  if (mode === 'dry-run') {
    if (result.listError) process.exit(1);
    console.log('Dry run complete. No changes pushed.');
    return;
  }

  if (result.failures > 0) {
    console.error(`Sync finished with ${result.failures} failure(s).`);
    process.exit(1);
  }
  console.log('Sync complete.');
}

// Only run when executed directly (node …/sync-rulesets.mjs). Importing the
// module (e.g. from tests or sync.mjs) must NOT trigger a live gh sync.
if (isMain(import.meta.url)) {
  main();
}
