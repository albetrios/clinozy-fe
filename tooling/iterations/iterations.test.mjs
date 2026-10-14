/**
 * The shared design-iteration model (`iterations.mjs`): names, the README table and History, the
 * Status lifecycle, the frontend's mandatory set by Intake mode, the Intake hash, the Baseline
 * suggestion, the sibling repository and the command line. The same rules as clinozy-be's
 * `iteration.util.ts`.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  brief,
  cleanScratch,
  completeDrop,
  createRepository,
  scratchFolder,
  writeDrop,
  writeIteration,
} from './iteration-fixtures.mjs';
import {
  appendHistoryEntry,
  checkIntakeSet,
  isStandaloneBrief,
  indexSlugs,
  intakeHash,
  localDate,
  missingBriefSections,
  missingIntakeFiles,
  parseCommandLine,
  parseIterationName,
  parseIterationReadme,
  prototypeScripts,
  recordedIntakeMode,
  referencedOptionalFiles,
  renderHistoryEntry,
  resolveSiblingRoot,
  schemaRoutesHash,
  setReadmeField,
  siblingPackageName,
  snapshotFingerprint,
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

  test('an optional file _index.md names becomes mandatory', () => {
    const drop = completeDrop();
    delete drop['_patterns.md'];
    drop['_index.md'] +=
      '\nShared: `_patterns.md` · `preset.json` · see alpha.md and PRD.md\n';
    assert.deepEqual(referencedOptionalFiles(drop['_index.md']), [
      '_patterns.md',
      'preset.json',
    ]);
    assert.deepEqual(
      checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) }).missing,
      ['_patterns.md', 'preset.json'],
    );
  });

  test('brief mode also needs BRIEF.md; elsewhere BRIEF.md is optional', () => {
    const drop = completeDrop();
    assert.deepEqual(
      checkIntakeSet({
        names: Object.keys(drop),
        readText: readerOf(drop),
        mode: 'brief',
      }).missing,
      ['BRIEF.md'],
    );
    const carried = { ...drop, 'BRIEF.md': brief() };
    assert.deepEqual(
      checkIntakeSet({ names: Object.keys(carried), readText: readerOf(carried) }),
      { missing: [], extras: [], unlistedScreens: [] },
    );
  });

  test('a BRIEF.md needs every template section', () => {
    assert.deepEqual(missingBriefSections(brief()), []);
    assert.deepEqual(
      missingBriefSections(
        brief().replace('## Why', '## Reason').replace('## Rules\n', ''),
      ),
      ['Why', 'Rules'],
    );
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

  test("reads the README's Intake mode — full when missing or unknown", () => {
    assert.equal(recordedIntakeMode(new Map([['Intake mode', 'brief']])), 'brief');
    assert.equal(recordedIntakeMode(new Map([['Intake mode', '—']])), 'full');
    assert.equal(recordedIntakeMode(new Map()), 'full');
  });

  test('checks an iteration folder for the mode its README records', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      intake: completeDrop(),
      fields: { status: 'done' },
    });
    writeIteration({
      repositoryRoot,
      name: 'feat-returns-2026-10-06-kqzx',
      intake: completeDrop(),
      fields: { intakeMode: 'brief', baseline: 'launch-2026-09-30-jxmr' },
    });
    assert.deepEqual(
      missingIntakeFiles({ repositoryRoot, iteration: 'feat-returns-2026-10-06-kqzx' }),
      ['BRIEF.md'],
    );
  });

  test("checks a brief that stores only BRIEF.md on its Baseline's snapshot", () => {
    const repositoryRoot = createRepository();
    const { 'shell.md': _shell, ...withoutShell } = completeDrop();
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      intake: withoutShell,
      fields: { status: 'done' },
    });
    writeIteration({
      repositoryRoot,
      name: 'feat-returns-2026-10-06-kqzx',
      intake: { 'BRIEF.md': '# Brief\n' },
      fields: { intakeMode: 'brief', baseline: 'launch-2026-09-30-jxmr' },
    });
    assert.deepEqual(
      missingIntakeFiles({ repositoryRoot, iteration: 'feat-returns-2026-10-06-kqzx' }),
      ['shell.md'],
    );
    writeIteration({
      repositoryRoot,
      name: 'feat-returns-2026-10-06-kqzx',
      intake: { 'BRIEF.md': '# Brief\n' },
      fields: { intakeMode: 'brief', baseline: 'none' },
    });
    // From scratch the brief stands alone: BRIEF.md is the whole snapshot, nothing is missing.
    assert.deepEqual(
      missingIntakeFiles({ repositoryRoot, iteration: 'feat-returns-2026-10-06-kqzx' }),
      [],
    );
    // An overlay has no such reading: on Baseline none, what it does not store comes from nowhere.
    writeIteration({
      repositoryRoot,
      name: 'feat-returns-2026-10-06-kqzx',
      intake: { 'PRD.md': '# PRD\n' },
      fields: { intakeMode: 'overlay', baseline: 'none' },
    });
    assert.match(
      missingIntakeFiles({
        repositoryRoot,
        iteration: 'feat-returns-2026-10-06-kqzx',
      })[0],
      /^intake-files\/ \(feat-returns-2026-10-06-kqzx is a overlay intake with Baseline none/,
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

describe('the Intake hash', () => {
  test('is one sha256 over every file — name, NUL, bytes, NUL — in code-unit order', () => {
    const files = new Map([
      ['b.md', Buffer.from('two\n')],
      ['B.md', Buffer.from('one\n')],
      ['a.md', Buffer.from('three\n')],
    ]);
    const expected = createHash('sha256');
    for (const name of ['B.md', 'a.md', 'b.md']) {
      expected.update(name);
      expected.update('\0');
      expected.update(files.get(name));
      expected.update('\0');
    }
    assert.equal(snapshotFingerprint(files), expected.digest('hex').slice(0, 12));
    assert.equal(snapshotFingerprint(new Map()), '—');
  });

  test('changes with any edited, added, removed or renamed file; ignores dotfiles', () => {
    const folder = writeDrop(join(scratchFolder(), 'intake'), completeDrop());
    const original = intakeHash(folder);
    assert.match(original, /^[0-9a-f]{12}$/);
    writeFileSync(join(folder, '.DS_Store'), 'x');
    assert.equal(intakeHash(folder), original);
    const fingerprintOf = (change) => {
      const files = new Map(
        Object.entries(completeDrop()).map(([name, text]) => [name, Buffer.from(text)]),
      );
      change(files);
      return snapshotFingerprint(files);
    };
    assert.equal(
      fingerprintOf(() => {}),
      original,
    );
    for (const change of [
      (files) => files.set('alpha.md', Buffer.from('# Screen: Alpha!\n')),
      (files) => files.set('gamma.md', Buffer.from('')),
      (files) => files.delete('_patterns.md'),
      (files) => {
        files.set('_shared.md', files.get('_patterns.md'));
        files.delete('_patterns.md');
      },
    ]) {
      assert.notEqual(fingerprintOf(change), original);
    }
    assert.equal(intakeHash(join(folder, 'missing')), '—');
  });
});

describe('a brief from scratch', () => {
  test('is a brief on Baseline none — any other mode or a named Baseline is not', () => {
    const fields = (baseline, mode) =>
      new Map([
        ['Baseline', baseline],
        ['Intake mode', mode],
      ]);
    assert.equal(isStandaloneBrief(fields('none', 'brief')), true);
    assert.equal(isStandaloneBrief(fields('launch-2026-09-30-jxmr', 'brief')), false);
    assert.equal(isStandaloneBrief(fields('none', 'full')), false);
    assert.equal(isStandaloneBrief(fields('none', 'overlay')), false);
  });

  test('needs BRIEF.md alone; anything else is reported, never required', () => {
    const readText = readerOf({});
    assert.deepEqual(
      checkIntakeSet({ names: ['BRIEF.md'], readText, mode: 'brief', standalone: true }),
      { missing: [], extras: [], unlistedScreens: [] },
    );
    assert.deepEqual(
      checkIntakeSet({
        names: ['notes.md', 'mock.png'],
        readText,
        mode: 'brief',
        standalone: true,
      }),
      { missing: ['BRIEF.md'], extras: ['mock.png'], unlistedScreens: ['notes.md'] },
    );
    // A brief on a named Baseline still needs the whole carried-forward set.
    assert.ok(
      checkIntakeSet({ names: ['BRIEF.md'], readText, mode: 'brief' }).missing.includes(
        'PRD.md',
      ),
    );
  });
});

describe('parseCommandLine', () => {
  const shape = {
    flags: ['--both', '--check'],
    values: ['--mode'],
    maxPositionals: 2,
    usage: 'expected <a> <b>.',
  };

  test('reads flags, --name value and --name=value options, and --sibling', () => {
    const parsed = parseCommandLine(
      ['x', '--mode', 'overlay', 'y', '--check', '--sibling', '../b'],
      shape,
    );
    assert.deepEqual(parsed.positionals, ['x', 'y']);
    assert.deepEqual([...parsed.flags], ['--check']);
    assert.equal(parsed.values.get('--mode'), 'overlay');
    assert.equal(parsed.siblingPath, '../b');
    assert.equal(parsed.createInSibling, true);
    assert.equal(parseCommandLine(['--mode=brief'], shape).values.get('--mode'), 'brief');
  });

  test('refuses a value option without its value, an unknown option and extra positionals', () => {
    assert.throws(() => parseCommandLine(['--mode'], shape), /--mode needs a value/);
    assert.throws(() => parseCommandLine(['--mode', '--check'], shape), /needs a value/);
    assert.throws(() => parseCommandLine(['--mode='], shape), /needs a value/);
    assert.throws(() => parseCommandLine(['--nope'], shape), /Unknown option "--nope"/);
    assert.throws(() => parseCommandLine(['a', 'b', 'c'], shape), /Too many arguments/);
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
