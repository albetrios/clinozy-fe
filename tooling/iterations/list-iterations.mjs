#!/usr/bin/env node
/**
 * pnpm iteration:list — print every design iteration in this working tree.
 *
 * Prints Name | Type | Owner | Opened | Baseline | Status | Schema-routes | Drop placed, oldest
 * first, from each `iterations/<iteration>/README.md`; Schema-routes is the live fingerprint of
 * `intake-files/schema-routes.md`. There is no shared index file — this listing is the index. The
 * model: iterations/README.md.
 */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_FIELD,
  intakeFolder,
  parseIterationReadme,
  readAllIterationReadmes,
  schemaRoutesHash,
} from './iterations.mjs';

const LIST_COLUMNS = [
  'Name',
  'Type',
  'Owner',
  'Opened',
  'Baseline',
  'Status',
  'Schema-routes',
  'Drop placed',
];

/**
 * Reads every working-tree iteration into list rows, oldest first (Opened, then name). A missing
 * README or field shows as `—`.
 *
 * @param {string} repositoryRoot
 * @returns {{ name: string, type: string, owner: string, opened: string, baseline: string, status: string, schemaRoutes: string, dropPlaced: string }[]}
 */
export function readIterationListings(repositoryRoot) {
  return [...readAllIterationReadmes(repositoryRoot)]
    .map(([name, readme]) => {
      const fields = parseIterationReadme(readme);
      const field = (label) => fields.get(label) ?? EMPTY_FIELD;
      return {
        name,
        type: field('Type'),
        owner: field('Owner'),
        opened: field('Opened'),
        baseline: field('Baseline'),
        status: field('Status'),
        schemaRoutes: schemaRoutesHash(
          join(intakeFolder({ repositoryRoot, iteration: name }), 'schema-routes.md'),
        ),
        dropPlaced: field('Drop placed'),
      };
    })
    .sort(
      (left, right) =>
        left.opened.localeCompare(right.opened) || left.name.localeCompare(right.name),
    );
}

/**
 * Formats list rows as a markdown table padded to each column's width.
 *
 * @param {ReturnType<typeof readIterationListings>} listings
 * @returns {string}
 */
export function formatIterationTable(listings) {
  const rows = listings.map((listing) => [
    listing.name,
    listing.type,
    listing.owner,
    listing.opened,
    listing.baseline,
    listing.status,
    listing.schemaRoutes,
    listing.dropPlaced,
  ]);
  const widths = LIST_COLUMNS.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column].length)),
  );
  const line = (cells) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`;
  const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
  return [line(LIST_COLUMNS), separator, ...rows.map(line)].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage:\n  pnpm iteration:list');
  } else {
    const listings = readIterationListings(resolve(import.meta.dirname, '../..'));
    console.log(
      listings.length === 0
        ? 'No iterations yet — open the launch with: pnpm iteration:new launch'
        : formatIterationTable(listings),
    );
  }
}
