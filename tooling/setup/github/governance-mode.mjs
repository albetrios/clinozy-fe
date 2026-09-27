/**
 * Governance mode (personal ↔ team) — one switch for the repo's human-review
 * posture, keeping the two source-of-truth files that encode it consistent.
 *
 * The automated gates (`Quality gate` + `Checks`) block every merge in BOTH
 * modes — this tool only governs the *human* review requirement:
 *
 *   personal : solo maintainer — PR required, but 0 approvals, no code-owner
 *              review, self-review allowed.
 *   team     : four-eyes — 1 approval, code-owner review, no self-review, stale
 *              reviews dismissed on push.
 *
 * Why a tool and not hand-edits: the review fields are COUPLED and the wrong
 * combination deadlocks the maintainer (GitHub forbids self-approval, so
 * `preventSelfReview` with a single reviewer locks the shipper out). This flips
 * every coupled field across both files atomically and refuses any combination
 * that would deadlock or that `team` cannot satisfy (fewer than two owners).
 *
 * It edits ONLY:
 *   - the trunk ruleset's `pull_request` rule  (.github/rulesets/<trunk>.json)
 *   - the production environment's requiredReviewers (.github/environments/production.json)
 * It never touches required_status_checks, bypass_actors, signatures, merge
 * method, or the deployment branch policy — that is what keeps it portable.
 *
 * The roster (who MAY review) is read-only from .github/CODEOWNERS. Apply the
 * result to GitHub with `pnpm github:sync` afterwards.
 *
 * Usage (via package.json):
 *   pnpm github:tool:governance-mode            # status
 *   pnpm github:tool:governance-mode personal   # apply solo posture
 *   pnpm github:tool:governance-mode team        # apply four-eyes (needs ≥2 owners)
 *   pnpm github:tool:governance-mode:check       # exit non-zero on any inconsistency
 *
 * Full reference: docs/reference/branch-governance.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../../../');
const SETUP_CONFIG_PATH = join(REPO_ROOT, 'tooling/setup/setup.config.json');
const RULESETS_DIR = join(REPO_ROOT, '.github/rulesets');
const CODEOWNERS_PATH = join(REPO_ROOT, '.github/CODEOWNERS');
const PRODUCTION_ENVIRONMENT_PATH = join(
  REPO_ROOT,
  '.github/environments/production.json',
);

/** Maximum production reviewers materialized in team mode (GitHub caps at 6). */
const MAX_TEAM_REVIEWERS = 6;

/**
 * The two presets. Each owns exactly the coupled review fields; every other
 * field in both files is preserved untouched.
 */
export const GOVERNANCE_PRESETS = {
  personal: {
    ruleset: {
      required_approving_review_count: 0,
      require_code_owner_review: false,
      require_last_push_approval: false,
      dismiss_stale_reviews_on_push: false,
    },
    production: { preventSelfReview: false },
  },
  team: {
    ruleset: {
      required_approving_review_count: 1,
      require_code_owner_review: true,
      require_last_push_approval: true,
      dismiss_stale_reviews_on_push: true,
    },
    production: { preventSelfReview: true },
  },
};

/** @typedef {'personal' | 'team' | 'unknown'} GovernanceMode */

/** @param {string} path */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * @param {object} value
 * @param {string} path
 */
function writeJson(value, path) {
  // 2-space + trailing newline matches the committed files and Prettier's JSON
  // output (the before-commit hook re-formats staged JSON regardless).
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

/**
 * Individual user owners from CODEOWNERS — `@handle` tokens without a slash.
 * Comments (from the first `#`) are stripped, so a handle mentioned in a TODO
 * comment is not counted. Team handles (`@org/team`) are collected separately;
 * they are not "users" for self-review purposes and only resolve on org repos.
 * @param {string} text
 * @returns {{ users: string[], teams: string[] }}
 */
export function parseCodeownersOwners(text) {
  const users = new Set();
  const teams = new Set();
  for (const rawLine of text.split('\n')) {
    const hashIndex = rawLine.indexOf('#');
    const line = (hashIndex === -1 ? rawLine : rawLine.slice(0, hashIndex)).trim();
    if (!line) continue;
    // First token is the path pattern; the rest are owners.
    for (const token of line.split(/\s+/).slice(1)) {
      if (!token.startsWith('@')) continue;
      const handle = token.slice(1);
      if (handle.includes('/')) teams.add(handle);
      else if (handle) users.add(handle);
    }
  }
  return {
    users: [...users].sort(),
    teams: [...teams].sort(),
  };
}

/** @returns {string} absolute path of the trunk ruleset file. */
export function resolveTrunkRulesetPath() {
  const config = readJson(SETUP_CONFIG_PATH);
  const branch = config.git?.defaultBranch ?? 'main';
  return join(RULESETS_DIR, `${branch}.json`);
}

/**
 * @param {any} rulesetPayload
 * @returns {{ type: string, parameters?: Record<string, unknown> } | undefined}
 */
function pullRequestRule(rulesetPayload) {
  return (rulesetPayload.rules ?? []).find((rule) => rule?.type === 'pull_request');
}

/**
 * Which preset the ruleset's pull_request params match, or 'unknown' for a
 * hand-mangled hybrid.
 * @param {any} rulesetPayload
 * @returns {GovernanceMode}
 */
export function detectRulesetMode(rulesetPayload) {
  const parameters = pullRequestRule(rulesetPayload)?.parameters;
  if (!parameters) return 'unknown';
  for (const mode of /** @type {const} */ (['personal', 'team'])) {
    const preset = GOVERNANCE_PRESETS[mode].ruleset;
    if (Object.entries(preset).every(([key, value]) => parameters[key] === value)) {
      return mode;
    }
  }
  return 'unknown';
}

/**
 * Which preset the production environment matches, keyed off preventSelfReview.
 * @param {any} productionPayload
 * @returns {GovernanceMode}
 */
export function detectProductionMode(productionPayload) {
  const preventSelfReview =
    productionPayload?.protection?.requiredReviewers?.preventSelfReview;
  if (preventSelfReview === false) return 'personal';
  if (preventSelfReview === true) return 'team';
  return 'unknown';
}

/**
 * @param {any} productionPayload
 * @returns {string[]}
 */
function productionReviewers(productionPayload) {
  return productionPayload?.protection?.requiredReviewers?.users ?? [];
}

/**
 * Read every source and assemble the facts the checks and status need.
 * @returns {{
 *   rulesetPath: string,
 *   rulesetMode: GovernanceMode,
 *   productionMode: GovernanceMode,
 *   rulesetParameters: Record<string, unknown>,
 *   productionReviewers: string[],
 *   preventSelfReview: unknown,
 *   codeownersUsers: string[],
 *   codeownersTeams: string[],
 * }}
 */
export function readGovernanceFacts() {
  const rulesetPath = resolveTrunkRulesetPath();
  const ruleset = readJson(rulesetPath);
  const production = readJson(PRODUCTION_ENVIRONMENT_PATH);
  const { users, teams } = parseCodeownersOwners(readFileSync(CODEOWNERS_PATH, 'utf-8'));
  return {
    rulesetPath,
    rulesetMode: detectRulesetMode(ruleset),
    productionMode: detectProductionMode(production),
    rulesetParameters: pullRequestRule(ruleset)?.parameters ?? {},
    productionReviewers: productionReviewers(production),
    preventSelfReview: production?.protection?.requiredReviewers?.preventSelfReview,
    codeownersUsers: users,
    codeownersTeams: teams,
  };
}

/**
 * Pure invariant check — empty array means the committed files encode a single,
 * consistent, non-deadlocking governance mode.
 * @param {ReturnType<typeof readGovernanceFacts>} facts
 * @returns {string[]}
 */
export function findGovernanceIssues(facts) {
  const issues = [];
  const {
    rulesetMode,
    productionMode,
    rulesetParameters,
    productionReviewers: reviewers,
    preventSelfReview,
    codeownersUsers,
  } = facts;

  if (rulesetMode === 'unknown') {
    issues.push(
      'Ruleset pull_request params match no known governance preset (hand-mangled hybrid?).',
    );
  }
  if (productionMode === 'unknown') {
    issues.push(
      'Production requiredReviewers.preventSelfReview is missing or not a boolean.',
    );
  }
  if (
    rulesetMode !== 'unknown' &&
    productionMode !== 'unknown' &&
    rulesetMode !== productionMode
  ) {
    issues.push(
      `Ruleset mode (${rulesetMode}) disagrees with production environment mode (${productionMode}).`,
    );
  }

  const effectiveTeam = rulesetMode === 'team' || productionMode === 'team';
  if (effectiveTeam) {
    if (codeownersUsers.length < 2) {
      issues.push(
        `Team mode requires ≥2 CODEOWNERS users; found ${codeownersUsers.length}.`,
      );
    }
    if (reviewers.length < 2) {
      issues.push(
        `Team mode requires ≥2 production reviewers; found ${reviewers.length}.`,
      );
    }
  }

  const stray = reviewers.filter((reviewer) => !codeownersUsers.includes(reviewer));
  if (stray.length > 0) {
    issues.push(
      `Production reviewers not in CODEOWNERS: [${stray.join(', ')}] (single roster source).`,
    );
  }

  // Deadlock guards — independent of which mode is claimed.
  if (preventSelfReview === true && reviewers.length < 2) {
    issues.push(
      'Deadlock: preventSelfReview with <2 production reviewers locks out the sole shipper.',
    );
  }
  if (
    rulesetParameters.require_code_owner_review === true &&
    codeownersUsers.length < 2
  ) {
    issues.push(
      'Deadlock: require_code_owner_review with <2 CODEOWNERS users can lock out the author.',
    );
  }

  return issues;
}

/**
 * The production reviewers a mode materializes — or throw when the roster can't
 * satisfy it (writes nothing).
 * @param {'personal' | 'team'} mode
 * @param {string[]} codeownersUsers
 * @returns {string[]}
 */
export function resolveReviewers(mode, codeownersUsers) {
  if (codeownersUsers.length === 0) {
    throw new Error('.github/CODEOWNERS lists no individual user owners.');
  }
  if (mode === 'team' && codeownersUsers.length < 2) {
    throw new Error(
      `team mode needs ≥2 CODEOWNERS users; found ${codeownersUsers.length} ` +
        `(${codeownersUsers.join(', ') || 'none'}). Add a second owner to ` +
        '.github/CODEOWNERS first.',
    );
  }
  return mode === 'team'
    ? codeownersUsers.slice(0, MAX_TEAM_REVIEWERS)
    : [codeownersUsers[0]];
}

/**
 * Pure — the ruleset payload with its pull_request review params set to `mode`.
 * @param {any} rulesetPayload
 * @param {'personal' | 'team'} mode
 */
export function nextRulesetPayload(rulesetPayload, mode) {
  const next = structuredClone(rulesetPayload);
  const rule = pullRequestRule(next);
  if (!rule?.parameters) {
    throw new Error('Ruleset has no pull_request rule to configure.');
  }
  Object.assign(rule.parameters, GOVERNANCE_PRESETS[mode].ruleset);
  return next;
}

/**
 * Pure — the production payload with reviewers + preventSelfReview set to `mode`.
 * @param {any} productionPayload
 * @param {'personal' | 'team'} mode
 * @param {string[]} reviewers
 */
export function nextProductionPayload(productionPayload, mode, reviewers) {
  const next = structuredClone(productionPayload);
  next.protection ??= {};
  next.protection.requiredReviewers ??= {};
  next.protection.requiredReviewers.users = reviewers;
  next.protection.requiredReviewers.teams ??= [];
  next.protection.requiredReviewers.preventSelfReview =
    GOVERNANCE_PRESETS[mode].production.preventSelfReview;
  return next;
}

/**
 * Apply a mode: rewrite both files. Throws (writes nothing) if the roster can't
 * satisfy the mode.
 * @param {'personal' | 'team'} mode
 * @returns {{ mode: string, rulesetPath: string, productionPath: string, reviewers: string[] }}
 */
export function applyGovernanceMode(mode) {
  if (mode !== 'personal' && mode !== 'team') {
    throw new Error(`Unknown governance mode "${mode}" (expected personal | team).`);
  }
  const rulesetPath = resolveTrunkRulesetPath();
  const ruleset = readJson(rulesetPath);
  const production = readJson(PRODUCTION_ENVIRONMENT_PATH);
  const { users } = parseCodeownersOwners(readFileSync(CODEOWNERS_PATH, 'utf-8'));

  const reviewers = resolveReviewers(mode, users);
  const nextRuleset = nextRulesetPayload(ruleset, mode);
  const nextProduction = nextProductionPayload(production, mode, reviewers);

  writeJson(nextRuleset, rulesetPath);
  writeJson(nextProduction, PRODUCTION_ENVIRONMENT_PATH);

  return {
    mode,
    rulesetPath,
    productionPath: PRODUCTION_ENVIRONMENT_PATH,
    reviewers,
  };
}

/* ----------------------------- CLI ----------------------------- */

/** @param {string} path */
function repoRelative(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function runStatus() {
  const facts = readGovernanceFacts();
  const issues = findGovernanceIssues(facts);
  const combined =
    facts.rulesetMode === facts.productionMode ? facts.rulesetMode : 'inconsistent';

  console.log('Governance mode');
  console.log('===============');
  console.log(`  current            : ${combined}`);
  console.log(
    `  ruleset            : ${facts.rulesetMode} (${repoRelative(facts.rulesetPath)})`,
  );
  console.log(`  production env     : ${facts.productionMode}`);
  console.log(
    `  CODEOWNERS users   : ${facts.codeownersUsers.join(', ') || '(none)'} ` +
      `(${facts.codeownersUsers.length})`,
  );
  console.log(
    `  production reviewers: ${facts.productionReviewers.join(', ') || '(none)'}`,
  );
  console.log('');

  if (issues.length > 0) {
    console.log('Issues:');
    for (const issue of issues) console.log(`  ✗ ${issue}`);
    console.log('');
    console.log(
      'Fix: pnpm github:tool:governance-mode <personal|team>, then pnpm github:sync',
    );
    return;
  }

  console.log('Consistent. ✓');
  if (combined === 'personal') {
    const canTeam = facts.codeownersUsers.length >= 2;
    console.log(
      canTeam
        ? '  To require four-eyes: pnpm github:tool:governance-mode team && pnpm github:sync'
        : '  Team mode needs a 2nd CODEOWNERS user first (add one to .github/CODEOWNERS).',
    );
  } else if (combined === 'team') {
    console.log(
      '  To return to solo: pnpm github:tool:governance-mode personal && pnpm github:sync',
    );
  }
}

/** @returns {number} exit code */
function runCheck() {
  const facts = readGovernanceFacts();
  const issues = findGovernanceIssues(facts);
  if (issues.length > 0) {
    console.error('Governance mode is inconsistent:');
    for (const issue of issues) console.error(`  ✗ ${issue}`);
    console.error('');
    console.error('Run: pnpm github:tool:governance-mode <personal|team>');
    return 1;
  }
  const mode = facts.rulesetMode;
  console.log(`Governance mode consistent (${mode}). ✓`);
  return 0;
}

/**
 * @param {'personal' | 'team'} mode
 * @returns {number} exit code
 */
function runApply(mode) {
  try {
    const result = applyGovernanceMode(mode);
    console.log(`Applied "${result.mode}" governance mode:`);
    console.log(`  ${repoRelative(result.rulesetPath)} — pull_request review params`);
    console.log(
      `  ${repoRelative(result.productionPath)} — reviewers [${result.reviewers.join(', ')}], ` +
        `preventSelfReview=${GOVERNANCE_PRESETS[mode].production.preventSelfReview}`,
    );
    console.log('');
    console.log('Next: pnpm github:sync   # push ruleset + environment to GitHub');
    return 0;
  } catch (error) {
    console.error(`Could not apply "${mode}" mode: ${error.message}`);
    return 1;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    process.exit(runCheck());
  }
  const positional = args.find((arg) => !arg.startsWith('-'));
  if (!positional || positional === 'status') {
    runStatus();
    return;
  }
  if (positional === 'personal' || positional === 'team') {
    process.exit(runApply(positional));
  }
  console.error(`Unknown argument "${positional}".`);
  console.error('Usage: governance-mode.mjs [status | personal | team | --check]');
  process.exit(1);
}

// Run only as a CLI, not when imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main();
}
