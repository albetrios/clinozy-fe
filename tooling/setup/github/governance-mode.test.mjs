import { expect, it } from 'vitest';

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

it('parseCodeownersOwners: counts user handles, excludes teams and comments', () => {
  const text = [
    '# TODO: replace @nikunjmavani with @core/frontend when the team grows',
    '* @nikunjmavani',
    '/src/ @nikunjmavani @second-dev',
    '/docs/ @core/frontend',
  ].join('\n');
  const { users, teams } = parseCodeownersOwners(text);
  expect(users).toStrictEqual(['nikunjmavani', 'second-dev']);
  expect(teams).toStrictEqual(['core/frontend']);
});

it('detectRulesetMode: recognizes each preset and flags a hybrid', () => {
  expect(detectRulesetMode(rulesetFixture('personal'))).toBe('personal');
  expect(detectRulesetMode(rulesetFixture('team'))).toBe('team');

  const hybrid = rulesetFixture('personal');
  hybrid.rules[1].parameters.dismiss_stale_reviews_on_push = true; // half team
  expect(detectRulesetMode(hybrid)).toBe('unknown');
});

it('detectProductionMode: keys off preventSelfReview', () => {
  expect(detectProductionMode(productionFixture('personal', ['a']))).toBe('personal');
  expect(detectProductionMode(productionFixture('team', ['a', 'b']))).toBe('team');
  expect(detectProductionMode({ protection: {} })).toBe('unknown');
});

it('findGovernanceIssues: none for a consistent personal repo', () => {
  expect(findGovernanceIssues(facts())).toStrictEqual([]);
});

it('findGovernanceIssues: none for a consistent team repo (2 owners)', () => {
  const twoOwnerTeam = facts({
    rulesetMode: 'team',
    productionMode: 'team',
    rulesetParameters: GOVERNANCE_PRESETS.team.ruleset,
    productionReviewers: ['nikunjmavani', 'second-dev'],
    preventSelfReview: true,
    codeownersUsers: ['nikunjmavani', 'second-dev'],
  });
  expect(findGovernanceIssues(twoOwnerTeam)).toStrictEqual([]);
});

it('findGovernanceIssues: flags ruleset/production disagreement', () => {
  const issues = findGovernanceIssues(
    facts({ productionMode: 'team', preventSelfReview: true }),
  );
  expect(issues.some((issue) => issue.includes('disagrees'))).toBeTruthy();
});

it('findGovernanceIssues: flags team with fewer than two owners (deadlock)', () => {
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
  expect(issues.some((issue) => issue.includes('≥2 CODEOWNERS users'))).toBeTruthy();
  expect(
    issues.some((issue) => issue.includes('Deadlock: preventSelfReview')),
  ).toBeTruthy();
});

it('findGovernanceIssues: flags a reviewer not present in CODEOWNERS', () => {
  const issues = findGovernanceIssues(facts({ productionReviewers: ['ghost'] }));
  expect(issues.some((issue) => issue.includes('not in CODEOWNERS'))).toBeTruthy();
});

it('resolveReviewers: personal picks the first owner; team needs two', () => {
  expect(resolveReviewers('personal', ['nikunjmavani', 'second-dev'])).toStrictEqual([
    'nikunjmavani',
  ]);
  expect(resolveReviewers('team', ['nikunjmavani', 'second-dev'])).toStrictEqual([
    'nikunjmavani',
    'second-dev',
  ]);
  expect(() => resolveReviewers('team', ['nikunjmavani'])).toThrow(/≥2 CODEOWNERS users/);
  expect(() => resolveReviewers('personal', [])).toThrow(/no individual user owners/);
});

it('nextRulesetPayload: sets review params, preserves everything else', () => {
  const before = rulesetFixture('personal');
  const after = nextRulesetPayload(before, 'team');
  const params = after.rules.find((rule) => rule.type === 'pull_request').parameters;
  expect(params.required_approving_review_count).toBe(1);
  expect(params.require_code_owner_review).toBe(true);
  // Untouched fields survive.
  expect(params.allowed_merge_methods).toStrictEqual(['squash']);
  expect(params.required_review_thread_resolution).toBe(true);
  // Input is not mutated.
  expect(
    before.rules.find((rule) => rule.type === 'pull_request').parameters
      .required_approving_review_count,
  ).toBe(0);
});

it('nextProductionPayload: sets reviewers + preventSelfReview, keeps branch policy', () => {
  const before = productionFixture('personal', ['nikunjmavani']);
  const after = nextProductionPayload(before, 'team', ['nikunjmavani', 'second-dev']);
  expect(after.protection.requiredReviewers.users).toStrictEqual([
    'nikunjmavani',
    'second-dev',
  ]);
  expect(after.protection.requiredReviewers.preventSelfReview).toBe(true);
  expect(after.protection.deploymentBranchPolicy).toStrictEqual({
    protectedBranches: true,
    customBranchPolicies: false,
  });
});
