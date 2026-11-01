import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const autoMerge = readFileSync(
  join(ROOT, '.github/workflows/dependabot-auto-merge.yml'),
  'utf8',
);
const approval = readFileSync(
  join(ROOT, '.github/workflows/dependabot-approval.yml'),
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
//
// H-1 / H-3: the approval runs dependabot-approval.yml, which holds nothing (a PR can rewrite
// it); dependabot-auto-merge.yml runs main's copy (workflow_run), checks every condition again
// from the API — an approval of the head by an OWNER / MEMBER / COLLABORATOR among them — and
// only then reads the PAT from the main-only development environment.
describe('dependabot auto-merge policy', () => {
  it('a submitted approval signals, from a job that holds nothing', () => {
    expect(approval).toContain('pull_request_review:');
    expect(approval).toContain('types: [submitted]');
    expect(approval).toContain("github.event.review.state == 'approved'");
    expect(approval).not.toMatch(/\$\{\{\s*secrets\./);
    expect(approval).not.toMatch(/^ +environment:/m);
    expect(approval).toMatch(/^ {4}permissions: \{\}$/m);
    expect(approval).toMatch(/^permissions:\n {2}contents: read\n\n/m);
  });

  it('arms from main only, on the approval signal, never on a pull_request trigger', () => {
    expect(autoMerge).toContain("workflows: ['Dependabot approval']");
    expect(autoMerge).toContain('types: [completed]');
    expect(autoMerge).not.toMatch(/^ {2}pull_request(?:_review|_target)?:/m);
    expect(autoMerge).not.toContain('actions/checkout');
    expect(autoMerge).toContain(
      'github.event.workflow_run.head_repository.full_name == github.repository',
    );
  });

  it('matches only Dependabot-authored PRs in the npm-non-major group', () => {
    expect(approval).toContain(
      "github.event.pull_request.user.login == 'dependabot[bot]'",
    );
    expect(approval).toContain("'npm-non-major'");
    // …and checks both again from the API, on the open PR whose head is the approved commit.
    expect(autoMerge).toContain(
      '.author.login == "app/dependabot" or .author.login == "dependabot[bot]"',
    );
    expect(autoMerge).toContain('contains("npm-non-major")');
    expect(autoMerge).toContain(
      'select(.headRefOid == $sha and (.isCrossRepository | not))',
    );
    expect(autoMerge).not.toContain("'npm-major'");
  });

  it('counts only an approval of the head by an owner, member or collaborator (H-3)', () => {
    expect(approval).toContain(
      `contains(fromJSON('["OWNER", "MEMBER", "COLLABORATOR"]'), github.event.review.author_association)`,
    );
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell expansion, asserted verbatim
    expect(autoMerge).toContain('repos/${REPOSITORY}/pulls/${number}/reviews');
    expect(autoMerge).toContain(
      'select(.commit_id == $sha and (.author_association | IN("OWNER", "MEMBER", "COLLABORATOR"))',
    );
    // A reviewer's later "changes requested" withdraws that reviewer's approval.
    expect(autoMerge).toContain('group_by(.user.login) | map(max_by(.submitted_at))');
    expect(autoMerge).toContain('--match-head-commit "$HEAD_SHA"');
  });

  it('the review check reads a trusted approval of the head, and nothing else, as approved', () => {
    const program =
      /approvals="\$\(jq -s --arg sha "\$HEAD_SHA" '([\s\S]*?)' reviews\.jsonl\)"/.exec(
        autoMerge,
      )?.[1];
    expect(program).toBeDefined();
    const review = (
      login: string,
      state: string,
      association: string,
      commit: string,
      at: string,
    ) =>
      JSON.stringify({
        user: { login },
        state,
        author_association: association,
        commit_id: commit,
        submitted_at: at,
      });
    const count = (reviews: string[]) => {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixed 'jq' binary, no user input
      const result = spawnSync('jq', ['-s', '--arg', 'sha', 'head', program ?? ''], {
        input: reviews.join('\n'),
        encoding: 'utf8',
      });
      return Number(result.stdout.trim());
    };
    expect(count([review('owner', 'APPROVED', 'OWNER', 'head', '1')])).toBe(1);
    expect(count([review('stranger', 'APPROVED', 'NONE', 'head', '1')])).toBe(0);
    expect(count([review('contributor', 'APPROVED', 'CONTRIBUTOR', 'head', '1')])).toBe(
      0,
    );
    expect(count([review('member', 'APPROVED', 'MEMBER', 'older', '1')])).toBe(0);
    expect(
      count([
        review('owner', 'APPROVED', 'OWNER', 'head', '1'),
        review('owner', 'CHANGES_REQUESTED', 'OWNER', 'head', '2'),
      ]),
    ).toBe(0);
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
    expect(autoMerge).toMatch(/^ {6}actions: read$/m);
    // The merge needs both writes when GITHUB_TOKEN is the fallback (see the job's permissions).
    expect(autoMerge).toMatch(/^ {6}contents: write$/m);
    expect(autoMerge).toMatch(/^ {6}pull-requests: write$/m);
    // `gh pr diff | grep -q` under pipefail reads a match as "no match" once grep stops early.
    expect(autoMerge).not.toMatch(/gh pr diff[^\n]*\|\s*grep/);
  });

  it('uses squash auto-merge with no third-party actions', () => {
    expect(autoMerge).toContain('gh pr merge --auto --squash');
    expect(autoMerge).not.toContain('uses:');
    expect(approval).not.toContain('uses:');
  });

  it('merges with the PAT (github.token fallback) so the merge push triggers post-merge CI', () => {
    // A GITHUB_TOKEN-attributed merge starts no workflows (no post-merge run for
    // that commit). The PAT is an ENVIRONMENT secret, so the job selects the
    // `development` environment to read it — main only, which a workflow_run job runs
    // on. It must never select `production`, whose reviewers would gate every merge.
    expect(autoMerge).toMatch(
      /GH_TOKEN:\s*\$\{\{\s*secrets\.RELEASE_PLEASE_TOKEN \|\| secrets\.GITHUB_TOKEN\s*\}\}/,
    );
    expect(autoMerge).toContain('environment: development');
    expect(autoMerge).not.toContain('environment: production');
    // The PAT reaches the one step that merges, after every check.
    expect(autoMerge.match(/secrets\.RELEASE_PLEASE_TOKEN/g)).toHaveLength(1);
    expect(autoMerge.indexOf('secrets.RELEASE_PLEASE_TOKEN')).toBeGreaterThan(
      autoMerge.indexOf('- name: Enable squash auto-merge'),
    );
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
