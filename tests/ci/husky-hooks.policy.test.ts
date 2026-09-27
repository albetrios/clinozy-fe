import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Locks the local git-hook invariants that back the CI gates. The pre-push hook
// is the first line of defense before a push reaches CI — if a guard is deleted
// here it silently stops running, so pin its presence.
const hook = (name: string): string =>
  readFileSync(join(process.cwd(), '.husky', name), 'utf8');

describe('husky hooks policy', () => {
  const prePush = hook('pre-push');

  it('pre-push enforces the <type>/<description> branch-name policy', () => {
    // The conventional-type prefixes a branch must start with, plus the
    // claude/* web-session allowlist (parity with clinozy-be).
    expect(prePush).toMatch(
      /\^\(claude\/\.\+\|\(feat\|feature\|fix\|hotfix\|chore\|ci\|docs\|refactor\|test\|perf\|build\|style\|revert\)/,
    );
  });

  it('pre-push keeps the one-off SKIP_BRANCH_CHECK bypass', () => {
    expect(prePush).toContain('SKIP_BRANCH_CHECK');
  });

  it('pre-push resolves the trunk from config, never a hardcoded branch name', () => {
    // The default branch is read from setup.config.json so a renamed trunk stays
    // exempt without editing the hook.
    expect(prePush).toContain('setup.config.json');
    expect(prePush).toContain('defaultBranch');
  });

  it('pre-push exempts the trunk and a detached HEAD from the branch-name check', () => {
    expect(prePush).toContain('!= "HEAD"');
    expect(prePush).toContain('!= "$DEFAULT_BRANCH"');
  });
});

describe('codegraph auto-sync hooks policy', () => {
  // post-checkout (branch switch) and post-merge (merge/pull) refresh the local
  // codegraph index so `codegraph_*` queries never answer from a stale index.
  // Both MUST stay guarded (no-op when codegraph or the index is absent — CI, web
  // sessions, teammates who don't use codegraph) and backgrounded (never block git).
  const postCheckout = hook('post-checkout');
  const postMerge = hook('post-merge');

  for (const [name, body] of [
    ['post-checkout', () => postCheckout],
    ['post-merge', () => postMerge],
  ] as const) {
    describe(name, () => {
      it('runs an incremental codegraph sync', () => {
        expect(body()).toContain('codegraph sync');
      });

      it('no-ops when the codegraph CLI is absent (CI / non-users)', () => {
        expect(body()).toContain('command -v codegraph');
      });

      it('no-ops when the local index is absent', () => {
        expect(body()).toContain('.codegraph/codegraph.db');
      });

      it('backgrounds the sync so it never blocks git', () => {
        // The sync runs in a detached subshell: `( codegraph sync -q … & )`.
        expect(body()).toMatch(/codegraph sync[^\n]*&/);
      });
    });
  }

  it('post-checkout only refreshes on a branch checkout, not a file checkout', () => {
    // Git passes $3 = 1 for a branch checkout, 0 for a file checkout.
    expect(postCheckout).toContain('[ "$3" = "1" ]');
  });
});
