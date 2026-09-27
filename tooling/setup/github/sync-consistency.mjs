/**
 * Pre-flight consistency check for `github:sync` — fail fast when the committed
 * IaC disagrees with ITSELF, before touching GitHub. Single-trunk aware.
 *
 * Cross-checks (all local, read-only):
 *   1. Environment set agreement — setup.config.json ↔ .github/environments/*.json
 *      ↔ the environments the reusable Netlify deploy accepts. Adding an
 *      environment in one place but not the others is the classic drift this
 *      catches.
 *   2. Single-trunk branches — git.protectedBranches ↔ the branches actually
 *      targeted by .github/rulesets/*.json, and git.defaultBranch is among them.
 *      A protectedBranches entry with no committed ruleset (a deleted branch) or a
 *      defaultBranch that nothing protects fails here.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../../../');
const SETUP_CONFIG = join(REPO_ROOT, 'tooling/setup/setup.config.json');
const ENVIRONMENTS_DIR = join(REPO_ROOT, '.github/environments');
const RULESETS_DIR = join(REPO_ROOT, '.github/rulesets');
const REUSABLE_DEPLOY = join(REPO_ROOT, '.github/workflows/reusable-netlify-deploy.yml');

/** @param {string[]} values */
const sortedUnique = (values) => [...new Set(values)].sort();

/**
 * @param {string[]} left
 * @param {string[]} right
 */
function sameSet(left, right) {
  const a = sortedUnique(left);
  const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Pure comparator — takes the already-loaded facts and returns issues. Unit
 * tested; the readers below feed it from disk.
 * @param {{
 *   configuredEnvironments: string[],
 *   environmentJsonNames: string[],
 *   deployWorkflowEnvironments: string[],
 *   defaultBranch: string,
 *   protectedBranches: string[],
 *   rulesetBranches: string[],
 * }} facts
 * @returns {{ dimension: string, detail: string }[]}
 */
export function collectConsistencyIssues(facts) {
  const issues = [];
  const {
    configuredEnvironments,
    environmentJsonNames,
    deployWorkflowEnvironments,
    defaultBranch,
    protectedBranches,
    rulesetBranches,
  } = facts;

  if (!sameSet(configuredEnvironments, environmentJsonNames)) {
    issues.push({
      dimension: 'environments',
      detail: `setup.config.json [${sortedUnique(configuredEnvironments).join(', ')}] != .github/environments/*.json [${sortedUnique(environmentJsonNames).join(', ')}]`,
    });
  }
  if (!sameSet(configuredEnvironments, deployWorkflowEnvironments)) {
    issues.push({
      dimension: 'environments',
      detail: `setup.config.json [${sortedUnique(configuredEnvironments).join(', ')}] != reusable-netlify-deploy accepted [${sortedUnique(deployWorkflowEnvironments).join(', ')}]`,
    });
  }
  if (!sameSet(protectedBranches, rulesetBranches)) {
    issues.push({
      dimension: 'branches',
      detail: `git.protectedBranches [${sortedUnique(protectedBranches).join(', ')}] != ruleset target branches [${sortedUnique(rulesetBranches).join(', ')}] (single trunk: only committed rulesets are protected)`,
    });
  }
  if (defaultBranch && !rulesetBranches.includes(defaultBranch)) {
    issues.push({
      dimension: 'branches',
      detail: `git.defaultBranch "${defaultBranch}" is protected by no committed ruleset [${sortedUnique(rulesetBranches).join(', ')}]`,
    });
  }
  return issues;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function rulesetTargetBranches() {
  const branches = [];
  for (const fileName of readdirSync(RULESETS_DIR).filter((name) =>
    name.endsWith('.json'),
  )) {
    const include = readJson(join(RULESETS_DIR, fileName))?.conditions?.ref_name?.include;
    if (!Array.isArray(include)) continue;
    for (const ref of include) {
      if (typeof ref === 'string' && ref.startsWith('refs/heads/')) {
        const branch = ref.slice('refs/heads/'.length);
        if (branch && !branch.includes('*')) branches.push(branch);
      }
    }
  }
  return branches;
}

function deployWorkflowEnvironments() {
  const workflow = readFileSync(REUSABLE_DEPLOY, 'utf-8');
  // The reusable validates the environment with `case "$environment" in
  // <env> | <env>) ;;` — the accepted set is that alternation list.
  const match = workflow.match(/case "\$environment" in\s*\n\s*([a-z0-9|\s-]+?)\)/);
  if (!match?.[1]) return [];
  return match[1]
    .split('|')
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Read every source and return consistency issues (empty = consistent).
 * @returns {{ dimension: string, detail: string }[]}
 */
export function checkSyncConsistency() {
  const config = readJson(SETUP_CONFIG);
  const environmentJsonNames = readdirSync(ENVIRONMENTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''));

  return collectConsistencyIssues({
    configuredEnvironments: (config.environments ?? []).map(
      (environment) => environment.name,
    ),
    environmentJsonNames,
    deployWorkflowEnvironments: deployWorkflowEnvironments(),
    defaultBranch: config.git?.defaultBranch ?? '',
    protectedBranches: config.git?.protectedBranches ?? [],
    rulesetBranches: rulesetTargetBranches(),
  });
}
