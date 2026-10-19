import { expect, it } from 'vitest';

import {
  compareGitHubEnvironmentToConfig,
  parseGitHubEnvironmentApiResponse,
  requiredReviewersSupport,
} from './environments-util.mjs';
import { getRuntimeSecretNames, validateDeploySecrets } from './validate-github-env.mjs';

it('parseGitHubEnvironmentApiResponse extracts reviewers and branch policy', () => {
  const live = parseGitHubEnvironmentApiResponse({
    protection_rules: [
      {
        type: 'required_reviewers',
        prevent_self_review: false,
        reviewers: [{ type: 'User', reviewer: { login: 'NikunjMavani' } }],
      },
    ],
    deployment_branch_policy: {
      protected_branches: true,
      custom_branch_policies: false,
    },
  });

  expect(live.reviewers.users).toStrictEqual(['nikunjmavani']);
  expect(live.deploymentBranchPolicy?.protectedBranches).toBe(true);
});

it('compareGitHubEnvironmentToConfig detects reviewer drift', () => {
  const config = {
    name: 'production',
    protection: {
      requiredReviewers: { users: ['nikunjmavani'], teams: [], preventSelfReview: false },
      deploymentBranchPolicy: { protectedBranches: true, customBranchPolicies: false },
    },
  };
  const live = parseGitHubEnvironmentApiResponse({ protection_rules: [] });

  const issues = compareGitHubEnvironmentToConfig(config, live);
  expect(issues.some((issue) => issue.kind === 'missing_in_github')).toBeTruthy();
});

// GitHub enforces required reviewers on a private repository's environments only on Enterprise,
// so on Team they can never match the committed config and `github:sync --check` failed forever.
it('requiredReviewersSupport: public anywhere, private only on Enterprise, unknown without the plan', () => {
  expect(
    requiredReviewersSupport({
      isPrivate: false,
      ownerType: 'Organization',
      ownerPlan: 'free',
    }),
  ).toBe('supported');
  expect(
    requiredReviewersSupport({
      isPrivate: true,
      ownerType: 'Organization',
      ownerPlan: 'enterprise',
    }),
  ).toBe('supported');
  expect(
    requiredReviewersSupport({
      isPrivate: true,
      ownerType: 'Organization',
      ownerPlan: 'team',
    }),
  ).toBe('unsupported');
  expect(requiredReviewersSupport({ isPrivate: true, ownerType: 'User' })).toBe(
    'unsupported',
  );
  expect(requiredReviewersSupport({ isPrivate: true, ownerType: 'Organization' })).toBe(
    'unknown',
  );
});

it('compareGitHubEnvironmentToConfig skips reviewers it was told not to check, but not the branch policy', () => {
  const config = {
    name: 'production',
    protection: {
      requiredReviewers: { users: ['nikunjmavani'], teams: [], preventSelfReview: false },
      deploymentBranchPolicy: { protectedBranches: true, customBranchPolicies: false },
    },
  };
  const branchPolicyApplied = parseGitHubEnvironmentApiResponse({
    protection_rules: [{ type: 'branch_policy' }],
    deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
  });
  expect(
    compareGitHubEnvironmentToConfig(config, branchPolicyApplied, {
      checkReviewers: false,
    }),
  ).toStrictEqual([]);

  const noBranchPolicy = parseGitHubEnvironmentApiResponse({ protection_rules: [] });
  const issues = compareGitHubEnvironmentToConfig(config, noBranchPolicy, {
    checkReviewers: false,
  });
  expect(
    issues.every((issue) => issue.detail.startsWith('deploymentBranchPolicy.')),
  ).toBeTruthy();
  expect(issues.length > 0).toBeTruthy();
});

it('validateDeploySecrets fails on missing required keys only', () => {
  const result = validateDeploySecrets('development', [
    'VITE_API_BASE_URL',
    'NETLIFY_AUTH_TOKEN',
  ]);
  expect(result.missingRequired).toStrictEqual(['NETLIFY_SITE_ID']);
  expect(result.missingOptional.length > 0).toBeTruthy();
});

it('getRuntimeSecretNames ignores empty values', () => {
  const names = getRuntimeSecretNames(
    {
      VITE_API_BASE_URL: 'https://api.example.com',
      NETLIFY_AUTH_TOKEN: '   ',
      NETLIFY_SITE_ID: 'site-123',
    },
    ['VITE_API_BASE_URL', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'],
  );
  expect(names.sort()).toStrictEqual(['NETLIFY_SITE_ID', 'VITE_API_BASE_URL']);
});
