import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareGitHubEnvironmentToConfig,
  parseGitHubEnvironmentApiResponse,
  requiredReviewersSupport,
} from './environments-util.mjs';
import { getRuntimeSecretNames, validateDeploySecrets } from './validate-github-env.mjs';

test('parseGitHubEnvironmentApiResponse extracts reviewers and branch policy', () => {
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

  assert.deepEqual(live.reviewers.users, ['nikunjmavani']);
  assert.equal(live.deploymentBranchPolicy?.protectedBranches, true);
});

test('compareGitHubEnvironmentToConfig detects reviewer drift', () => {
  const config = {
    name: 'production',
    protection: {
      requiredReviewers: { users: ['nikunjmavani'], teams: [], preventSelfReview: false },
      deploymentBranchPolicy: { protectedBranches: true, customBranchPolicies: false },
    },
  };
  const live = parseGitHubEnvironmentApiResponse({ protection_rules: [] });

  const issues = compareGitHubEnvironmentToConfig(config, live);
  assert.ok(issues.some((issue) => issue.kind === 'missing_in_github'));
});

// GitHub enforces required reviewers on a private repository's environments only on Enterprise,
// so on Team they can never match the committed config and `github:sync --check` failed forever.
test('requiredReviewersSupport: public anywhere, private only on Enterprise, unknown without the plan', () => {
  assert.equal(
    requiredReviewersSupport({
      isPrivate: false,
      ownerType: 'Organization',
      ownerPlan: 'free',
    }),
    'supported',
  );
  assert.equal(
    requiredReviewersSupport({
      isPrivate: true,
      ownerType: 'Organization',
      ownerPlan: 'enterprise',
    }),
    'supported',
  );
  assert.equal(
    requiredReviewersSupport({
      isPrivate: true,
      ownerType: 'Organization',
      ownerPlan: 'team',
    }),
    'unsupported',
  );
  assert.equal(
    requiredReviewersSupport({ isPrivate: true, ownerType: 'User' }),
    'unsupported',
  );
  assert.equal(
    requiredReviewersSupport({ isPrivate: true, ownerType: 'Organization' }),
    'unknown',
  );
});

test('compareGitHubEnvironmentToConfig skips reviewers it was told not to check, but not the branch policy', () => {
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
  assert.deepEqual(
    compareGitHubEnvironmentToConfig(config, branchPolicyApplied, {
      checkReviewers: false,
    }),
    [],
  );

  const noBranchPolicy = parseGitHubEnvironmentApiResponse({ protection_rules: [] });
  const issues = compareGitHubEnvironmentToConfig(config, noBranchPolicy, {
    checkReviewers: false,
  });
  assert.ok(issues.every((issue) => issue.detail.startsWith('deploymentBranchPolicy.')));
  assert.ok(issues.length > 0);
});

test('validateDeploySecrets fails on missing required keys only', () => {
  const result = validateDeploySecrets('development', [
    'VITE_API_BASE_URL',
    'NETLIFY_AUTH_TOKEN',
  ]);
  assert.deepEqual(result.missingRequired, ['NETLIFY_SITE_ID']);
  assert.ok(result.missingOptional.length > 0);
});

test('getRuntimeSecretNames ignores empty values', () => {
  const names = getRuntimeSecretNames(
    {
      VITE_API_BASE_URL: 'https://api.example.com',
      NETLIFY_AUTH_TOKEN: '   ',
      NETLIFY_SITE_ID: 'site-123',
    },
    ['VITE_API_BASE_URL', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'],
  );
  assert.deepEqual(names.sort(), ['NETLIFY_SITE_ID', 'VITE_API_BASE_URL']);
});
