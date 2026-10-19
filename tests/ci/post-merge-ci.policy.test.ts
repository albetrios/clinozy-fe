import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { jobBlock } from '@/tests/utils/workflow-jobs.ts';

const POST_MERGE_WORKFLOW = join(process.cwd(), '.github/workflows/post-merge-ci.yml');

// Locks the single-trunk post-merge wiring:
// one channel, ungated release-please, deploy split, and NO redundant re-testing
// of what pr-ci.yml already gated.

describe('post-merge CI policy (single trunk)', () => {
  const workflow = readFileSync(POST_MERGE_WORKFLOW, 'utf8');

  it('runs on pushes to the single trunk (main only, plus manual dispatch)', () => {
    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request:');
    // fix-forward hotfixes on main — no release/** lane, no dev.
    expect(workflow).not.toContain("'release/**'");
    expect(workflow).not.toMatch(/branches:\s*\[dev,\s*main\]/);
  });

  it('uses the single stable channel — no CHANNEL_SUFFIX, hardcoded config/manifest', () => {
    expect(workflow).not.toContain('CHANNEL_SUFFIX');
    expect(workflow).toContain('config-file: .github/release-please/config.json');
    expect(workflow).toContain('manifest-file: .github/release-please/manifest.json');
  });

  it('does NOT re-run the test suite post-merge (pr-ci is the gate)', () => {
    // The redundant unit/security/matrix jobs are gone; deploy no longer gates on them.
    expect(workflow).not.toMatch(/^ {2}unit-tests:/m);
    expect(workflow).not.toMatch(/^ {2}security-tests:/m);
    expect(workflow).not.toMatch(/^ {2}matrix-tests:/m);
    expect(workflow).not.toContain('reusable-vitest-unit-only.yml');
    expect(workflow).not.toContain('pnpm test:security');
  });

  it('selects the `development` environment on release-please — and NEVER `production`', () => {
    // RELEASE_PLEASE_TOKEN is an environment secret, so the job must select an
    // environment to read it at all. `development` has an empty protection block
    // (.github/environments/development.json), so this grants secret access
    // without gating. `production` carries requiredReviewers — selecting it here
    // would pause post-merge CI for manual approval on EVERY merge to main.
    const releaseBlock = jobBlock(workflow, 'release-please');
    expect(releaseBlock).not.toBe('');
    const environmentLines = releaseBlock
      .split('\n')
      .filter((line) => /^ +environment:/.test(line))
      .map((line) => line.trim());
    expect(environmentLines).toEqual(['environment: development']);
  });

  it('runs release-please with the PAT (github.token fallback) so release-PR merges re-trigger it', () => {
    const tokenPattern =
      /\$\{\{\s*secrets\.RELEASE_PLEASE_TOKEN \|\| github\.token\s*\}\}/g;
    // action token + lint-fix GH_TOKEN (no auto-merge step — release on cadence).
    expect(workflow.match(tokenPattern)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('keeps the tripwire that warns when RELEASE_PLEASE_TOKEN is not provisioned', () => {
    expect(workflow).toContain('RELEASE_PLEASE_TOKEN not provisioned');
  });

  it('actively probes the PAT and fails loud on a 401 (expired/revoked, not just unset)', () => {
    // A silently-degraded PAT still runs green via the github.token fallback but
    // stops release-PR merges from re-triggering the workflow. Fail the run on a
    // deterministic 401 so it surfaces on the merge, not at release time.
    expect(workflow).toContain('Verify RELEASE_PLEASE_TOKEN is valid');
    expect(workflow).toContain('The PAT returned 401');
  });

  it('persists a tracked ci-failure issue on post-merge failure (not just a run ::error)', () => {
    const notifyBlock = jobBlock(workflow, 'notify-failure');
    expect(notifyBlock).not.toBe('');
    // widened perms + the ci-failure-issue action (a true copy of clinozy-be's): one labelled
    // issue per title, repeats as comments, and the next green run closes it.
    expect(notifyBlock).toContain('issues: write');
    expect(notifyBlock).toContain('uses: ./.github/actions/ci-failure-issue');
    expect(notifyBlock).toMatch(/mode: open\n\s+title: Post-merge CI failing/);
    const resolveBlock = jobBlock(workflow, 'resolve-success');
    expect(resolveBlock).toContain('issues: write');
    expect(resolveBlock).toMatch(/mode: close\n\s+title: Post-merge CI failing/);
  });

  it('runs release-please on demand: a merged Release PR, or a dispatch with release_pr', () => {
    // An ordinary merge no longer refreshes the Release PR (each refresh re-ran its PR CI).
    const releaseBlock = jobBlock(workflow, 'release-please');
    expect(releaseBlock).toContain(
      "(github.event_name == 'workflow_dispatch' && inputs.release_pr)",
    );
    expect(releaseBlock).toContain(
      "startsWith(github.event.head_commit.message, 'chore(main): release ')",
    );
    expect(workflow).toMatch(
      /release_pr:\n\s+description: Open or refresh the Release PR/,
    );
    expect(workflow).not.toContain('skip_release');
  });

  it('does NOT auto-merge release PRs — release on cadence (manual merge is the ship button)', () => {
    // release-please keeps the standing Release PR fresh; a human merges it to ship.
    expect(workflow).not.toMatch(/gh pr merge[^\n]*--auto/);
    expect(workflow).not.toContain('Enable auto-merge on release PRs');
  });

  it('generates the SBOM ONLY when a release is cut (not on every merge)', () => {
    const sbomBlock = jobBlock(workflow, 'sbom');
    expect(sbomBlock).not.toBe('');
    expect(sbomBlock).toContain('needs: [release-please]');
    expect(sbomBlock).toContain(
      "needs.release-please.outputs.releases_created == 'true'",
    );
    // release-sbom still reuses that artifact (no duplicate generation).
    const releaseSbomBlock = jobBlock(workflow, 'release-sbom');
    expect(releaseSbomBlock).toContain('needs: [sbom, release-please]');
    expect(releaseSbomBlock).toContain('name: sbom.cyclonedx.json');
  });

  it('deploy-development is decoupled from release-please, default-branch + src gated', () => {
    const devBlock = jobBlock(workflow, 'deploy-development');
    expect(devBlock).not.toBe('');
    // decoupled: depends on `changes`, NOT release-please (development alias tracks
    // HEAD even on a release failure).
    expect(devBlock).toContain('needs: [changes]');
    expect(devBlock).not.toContain('needs.release-please');
    expect(devBlock).not.toMatch(/needs:\s*\[[^\]]*release-please/);
    expect(devBlock).toContain('github_environment: development');
    expect(devBlock).toContain(
      'github.ref_name == github.event.repository.default_branch',
    );
    expect(devBlock).toContain("needs.changes.outputs.src-code == 'true'");
    // concurrency (batching) now lives in the reusable — the caller does not repeat it.
    expect(devBlock).not.toContain('cancel-in-progress');
  });

  it('no longer deploys production — that moved to release-deploy.yml', () => {
    // Prod deploy is decoupled: release-deploy.yml on `release: published`,
    // pinned to the tag. post-merge must NOT reference the production environment.
    expect(jobBlock(workflow, 'deploy-production')).toBe('');
    expect(workflow).not.toContain('github_environment: production');
  });

  it('the reusable deploy owns concurrency: never-cancel production, batch everything else', () => {
    const reusable = readFileSync(
      join(process.cwd(), '.github/workflows/reusable-netlify-deploy.yml'),
      'utf8',
    );
    expect(reusable).toContain('group: netlify-deploy-');
    // env-driven cancel-in-progress: prod → false, any other env → true.
    expect(reusable).toMatch(
      /cancel-in-progress:\s*\$\{\{[^}]*!=\s*'production'[^}]*\}\}/,
    );
  });

  it('no longer dispatches a post-release back-merge (single trunk — nothing to back-merge)', () => {
    expect(workflow).not.toContain('dispatch-post-release-backmerge');
    expect(workflow).not.toContain('post-release-backmerge.yml');
  });
});
