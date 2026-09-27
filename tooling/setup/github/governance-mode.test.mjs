import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GOVERNANCE_PRESETS,
  detectProductionMode,
  detectRulesetMode,
  findGovernanceIssues,
  nextProductionPayload,
  nextRulesetPayload,
  parseCodeownersOwners,
  resolveReviewers,
} from './governance-mode.mjs';

/** A minimal ruleset in a given mode, for the pure transforms. */
function rulesetFixture(mode) {
  return {
    name: 'Protect main',
    rules: [
      { type: 'deletion' },
      {
        type: 'pull_request',
        parameters: {
          allowed_merge_methods: ['squash'],
          required_review_thread_resolution: true,
          ...GOVERNANCE_PRESETS[mode].ruleset,
        },
      },
    ],
  };
}

function productionFixture(mode, users) {
  return {
    name: 'production',
    protection: {
      requiredReviewers: {
        users,
        teams: [],
        preventSelfReview: GOVERNANCE_PRESETS[mode].production.preventSelfReview,
      },
      deploymentBranchPolicy: { protectedBranches: true, customBranchPolicies: false },
    },
  };
}

/** Facts helper for findGovernanceIssues. */
function facts(overrides = {}) {
  return {
    rulesetPath: '.github/rulesets/main.json',
    rulesetMode: 'personal',
    productionMode: 'personal',
    rulesetParameters: GOVERNANCE_PRESETS.personal.ruleset,
    productionReviewers: ['nikunjmavani'],
    preventSelfReview: false,
    codeownersUsers: ['nikunjmavani'],
    codeownersTeams: [],
    ...overrides,
  };
}

test('parseCodeownersOwners: counts user handles, excludes teams and comments', () => {
  const text = [
    '# TODO: replace @nikunjmavani with @core/frontend when the team grows',
    '* @nikunjmavani',
    '/src/ @nikunjmavani @second-dev',
    '/docs/ @core/frontend',
  ].join('\n');
  const { users, teams } = parseCodeownersOwners(text);
  assert.deepEqual(users, ['nikunjmavani', 'second-dev']);
  assert.deepEqual(teams, ['core/frontend']);
});

test('detectRulesetMode: recognizes each preset and flags a hybrid', () => {
  assert.equal(detectRulesetMode(rulesetFixture('personal')), 'personal');
  assert.equal(detectRulesetMode(rulesetFixture('team')), 'team');

  const hybrid = rulesetFixture('personal');
  hybrid.rules[1].parameters.dismiss_stale_reviews_on_push = true; // half team
  assert.equal(detectRulesetMode(hybrid), 'unknown');
});

test('detectProductionMode: keys off preventSelfReview', () => {
  assert.equal(detectProductionMode(productionFixture('personal', ['a'])), 'personal');
  assert.equal(detectProductionMode(productionFixture('team', ['a', 'b'])), 'team');
  assert.equal(detectProductionMode({ protection: {} }), 'unknown');
});

test('findGovernanceIssues: none for a consistent personal repo', () => {
  assert.deepEqual(findGovernanceIssues(facts()), []);
});

test('findGovernanceIssues: none for a consistent team repo (2 owners)', () => {
  const twoOwnerTeam = facts({
    rulesetMode: 'team',
    productionMode: 'team',
    rulesetParameters: GOVERNANCE_PRESETS.team.ruleset,
    productionReviewers: ['nikunjmavani', 'second-dev'],
    preventSelfReview: true,
    codeownersUsers: ['nikunjmavani', 'second-dev'],
  });
  assert.deepEqual(findGovernanceIssues(twoOwnerTeam), []);
});

test('findGovernanceIssues: flags ruleset/production disagreement', () => {
  const issues = findGovernanceIssues(
    facts({ productionMode: 'team', preventSelfReview: true }),
  );
  assert.ok(issues.some((issue) => issue.includes('disagrees')));
});

test('findGovernanceIssues: flags team with fewer than two owners (deadlock)', () => {
  const issues = findGovernanceIssues(
    facts({
      rulesetMode: 'team',
      productionMode: 'team',
      rulesetParameters: GOVERNANCE_PRESETS.team.ruleset,
      productionReviewers: ['nikunjmavani'],
      preventSelfReview: true,
      codeownersUsers: ['nikunjmavani'],
    }),
  );
  assert.ok(issues.some((issue) => issue.includes('≥2 CODEOWNERS users')));
  assert.ok(issues.some((issue) => issue.includes('Deadlock: preventSelfReview')));
});

test('findGovernanceIssues: flags a reviewer not present in CODEOWNERS', () => {
  const issues = findGovernanceIssues(facts({ productionReviewers: ['ghost'] }));
  assert.ok(issues.some((issue) => issue.includes('not in CODEOWNERS')));
});

test('resolveReviewers: personal picks the first owner; team needs two', () => {
  assert.deepEqual(resolveReviewers('personal', ['nikunjmavani', 'second-dev']), [
    'nikunjmavani',
  ]);
  assert.deepEqual(resolveReviewers('team', ['nikunjmavani', 'second-dev']), [
    'nikunjmavani',
    'second-dev',
  ]);
  assert.throws(() => resolveReviewers('team', ['nikunjmavani']), /≥2 CODEOWNERS users/);
  assert.throws(() => resolveReviewers('personal', []), /no individual user owners/);
});

test('nextRulesetPayload: sets review params, preserves everything else', () => {
  const before = rulesetFixture('personal');
  const after = nextRulesetPayload(before, 'team');
  const params = after.rules.find((rule) => rule.type === 'pull_request').parameters;
  assert.equal(params.required_approving_review_count, 1);
  assert.equal(params.require_code_owner_review, true);
  // Untouched fields survive.
  assert.deepEqual(params.allowed_merge_methods, ['squash']);
  assert.equal(params.required_review_thread_resolution, true);
  // Input is not mutated.
  assert.equal(
    before.rules.find((rule) => rule.type === 'pull_request').parameters
      .required_approving_review_count,
    0,
  );
});

test('nextProductionPayload: sets reviewers + preventSelfReview, keeps branch policy', () => {
  const before = productionFixture('personal', ['nikunjmavani']);
  const after = nextProductionPayload(before, 'team', ['nikunjmavani', 'second-dev']);
  assert.deepEqual(after.protection.requiredReviewers.users, [
    'nikunjmavani',
    'second-dev',
  ]);
  assert.equal(after.protection.requiredReviewers.preventSelfReview, true);
  assert.deepEqual(after.protection.deploymentBranchPolicy, {
    protectedBranches: true,
    customBranchPolicies: false,
  });
});
