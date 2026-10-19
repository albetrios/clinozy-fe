#!/usr/bin/env node
/**
 * pnpm iteration:freeze-check — the merge-time freeze check (PR CI's Iteration freeze lane).
 *
 * Usage:
 *   pnpm iteration:freeze-check [--base <ref>]      # default: the upstream, else origin/<default branch>
 *
 * Every iteration the branch changes since its merge base with <ref> must be `frozen`, and a merged
 * frozen iteration may change only by `pnpm iteration:intake <iteration> --compact`. Exits 1 with
 * one line per problem, each naming its fix. The rules: iterations/README.md.
 */
import { resolve } from 'node:path';
import { resolveBase } from '../ci/git-environment.mjs';
import { parseCommandLine } from '../ci/script.mjs';
import { checkIterationFreeze } from './iteration-freeze.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');

const USAGE = `Usage:
  pnpm iteration:freeze-check [--base <ref>]`;

function main() {
  let values;
  try {
    ({ values } = parseCommandLine(process.argv.slice(2), {
      options: { base: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
    }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  if (values.help === true) {
    console.log(USAGE);
    return;
  }
  const base = resolveBase({ base: values.base, cwd: REPOSITORY_ROOT });
  const { touched, problems } = checkIterationFreeze({
    repositoryRoot: REPOSITORY_ROOT,
    base,
  });
  if (problems.length === 0) {
    console.log(
      touched.length === 0
        ? `Iteration freeze: no iteration changed since ${base}.`
        : `Iteration freeze: ${touched.length} changed iteration(s), each frozen or compacted — ${touched.join(', ')}.`,
    );
    return;
  }
  const annotate = process.env.GITHUB_ACTIONS === 'true';
  for (const problem of problems)
    console.error(annotate ? `::error::${problem}` : `✗ ${problem}`);
  console.error(
    `Iteration freeze failed — ${problems.length} problem${problems.length === 1 ? '' : 's'}.`,
  );
  process.exitCode = 1;
}

main();
