#!/usr/bin/env node
/**
 * pnpm iteration:intake — place a design drop into an iteration's `intake-files/` and check it.
 *
 * Usage:
 *   pnpm iteration:intake <iteration> <source-folder> [--both] [--sibling <path>] [--replace] [--dry-run]
 *
 * The drop is copied flat and exactly as delivered (never `README.md`); the frontend's required
 * set is checked (a missing file stops the intake); extras and screen files `_index.md` does not
 * list are warned about; the README's Drop placed, Drop source and Schema-routes rows are filled.
 * Under `--both`, `PRD.md` and `schema-routes.md` also go to the sibling repository's same-named
 * iteration. The intake is locked once the iteration is approved. Any problem stops it with nothing
 * written. The model: iterations/README.md.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkIntakeSet,
  gitEnvironment,
  INTAKE_DIRECTORY,
  intakeFolder,
  iterationFolder,
  localDate,
  LOCKED_INTAKE_STATUSES,
  parseCommandLine,
  readIterationReadme,
  resolveSiblingRoot,
  schemaRoutesHash,
  setReadmeField,
} from './iterations.mjs';

/** Files `--both` copies into the sibling repository's same-named iteration. */
export const SHARED_INTAKE_FILES = ['PRD.md', 'schema-routes.md'];

/** Lines of a conflicting file's diff shown before stopping. */
const DIFF_PREVIEW_LINES = 120;

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');

const USAGE = `Usage:
  pnpm iteration:intake <iteration> <source-folder> [--both] [--sibling <path>] [--replace] [--dry-run]

  --both            also copy PRD.md and schema-routes.md into the sibling repository's same-named iteration
  --sibling <path>  sibling repository path (default: ../<package name with -fe → -be>)
  --replace         overwrite files that differ (only while Status is planning)
  --dry-run         check and report; write nothing`;

/**
 * Parses `<iteration> <source-folder> [--both] [--sibling <path>] [--replace] [--dry-run]`.
 *
 * @param {readonly string[]} commandLine
 */
export function parseIntakeArguments(commandLine) {
  const parsed = parseCommandLine(commandLine, {
    flags: ['--both', '--replace', '--dry-run'],
    maxPositionals: 2,
    usage: 'expected <iteration> <source-folder>.',
  });
  return {
    iteration: parsed.positionals[0],
    source: parsed.positionals[1],
    createInSibling: parsed.createInSibling,
    siblingPath: parsed.siblingPath,
    replace: parsed.flags.has('--replace'),
    dryRun: parsed.flags.has('--dry-run'),
    help: parsed.help,
  };
}

/**
 * Shows a source folder the way a person typed it: repository-relative, `~/…`, or absolute.
 *
 * @param {{ repositoryRoot: string, source: string }} location
 */
export function displaySourcePath({ repositoryRoot, source }) {
  const fromRepository = relative(repositoryRoot, source);
  if (fromRepository !== '' && !fromRepository.startsWith('..')) return fromRepository;
  const home = homedir();
  if (source === home) return '~';
  if (source.startsWith(`${home}${sep}`)) return `~${source.slice(home.length)}`;
  return source;
}

/**
 * The unified diff of two files (`git diff --no-index`), trimmed for the terminal.
 *
 * @param {{ before: string, after: string }} files
 */
export function fileDiff({ before, after }) {
  const result = spawnSync('git', ['diff', '--no-index', '--', before, after], {
    encoding: 'utf-8',
    env: gitEnvironment(),
  });
  const lines = (result.stdout ?? '').split('\n');
  return lines.length > DIFF_PREVIEW_LINES
    ? [
        ...lines.slice(0, DIFF_PREVIEW_LINES),
        `… ${lines.length - DIFF_PREVIEW_LINES} more lines`,
      ].join('\n')
    : lines.join('\n');
}

function sameBytes(left, right) {
  return readFileSync(left).equals(readFileSync(right));
}

function planSide({
  repositoryRoot,
  iteration,
  source,
  names,
  replace,
  label,
  problems,
  diffs,
}) {
  const readme = readIterationReadme({ repositoryRoot, iteration });
  const status = readme.fields.get('Status') ?? '';
  const locked = LOCKED_INTAKE_STATUSES.has(status);
  const folder = intakeFolder({ repositoryRoot, iteration });
  const files = names.map((name) => {
    const from = join(source, name);
    const to = join(folder, name);
    if (!existsSync(to)) return { name, from, to, action: 'copy' };
    if (sameBytes(from, to)) return { name, from, to, action: 'unchanged' };
    if (replace) return { name, from, to, action: 'replace' };
    diffs.push(
      `${label}: ${INTAKE_DIRECTORY}/${name} differs from the drop:\n${fileDiff({ before: to, after: from })}`,
    );
    return { name, from, to, action: 'conflict' };
  });
  const conflicts = files
    .filter((file) => file.action === 'conflict')
    .map((file) => file.name);
  if (conflicts.length > 0) {
    problems.push(
      `${label}: ${conflicts.join(', ')} already in ${INTAKE_DIRECTORY}/ with different content — re-run with --replace (only while planning) to overwrite.`,
    );
  }
  const changes = files.some(
    (file) => file.action === 'copy' || file.action === 'replace',
  );
  if (changes && locked) {
    problems.push(
      `${label}: the intake is locked (Status ${status}) — move it back first: pnpm iteration:status ${iteration} planning --reason "<why>".`,
    );
  }
  if (files.some((file) => file.action === 'replace') && status !== 'planning') {
    problems.push(
      `${label}: --replace overwrites only while Status is planning (it is ${status}).`,
    );
  }
  return {
    repositoryRoot,
    readmePath: readme.path,
    readme: readme.content,
    status,
    locked,
    files,
  };
}

function filledReadme({ side, today, sourceDisplay, schemaRoutesSource }) {
  if (!side.files.some((file) => file.action === 'copy' || file.action === 'replace'))
    return undefined;
  let readme = setReadmeField({
    readme: side.readme,
    label: 'Drop placed',
    value: today,
  });
  readme = setReadmeField({ readme, label: 'Drop source', value: sourceDisplay });
  return setReadmeField({
    readme,
    label: 'Schema-routes',
    value: schemaRoutesHash(schemaRoutesSource),
  });
}

/**
 * Decides everything `pnpm iteration:intake` will do, without writing anything.
 *
 * Lists the source folder's files (flat — subfolders, hidden files and `README.md` are skipped and
 * reported); checks the frontend's required set ({@link checkIntakeSet}) and reports extras and
 * unlisted screens; classifies each file against `intake-files/` as copy, unchanged, replace
 * (with `--replace`) or conflict (with a diff); refuses any change while Status is `approved` or
 * later; under `--both`, does the same for {@link SHARED_INTAKE_FILES} in the sibling's same-named
 * iteration, which must exist. The README rows are filled only for a side whose files change.
 *
 * @param {{ repositoryRoot: string, iteration: string | undefined, source: string | undefined, siblingRoot: string | undefined, replace: boolean, today?: string }} request
 * @throws when the source folder or the iteration does not exist; every other refusal is a
 *   `problems` entry, so a dry run reports all of them at once
 */
export function planIntake(request) {
  const { repositoryRoot, iteration, siblingRoot, replace } = request;
  if (iteration === undefined || request.source === undefined) throw new Error(USAGE);
  const source = resolve(repositoryRoot, request.source);
  if (!(existsSync(source) && statSync(source).isDirectory())) {
    throw new Error(`Source folder not found: ${source}`);
  }
  const names = [];
  const skipped = [];
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory())
      skipped.push(`${entry.name}/ (the intake is flat — subfolders are not copied)`);
    else if (entry.name === 'README.md')
      skipped.push('README.md (never copied — the iteration owns its README)');
    else if (entry.isFile()) names.push(entry.name);
  }
  names.sort((left, right) => left.localeCompare(right));
  const { missing, extras, unlistedScreens } = checkIntakeSet({
    names,
    readText: (name) => readFileSync(join(source, name), 'utf-8'),
  });
  const problems = [];
  const diffs = [];
  if (missing.length > 0)
    problems.push(`The drop is missing required file(s): ${missing.join(', ')}.`);

  const today = request.today ?? localDate(new Date());
  const sourceDisplay = displaySourcePath({ repositoryRoot, source });
  const schemaRoutesSource = join(source, 'schema-routes.md');
  const localSide = planSide({
    repositoryRoot,
    iteration,
    source,
    names,
    replace,
    label: 'This repository',
    problems,
    diffs,
  });
  const local = {
    ...localSide,
    readme: filledReadme({ side: localSide, today, sourceDisplay, schemaRoutesSource }),
  };

  let sibling;
  if (siblingRoot !== undefined) {
    if (
      existsSync(
        join(iterationFolder({ repositoryRoot: siblingRoot, iteration }), 'README.md'),
      )
    ) {
      const siblingSide = planSide({
        repositoryRoot: siblingRoot,
        iteration,
        source,
        names: SHARED_INTAKE_FILES.filter((name) => names.includes(name)),
        replace,
        label: 'Sibling repository',
        problems,
        diffs,
      });
      sibling = {
        ...siblingSide,
        readme: filledReadme({
          side: siblingSide,
          today,
          sourceDisplay,
          schemaRoutesSource,
        }),
      };
    } else {
      problems.push(
        `The sibling repository has no iteration ${iteration} — open it in both first: pnpm iteration:new <type> <topic> --both.`,
      );
    }
  }
  return {
    iteration,
    source,
    local,
    sibling,
    missing,
    extras,
    unlistedScreens,
    skipped,
    diffs,
    problems,
  };
}

/**
 * Writes an intake plan: copies the changed files and writes the filled READMEs.
 *
 * @param {ReturnType<typeof planIntake>} plan
 * @throws without writing anything when the plan has problems
 */
export function applyIntake(plan) {
  if (plan.problems.length > 0) throw new Error(plan.problems.join('\n'));
  for (const side of [plan.local, plan.sibling]) {
    if (side === undefined) continue;
    for (const file of side.files) {
      if (file.action !== 'copy' && file.action !== 'replace') continue;
      mkdirSync(dirname(file.to), { recursive: true });
      copyFileSync(file.from, file.to);
    }
    if (side.readme !== undefined) writeFileSync(side.readmePath, side.readme);
  }
}

function describeIntake(plan, workspace) {
  const sideLines = (title, side) => {
    if (side === undefined) return [];
    const count = (action) => side.files.filter((file) => file.action === action).length;
    return [
      `${title} (${relative(workspace, side.readmePath).replace(/README\.md$/, INTAKE_DIRECTORY)}) — Status ${side.status}: ${count('copy')} new, ${count('replace')} replaced, ${count('unchanged')} unchanged, ${count('conflict')} conflicting`,
    ];
  };
  return [
    `Drop: ${plan.source}`,
    ...sideLines('This repository', plan.local),
    ...sideLines('Sibling repository', plan.sibling),
    ...plan.skipped.map((entry) => `  skipped ${entry}`),
    ...plan.extras.map(
      (name) => `! extra file (not in the required or optional set): ${name}`,
    ),
    ...plan.unlistedScreens.map(
      (name) => `! screen file not listed in _index.md: ${name}`,
    ),
    ...plan.diffs,
    ...plan.problems.map((problem) => `✗ ${problem}`),
  ];
}

/**
 * Runs `pnpm iteration:intake` and returns what to print; the exit code is non-zero when anything
 * required is missing or any other problem stops the intake.
 *
 * @param {readonly string[]} commandLine
 * @param {{ repositoryRoot?: string, today?: string }} [context]
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runIntake(commandLine, context = {}) {
  const options = parseIntakeArguments(commandLine);
  if (options.help || options.source === undefined)
    return { exitCode: options.help ? 0 : 1, lines: [USAGE] };
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  const plan = planIntake({
    repositoryRoot,
    iteration: options.iteration,
    source: options.source,
    siblingRoot: options.createInSibling
      ? resolveSiblingRoot({ repositoryRoot, siblingPath: options.siblingPath })
      : undefined,
    replace: options.replace,
    today: context.today,
  });
  const lines = describeIntake(plan, resolve(repositoryRoot, '..'));
  if (plan.problems.length > 0)
    return { exitCode: 1, lines: [...lines, 'Nothing written.'] };
  if (options.dryRun)
    return {
      exitCode: 0,
      lines: ['Dry run — nothing written; the drop passes.', ...lines],
    };
  applyIntake(plan);
  return {
    exitCode: 0,
    lines: ['Placed.', ...lines, `Next: say "plan iteration ${plan.iteration}".`],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { exitCode, lines } = runIntake(process.argv.slice(2));
    console.log(lines.join('\n'));
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
