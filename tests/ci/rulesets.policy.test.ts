import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the single-trunk model: exactly ONE committed branch ruleset, targeting
// `main` only. A second ruleset file or a non-main branch target fails here —
// this is the committed side of
// "one trunk, one ruleset"; the remote side is enforced by
// `pnpm github:sync --prune`, which deletes any remote branch ruleset not in
// this directory.
const RULESETS_DIR = join(process.cwd(), '.github/rulesets');

/** @returns {{ fileName: string, payload: any }[]} */
function loadRulesets() {
  return readdirSync(RULESETS_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      payload: JSON.parse(readFileSync(join(RULESETS_DIR, fileName), 'utf8')),
    }));
}

describe('branch rulesets policy (one trunk, one ruleset)', () => {
  const rulesets = loadRulesets();

  it('commits exactly one ruleset file — main.json', () => {
    expect(rulesets.map((ruleset) => ruleset.fileName)).toEqual(['main.json']);
  });

  it('is a branch ruleset that targets main only (no dev or other branch)', () => {
    for (const { fileName, payload } of rulesets) {
      expect(payload.target, `${fileName}: target`).toBe('branch');
      expect(
        payload?.conditions?.ref_name?.include,
        `${fileName}: ref_name.include`,
      ).toEqual(['refs/heads/main']);
      expect(
        payload?.conditions?.ref_name?.exclude ?? [],
        `${fileName}: ref_name.exclude`,
      ).toEqual([]);
    }
  });

  it('is named "Protect main" (the name the drift guard and sync match on)', () => {
    expect(rulesets[0]?.payload?.name).toBe('Protect main');
  });

  it('pins the governance rules the trunk depends on (squash-only, linear history, checks)', () => {
    // The weekly canary checks ruleset PRESENCE only (the Actions token cannot
    // read secrets to diff parameters), so the committed JSON is the one place
    // rule CONTENT is pinned — a dropped rule here would otherwise vanish
    // silently on the next `pnpm github:sync --prune`.
    // NOTE: `required_signatures` is intentionally NOT pinned — branch commits are
    // unsigned and the GitHub squash-merge commit that lands on main is signed anyway,
    // so the rule only ever deadlocked merges once `bypass_actors` was removed.
    const ruleTypes = (
      (rulesets[0]?.payload?.rules ?? []) as Array<{ type: string }>
    ).map((rule) => rule.type);
    expect(ruleTypes).toEqual(
      expect.arrayContaining([
        'required_linear_history',
        'pull_request',
        'required_status_checks',
        'deletion',
        'non_fast_forward',
      ]),
    );
    // required_signatures must NOT come back (it would deadlock every unsigned-commit PR).
    expect(ruleTypes).not.toContain('required_signatures');
    const pullRequestRule = (
      (rulesets[0]?.payload?.rules ?? []) as Array<{
        type: string;
        parameters?: { allowed_merge_methods?: string[] };
      }>
    ).find((rule) => rule.type === 'pull_request');
    expect(pullRequestRule?.parameters?.allowed_merge_methods).toEqual(['squash']);
  });

  it('has NO bypass actors — a red/pending required check cannot be merged by anyone', () => {
    // The bug this locks out: a repo-admin `pull_request` bypass let a red `Quality gate`
    // merge through the merge API. With zero bypass actors, a failing/pending required
    // check blocks the merge for everyone — the repo owner included. Never re-add these.
    expect(rulesets[0]?.payload?.bypass_actors ?? []).toEqual([]);
  });

  it('does not require branches to be up to date (strict off) so a green PR merges cleanly', () => {
    const checksRule = (
      (rulesets[0]?.payload?.rules ?? []) as Array<{
        type: string;
        parameters?: { strict_required_status_checks_policy?: boolean };
      }>
    ).find((rule) => rule.type === 'required_status_checks');
    expect(checksRule?.parameters?.strict_required_status_checks_policy).toBe(false);
  });
});
