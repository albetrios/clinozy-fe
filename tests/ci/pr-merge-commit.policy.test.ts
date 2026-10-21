import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { jobBlocks } from '@/tests/utils/workflow-jobs.ts';

// Regression guard: PR CI tests one tree in every lane — the PR merged with main.
//
// On a `pull_request` event GitHub builds a test merge of the PR into main
// (`refs/pull/<n>/merge`) and sets `github.sha` to it; a checkout with no `ref:` takes
// that commit. With strict up-to-date off (`.github/rulesets/main.json`), the head of a
// branch behind main is a tree that never lands, so no lane may test it. clinozy-be's DB
// matrix did (it was passed `pull_request.head.sha`): clinozy-be#134's head re-ran a hang
// main had already fixed, and its Quality gate went red although the PR merged with main
// held the fix. Every lane here takes the default ref; this pins it.
//
// Pinned here, for every workflow a pull request runs and every reusable workflow it
// calls:
//   1. a checkout takes the run's commit — no `ref:`, or `github.sha` — and a reusable
//      workflow's checkout takes the commit its caller passes
//      (`inputs.merge_commit_sha || github.sha`);
//   2. a reusable call that passes `merge_commit_sha` passes `github.sha`.
// The head stays readable for what is not a test: the commit status the early failure
// alert posts, the preview comment, the docs lane's changed-file list. clinozy-be pins
// the same in src/tests/unit/ci/pr-merge-commit.policy.unit.test.ts.

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows');
const LOCAL_CALL = /^ {4}uses: \.\/\.github\/workflows\/([\w.-]+\.ya?ml)$/m;

/** The run's own commit: on a pull request, the PR merged with main. */
const RUN_COMMIT = /^\$\{\{ github\.sha \}\}$/;
/** A reusable workflow's checkout of the commit its caller passes, else the run's own. */
const CALLER_COMMIT = /^\$\{\{ inputs\.merge_commit_sha \|\| github\.sha \}\}$/;

function readWorkflow(file: string): string {
  return readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
}

/** The workflow's `on:` block: from `on:` to the next top-level key. */
function triggers(workflow: string): string {
  const start = workflow.search(/^on:/m);
  if (start === -1) return '';
  const rest = workflow.slice(start + 'on:'.length);
  const end = rest.search(/^\S/m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The workflows a pull request runs directly (`pull_request:` under `on:`). */
function pullRequestWorkflows(): string[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter((file) => file.endsWith('.yml'))
    .filter((file) => /^ {2}pull_request:/m.test(triggers(readWorkflow(file))));
}

/**
 * Every `actions/checkout` step: from its `- ` item to the next item or a shallower line.
 */
function checkoutSteps(workflow: string): string[] {
  const lines = workflow.split('\n');
  return lines.flatMap((line, index) => {
    if (!/\buses: actions\/checkout@/.test(line)) return [];
    let start = index;
    while (start > 0 && !/^\s*- /.test(lines[start] ?? '')) start -= 1;
    const itemIndent = (lines[start] ?? '').indexOf('-');
    let end = start + 1;
    while (end < lines.length) {
      const next = lines[end] ?? '';
      if (next.trim() !== '' && next.search(/\S/) <= itemIndent) break;
      end += 1;
    }
    return [lines.slice(start, end).join('\n')];
  });
}

/** The value a block's first `<key>:` line sets — line by line, no backtracking regex. */
function keyValue(block: string, key: string): string | undefined {
  const prefix = `${key}:`;
  const line = block.split('\n').find((text) => text.trimStart().startsWith(prefix));
  return line?.trimStart().slice(prefix.length).trim();
}

/** The `ref:` a checkout step names, or undefined for the default (the run's commit). */
function checkoutRef(step: string): string | undefined {
  return keyValue(step, 'ref');
}

/** A checkout of another repository (`repository:`) tests nothing of this one. */
function checksOutThisRepository(step: string): boolean {
  return keyValue(step, 'repository') === undefined;
}

/** Every job of a pull-request workflow that calls a local reusable workflow. */
function reusableCalls(): Array<{ caller: string; workflow: string; job: string }> {
  return pullRequestWorkflows().flatMap((file) =>
    jobBlocks(readWorkflow(file)).flatMap(([name, job]) => {
      const workflow = LOCAL_CALL.exec(job)?.[1];
      return workflow ? [{ caller: `${file} job '${name}'`, workflow, job }] : [];
    }),
  );
}

describe('PR CI tests one tree: the PR merged with main', () => {
  it('finds the pull-request workflows, their checkouts and their reusable calls', () => {
    // A parser that matched nothing would let every check below pass vacuously.
    expect(pullRequestWorkflows()).toEqual(
      expect.arrayContaining(['pr-ci.yml', 'preview.yml']),
    );
    expect(checkoutSteps(readWorkflow('pr-ci.yml')).length).toBeGreaterThan(10);
    expect(reusableCalls().map((call) => call.workflow)).toContain(
      'reusable-vitest-unit-only.yml',
    );
  });

  it('checks out the run commit in every job a pull request runs', () => {
    const elsewhere = pullRequestWorkflows().flatMap((file) =>
      checkoutSteps(readWorkflow(file))
        .filter(checksOutThisRepository)
        .map(checkoutRef)
        .filter((ref) => ref !== undefined && !RUN_COMMIT.test(ref))
        .map((ref) => `${file}: ref: ${ref}`),
    );
    expect(elsewhere).toEqual([]);
  });

  it('tests the commit the caller passes in every reusable workflow a pull request calls', () => {
    const drifting = reusableCalls().flatMap(({ caller, workflow, job }) => {
      const passed = keyValue(job, 'merge_commit_sha');
      const passedElsewhere =
        passed === undefined || RUN_COMMIT.test(passed)
          ? []
          : [`${caller} passes merge_commit_sha: ${passed}`];
      const checkedOutElsewhere = checkoutSteps(readWorkflow(workflow))
        .filter(checksOutThisRepository)
        .map(checkoutRef)
        .filter(
          (ref) => ref !== undefined && !RUN_COMMIT.test(ref) && !CALLER_COMMIT.test(ref),
        )
        .map((ref) => `${workflow}: ref: ${ref}`);
      return [...passedElsewhere, ...checkedOutElsewhere];
    });
    expect(drifting).toEqual([]);
  });
});
