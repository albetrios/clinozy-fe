import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const autoMerge = readFileSync(
  join(ROOT, '.github/workflows/dependabot-auto-merge.yml'),
  'utf8',
);
const triage = readFileSync(
  join(ROOT, '.github/workflows/dependabot-ci-triage.yml'),
  'utf8',
);
const dependabotConfig = readFileSync(join(ROOT, '.github/dependabot.yml'), 'utf8');

// The approval IS the manual gate: only the low-risk npm-non-major group may
// auto-merge, and only after a maintainer approves, and, for a dependency bump, only
// once its @smoke e2e against the backend image is green. Everything else is manual.
describe('dependabot auto-merge policy', () => {
  it('arms only on a submitted approval review', () => {
    expect(autoMerge).toContain('pull_request_review:');
    expect(autoMerge).toContain('types: [submitted]');
    expect(autoMerge).toContain("github.event.review.state == 'approved'");
    expect(autoMerge).not.toContain('pull_request_target');
  });

  it('matches only Dependabot-authored PRs in the npm-non-major group', () => {
    expect(autoMerge).toContain(
      "github.event.pull_request.user.login == 'dependabot[bot]'",
    );
    expect(autoMerge).toContain("'npm-non-major'");
    expect(autoMerge).not.toContain("'npm-major'");
  });

  it('waits for the @smoke e2e on the head before arming auto-merge when a dependency file changed', () => {
    // e2e-backend.yml runs on a pull request that changes one of these files. It is not a
    // required check, so auto-merge would not wait for it: the job waits, and it must look
    // for the same files, or a bump would merge without its e2e.
    const e2eBackend = readFileSync(
      join(ROOT, '.github/workflows/e2e-backend.yml'),
      'utf8',
    );
    const pathsBlock =
      /pull_request:\n\s+paths:\n((?:\s+- .+\n)+)/.exec(e2eBackend)?.[1] ?? '';
    const pullRequestPaths = [...pathsBlock.matchAll(/- (\S+)/g)].map(
      (match) => match[1] ?? '',
    );
    expect(pullRequestPaths.length).toBeGreaterThan(0);
    for (const path of pullRequestPaths)
      expect(autoMerge).toContain(path.replaceAll('.', '\\.'));

    const wait = autoMerge.indexOf('- name: Wait for the @smoke e2e on this head');
    expect(wait).toBeGreaterThan(-1);
    expect(wait).toBeLessThan(autoMerge.indexOf('gh pr merge --auto --squash'));
    expect(autoMerge).toContain('--workflow e2e-backend.yml');
    expect(autoMerge).toMatch(/gh run watch [^\n]*--exit-status/);
    expect(autoMerge).toMatch(/^ {2}actions: read$/m);
    // `gh pr diff | grep -q` under pipefail reads a match as "no match" once grep stops early.
    expect(autoMerge).not.toMatch(/gh pr diff[^\n]*\|\s*grep/);
  });

  it('uses squash auto-merge with no third-party actions', () => {
    expect(autoMerge).toContain('gh pr merge --auto --squash');
    expect(autoMerge).not.toContain('uses:');
  });

  it('merges with the PAT (github.token fallback) so the merge push triggers post-merge CI', () => {
    // A GITHUB_TOKEN-attributed merge starts no workflows (no post-merge run for
    // that commit). The PAT is an ENVIRONMENT secret, so the job selects the
    // `development` environment to read it — an environment with no protection
    // rules. It must never select `production`: this job runs on Dependabot PR
    // branches, which production's protectedBranches policy would reject.
    expect(autoMerge).toMatch(
      /GH_TOKEN:\s*\$\{\{\s*secrets\.RELEASE_PLEASE_TOKEN \|\| secrets\.GITHUB_TOKEN\s*\}\}/,
    );
    expect(autoMerge).toContain('environment: development');
    expect(autoMerge).not.toContain('environment: production');
  });
});

describe('dependabot CI triage policy', () => {
  it('listens for PR CI completion and never merges anything', () => {
    expect(triage).toContain('workflow_run:');
    expect(triage).toContain("workflows: ['PR CI']");
    expect(triage).not.toContain('gh pr merge');
  });

  it('opens its issue through the shared action, linked to the failed run, and closes it when green', () => {
    expect(triage).not.toContain('gh issue create');
    expect(triage).toMatch(
      /mode: open[\s\S]*run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/,
    );
    expect(triage).toMatch(/mode: close\n\s+title: 'Dependabot PR blocked by CI: PR #/);
  });

  it('files its issue with the dependencies label beside ci-failure', () => {
    // The issue had it before the move to the shared action, which now takes more labels.
    expect(triage).toMatch(/mode: open[\s\S]*?labels: dependencies\n[\s\S]*?mode: close/);
  });
});

describe('dependabot grouping policy', () => {
  it('defines the risk groups the auto-merge classification depends on', () => {
    expect(dependabotConfig).toContain('npm-non-major:');
    expect(dependabotConfig).toContain('npm-major:');
    expect(dependabotConfig).toContain('security-updates:');
  });

  it('keeps npm-non-major scoped to patch + minor only', () => {
    const nonMajorBlock =
      dependabotConfig.match(/npm-non-major:\n([\s\S]*?)\n {6}\S/)?.[1] ?? '';
    expect(nonMajorBlock).not.toBe('');
    expect(nonMajorBlock).toContain('- patch');
    expect(nonMajorBlock).toContain('- minor');
    expect(nonMajorBlock).not.toContain('- major');
  });

  it('keeps the @tanstack/react-router minor/major ignore that enforces the documented 1.170.x pin', () => {
    expect(dependabotConfig).toContain("dependency-name: '@tanstack/react-router'");
    const routerIgnoreBlock =
      dependabotConfig.match(/@tanstack\/react-router'\n([\s\S]*?)\n {4}\S/)?.[1] ?? '';
    expect(routerIgnoreBlock).toContain('version-update:semver-minor');
    expect(routerIgnoreBlock).toContain('version-update:semver-major');
  });
});

describe('dependabot cooldown policy', () => {
  it('makes every ecosystem wait 7 days before proposing a new release', () => {
    // Semgrep's dependabot-missing-cooldown (20 Oct 2026 triage): a release this new has had no
    // time to be found broken or compromised. Cooldown never delays a security update.
    const ecosystems = dependabotConfig.split(/^ {2}- package-ecosystem: /m).slice(1);
    expect(ecosystems.length).toBeGreaterThan(0);
    for (const block of ecosystems) {
      const days = Number(/cooldown:\n\s+default-days: (\d+)/.exec(block)?.[1] ?? 0);
      expect(days, block.split('\n')[0]).toBeGreaterThanOrEqual(7);
    }
  });
});
