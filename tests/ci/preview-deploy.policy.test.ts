import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { jobBlock, jobBlocks } from '@/tests/utils/workflow-jobs.ts';

// H-1: no pull request reaches a deploy secret. The development environment (an account-wide
// Netlify token for the site production also serves, and the release PAT) allows the main branch
// only; the PR preview builds in a job that holds nothing and publishes from a workflow_run job
// that runs main's copy of its file and none of the PR's code. clinozy-be pins the same split in
// src/tests/unit/ci/preview-deploy.policy.unit.test.ts where it has the same task.

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows');
const read = (file: string) => readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
const workflowFiles = readdirSync(WORKFLOWS_DIR).filter((file) => /\.ya?ml$/.test(file));

/** `text` without its comment lines. */
const withoutComments = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

/** The workflow's `on:` block, comments dropped. */
function triggers(workflow: string): string {
  const code = withoutComments(workflow);
  const start = code.search(/^on:/m);
  if (start === -1) return '';
  const rest = code.slice(start).split('\n');
  const end = rest.slice(1).findIndex((line) => /^\S/.test(line));
  return rest.slice(0, end === -1 ? undefined : end + 1).join('\n');
}

/** True when a pull request (or a review of one) starts the workflow. */
const pullRequestTriggered = (workflow: string) =>
  /^ {2}pull_request(?:_review|_review_comment|_target)?:/m.test(triggers(workflow));

const build = read('preview.yml');
const deploy = read('preview-deploy.yml');
const developmentEnvironment = JSON.parse(
  readFileSync(join(process.cwd(), '.github/environments/development.json'), 'utf8'),
) as {
  protection?: {
    deploymentBranchPolicy?: {
      protectedBranches?: boolean;
      customBranchPolicies?: boolean;
    };
  };
};

describe('PR previews and the development environment (H-1)', () => {
  it('reads the triggers (parser sanity)', () => {
    expect(pullRequestTriggered(build)).toBe(true);
    expect(pullRequestTriggered(deploy)).toBe(false);
    expect(triggers(deploy)).toContain("workflows: ['Preview build']");
  });

  it('no workflow runs on pull_request_target', () => {
    for (const file of workflowFiles) {
      expect(triggers(read(file)), file).not.toMatch(/pull_request_target/);
    }
  });

  it('the development environment allows the main branch only', () => {
    expect(developmentEnvironment.protection?.deploymentBranchPolicy).toEqual({
      protectedBranches: true,
      customBranchPolicies: false,
    });
  });

  it('no job a pull request starts selects the development environment or reads a secret', () => {
    const offences = workflowFiles
      .filter((file) => pullRequestTriggered(read(file)))
      .flatMap((file) =>
        jobBlocks(withoutComments(read(file))).flatMap(([name, block]) => {
          const environment =
            block
              .split('\n')
              .find((line) => line.startsWith('    environment:'))
              ?.slice('    environment:'.length)
              .trim() ?? '';
          const problems: string[] = [];
          // A job that also runs off pull requests may select it there, never on one.
          if (
            /development/.test(environment) &&
            !environment.includes(
              "github.event_name != 'pull_request' && 'development' || null",
            )
          ) {
            problems.push(`${file} job '${name}' selects ${environment}`);
          }
          if (file === 'preview.yml' && /\$\{\{\s*secrets\./.test(block)) {
            problems.push(`${file} job '${name}' reads a secret`);
          }
          return problems;
        }),
      );
    expect(offences).toEqual([]);
  });

  it('the preview build holds nothing: no environment, no secret, a read-only token', () => {
    const code = withoutComments(build);
    expect(code).not.toMatch(/^ +environment:/m);
    expect(code).not.toMatch(/secrets\./);
    expect(code).not.toMatch(/: write$/m);
    expect(jobBlock(code, 'build')).toMatch(/^ {6}contents: read$/m);
    expect(code).toContain('name: preview-dist');
    expect(code).toContain("HOSTED_DEPLOYMENT: 'true'");
  });

  it('the deploy job runs no code from the pull request', () => {
    const job = jobBlock(withoutComments(deploy), 'deploy');
    expect(job).not.toBe('');
    // Only main's netlify.toml and .nvmrc are checked out — never the PR's tree.
    const checkouts = [
      ...job.matchAll(/uses: actions\/checkout@[^\n]+\n((?: {8}.+\n)+)/g),
    ];
    expect(checkouts).toHaveLength(1);
    expect(checkouts[0]?.[1]).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression syntax, asserted verbatim
      'ref: ${{ github.event.repository.default_branch }}',
    );
    expect(checkouts[0]?.[1]).toContain('sparse-checkout: |');
    // No repository script, no local action, no install from the PR's lockfile.
    expect(job).not.toMatch(
      /\bpnpm\b|\bnpm run\b|\bnpx\b|\byarn\b|\.\/\.github\/actions|node tooling/,
    );
    // The PR is published as data: the artifact of the build run that triggered this one.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression syntax, asserted verbatim
    expect(job).toContain('run-id: ${{ github.event.workflow_run.id }}');
    expect(job).toContain('name: preview-dist');
  });

  it('the deploy job publishes to the pull request alias only, never --prod', () => {
    const job = jobBlock(withoutComments(deploy), 'deploy');
    expect(withoutComments(deploy)).not.toMatch(/--prod\b/);
    const deployCommands = job
      .split('\n')
      .filter((line) => /netlify deploy\b/.test(line));
    expect(deployCommands).toEqual([
      '          netlify deploy --alias "$PREVIEW_ALIAS" --dir=dist --no-build --json > deploy-result.json',
    ]);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell expansion, asserted verbatim
    expect(job).toContain('echo "alias=pr-${number}"');
    // The number is the API's pull request for the build's commit, digits only.
    expect(job).toContain("'' | *[!0-9]*)");
  });

  it('the deploy job installs netlify-cli by exact version, no scripts, before any secret', () => {
    const version = /^ {2}NETLIFY_CLI_VERSION: '(\d+)\.\d+\.\d+'$/m.exec(deploy)?.[1];
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(version).toBe(
      /\d+/.exec(packageJson.devDependencies['netlify-cli'] ?? '')?.[0],
    );
    const install = deploy.slice(deploy.indexOf('- name: Install netlify-cli'));
    const installStep = install.slice(0, install.indexOf('\n      - ', 1));
    expect(installStep).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: shell expansion, asserted verbatim
      'npm install --global --ignore-scripts --no-audit --no-fund "netlify-cli@${NETLIFY_CLI_VERSION}"',
    );
    expect(installStep).not.toMatch(/secrets\./);
    expect(deploy.indexOf('- name: Install netlify-cli')).toBeLessThan(
      deploy.indexOf('NETLIFY_AUTH_TOKEN: $' + '{{ secrets.NETLIFY_AUTH_TOKEN }}'),
    );
  });

  it('publishes only same-repository, non-Dependabot pull requests after a green build', () => {
    const condition =
      /^ {4}if: >-\n((?: {6}.+\n)+)/m.exec(jobBlock(deploy, 'deploy'))?.[1] ?? '';
    for (const clause of [
      "github.event.workflow_run.event == 'pull_request'",
      "github.event.workflow_run.conclusion == 'success'",
      'github.event.workflow_run.head_repository.full_name == github.repository',
      "github.event.workflow_run.actor.login != 'dependabot[bot]'",
    ]) {
      expect(condition).toContain(clause);
    }
  });

  it('the probe job runs main’s tooling with no environment and no secret', () => {
    const probe = jobBlock(withoutComments(deploy), 'probe');
    expect(probe).not.toBe('');
    expect(probe).not.toMatch(/environment:|secrets\./);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression syntax, asserted verbatim
    expect(probe).toContain('ref: ${{ github.event.repository.default_branch }}');
  });

  it('the cache cleanup no longer touches Netlify or the development environment', () => {
    const cleanup = withoutComments(read('cleanup-cache.yml'));
    expect(cleanup).not.toMatch(/environment:|netlify|secrets\./);
  });
});
