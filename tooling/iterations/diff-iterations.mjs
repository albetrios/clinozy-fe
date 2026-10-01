#!/usr/bin/env node
/**
 * pnpm iteration:diff — compare a Baseline's `intake-files/` with the current iteration's.
 *
 * Usage:
 *   pnpm iteration:diff [<baseline>] <current> [--json]
 *
 * Every iteration's intake holds the full drop, so the delta of an incremental iteration is this
 * comparison plus the designer's "What changed" notes; anything the comparison shows that the
 * notes omit is a finding. Only `intake-files/` is compared — never the README, `KICKOFF.md`,
 * `plans/` or `AS-BUILT.md` — so both sides need theirs. Prints a summary (files; screens via
 * `_index.md` Slugs; whether the PRD, `schema-routes.md` or the prototype changed; the
 * `schema-routes.md` entities, fields, enums, routes and operations added, removed or changed),
 * then the raw `git diff --no-index`. `--json` prints the summary only, for skills. Without a
 * Baseline it prints the recorded and suggested Baselines and exits 2, so the user can confirm one.
 *
 * clinozy-be's `tooling/iterations/iteration-diff.util.ts` prints the same summary and JSON shape.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_FIELD,
  flatFileNames,
  gitEnvironment,
  INTAKE_DIRECTORY,
  indexSlugs,
  intakeFolder,
  ITERATIONS_DIRECTORY,
  NO_BASELINE,
  readIterationReadme,
  suggestBaseline,
  tableCells,
} from './iterations.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');
const PROTOTYPE_EXTENSIONS = ['.html', '.js'];

const USAGE = `Usage:
  pnpm iteration:diff [<baseline>] <current> [--json]`;

/**
 * Parses the comparable parts of a `schema-routes.md`: `# Route map` rows whose first cell is a
 * backticked path; `## Entity: <name>` tables (fields — a trailing `(…)` note on the name is
 * dropped); `## Enum: <name>` tables (machine values); `# Operations` tables under
 * `## Screen: <name>`. Header and `n/a` rows are skipped; each row's other cells form its
 * signature, so an edited row reads as changed.
 *
 * @param {string} markdown
 * @returns {{ entities: Map<string, Map<string, string>>, enums: Map<string, Map<string, string>>, routes: Map<string, string>, operations: Map<string, string> }}
 */
export function parseSchemaRoutes(markdown) {
  const entities = new Map();
  const enums = new Map();
  const routes = new Map();
  const operations = new Map();
  let section = '';
  let heading = { kind: 'other', name: '' };
  for (const line of markdown.split('\n')) {
    if (line.startsWith('# ')) {
      section = line.slice(2).trim().toLowerCase();
      heading = { kind: 'other', name: '' };
      continue;
    }
    if (line.startsWith('## ')) {
      heading = headingOf(line.slice(3).trim());
      if (heading.kind === 'entity' && !entities.has(heading.name))
        entities.set(heading.name, new Map());
      if (heading.kind === 'enum' && !enums.has(heading.name))
        enums.set(heading.name, new Map());
      continue;
    }
    const cells = tableCells(line);
    if (cells === undefined || cells.length < 2) continue;
    const [first, ...rest] = cells;
    const signature = rest.join(' | ');
    if (section === 'route map') {
      const path = /^`([^`]+)`$/.exec(first)?.[1];
      if (path !== undefined) routes.set(path, signature);
    } else if (heading.kind === 'entity') {
      if (first !== 'Field') entities.get(heading.name).set(first, signature);
    } else if (heading.kind === 'enum') {
      if (first !== 'Machine value') enums.get(heading.name).set(first, signature);
    } else if (
      heading.kind === 'screen' &&
      section === 'operations' &&
      first !== 'Operation' &&
      first !== 'n/a'
    ) {
      operations.set(`${heading.name} › ${first}`, signature);
    }
  }
  return { entities, enums, routes, operations };
}

function headingOf(title) {
  const named = (prefix) =>
    title
      .slice(prefix.length)
      .replace(/\s*\(.*\)\s*$/, '')
      .trim();
  if (title.startsWith('Entity:')) return { kind: 'entity', name: named('Entity:') };
  if (title.startsWith('Enum:')) return { kind: 'enum', name: named('Enum:') };
  if (title.startsWith('Screen:')) return { kind: 'screen', name: named('Screen:') };
  return { kind: 'other', name: title };
}

function compareMaps({ before, after, same }) {
  const added = [...after.keys()].filter((key) => !before.has(key));
  const removed = [...before.keys()].filter((key) => !after.has(key));
  const changed = [...after.keys()].filter(
    (key) => before.has(key) && !same(before.get(key), after.get(key)),
  );
  const sorted = (keys) => keys.sort((left, right) => left.localeCompare(right));
  return { added: sorted(added), removed: sorted(removed), changed: sorted(changed) };
}

function sameMap(left, right) {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) if (right.get(key) !== value) return false;
  return true;
}

/**
 * Compares two parsed `schema-routes.md` files. Fields are named `<Entity>.<field>` and compared
 * only for entities both sides have.
 *
 * @param {{ before: ReturnType<typeof parseSchemaRoutes>, after: ReturnType<typeof parseSchemaRoutes> }} models
 */
export function compareSchemaRoutes({ before, after }) {
  const fields = { added: [], removed: [], changed: [] };
  for (const [entity, afterFields] of after.entities) {
    const beforeFields = before.entities.get(entity);
    if (beforeFields === undefined) continue;
    const change = compareMaps({
      before: beforeFields,
      after: afterFields,
      same: (left, right) => left === right,
    });
    for (const kind of ['added', 'removed', 'changed'])
      fields[kind].push(...change[kind].map((field) => `${entity}.${field}`));
  }
  for (const kind of ['added', 'removed', 'changed'])
    fields[kind].sort((left, right) => left.localeCompare(right));
  const exact = (left, right) => left === right;
  return {
    entities: compareMaps({
      before: before.entities,
      after: after.entities,
      same: sameMap,
    }),
    fields,
    enums: compareMaps({ before: before.enums, after: after.enums, same: sameMap }),
    routes: compareMaps({ before: before.routes, after: after.routes, same: exact }),
    operations: compareMaps({
      before: before.operations,
      after: after.operations,
      same: exact,
    }),
  };
}

function readDrop(folder) {
  return new Map(
    flatFileNames(folder).map((name) => [name, readFileSync(join(folder, name))]),
  );
}

/**
 * Summarizes the difference between two iterations' intake files: the flat file sets byte by byte;
 * changed `<slug>.md` files as screens (through either side's `_index.md` Slug column); whether
 * `PRD.md`, `schema-routes.md` or the prototype (`.html`, `.js`) changed; and the two
 * `schema-routes.md` files compared ({@link compareSchemaRoutes}).
 *
 * @param {{ repositoryRoot: string, baseline: string, current: string }} request
 * @throws when either iteration has no README or no `intake-files/` — the comparison covers
 *   `intake-files/` only, so both sides are mandatory
 */
export function summarizeIntakeDiff({ repositoryRoot, baseline, current }) {
  readIterationReadme({ repositoryRoot, iteration: baseline });
  readIterationReadme({ repositoryRoot, iteration: current });
  for (const iteration of [baseline, current]) {
    if (!existsSync(intakeFolder({ repositoryRoot, iteration }))) {
      throw new Error(
        `${iteration} has no ${INTAKE_DIRECTORY}/ — the incremental delta is a diff of ${INTAKE_DIRECTORY}/ only, so both iterations need theirs: pnpm iteration:intake ${iteration} <source-folder>.`,
      );
    }
  }
  const before = readDrop(intakeFolder({ repositoryRoot, iteration: baseline }));
  const after = readDrop(intakeFolder({ repositoryRoot, iteration: current }));
  const files = compareMaps({ before, after, same: (left, right) => left.equals(right) });
  const touched = new Set([...files.added, ...files.removed, ...files.changed]);
  const slugs = new Set([
    ...indexSlugs(before.get('_index.md')?.toString('utf-8')),
    ...indexSlugs(after.get('_index.md')?.toString('utf-8')),
  ]);
  const asScreens = (names) =>
    names
      .filter((name) => name.endsWith('.md') && slugs.has(name.slice(0, -'.md'.length)))
      .map((name) => name.slice(0, -'.md'.length));
  return {
    baseline,
    current,
    files,
    screens: {
      added: asScreens(files.added),
      removed: asScreens(files.removed),
      changed: asScreens(files.changed),
    },
    prdChanged: touched.has('PRD.md'),
    schemaRoutesChanged: touched.has('schema-routes.md'),
    prototypeChanged: [...touched].some((name) =>
      PROTOTYPE_EXTENSIONS.some((extension) => name.endsWith(extension)),
    ),
    schemaRoutes: compareSchemaRoutes({
      before: parseSchemaRoutes(before.get('schema-routes.md')?.toString('utf-8') ?? ''),
      after: parseSchemaRoutes(after.get('schema-routes.md')?.toString('utf-8') ?? ''),
    }),
  };
}

function changeLines(title, changes) {
  const parts = [];
  if (changes.added.length > 0)
    parts.push(`  + added   (${changes.added.length}): ${changes.added.join(', ')}`);
  if (changes.removed.length > 0)
    parts.push(`  − removed (${changes.removed.length}): ${changes.removed.join(', ')}`);
  if (changes.changed.length > 0)
    parts.push(`  ~ changed (${changes.changed.length}): ${changes.changed.join(', ')}`);
  return [`${title}:`, ...(parts.length > 0 ? parts : ['  (no change)'])];
}

/**
 * Formats a summary for the terminal.
 *
 * @param {ReturnType<typeof summarizeIntakeDiff>} summary
 */
export function formatIntakeDiffSummary(summary) {
  const state = (value) => (value ? 'changed' : 'unchanged');
  return [
    `iteration:diff ${summary.baseline} → ${summary.current} (${INTAKE_DIRECTORY}/)`,
    '',
    ...changeLines('Files', summary.files),
    ...changeLines('Screens (via _index.md)', summary.screens),
    `PRD.md: ${state(summary.prdChanged)} · schema-routes.md: ${state(summary.schemaRoutesChanged)} · prototype: ${state(summary.prototypeChanged)}`,
    '',
    'schema-routes.md',
    ...changeLines('Entities', summary.schemaRoutes.entities),
    ...changeLines('Fields', summary.schemaRoutes.fields),
    ...changeLines('Enums', summary.schemaRoutes.enums),
    ...changeLines('Routes', summary.schemaRoutes.routes),
    ...changeLines('Operations', summary.schemaRoutes.operations),
  ].join('\n');
}

/**
 * Runs `git diff --no-index` between the two iterations' `intake-files/` and returns its output.
 *
 * @param {{ repositoryRoot: string, baseline: string, current: string }} request
 */
export function rawIntakeDiff({ repositoryRoot, baseline, current }) {
  const result = spawnSync(
    'git',
    [
      'diff',
      '--no-index',
      '--',
      join(ITERATIONS_DIRECTORY, baseline, INTAKE_DIRECTORY),
      join(ITERATIONS_DIRECTORY, current, INTAKE_DIRECTORY),
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf-8',
      env: gitEnvironment(),
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  return result.stdout ?? '';
}

/**
 * Parses `[<baseline>] <current> [--json]`.
 *
 * @param {readonly string[]} commandLine
 * @returns {{ baseline: string | undefined, current: string | undefined, json: boolean, help: boolean }}
 */
export function parseDiffArguments(commandLine) {
  const positionals = [];
  let json = false;
  let help = false;
  for (const token of commandLine) {
    if (token === '--json') json = true;
    else if (token === '--help' || token === '-h') help = true;
    else if (token.startsWith('-')) throw new Error(`Unknown option "${token}".`);
    else positionals.push(token);
  }
  if (positionals.length > 2)
    throw new Error(
      `Too many arguments: ${positionals.join(' ')} — expected [<baseline>] <current>.`,
    );
  return positionals.length === 2
    ? { baseline: positionals[0], current: positionals[1], json, help }
    : { baseline: undefined, current: positionals[0], json, help };
}

/**
 * Explains what to compare against when no Baseline is given — the recorded Baseline and the
 * suggestion — so the caller can ask the user.
 *
 * @param {{ repositoryRoot: string, current: string }} request
 */
export function missingBaselineMessage({ repositoryRoot, current }) {
  const recorded = readIterationReadme({ repositoryRoot, iteration: current }).fields.get(
    'Baseline',
  );
  const usable =
    recorded !== undefined && recorded !== NO_BASELINE && recorded !== EMPTY_FIELD
      ? recorded
      : undefined;
  const suggested = suggestBaseline({ repositoryRoot, excluding: current });
  const lines = ['No Baseline given.'];
  if (usable !== undefined) lines.push(`  Recorded in ${current}/README.md: ${usable}`);
  lines.push(
    suggested === undefined
      ? '  Suggested: none — no iteration in this repository is done or frozen with a complete intake yet.'
      : `  Suggested (latest done/frozen in this repository): ${suggested}`,
  );
  const pick = usable ?? suggested;
  if (pick !== undefined)
    lines.push(`Confirm and re-run: pnpm iteration:diff ${pick} ${current}`);
  return lines.join('\n');
}

/**
 * Runs `pnpm iteration:diff` and returns what to print.
 *
 * @param {readonly string[]} commandLine
 * @param {{ repositoryRoot?: string }} [context]
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runDiff(commandLine, context = {}) {
  const options = parseDiffArguments(commandLine);
  if (options.help || options.current === undefined)
    return { exitCode: options.help ? 0 : 1, lines: [USAGE] };
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  if (options.baseline === undefined) {
    return {
      exitCode: 2,
      lines: [missingBaselineMessage({ repositoryRoot, current: options.current })],
    };
  }
  const request = {
    repositoryRoot,
    baseline: options.baseline,
    current: options.current,
  };
  const summary = summarizeIntakeDiff(request);
  if (options.json) return { exitCode: 0, lines: [JSON.stringify(summary, null, 2)] };
  const raw = rawIntakeDiff(request);
  return {
    exitCode: 0,
    lines: [
      formatIntakeDiffSummary(summary),
      '',
      '── git diff --no-index ──',
      raw === '' ? '(no difference)' : raw,
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { exitCode, lines } = runDiff(process.argv.slice(2));
    console.log(lines.join('\n'));
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
