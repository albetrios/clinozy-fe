/**
 * `pnpm iteration:list` — every working-tree iteration as Name | Type | Owner | Opened | Baseline |
 * Status | Intake mode | Schema-routes | Intake hash | Drop placed, oldest first, with live
 * fingerprints — an Intake hash the README does not record shows both.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import {
  cleanScratch,
  completeDrop,
  createRepository,
  SCHEMA_ROUTES,
  writeIteration,
} from './iteration-fixtures.mjs';
import { intakeHash } from './iterations.mjs';
import { formatIterationTable, readIterationListings } from './list-iterations.mjs';

afterEach(cleanScratch);

test('lists every iteration oldest first, with the live fingerprint of intake-files/schema-routes.md', () => {
  const repositoryRoot = createRepository();
  writeIteration({
    repositoryRoot,
    name: 'feat-returns-2026-10-06-kqzx',
    fields: { baseline: 'launch-2026-09-30-jxmr', dropPlaced: '2026-10-07' },
  });
  writeIteration({
    repositoryRoot,
    name: 'launch-2026-09-30-jxmr',
    fields: { status: 'implementing', dropPlaced: '2026-10-01' },
    intake: completeDrop(),
  });
  mkdirSync(join(repositoryRoot, 'iterations', 'b-pharmacy-returns'));

  const listings = readIterationListings(repositoryRoot);
  const launchHash = intakeHash(
    join(repositoryRoot, 'iterations', 'launch-2026-09-30-jxmr', 'intake-files'),
  );
  assert.deepEqual(
    listings.map((listing) => [
      listing.name,
      listing.status,
      listing.intakeMode,
      listing.schemaRoutes,
      listing.intakeHash,
      listing.dropPlaced,
    ]),
    [
      [
        'launch-2026-09-30-jxmr',
        'implementing',
        'full',
        createHash('sha256').update(SCHEMA_ROUTES).digest('hex').slice(0, 12),
        launchHash,
        '2026-10-01',
      ],
      ['feat-returns-2026-10-06-kqzx', 'planning', '—', '—', '—', '2026-10-07'],
    ],
  );
  const lines = formatIterationTable(listings).split('\n');
  assert.match(
    lines[0],
    /^\| Name +\| Type +\| Owner +\| Opened +\| Baseline +\| Status +\| Intake mode +\| Schema-routes +\| Intake hash +\| Drop placed +\|$/,
  );
  assert.equal(new Set(lines.map((line) => line.length)).size, 1);

  writeFileSync(
    join(
      repositoryRoot,
      'iterations',
      'launch-2026-09-30-jxmr',
      'intake-files',
      'alpha.md',
    ),
    'edited\n',
  );
  assert.equal(
    readIterationListings(repositoryRoot)[0].intakeHash,
    `${intakeHash(join(repositoryRoot, 'iterations', 'launch-2026-09-30-jxmr', 'intake-files'))} ≠ README ${launchHash}`,
  );
});

test('shows — for an iteration folder without a README', () => {
  const repositoryRoot = createRepository();
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
      intakeMode: '—',
      schemaRoutes: '—',
      intakeHash: '—',
      dropPlaced: '—',
    },
  ]);
});
