/**
 * Design-iteration listing (`pnpm iteration:list`) and the README reader it shares with
 * `pnpm iteration:new`. Fixtures live in throwaway folders under the OS temp folder.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  formatIterationTable,
  parseIterationReadme,
  readIterationListings,
  workingTreeIterationNames,
} from './list-iterations.mjs';

const scratchFolders = [];

afterEach(() => {
  for (const folder of scratchFolders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});

function scratchRepository() {
  const repositoryRoot = mkdtempSync(join(tmpdir(), 'iteration-list-'));
  scratchFolders.push(repositoryRoot);
  return repositoryRoot;
}

function writeReadme(repositoryRoot, name, fields) {
  const folder = join(repositoryRoot, 'iterations', name);
  mkdirSync(folder, { recursive: true });
  const rows = Object.entries(fields).map(([label, value]) => `| ${label} | ${value} |`);
  writeFileSync(
    join(folder, 'README.md'),
    [`# ${name}`, '', '| Field | Value |', '| --- | --- |', ...rows, ''].join('\n'),
  );
}

describe('parseIterationReadme', () => {
  test('reads the generator table and a padded (Prettier-style) one alike', () => {
    const unpadded =
      '# x\n\n| Field | Value |\n| --- | --- |\n| Type | feat |\n| Summary | — |\n';
    const padded =
      '# x\n\n| Field   | Value |\n| ------- | ----- |\n| Type    | feat  |\n| Summary | —     |\n';
    for (const markdown of [unpadded, padded]) {
      const fields = parseIterationReadme(markdown);
      assert.deepEqual(
        [...fields.entries()],
        [
          ['Type', 'feat'],
          ['Summary', '—'],
        ],
      );
    }
  });

  test('keeps a pipe inside the value and ignores rows that are not fields', () => {
    const fields = parseIterationReadme(
      [
        '| Summary | returns | refunds |',
        '| Two words | x |',
        'not a table row',
        '|',
        '| Owner |',
      ].join('\n'),
    );
    assert.deepEqual([...fields.entries()], [['Summary', 'returns | refunds']]);
  });
});

describe('readIterationListings', () => {
  test('lists every iteration oldest first as an aligned table', () => {
    const repositoryRoot = scratchRepository();
    writeReadme(repositoryRoot, 'feat-returns-2026-10-06-kqzx', {
      Type: 'feat',
      Owner: 'Test Owner',
      Opened: '2026-10-06',
      Baseline: 'launch-2026-09-30-jxmr',
      Status: 'planning',
    });
    writeReadme(repositoryRoot, 'launch-2026-09-30-jxmr', {
      Type: 'launch',
      Owner: 'Test Owner',
      Opened: '2026-09-30',
      Baseline: 'none',
      Status: 'frozen',
    });
    // Not iterations: a folder outside the name grammar, and a stray file.
    mkdirSync(join(repositoryRoot, 'iterations', 'b-pharmacy-returns'));
    writeFileSync(
      join(repositoryRoot, 'iterations', 'README.md'),
      '# Design iterations\n',
    );

    const listings = readIterationListings(repositoryRoot);
    assert.deepEqual(
      listings.map((listing) => listing.name),
      ['launch-2026-09-30-jxmr', 'feat-returns-2026-10-06-kqzx'],
    );
    const lines = formatIterationTable(listings).split('\n');
    assert.match(
      lines[0],
      /^\| Name +\| Type +\| Owner +\| Opened +\| Baseline +\| Status +\|$/,
    );
    assert.equal(new Set(lines.map((line) => line.length)).size, 1);
  });

  test('shows — for a missing README or field', () => {
    const repositoryRoot = scratchRepository();
    mkdirSync(join(repositoryRoot, 'iterations', 'fix-typo-2026-10-07-abcd'), {
      recursive: true,
    });
    assert.deepEqual(readIterationListings(repositoryRoot), [
      {
        name: 'fix-typo-2026-10-07-abcd',
        type: '—',
        owner: '—',
        opened: '—',
        baseline: '—',
        status: '—',
      },
    ]);
  });

  test('is empty when there is no iterations folder', () => {
    assert.deepEqual(workingTreeIterationNames(scratchRepository()), []);
  });
});
