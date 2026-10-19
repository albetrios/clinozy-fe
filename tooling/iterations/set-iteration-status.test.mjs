/**
 * `pnpm iteration:status` — the Status transitions, and the README's Status row and History line
 * every change writes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanScratch,
  createRepository,
  OWNER,
  TODAY,
  writeIteration,
} from './iteration-fixtures.mjs';
import { parseIterationReadme } from './iterations.mjs';
import {
  parseStatusArguments,
  planStatusChange,
  runStatus,
} from './set-iteration-status.mjs';

afterEach(cleanScratch);

const NAME = 'launch-2026-09-30-jxmr';

function readmeOf(repositoryRoot) {
  return readFileSync(join(repositoryRoot, 'iterations', NAME, 'README.md'), 'utf-8');
}

describe('parseStatusArguments', () => {
  it('reads --reason "<text>" and --reason=<text>', () => {
    expect(
      parseStatusArguments([NAME, 'planning', '--reason', 'scope changed']),
    ).toStrictEqual({
      iteration: NAME,
      status: 'planning',
      reason: 'scope changed',
      help: false,
    });
    expect(
      parseStatusArguments([NAME, 'planning', '--reason=scope changed']).reason,
    ).toBe('scope changed');
    expect(() => parseStatusArguments([NAME, 'planning', '--reason'])).toThrow(
      /needs text/,
    );
    expect(() => parseStatusArguments([NAME, 'planning', '--force'])).toThrow(
      /Unknown option/,
    );
  });
});

describe('status changes', () => {
  it('walks the lifecycle one step at a time, writing the Status row and a History line each time', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: NAME });
    for (const status of [
      'ready-for-approval',
      'approved',
      'implementing',
      'done',
      'frozen',
    ]) {
      runStatus([NAME, status], { repositoryRoot, today: TODAY });
    }
    const readme = readmeOf(repositoryRoot);
    expect(parseIterationReadme(readme).get('Status')).toBe('frozen');
    expect(readme.split('## History\n\n')[1].trim().split('\n')).toStrictEqual([
      `- ${TODAY} · planning → ready-for-approval · — · ${OWNER}`,
      `- ${TODAY} · ready-for-approval → approved · — · ${OWNER}`,
      `- ${TODAY} · approved → implementing · — · ${OWNER}`,
      `- ${TODAY} · implementing → done · — · ${OWNER}`,
      `- ${TODAY} · done → frozen · — · ${OWNER}`,
    ]);
    expect(() =>
      runStatus([NAME, 'planning', '--reason', 'x'], { repositoryRoot }),
    ).toThrow(/never edited/);
  });

  it('goes back to planning only with a reason, and refuses a skip', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: NAME, fields: { status: 'approved' } });
    expect(() =>
      planStatusChange({
        repositoryRoot,
        iteration: NAME,
        status: 'planning',
        reason: undefined,
      }),
    ).toThrow(/needs --reason/);
    expect(() =>
      planStatusChange({
        repositoryRoot,
        iteration: NAME,
        status: 'done',
        reason: undefined,
      }),
    ).toThrow(/Cannot move approved → done/);
    const back = planStatusChange({
      repositoryRoot,
      iteration: NAME,
      status: 'planning',
      reason: 'scope   changed',
      today: TODAY,
    });
    expect(back.historyEntry).toBe(
      `- ${TODAY} · approved → planning · scope changed · ${OWNER}`,
    );
  });

  it('moves a lite fix straight to implementing; a README without a Process row is full', () => {
    const repositoryRoot = createRepository();
    const fix = 'fix-rounding-2026-10-06-kqzx';
    writeIteration({
      repositoryRoot,
      name: fix,
      fields: { type: 'fix', process: 'lite', topic: 'rounding' },
    });
    const lite = planStatusChange({
      repositoryRoot,
      iteration: fix,
      status: 'implementing',
      reason: undefined,
      today: TODAY,
    });
    expect(parseIterationReadme(lite.content).get('Status')).toBe('implementing');

    writeIteration({ repositoryRoot, name: NAME });
    const readmePath = join(repositoryRoot, 'iterations', NAME, 'README.md');
    writeFileSync(
      readmePath,
      readmeOf(repositoryRoot).replace(/^\| Process \|.*\n/m, ''),
    );
    expect(parseIterationReadme(readmeOf(repositoryRoot)).has('Process')).toBe(false);
    expect(() =>
      planStatusChange({
        repositoryRoot,
        iteration: NAME,
        status: 'implementing',
        reason: undefined,
      }),
    ).toThrow(/allowed next status is ready-for-approval/);
  });

  it('refuses an unknown iteration, an unknown status, and a README with an unknown Status', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: NAME, fields: { status: 'building' } });
    expect(() =>
      planStatusChange({
        repositoryRoot,
        iteration: 'launch-2026-09-30-zzzz',
        status: 'approved',
      }),
    ).toThrow(/No iteration/);
    expect(() =>
      planStatusChange({ repositoryRoot, iteration: NAME, status: 'shipped' }),
    ).toThrow(/Unknown status/);
    expect(() =>
      planStatusChange({ repositoryRoot, iteration: NAME, status: 'implementing' }),
    ).toThrow(/not a known status/);
  });
});
