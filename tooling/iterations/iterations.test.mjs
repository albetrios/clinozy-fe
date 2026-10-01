/**
 * The shared design-iteration model (`iterations.mjs`): names, the README table and History, the
 * Status lifecycle, the frontend's required intake set, the Baseline suggestion and the sibling
 * repository. The same rules as clinozy-be's `iteration.util.ts`.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  cleanScratch,
  completeDrop,
  createRepository,
  scratchFolder,
  writeIteration,
} from './iteration-fixtures.mjs';
import {
  appendHistoryEntry,
  checkIntakeSet,
  indexSlugs,
  localDate,
  missingIntakeFiles,
  parseIterationName,
  parseIterationReadme,
  prototypeScripts,
  renderHistoryEntry,
  resolveSiblingRoot,
  schemaRoutesHash,
  setReadmeField,
  siblingPackageName,
  suggestBaseline,
  validateStatusTransition,
} from './iterations.mjs';

afterEach(cleanScratch);

const readerOf = (files) => (name) => files[name];

describe('names', () => {
  test('parses launch and topic names, and nothing else', () => {
    assert.deepEqual(parseIterationName('feat-pharmacy-returns-2026-10-06-kqzx'), {
      type: 'feat',
      topic: 'pharmacy-returns',
      opened: '2026-10-06',
    });
    assert.equal(parseIterationName('launch-2026-09-30-jxmr')?.topic, undefined);
    for (const name of [
      'b-pharmacy-returns',
      'v1',
      'feat-returns2-2026-10-06-kqzx',
      'feat-x-2026-10-06-KQZX',
      'release-x-2026-10-06-abcd',
    ]) {
      assert.equal(parseIterationName(name), undefined, name);
    }
  });

  test('formats the local date', () => {
    assert.equal(localDate(new Date(2026, 8, 5)), '2026-09-05');
  });
});

describe('README table', () => {
  const generated =
    '# x\n\n| Field | Value |\n| --- | --- |\n| Type | feat |\n| Drop placed | 2026-10-01 |\n| Schema-routes | — |\n';

  test('reads generated and padded tables, labels with spaces and hyphens', () => {
    const padded =
      '| Field         | Value      |\n| ------------- | ---------- |\n| Type          | feat       |\n| Drop placed   | 2026-10-01 |\n| Schema-routes | —          |\n';
    for (const markdown of [generated, padded]) {
      assert.deepEqual(
        [...parseIterationReadme(markdown)],
        [
          ['Type', 'feat'],
          ['Drop placed', '2026-10-01'],
          ['Schema-routes', '—'],
        ],
      );
    }
  });

  test('counts only two-cell rows', () => {
    const fields = parseIterationReadme(
      '| Summary | a | b |\n| Two2 | x |\n| Owner | Test Owner |\n',
    );
    assert.deepEqual([...fields], [['Owner', 'Test Owner']]);
  });

  test('sets one row and keeps every other line', () => {
    const updated = setReadmeField({
      readme: generated,
      label: 'Drop placed',
      value: '2026-10-02',
    });
    assert.equal(
      updated,
      generated.replace('| Drop placed | 2026-10-01 |', '| Drop placed | 2026-10-02 |'),
    );
    assert.throws(
      () => setReadmeField({ readme: generated, label: 'Owner', value: 'x' }),
      /no "\| Owner/,
    );
    assert.throws(
      () => setReadmeField({ readme: generated, label: 'Type', value: 'a | b' }),
      /cannot hold/,
    );
  });
});

describe('History', () => {
  test('renders one line, collapsing the reason and defaulting it to —', () => {
    assert.equal(
      renderHistoryEntry({
        date: '2026-10-01',
        change: 'ready-for-approval → planning',
        reason: ' scope\n  changed ',
        owner: 'A',
      }),
      '- 2026-10-01 · ready-for-approval → planning · scope changed · A',
    );
    assert.equal(
      renderHistoryEntry({
        date: '2026-10-01',
        change: 'Baseline — → x',
        reason: undefined,
        owner: 'A',
      }),
      '- 2026-10-01 · Baseline — → x · — · A',
    );
  });

  test('creates the section, appends inside it, and never after a following section', () => {
    const table = '# x\n\n| Field | Value |\n| --- | --- |\n| Status | planning |\n';
    const first = appendHistoryEntry({ readme: table, historyEntry: '- one' });
    assert.equal(first, `${table}\n## History\n\n- one\n`);
    assert.equal(
      appendHistoryEntry({ readme: first, historyEntry: '- two' }),
      `${table}\n## History\n\n- one\n- two\n`,
    );
    const withDrop = `${table}\n## History\n\n- one\n\n## Drop\n\nnotes\n`;
    assert.equal(
      appendHistoryEntry({ readme: withDrop, historyEntry: '- two' }),
      `${table}\n## History\n\n- one\n- two\n\n## Drop\n\nnotes\n`,
    );
    assert.equal(
      appendHistoryEntry({ readme: `${table}\n## History\n`, historyEntry: '- one' }),
      `${table}\n## History\n\n- one\n`,
    );
  });
});

describe('validateStatusTransition', () => {
  test('allows one step forward, and back to planning with a reason', () => {
    const order = [
      'planning',
      'ready-for-approval',
      'approved',
      'implementing',
      'done',
      'frozen',
    ];
    for (let index = 0; index < order.length - 1; index += 1) {
      validateStatusTransition({
        from: order[index],
        to: order[index + 1],
        reason: undefined,
      });
    }
    for (const from of ['ready-for-approval', 'approved', 'implementing']) {
      validateStatusTransition({ from, to: 'planning', reason: 'scope changed' });
      assert.throws(
        () => validateStatusTransition({ from, to: 'planning', reason: undefined }),
        /needs --reason/,
      );
    }
  });

  test('refuses skips, other moves back, and anything from frozen', () => {
    assert.throws(
      () =>
        validateStatusTransition({ from: 'planning', to: 'approved', reason: undefined }),
      /allowed next status is ready-for-approval/,
    );
    assert.throws(
      () => validateStatusTransition({ from: 'done', to: 'planning', reason: 'x' }),
      /Cannot move done → planning/,
    );
    assert.throws(
      () => validateStatusTransition({ from: 'frozen', to: 'planning', reason: 'x' }),
      /never edited/,
    );
  });
});

describe('the required intake set', () => {
  test('a complete drop passes with no warnings', () => {
    const drop = completeDrop();
    assert.deepEqual(
      checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) }),
      {
        missing: [],
        extras: [],
        unlistedScreens: [],
      },
    );
  });

  test('names every missing required file — a fixed file, a listed screen, a loaded script, the prototype', () => {
    const drop = completeDrop();
    delete drop['preset.md'];
    delete drop['beta.md'];
    delete drop['support.js'];
    assert.deepEqual(
      checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) }).missing,
      ['beta.md', 'preset.md', 'support.js'],
    );
    const noPrototype = completeDrop();
    delete noPrototype['Demo.dc.html'];
    assert.ok(
      checkIntakeSet({
        names: Object.keys(noPrototype),
        readText: readerOf(noPrototype),
      }).missing.includes('a prototype *.html'),
    );
  });

  test('warns about extras and screen files _index.md does not list; optional files pass', () => {
    const drop = {
      ...completeDrop(),
      'gamma.md': '# Screen: Gamma\n',
      'notes.txt': 'x',
      'design-overview.md': '#',
      'preset.json': '{}',
      '_report.md': '#',
    };
    const result = checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) });
    assert.deepEqual(result.extras, ['notes.txt']);
    assert.deepEqual(result.unlistedScreens, ['gamma.md']);
  });

  test('reads Slugs from the Slug column and local scripts from the prototype', () => {
    assert.deepEqual(indexSlugs(completeDrop()['_index.md']), ['alpha', 'beta']);
    assert.deepEqual(
      indexSlugs('| Screen | Route |\n| --- | --- |\n| alpha | /a |\n'),
      [],
    );
    assert.deepEqual(
      prototypeScripts(
        '<script src="support.js"></script><script defer src="./lib/app.js#x"></script><script src="/abs.js"></script><script src="https://x.test/y.js"></script>',
      ),
      ['app.js', 'support.js'],
    );
  });

  test('checks an iteration folder: missing intake-files/ and an incomplete drop', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    assert.deepEqual(
      missingIntakeFiles({ repositoryRoot, iteration: 'launch-2026-09-30-jxmr' }),
      ['intake-files/'],
    );
    const { 'shell.md': _shell, ...withoutShell } = completeDrop();
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      intake: withoutShell,
    });
    assert.deepEqual(
      missingIntakeFiles({ repositoryRoot, iteration: 'launch-2026-09-30-jxmr' }),
      ['shell.md'],
    );
  });
});

describe('schemaRoutesHash', () => {
  test('is the first 12 hex characters of the sha256, or — when missing', () => {
    const folder = scratchFolder();
    const path = join(folder, 'schema-routes.md');
    writeFileSync(path, 'routes\n');
    assert.equal(
      schemaRoutesHash(path),
      createHash('sha256').update('routes\n').digest('hex').slice(0, 12),
    );
    assert.equal(schemaRoutesHash(join(folder, 'missing.md')), '—');
  });
});

describe('suggestBaseline', () => {
  test('the latest done or frozen iteration with a complete intake, by finish date, then Opened, then name', () => {
    const repositoryRoot = createRepository();
    const done = (date) => [`- ${date} · implementing → done · — · A`];
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      fields: { status: 'frozen' },
      history: done('2026-10-02'),
      intake: completeDrop(),
    });
    writeIteration({
      repositoryRoot,
      name: 'feat-late-2026-10-03-aaaa',
      fields: { status: 'done' },
      history: done('2026-10-09'),
      intake: completeDrop(),
    });
    writeIteration({
      repositoryRoot,
      name: 'feat-early-2026-10-05-bbbb',
      fields: { status: 'done' },
      history: done('2026-10-07'),
      intake: completeDrop(),
    });
    writeIteration({
      repositoryRoot,
      name: 'feat-busy-2026-10-08-cccc',
      fields: { status: 'implementing' },
      intake: completeDrop(),
    });
    const { 'PRD.md': _prd, ...noPrd } = completeDrop();
    writeIteration({
      repositoryRoot,
      name: 'fix-hollow-2026-10-09-dddd',
      fields: { status: 'done' },
      history: done('2026-10-10'),
      intake: noPrd,
    });

    assert.equal(suggestBaseline({ repositoryRoot }), 'feat-late-2026-10-03-aaaa');
    assert.equal(
      suggestBaseline({ repositoryRoot, excluding: 'feat-late-2026-10-03-aaaa' }),
      'feat-early-2026-10-05-bbbb',
    );
  });

  test('is undefined while nothing is done or frozen', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      fields: { status: 'implementing' },
      intake: completeDrop(),
    });
    assert.equal(suggestBaseline({ repositoryRoot }), undefined);
  });
});

describe('sibling repository', () => {
  test('maps -fe ↔ -be and resolves the folder next to this one', () => {
    assert.equal(siblingPackageName('demo-fe'), 'demo-be');
    assert.equal(siblingPackageName('demo-be'), 'demo-fe');
    assert.throws(() => siblingPackageName('demo'), /--sibling/);

    const repositoryRoot = createRepository();
    const siblingRoot = join(repositoryRoot, '..', 'demo-be');
    mkdirSync(siblingRoot);
    writeFileSync(join(siblingRoot, 'package.json'), '{"name":"demo-be"}');
    assert.equal(
      resolveSiblingRoot({ repositoryRoot, siblingPath: undefined }),
      siblingRoot,
    );
    assert.equal(
      resolveSiblingRoot({ repositoryRoot, siblingPath: '../demo-be' }),
      siblingRoot,
    );
    assert.throws(
      () => resolveSiblingRoot({ repositoryRoot, siblingPath: '../missing-be' }),
      /not found/,
    );
  });
});
