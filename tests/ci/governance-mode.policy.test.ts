import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The committed side of the governance-mode invariant (personal ↔ team). The
// tool `tooling/setup/github/governance-mode.mjs` keeps these files consistent;
// this test independently re-derives the check so a hand-edit that mangles the
// coupled review fields — or that would deadlock the sole maintainer — fails the
// `ci-policy` lane instead of reaching GitHub via `pnpm github:sync`.
//
// It is mode-AGNOSTIC on purpose: it asserts the files encode ONE recognized,
// non-deadlocking mode, so a legitimate personal→team switch (with a 2nd owner)
// stays green without editing this test. Full reference:
// docs/reference/branch-governance.md
const ROOT = process.cwd();

const ruleset = JSON.parse(
  readFileSync(join(ROOT, '.github/rulesets/main.json'), 'utf8'),
);
const productionEnv = JSON.parse(
  readFileSync(join(ROOT, '.github/environments/production.json'), 'utf8'),
);
const codeowners = readFileSync(join(ROOT, '.github/CODEOWNERS'), 'utf8');

/** Individual `@user` handles (no slash), comments stripped. */
function codeownersUsers(text: string): string[] {
  const users = new Set<string>();
  for (const rawLine of text.split('\n')) {
    const hashIndex = rawLine.indexOf('#');
    const line = (hashIndex === -1 ? rawLine : rawLine.slice(0, hashIndex)).trim();
    if (!line) continue;
    for (const token of line.split(/\s+/).slice(1)) {
      if (token.startsWith('@') && !token.includes('/')) users.add(token.slice(1));
    }
  }
  return [...users].sort();
}

const prParams: Record<string, unknown> =
  ruleset.rules?.find((rule: { type: string }) => rule.type === 'pull_request')
    ?.parameters ?? {};
const reviewers = productionEnv?.protection?.requiredReviewers ?? {};
const reviewerUsers: string[] = reviewers.users ?? [];
const users = codeownersUsers(codeowners);

function rulesetMode(): 'personal' | 'team' | 'unknown' {
  const personal =
    prParams.required_approving_review_count === 0 &&
    prParams.require_code_owner_review === false &&
    prParams.require_last_push_approval === false &&
    prParams.dismiss_stale_reviews_on_push === false;
  const team =
    (prParams.required_approving_review_count as number) >= 1 &&
    prParams.require_code_owner_review === true &&
    prParams.require_last_push_approval === true &&
    prParams.dismiss_stale_reviews_on_push === true;
  if (personal) return 'personal';
  if (team) return 'team';
  return 'unknown';
}

function productionMode(): 'personal' | 'team' | 'unknown' {
  if (reviewers.preventSelfReview === false) return 'personal';
  if (reviewers.preventSelfReview === true) return 'team';
  return 'unknown';
}

describe('branch governance policy (personal ↔ team)', () => {
  it('ruleset pull_request params match a recognized preset (not a hybrid)', () => {
    expect(rulesetMode()).not.toBe('unknown');
  });

  it('production environment matches a recognized preset', () => {
    expect(productionMode()).not.toBe('unknown');
  });

  it('ruleset mode and production environment mode agree', () => {
    expect(rulesetMode()).toBe(productionMode());
  });

  it('production reviewers are a subset of CODEOWNERS users (single roster)', () => {
    for (const reviewer of reviewerUsers) {
      expect(users, `reviewer ${reviewer}`).toContain(reviewer);
    }
  });

  it('no self-review deadlock — preventSelfReview requires ≥2 reviewers', () => {
    if (reviewers.preventSelfReview === true) {
      expect(reviewerUsers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('no code-owner-review deadlock — requires ≥2 CODEOWNERS users', () => {
    if (prParams.require_code_owner_review === true) {
      expect(users.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('team mode, when set, has ≥2 reviewers and ≥2 owners', () => {
    if (rulesetMode() === 'team') {
      expect(users.length).toBeGreaterThanOrEqual(2);
      expect(reviewerUsers.length).toBeGreaterThanOrEqual(2);
    }
  });
});
