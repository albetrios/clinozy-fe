/**
 * Compare committed `.github/environments/*.json` protection vs GitHub API state.
 * Port of clinozy-be tooling/setup/github/environments-util.ts (plain Node).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ENVIRONMENTS_DIRECTORY = resolve(
  import.meta.dirname,
  '../../../.github/environments',
);

function normalizeLogin(login) {
  return login.trim().toLowerCase();
}

function normalizeTeamSlug(slug) {
  return slug.trim().toLowerCase();
}

function sortedUniqueNormalized(values, normalize) {
  return [...new Set(values.map(normalize))].sort();
}

function omitUndefined(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

/**
 * @param {string} [environmentsDirectory]
 */
export function loadGitHubEnvironmentConfigs(
  environmentsDirectory = ENVIRONMENTS_DIRECTORY,
) {
  const fileNames = readdirSync(environmentsDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  return fileNames.map((fileName) => {
    const filePath = join(environmentsDirectory, fileName);
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (typeof raw.name !== 'string' || !raw.name.trim()) {
      throw new Error(`${fileName}: missing required string field "name".`);
    }
    return { fileName, filePath, ...raw };
  });
}

/**
 * @param {unknown} apiResponse
 */
export function parseGitHubEnvironmentApiResponse(apiResponse) {
  const response = /** @type {{
    protection_rules?: Array<{
      type?: string;
      prevent_self_review?: boolean;
      reviewers?: Array<{ type?: string; reviewer?: { login?: string; slug?: string } }>;
    }>;
    deployment_branch_policy?: {
      protected_branches?: boolean;
      custom_branch_policies?: boolean;
    } | null;
  }} */ (apiResponse);

  const requiredReviewersRule = response.protection_rules?.find(
    (rule) => rule.type === 'required_reviewers',
  );

  const users = [];
  const teams = [];

  for (const entry of requiredReviewersRule?.reviewers ?? []) {
    if (entry.type === 'User' && entry.reviewer?.login) {
      users.push(entry.reviewer.login);
    }
    if (entry.type === 'Team' && entry.reviewer?.slug) {
      teams.push(entry.reviewer.slug);
    }
  }

  return omitUndefined({
    reviewers: omitUndefined({
      users: sortedUniqueNormalized(users, normalizeLogin),
      teams: sortedUniqueNormalized(teams, normalizeTeamSlug),
      preventSelfReview: requiredReviewersRule?.prevent_self_review,
    }),
    deploymentBranchPolicy: response.deployment_branch_policy
      ? omitUndefined({
          protectedBranches: response.deployment_branch_policy.protected_branches,
          customBranchPolicies: response.deployment_branch_policy.custom_branch_policies,
        })
      : undefined,
  });
}

function compareStringSets(expected, actual, label, environment, missingKind, extraKind) {
  /** @type {Array<{ kind: string, environment: string, detail: string }>} */
  const issues = [];
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  for (const value of expected) {
    if (!actualSet.has(value)) {
      issues.push({
        kind: missingKind,
        environment,
        detail: `${label} "${value}" in config but not in GitHub UI`,
      });
    }
  }

  for (const value of actual) {
    if (!expectedSet.has(value)) {
      issues.push({
        kind: extraKind,
        environment,
        detail: `${label} "${value}" in GitHub UI but not in config`,
      });
    }
  }

  return issues;
}

/**
 * @param {ReturnType<typeof loadGitHubEnvironmentConfigs>[number]} config
 * @param {ReturnType<typeof parseGitHubEnvironmentApiResponse>} live
 */
export function compareGitHubEnvironmentToConfig(config, live) {
  const environment = config.name;
  /** @type {Array<{ kind: string, environment: string, detail: string }>} */
  const issues = [];
  const protection = config.protection;

  if (!protection) {
    return issues;
  }

  if (protection.requiredReviewers) {
    const expectedUsers = sortedUniqueNormalized(
      protection.requiredReviewers.users ?? [],
      normalizeLogin,
    );
    const expectedTeams = sortedUniqueNormalized(
      protection.requiredReviewers.teams ?? [],
      normalizeTeamSlug,
    );

    issues.push(
      ...compareStringSets(
        expectedUsers,
        live.reviewers.users,
        'User',
        environment,
        'missing_in_github',
        'extra_in_github',
      ),
      ...compareStringSets(
        expectedTeams,
        live.reviewers.teams,
        'Team',
        environment,
        'missing_in_github',
        'extra_in_github',
      ),
    );

    if (
      protection.requiredReviewers.preventSelfReview !== undefined &&
      protection.requiredReviewers.preventSelfReview !== live.reviewers.preventSelfReview
    ) {
      issues.push({
        kind: 'mismatch',
        environment,
        detail: `preventSelfReview: config=${String(protection.requiredReviewers.preventSelfReview)} github=${String(live.reviewers.preventSelfReview)}`,
      });
    }

    if (
      expectedUsers.length + expectedTeams.length > 0 &&
      live.reviewers.users.length + live.reviewers.teams.length === 0
    ) {
      issues.push({
        kind: 'missing_in_github',
        environment,
        detail:
          'Required reviewers rule missing in GitHub — enable Settings → Environments → Required reviewers',
      });
    }
  }

  if (protection.deploymentBranchPolicy) {
    const expected = protection.deploymentBranchPolicy;
    const actual = live.deploymentBranchPolicy ?? {};

    if (
      expected.protectedBranches !== undefined &&
      expected.protectedBranches !== actual.protectedBranches
    ) {
      issues.push({
        kind: 'mismatch',
        environment,
        detail: `deploymentBranchPolicy.protectedBranches: config=${String(expected.protectedBranches)} github=${String(actual.protectedBranches)}`,
      });
    }

    if (
      expected.customBranchPolicies !== undefined &&
      expected.customBranchPolicies !== actual.customBranchPolicies
    ) {
      issues.push({
        kind: 'mismatch',
        environment,
        detail: `deploymentBranchPolicy.customBranchPolicies: config=${String(expected.customBranchPolicies)} github=${String(actual.customBranchPolicies)}`,
      });
    }
  }

  return issues;
}

/**
 * @param {Array<{ issues: unknown[] }>} results
 */
export function driftResultsHaveIssues(results) {
  return results.some((result) => result.issues.length > 0);
}
