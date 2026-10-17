/**
 * `pnpm iteration:status` — the Status transitions, and the README's Status row and History line
 * every change writes.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
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
  test('reads --reason "<text>" and --reason=<text>', () => {
    assert.deepEqual(
      parseStatusArguments([NAME, 'planning', '--reason', 'scope changed']),
      {
        iteration: NAME,
        status: 'planning',
        reason: 'scope changed',
        help: false,
      },
    );
    assert.equal(
      parseStatusArguments([NAME, 'planning', '--reason=scope changed']).reason,
      'scope changed',
    );
    assert.throws(
      () => parseStatusArguments([NAME, 'planning', '--reason']),
      /needs text/,
    );
    assert.throws(
      () => parseStatusArguments([NAME, 'planning', '--force']),
      /Unknown option/,
    );
  });
});

describe('status changes', () => {
  test('walks the lifecycle one step at a time, writing the Status row and a History line each time', () => {
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
    assert.equal(parseIterationReadme(readme).get('Status'), 'frozen');
    assert.deepEqual(readme.split('## History\n\n')[1].trim().split('\n'), [
      `- ${TODAY} · planning → ready-for-approval · — · ${OWNER}`,
      `- ${TODAY} · ready-for-approval → approved · — · ${OWNER}`,
      `- ${TODAY} · approved → implementing · — · ${OWNER}`,
      `- ${TODAY} · implementing → done · — · ${OWNER}`,
      `- ${TODAY} · done → frozen · — · ${OWNER}`,
    ]);
    assert.throws(
      () => runStatus([NAME, 'planning', '--reason', 'x'], { repositoryRoot }),
      /never edited/,
    );
  });

  test('goes back to planning only with a reason, and refuses a skip', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: NAME, fields: { status: 'approved' } });
    assert.throws(
      () =>
        planStatusChange({
          repositoryRoot,
          iteration: NAME,
          status: 'planning',
          reason: undefined,
        }),
      /needs --reason/,
    );
    assert.throws(
      () =>
        planStatusChange({
          repositoryRoot,
          iteration: NAME,
          status: 'done',
          reason: undefined,
        }),
      /Cannot move approved → done/,
    );
    const back = planStatusChange({
      repositoryRoot,
      iteration: NAME,
      status: 'planning',
      reason: 'scope   changed',
      today: TODAY,
    });
    assert.equal(
      back.historyEntry,
      `- ${TODAY} · approved → planning · scope changed · ${OWNER}`,
    );
  });

  test('moves a lite fix straight to implementing; a README without a Process row is full', () => {
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
    assert.equal(parseIterationReadme(lite.content).get('Status'), 'implementing');

    writeIteration({ repositoryRoot, name: NAME });
    const readmePath = join(repositoryRoot, 'iterations', NAME, 'README.md');
    writeFileSync(
      readmePath,
      readmeOf(repositoryRoot).replace(/^\| Process \|.*\n/m, ''),
    );
    assert.equal(parseIterationReadme(readmeOf(repositoryRoot)).has('Process'), false);
    assert.throws(
      () =>
        planStatusChange({
          repositoryRoot,
          iteration: NAME,
          status: 'implementing',
          reason: undefined,
        }),
      /allowed next status is ready-for-approval/,
    );
  });

  test('refuses an unknown iteration, an unknown status, and a README with an unknown Status', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: NAME, fields: { status: 'building' } });
    assert.throws(
      () =>
        planStatusChange({
          repositoryRoot,
          iteration: 'launch-2026-09-30-zzzz',
          status: 'approved',
        }),
      /No iteration/,
    );
    assert.throws(
      () => planStatusChange({ repositoryRoot, iteration: NAME, status: 'shipped' }),
      /Unknown status/,
    );
    assert.throws(
      () => planStatusChange({ repositoryRoot, iteration: NAME, status: 'implementing' }),
      /not a known status/,
    );
  });
});
