import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareGitHubEnvironmentToConfig,
  parseGitHubEnvironmentApiResponse,
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
