/**
 * The shared design-iteration model (`iterations.mjs`): names, the README table and History, the
 * Status lifecycle, the frontend's mandatory set by Intake mode, the Intake hash, the Baseline
 * suggestion, the sibling repository and the command line. The same rules as clinozy-be's
 * `iteration.util.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
  it('parses launch and topic names, and nothing else', () => {
    expect(parseIterationName('feat-pharmacy-returns-2026-10-06-kqzx')).toStrictEqual({
      type: 'feat',
      topic: 'pharmacy-returns',
      opened: '2026-10-06',
    });
    expect(parseIterationName('launch-2026-09-30-jxmr')?.topic).toBe(undefined);
    for (const name of [
      'b-pharmacy-returns',
      'v1',
      'feat-returns2-2026-10-06-kqzx',
      'feat-x-2026-10-06-KQZX',
      'release-x-2026-10-06-abcd',
    ]) {
      expect(parseIterationName(name), name).toBe(undefined);
    }
  });

  it('formats the local date', () => {
    expect(localDate(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('README table', () => {
  const generated =
    '# x\n\n| Field | Value |\n| --- | --- |\n| Type | feat |\n| Drop placed | 2026-10-01 |\n| Schema-routes | — |\n';

  it('reads generated and padded tables, labels with spaces and hyphens', () => {
    const padded =
      '| Field         | Value      |\n| ------------- | ---------- |\n| Type          | feat       |\n| Drop placed   | 2026-10-01 |\n| Schema-routes | —          |\n';
    for (const markdown of [generated, padded]) {
      expect([...parseIterationReadme(markdown)]).toStrictEqual([
        ['Type', 'feat'],
        ['Drop placed', '2026-10-01'],
        ['Schema-routes', '—'],
      ]);
    }
  });

  it('counts only two-cell rows', () => {
    const fields = parseIterationReadme(
      '| Summary | a | b |\n| Two2 | x |\n| Owner | Test Owner |\n',
    );
    expect([...fields]).toStrictEqual([['Owner', 'Test Owner']]);
  });

  it('sets one row and keeps every other line', () => {
    const updated = setReadmeField({
      readme: generated,
      label: 'Drop placed',
      value: '2026-10-02',
    });
    expect(updated).toBe(
      generated.replace('| Drop placed | 2026-10-01 |', '| Drop placed | 2026-10-02 |'),
    );
    expect(() =>
      setReadmeField({ readme: generated, label: 'Owner', value: 'x' }),
    ).toThrow(/no "\| Owner/);
    expect(() =>
      setReadmeField({ readme: generated, label: 'Type', value: 'a | b' }),
    ).toThrow(/cannot hold/);
  });
});

describe('History', () => {
  it('renders one line, collapsing the reason and defaulting it to —', () => {
    expect(
      renderHistoryEntry({
        date: '2026-10-01',
        change: 'ready-for-approval → planning',
        reason: ' scope\n  changed ',
        owner: 'A',
      }),
    ).toBe('- 2026-10-01 · ready-for-approval → planning · scope changed · A');
    expect(
      renderHistoryEntry({
        date: '2026-10-01',
        change: 'Baseline — → x',
        reason: undefined,
        owner: 'A',
      }),
    ).toBe('- 2026-10-01 · Baseline — → x · — · A');
  });

  it('creates the section, appends inside it, and never after a following section', () => {
    const table = '# x\n\n| Field | Value |\n| --- | --- |\n| Status | planning |\n';
    const first = appendHistoryEntry({ readme: table, historyEntry: '- one' });
    expect(first).toBe(`${table}\n## History\n\n- one\n`);
    expect(appendHistoryEntry({ readme: first, historyEntry: '- two' })).toBe(
      `${table}\n## History\n\n- one\n- two\n`,
    );
    const withDrop = `${table}\n## History\n\n- one\n\n## Drop\n\nnotes\n`;
    expect(appendHistoryEntry({ readme: withDrop, historyEntry: '- two' })).toBe(
      `${table}\n## History\n\n- one\n- two\n\n## Drop\n\nnotes\n`,
    );
    expect(
      appendHistoryEntry({ readme: `${table}\n## History\n`, historyEntry: '- one' }),
    ).toBe(`${table}\n## History\n\n- one\n`);
  });
});

describe('validateStatusTransition', () => {
  it('allows one step forward, and back to planning with a reason', () => {
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
      expect(() =>
        validateStatusTransition({ from, to: 'planning', reason: undefined }),
      ).toThrow(/needs --reason/);
    }
  });

  it('moves a lite fix planning → implementing → done → frozen, and back only with a reason', () => {
    for (const [from, to] of [
      ['planning', 'implementing'],
      ['implementing', 'done'],
      ['done', 'frozen'],
    ]) {
      validateStatusTransition({ from, to, reason: undefined, process: 'lite' });
    }
    expect(() =>
      validateStatusTransition({
        from: 'planning',
        to: 'ready-for-approval',
        reason: undefined,
        process: 'lite',
      }),
    ).toThrow(/a lite fix\)\. From planning the allowed next status is implementing/);
    expect(() =>
      validateStatusTransition({
        from: 'implementing',
        to: 'planning',
        reason: undefined,
        process: 'lite',
      }),
    ).toThrow(/needs --reason/);
    validateStatusTransition({
      from: 'done',
      to: 'planning',
      reason: 'reopened',
      process: 'lite',
    });
    expect(() =>
      validateStatusTransition({
        from: 'planning',
        to: 'implementing',
        reason: undefined,
      }),
    ).toThrow(/allowed next status is ready-for-approval/);
  });

  it('refuses skips, other moves back, and anything from frozen', () => {
    expect(() =>
      validateStatusTransition({ from: 'planning', to: 'approved', reason: undefined }),
    ).toThrow(/allowed next status is ready-for-approval/);
    expect(() =>
      validateStatusTransition({ from: 'done', to: 'planning', reason: 'x' }),
    ).toThrow(/Cannot move done → planning/);
    expect(() =>
      validateStatusTransition({ from: 'frozen', to: 'planning', reason: 'x' }),
    ).toThrow(/never edited/);
  });
});

describe('the required intake set', () => {
  it('a complete drop passes with no warnings', () => {
    const drop = completeDrop();
    expect(
      checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) }),
    ).toStrictEqual({
      missing: [],
      extras: [],
      unlistedScreens: [],
    });
  });

  it('names every missing required file — a fixed file, a listed screen, a loaded script, the prototype', () => {
    const drop = completeDrop();
    delete drop['preset.md'];
    delete drop['beta.md'];
    delete drop['support.js'];
    expect(
      checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) }).missing,
    ).toStrictEqual(['beta.md', 'preset.md', 'support.js']);
    const noPrototype = completeDrop();
    delete noPrototype['Demo.dc.html'];
    expect(
      checkIntakeSet({
        names: Object.keys(noPrototype),
        readText: readerOf(noPrototype),
      }).missing.includes('a prototype *.html'),
    ).toBeTruthy();
  });

  it('warns about extras and screen files _index.md does not list; optional files pass', () => {
    const drop = {
      ...completeDrop(),
      'gamma.md': '# Screen: Gamma\n',
      'notes.txt': 'x',
      'design-overview.md': '#',
      'preset.json': '{}',
      '_report.md': '#',
    };
    const result = checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) });
    expect(result.extras).toStrictEqual(['notes.txt']);
    expect(result.unlistedScreens).toStrictEqual(['gamma.md']);
  });

  it('an optional file _index.md names becomes mandatory', () => {
    const drop = completeDrop();
    delete drop['_patterns.md'];
    drop['_index.md'] +=
      '\nShared: `_patterns.md` · `preset.json` · see alpha.md and PRD.md\n';
    expect(referencedOptionalFiles(drop['_index.md'])).toStrictEqual([
      '_patterns.md',
      'preset.json',
    ]);
    expect(
      checkIntakeSet({ names: Object.keys(drop), readText: readerOf(drop) }).missing,
    ).toStrictEqual(['_patterns.md', 'preset.json']);
  });

  it('brief mode also needs BRIEF.md; elsewhere BRIEF.md is optional', () => {
    const drop = completeDrop();
    expect(
      checkIntakeSet({
        names: Object.keys(drop),
        readText: readerOf(drop),
        mode: 'brief',
      }).missing,
    ).toStrictEqual(['BRIEF.md']);
    const carried = { ...drop, 'BRIEF.md': brief() };
    expect(
      checkIntakeSet({ names: Object.keys(carried), readText: readerOf(carried) }),
    ).toStrictEqual({ missing: [], extras: [], unlistedScreens: [] });
  });

  it('a BRIEF.md needs every template section', () => {
    expect(missingBriefSections(brief())).toStrictEqual([]);
    expect(
      missingBriefSections(
        brief().replace('## Why', '## Reason').replace('## Rules\n', ''),
      ),
    ).toStrictEqual(['Why', 'Rules']);
  });

  it('reads Slugs from the Slug column and local scripts from the prototype', () => {
    expect(indexSlugs(completeDrop()['_index.md'])).toStrictEqual(['alpha', 'beta']);
    expect(
      indexSlugs('| Screen | Route |\n| --- | --- |\n| alpha | /a |\n'),
    ).toStrictEqual([]);
    expect(
      prototypeScripts(
        '<script src="support.js"></script><script defer src="./lib/app.js#x"></script><script src="/abs.js"></script><script src="https://x.test/y.js"></script>',
      ),
    ).toStrictEqual(['app.js', 'support.js']);
  });

  it("reads the README's Intake mode — full when missing or unknown", () => {
    expect(recordedIntakeMode(new Map([['Intake mode', 'brief']]))).toBe('brief');
    expect(recordedIntakeMode(new Map([['Intake mode', '—']]))).toBe('full');
    expect(recordedIntakeMode(new Map())).toBe('full');
  });

  it('checks an iteration folder for the mode its README records', () => {
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
    expect(
      missingIntakeFiles({ repositoryRoot, iteration: 'feat-returns-2026-10-06-kqzx' }),
    ).toStrictEqual(['BRIEF.md']);
  });

  it("checks a brief that stores only BRIEF.md on its Baseline's snapshot", () => {
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
    expect(
      missingIntakeFiles({ repositoryRoot, iteration: 'feat-returns-2026-10-06-kqzx' }),
    ).toStrictEqual(['shell.md']);
    writeIteration({
      repositoryRoot,
      name: 'feat-returns-2026-10-06-kqzx',
      intake: { 'BRIEF.md': '# Brief\n' },
      fields: { intakeMode: 'brief', baseline: 'none' },
    });
    // From scratch the brief stands alone: BRIEF.md is the whole snapshot, nothing is missing.
    expect(
      missingIntakeFiles({ repositoryRoot, iteration: 'feat-returns-2026-10-06-kqzx' }),
    ).toStrictEqual([]);
    // An overlay has no such reading: on Baseline none, what it does not store comes from nowhere.
    writeIteration({
      repositoryRoot,
      name: 'feat-returns-2026-10-06-kqzx',
      intake: { 'PRD.md': '# PRD\n' },
      fields: { intakeMode: 'overlay', baseline: 'none' },
    });
    expect(
      missingIntakeFiles({
        repositoryRoot,
        iteration: 'feat-returns-2026-10-06-kqzx',
      })[0],
    ).toMatch(
      /^intake-files\/ \(feat-returns-2026-10-06-kqzx is a overlay intake with Baseline none/,
    );
  });

  it('checks an iteration folder: missing intake-files/ and an incomplete drop', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    expect(
      missingIntakeFiles({ repositoryRoot, iteration: 'launch-2026-09-30-jxmr' }),
    ).toStrictEqual(['intake-files/']);
    const { 'shell.md': _shell, ...withoutShell } = completeDrop();
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      intake: withoutShell,
    });
    expect(
      missingIntakeFiles({ repositoryRoot, iteration: 'launch-2026-09-30-jxmr' }),
    ).toStrictEqual(['shell.md']);
  });
});

describe('schemaRoutesHash', () => {
  it('is the first 12 hex characters of the sha256, or — when missing', () => {
    const folder = scratchFolder();
    const path = join(folder, 'schema-routes.md');
    writeFileSync(path, 'routes\n');
    expect(schemaRoutesHash(path)).toBe(
      createHash('sha256').update('routes\n').digest('hex').slice(0, 12),
    );
    expect(schemaRoutesHash(join(folder, 'missing.md'))).toBe('—');
  });
});

describe('the Intake hash', () => {
  it('is one sha256 over every file — name, NUL, bytes, NUL — in code-unit order', () => {
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
    expect(snapshotFingerprint(files)).toBe(expected.digest('hex').slice(0, 12));
    expect(snapshotFingerprint(new Map())).toBe('—');
  });

  it('changes with any edited, added, removed or renamed file; ignores dotfiles', () => {
    const folder = writeDrop(join(scratchFolder(), 'intake'), completeDrop());
    const original = intakeHash(folder);
    expect(original).toMatch(/^[0-9a-f]{12}$/);
    writeFileSync(join(folder, '.DS_Store'), 'x');
    expect(intakeHash(folder)).toBe(original);
    const fingerprintOf = (change) => {
      const files = new Map(
        Object.entries(completeDrop()).map(([name, text]) => [name, Buffer.from(text)]),
      );
      change(files);
      return snapshotFingerprint(files);
    };
    expect(fingerprintOf(() => {})).toBe(original);
    for (const change of [
      (files) => files.set('alpha.md', Buffer.from('# Screen: Alpha!\n')),
      (files) => files.set('gamma.md', Buffer.from('')),
      (files) => files.delete('_patterns.md'),
      (files) => {
        files.set('_shared.md', files.get('_patterns.md'));
        files.delete('_patterns.md');
      },
    ]) {
      expect(fingerprintOf(change)).not.toBe(original);
    }
    expect(intakeHash(join(folder, 'missing'))).toBe('—');
  });
});

describe('a brief from scratch', () => {
  it('is a brief on Baseline none — any other mode or a named Baseline is not', () => {
    const fields = (baseline, mode) =>
      new Map([
        ['Baseline', baseline],
        ['Intake mode', mode],
      ]);
    expect(isStandaloneBrief(fields('none', 'brief'))).toBe(true);
    expect(isStandaloneBrief(fields('launch-2026-09-30-jxmr', 'brief'))).toBe(false);
    expect(isStandaloneBrief(fields('none', 'full'))).toBe(false);
    expect(isStandaloneBrief(fields('none', 'overlay'))).toBe(false);
  });

  it('needs BRIEF.md alone; anything else is reported, never required', () => {
    const readText = readerOf({});
    expect(
      checkIntakeSet({ names: ['BRIEF.md'], readText, mode: 'brief', standalone: true }),
    ).toStrictEqual({ missing: [], extras: [], unlistedScreens: [] });
    expect(
      checkIntakeSet({
        names: ['notes.md', 'mock.png'],
        readText,
        mode: 'brief',
        standalone: true,
      }),
    ).toStrictEqual({
      missing: ['BRIEF.md'],
      extras: ['mock.png'],
      unlistedScreens: ['notes.md'],
    });
    // A brief on a named Baseline still needs the whole carried-forward set.
    expect(
      checkIntakeSet({ names: ['BRIEF.md'], readText, mode: 'brief' }).missing.includes(
        'PRD.md',
      ),
    ).toBeTruthy();
  });
});

describe('sibling repository', () => {
  it('maps -fe ↔ -be and resolves the folder next to this one', () => {
    expect(siblingPackageName('demo-fe')).toBe('demo-be');
    expect(siblingPackageName('demo-be')).toBe('demo-fe');
    expect(() => siblingPackageName('demo')).toThrow(/--sibling/);

    const repositoryRoot = createRepository();
    const siblingRoot = join(repositoryRoot, '..', 'demo-be');
    mkdirSync(siblingRoot);
    writeFileSync(join(siblingRoot, 'package.json'), '{"name":"demo-be"}');
    expect(resolveSiblingRoot({ repositoryRoot, siblingPath: undefined })).toBe(
      siblingRoot,
    );
    expect(resolveSiblingRoot({ repositoryRoot, siblingPath: '../demo-be' })).toBe(
      siblingRoot,
    );
    expect(() =>
      resolveSiblingRoot({ repositoryRoot, siblingPath: '../missing-be' }),
    ).toThrow(/not found/);
  });
});
