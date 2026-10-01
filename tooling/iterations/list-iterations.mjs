#!/usr/bin/env node
/**
 * pnpm iteration:list — print every design iteration in this working tree.
 *
 * Reads the field table of each `iterations/<iteration>/README.md` and prints
 * Name | Type | Owner | Opened | Baseline | Status, oldest first. There is no shared
 * index file; this listing is the index. The model: iterations/README.md.
 *
 * Also the shared reader for `new-iteration.mjs`: what counts as an iteration folder
 * (the name grammar) and how a README's field table is read. clinozy-be's
 * `tooling/iterations/iteration.util.ts` implements the same rules, so a folder
 * created in either repository reads the same in both.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The four iteration types, in the order the docs list them. */
export const ITERATION_TYPES = ['launch', 'feat', 'change', 'fix'];

/** Folder (relative to a repository root) that holds every iteration. */
export const ITERATIONS_DIRECTORY = 'iterations';

/** Placeholder for an empty README field (the launch's Topic, a new iteration's Summary). */
export const EMPTY_FIELD = '—';

const ITERATION_NAME_PATTERN = new RegExp(
  `^(${ITERATION_TYPES.join('|')})(?:-([a-z]+(?:-[a-z]+)*))?-(\\d{4}-\\d{2}-\\d{2})-([a-z]{4})$`,
);
const FIELD_LABEL = /^[A-Za-z]+$/;
const LIST_COLUMNS = ['Name', 'Type', 'Owner', 'Opened', 'Baseline', 'Status'];

/**
 * Splits an iteration folder name into its parts.
 *
 * @param {string} name a folder name under `iterations/`
 * @returns {{ type: string, topic: string | undefined, opened: string } | undefined}
 *   `undefined` when the name is not `<type>[-<topic>]-<YYYY-MM-DD>-<four letters>`
 */
export function parseIterationName(name) {
  const match = ITERATION_NAME_PATTERN.exec(name);
  if (!match) return undefined;
  const [, type, topic, opened] = match;
  return { type, topic, opened };
}

/**
 * Reads the field table of an iteration's `README.md` into a label → value map.
 *
 * Only `| Label | Value |` rows count, where the label is a single word; the header
 * row (`Field`) and the separator are skipped. The value runs to the row's last pipe.
 *
 * @param {string} markdown
 * @returns {Map<string, string>}
 */
export function parseIterationReadme(markdown) {
  const fields = new Map();
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (line.length < 2 || !line.startsWith('|') || !line.endsWith('|')) continue;
    const cells = line.slice(1, -1);
    const divider = cells.indexOf('|');
    if (divider === -1) continue;
    const label = cells.slice(0, divider).trim();
    if (!FIELD_LABEL.test(label) || label === 'Field') continue;
    fields.set(label, cells.slice(divider + 1).trim());
  }
  return fields;
}

/**
 * Iteration folder names present in a repository's working tree, sorted. Folders
 * outside the name grammar (an old letter-named folder, a stray `notes/`) are not iterations.
 *
 * @param {string} repositoryRoot
 * @returns {string[]}
 */
export function workingTreeIterationNames(repositoryRoot) {
  const directory = join(repositoryRoot, ITERATIONS_DIRECTORY);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && parseIterationName(entry.name) !== undefined,
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Reads every `iterations/*\/README.md` in a working tree into list rows, oldest first
 * (Opened, then name). A missing README or field shows as `—`.
 *
 * @param {string} repositoryRoot
 * @returns {{ name: string, type: string, owner: string, opened: string, baseline: string, status: string }[]}
 */
export function readIterationListings(repositoryRoot) {
  return workingTreeIterationNames(repositoryRoot)
    .map((name) => {
      const readmePath = join(repositoryRoot, ITERATIONS_DIRECTORY, name, 'README.md');
      const fields = existsSync(readmePath)
        ? parseIterationReadme(readFileSync(readmePath, 'utf-8'))
        : new Map();
      const field = (label) => fields.get(label) ?? EMPTY_FIELD;
      return {
        name,
        type: field('Type'),
        owner: field('Owner'),
        opened: field('Opened'),
        baseline: field('Baseline'),
        status: field('Status'),
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
  const listings = readIterationListings(resolve(import.meta.dirname, '../..'));
  console.log(
    listings.length === 0
      ? 'No iterations yet — open the launch with: pnpm iteration:new launch'
      : formatIterationTable(listings),
  );
}
