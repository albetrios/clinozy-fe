/**
 * `pnpm iteration:list` — every working-tree iteration as Name | Type | Owner | Opened | Baseline |
 * Status | Intake mode | Schema-routes | Intake hash | Drop placed, oldest first, with live
 * fingerprints — an Intake hash the README does not record shows both.
 */
import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanScratch,
  completeDrop,
  createRepository,
  SCHEMA_ROUTES,
  scratchFolder,
  writeIteration,
} from './iteration-fixtures.mjs';
import { intakeHash } from './iterations.mjs';
import { formatIterationTable, readIterationListings } from './list-iterations.mjs';

afterEach(cleanScratch);

it('lists every iteration oldest first, with the live fingerprint of intake-files/schema-routes.md', () => {
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
  expect(
    listings.map((listing) => [
      listing.name,
      listing.status,
      listing.intakeMode,
      listing.schemaRoutes,
      listing.intakeHash,
      listing.dropPlaced,
    ]),
  ).toStrictEqual([
    [
      'launch-2026-09-30-jxmr',
      'implementing',
      'full',
      createHash('sha256').update(SCHEMA_ROUTES).digest('hex').slice(0, 12),
      launchHash,
      '2026-10-01',
    ],
    ['feat-returns-2026-10-06-kqzx', 'planning', '—', '—', '—', '2026-10-07'],
  ]);
  const lines = formatIterationTable(listings).split('\n');
  expect(lines[0]).toMatch(
    /^\| Name +\| Type +\| Owner +\| Opened +\| Baseline +\| Status +\| Intake mode +\| Schema-routes +\| Intake hash +\| Drop placed +\|$/,
  );
  expect(new Set(lines.map((line) => line.length)).size).toBe(1);

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
  expect(readIterationListings(repositoryRoot)[0].intakeHash).toBe(
    `${intakeHash(join(repositoryRoot, 'iterations', 'launch-2026-09-30-jxmr', 'intake-files'))} ≠ README ${launchHash}`,
  );
});

it('shows — for an iteration folder without a README', () => {
  const repositoryRoot = createRepository();
  mkdirSync(join(repositoryRoot, 'iterations', 'fix-typo-2026-10-07-abcd'), {
    recursive: true,
  });
  expect(readIterationListings(repositoryRoot)).toStrictEqual([
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

it('a brief that stores only BRIEF.md lists the fingerprints of the snapshot it resolves to', () => {
  const repositoryRoot = createRepository();
  writeIteration({
    repositoryRoot,
    name: 'launch-2026-09-30-jxmr',
    fields: { status: 'done' },
    intake: completeDrop(),
  });
  const briefFolder = writeIteration({
    repositoryRoot,
    name: 'feat-returns-2026-10-06-kqzx',
    fields: {
      baseline: 'launch-2026-09-30-jxmr',
      intakeMode: 'brief',
      intakeNote: '1 received (BRIEF.md) · 9 carried forward from launch-2026-09-30-jxmr',
    },
    intake: { 'BRIEF.md': '# Brief\n' },
  });
  const full = join(scratchFolder(), 'full');
  mkdirSync(full, { recursive: true });
  for (const [name, text] of Object.entries({
    ...completeDrop(),
    'BRIEF.md': '# Brief\n',
  }))
    writeFileSync(join(full, name), text);
  const resolvedHash = intakeHash(full);
  const readme = join(briefFolder, 'README.md');
  writeFileSync(
    readme,
    readFileSync(readme, 'utf-8').replace(
      /\| Intake hash \| \w+ \|/,
      `| Intake hash | ${resolvedHash} |`,
    ),
  );

  const listing = readIterationListings(repositoryRoot).find(
    (row) => row.name === 'feat-returns-2026-10-06-kqzx',
  );
  expect(listing.intakeHash).toBe(resolvedHash);
  expect(listing.schemaRoutes).toBe(
    createHash('sha256').update(SCHEMA_ROUTES).digest('hex').slice(0, 12),
  );
});
