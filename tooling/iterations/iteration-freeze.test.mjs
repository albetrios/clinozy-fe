/**
 * The merge-time freeze check (`iteration-freeze.mjs`, `pnpm iteration:freeze-check`): every
 * iteration a branch changes merges frozen, a merged frozen iteration takes only a hash-keeping
 * `--compact`, a merged iteration is never removed, and git that cannot name the changes fails
 * closed. The same rules as clinozy-be's.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
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
  it('passes a branch that changes no iteration, and names only iteration paths', () => {
    const repositoryRoot = repository();
    expect(check(repositoryRoot)).toStrictEqual({ touched: [], problems: [] });
    expect(iterationOfPath(`iterations/${LAUNCH}/README.md`)).toBe(LAUNCH);
    expect(iterationOfPath('iterations/README.md')).toBe(undefined);
    expect(iterationOfPath('docs/x.md')).toBe(undefined);
  });

  it('a changed iteration merges frozen: planning and done are refused with their fix', () => {
    const repositoryRoot = repository();
    writeIteration({
      repositoryRoot,
      name: FIX,
      fields: { type: 'fix', topic: 'rounding' },
    });
    commitAll(repositoryRoot, 'open the fix');
    expect(check(repositoryRoot).problems[0]).toMatch(
      /Status planning — .*finish it \(Status done\)/,
    );
    writeIteration({
      repositoryRoot,
      name: FIX,
      fields: { type: 'fix', topic: 'rounding', status: 'done' },
    });
    commitAll(repositoryRoot, 'done');
    expect(check(repositoryRoot).problems[0]).toMatch(
      new RegExp(`pnpm iteration:status ${FIX} frozen`),
    );
    writeIteration({
      repositoryRoot,
      name: FIX,
      fields: { type: 'fix', topic: 'rounding', status: 'frozen' },
    });
    commitAll(repositoryRoot, 'frozen');
    expect(check(repositoryRoot)).toStrictEqual({ touched: [FIX], problems: [] });
  });

  it('a merged frozen iteration is never edited, and never removed', () => {
    const edited = repository();
    writeIteration({
      repositoryRoot: edited,
      name: LAUNCH,
      fields: { status: 'frozen', summary: 'reworded' },
      history: FROZEN,
      intake: completeDrop(),
    });
    commitAll(edited, 'edit the launch');
    expect(check(edited).problems[0]).toMatch(
      /merged frozen, and this branch changes it/,
    );

    const removed = repository();
    rmSync(join(removed, 'iterations', LAUNCH), { recursive: true });
    commitAll(removed, 'remove the launch');
    expect(check(removed).problems[0]).toMatch(
      /removed — a merged iteration is never removed/,
    );
  });

  it('a compaction that keeps the Intake hash is the one change a merged iteration takes', () => {
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
    expect(check(repositoryRoot)).toStrictEqual({ touched: [overlay], problems: [] });
  });

  it('fails closed when git cannot name the changes', () => {
    const repositoryRoot = repository();
    const result = checkIterationFreeze({
      repositoryRoot,
      base: 'origin/no-such-branch',
    });
    expect(result.problems[0]).toMatch(
      /git cannot name the changes since origin\/no-such-branch/,
    );
  });
});
