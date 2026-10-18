#!/usr/bin/env node
/**
 * `pnpm agent-os:review-clean [--note "<summary>"]` — records that `/fe-pre-merge-review` found no
 * critical or major finding on HEAD (clinozy-be's review marker). The push review gate
 * (`agent-os/hooks/fe-guardrails.mjs`) reads it: a `git push` of auth, token, CSP, routeTree or guard
 * changes asks the user first unless HEAD has this record.
 *
 * The record is `<git dir>/fe-pre-merge-review/<HEAD sha>.clean` — this clone only, never
 * committed. A new commit is a new HEAD, so it needs a new review.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The record's folder under the git directory, read by the push review gate. */
const REVIEW_RECORD_DIRECTORY = 'fe-pre-merge-review';

function git(args) {
  // From a git hook, git's own GIT_DIR would outrank the working directory.
  const environment = { ...process.env };
  delete environment.GIT_DIR;
  delete environment.GIT_WORK_TREE;
  const result = spawnSync('git', args, { encoding: 'utf8', env: environment });
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

const noteIndex = process.argv.indexOf('--note');
const note = noteIndex === -1 ? '' : (process.argv[noteIndex + 1] ?? '');
const head = git(['rev-parse', 'HEAD']);
const directory = join(git(['rev-parse', '--absolute-git-dir']), REVIEW_RECORD_DIRECTORY);
mkdirSync(directory, { recursive: true });
writeFileSync(
  join(directory, `${head}.clean`),
  `${JSON.stringify({ head, recordedAt: new Date().toISOString(), note }, null, 2)}\n`,
);
console.log(`Recorded a clean /fe-pre-merge-review for HEAD ${head.slice(0, 7)}.`);
