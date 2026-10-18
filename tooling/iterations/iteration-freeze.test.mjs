/**
 * The merge-time freeze check (`iteration-freeze.mjs`, `pnpm iteration:freeze-check`): every
 * iteration a branch changes merges frozen, a merged frozen iteration takes only a hash-keeping
 * `--compact`, a merged iteration is never removed, and git that cannot name the changes fails
 * closed. The same rules as clinozy-be's.
 */
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  BASE_BRANCH,
  cleanScratch,
  commitAll,
  completeDrop,
  createRepository,
  git,
  WORK_BRANCH,
  writeIteration,
} from './iteration-fixtures.mjs';
import { checkIterationFreeze, iterationOfPath } from './iteration-freeze.mjs';

afterEach(cleanScratch);

const LAUNCH = 'launch-2026-09-30-jxmr';
const FIX = 'fix-rounding-2026-10-06-kqzx';
const FROZEN = ['- 2026-10-02 · done → frozen · — · A'];

/** A repository whose base branch holds a frozen launch, then a work branch. */
function repository() {
  const repositoryRoot = createRepository();
  writeIteration({
    repositoryRoot,
    name: LAUNCH,
    fields: { status: 'frozen' },
    history: FROZEN,
    intake: completeDrop(),
  });
  commitAll(repositoryRoot, 'launch');
  git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
  return repositoryRoot;
}

const check = (repositoryRoot) =>
  checkIterationFreeze({ repositoryRoot, base: BASE_BRANCH });

describe('checkIterationFreeze', () => {
  test('passes a branch that changes no iteration, and names only iteration paths', () => {
    const repositoryRoot = repository();
    assert.deepEqual(check(repositoryRoot), { touched: [], problems: [] });
    assert.equal(iterationOfPath(`iterations/${LAUNCH}/README.md`), LAUNCH);
    assert.equal(iterationOfPath('iterations/README.md'), undefined);
    assert.equal(iterationOfPath('docs/x.md'), undefined);
  });

  test('a changed iteration merges frozen: planning and done are refused with their fix', () => {
    const repositoryRoot = repository();
    writeIteration({
      repositoryRoot,
      name: FIX,
      fields: { type: 'fix', topic: 'rounding' },
    });
    commitAll(repositoryRoot, 'open the fix');
    assert.match(
      check(repositoryRoot).problems[0],
      /Status planning — .*finish it \(Status done\)/,
    );
    writeIteration({
      repositoryRoot,
      name: FIX,
      fields: { type: 'fix', topic: 'rounding', status: 'done' },
    });
    commitAll(repositoryRoot, 'done');
    assert.match(
      check(repositoryRoot).problems[0],
      new RegExp(`pnpm iteration:status ${FIX} frozen`),
    );
    writeIteration({
      repositoryRoot,
      name: FIX,
      fields: { type: 'fix', topic: 'rounding', status: 'frozen' },
    });
    commitAll(repositoryRoot, 'frozen');
    assert.deepEqual(check(repositoryRoot), { touched: [FIX], problems: [] });
  });

  test('a merged frozen iteration is never edited, and never removed', () => {
    const edited = repository();
    writeIteration({
      repositoryRoot: edited,
      name: LAUNCH,
      fields: { status: 'frozen', summary: 'reworded' },
      history: FROZEN,
      intake: completeDrop(),
    });
    commitAll(edited, 'edit the launch');
    assert.match(check(edited).problems[0], /merged frozen, and this branch changes it/);

    const removed = repository();
    rmSync(join(removed, 'iterations', LAUNCH), { recursive: true });
    commitAll(removed, 'remove the launch');
    assert.match(
      check(removed).problems[0],
      /removed — a merged iteration is never removed/,
    );
  });

  test('a compaction that keeps the Intake hash is the one change a merged iteration takes', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: LAUNCH,
      fields: { status: 'frozen' },
      history: FROZEN,
      intake: completeDrop(),
    });
    const overlay = 'change-returns-2026-10-06-kqzx';
    writeIteration({
      repositoryRoot,
      name: overlay,
      fields: {
        type: 'change',
        topic: 'returns',
        status: 'frozen',
        baseline: LAUNCH,
        intakeMode: 'overlay',
      },
      history: FROZEN,
      intake: completeDrop(),
    });
    commitAll(repositoryRoot, 'both merged');
    git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
    rmSync(join(repositoryRoot, 'iterations', overlay, 'intake-files', 'PRD.md'));
    commitAll(repositoryRoot, 'compact the overlay');
    assert.deepEqual(check(repositoryRoot), { touched: [overlay], problems: [] });
  });

  test('fails closed when git cannot name the changes', () => {
    const repositoryRoot = repository();
    const result = checkIterationFreeze({
      repositoryRoot,
      base: 'origin/no-such-branch',
    });
    assert.match(
      result.problems[0],
      /git cannot name the changes since origin\/no-such-branch/,
    );
  });
});
