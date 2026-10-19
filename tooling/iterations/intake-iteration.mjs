#!/usr/bin/env node
/**
 * pnpm iteration:intake — place what arrived for an iteration in `intake-files/`, check it, or
 * compact it.
 *
 * Usage:
 *   pnpm iteration:intake <iteration> <source> [--mode full|overlay|brief] [--both] [--sibling <path>] [--replace] [--dry-run]
 *   pnpm iteration:intake <iteration> --check [--baseline <iteration>]
 *   pnpm iteration:intake <iteration> --compact [--dry-run]
 *
 * `intake-files/` stores what arrived; the iteration's snapshot is resolved from it
 * (`resolveIntakeSnapshot`). `full` (the default, and always the launch's): the drop as received
 * is the snapshot. `overlay`: the received files are stored, and the snapshot is the Baseline's
 * with them laid over it — it needs a Baseline the user named. `brief`: only the received
 * `BRIEF.md` is stored; from scratch (Baseline `none`, the default) it is the whole snapshot, and on
 * a Baseline the user named the snapshot is the Baseline's plus it — no other file may differ from
 * the Baseline's. `<source>` is a folder or one file; received files are copied flat and exactly
 * as delivered (never `README.md`). The frontend's mandatory set is checked on the resolved
 * snapshot, and the README's Drop placed, Drop source, Intake mode, Intake note, Schema-routes and
 * Intake hash rows are filled — the Intake hash covers the resolved snapshot. Replacing a
 * different existing snapshot needs `--replace`, which
 * works only while planning; the intake is locked once the iteration is approved. Under `--both`
 * the sibling repository's same-named iteration gets a snapshot in the same mode, on its own
 * Baseline (or from scratch), with `PRD.md` and `schema-routes.md` (and `BRIEF.md` in brief mode) from this one. Any
 * problem stops the intake with nothing written.
 *
 * `--check` is the gate the iteration skills run before planning and before building: every
 * mandatory file is present and the recomputed Intake hash equals the README's, for the iteration
 * and, with `--baseline`, its Baseline. A failure names the folder, what is missing or changed and
 * the fix, and exits 1.
 *
 * `--compact` removes, from an overlay or a brief that still stores the Baseline's files (as every
 * intake did before), each copy identical to the Baseline's, keeping the received files. The
 * resolved snapshot and its Intake hash do not change, so it works at any Status and never writes
 * the README. The model: iterations/README.md.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnvironmentWithoutInheritedRepository } from '../ci/git-environment.mjs';
import {
  BRIEF_FILE,
  checkIntakeSet,
  DEFAULT_INTAKE_MODE,
  EMPTY_FIELD,
  flatFileNames,
  INTAKE_DIRECTORY,
  INTAKE_MODES,
  intakeFolder,
  iterationFolder,
  LAYERED_INTAKE_MODES,
  localDate,
  LOCKED_INTAKE_STATUSES,
  isStandaloneBrief,
  missingBriefSections,
  NO_BASELINE,
  parseCommandLine,
  parseIterationName,
  OPTIONAL_README_FIELDS,
  README_FIELD_LABELS,
  readIterationReadme,
  readResolvedSnapshot,
  recordedIntakeMode,
  resolveIntakeSnapshot,
  resolveSiblingRoot,
  schemaRoutesHash,
  setReadmeField,
  snapshotFingerprint,
  tryGit,
} from './iterations.mjs';

/** Files `--both` sends to the sibling repository's same-named iteration (plus `BRIEF.md` in brief mode). */
export const SHARED_INTAKE_FILES = ['PRD.md', 'schema-routes.md'];

/** Lines of a differing file's diff shown before stopping. */
const DIFF_PREVIEW_LINES = 120;

/** The part of an overlay or brief Intake note naming the Baseline the snapshot was built on. */
const BUILT_ON = / carried forward from ([a-z0-9-]+)/;

const BRIEF_TEMPLATE = 'tooling/iterations/templates/BRIEF.md';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');

const USAGE = `Usage:
  pnpm iteration:intake <iteration> <source> [--mode full|overlay|brief] [--both] [--sibling <path>] [--replace] [--dry-run]
  pnpm iteration:intake <iteration> --check [--baseline <iteration>]
  pnpm iteration:intake <iteration> --compact [--dry-run]

  <source>          the folder (or the one file) that arrived
  --mode full       the whole drop (the default; always the launch)
  --mode overlay    only the changed files — stored, laid over the Baseline's snapshot (needs a Baseline)
  --mode brief      only ${BRIEF_FILE} (template: ${BRIEF_TEMPLATE}) — stored; on its own from scratch
                    (Baseline none, the default), or added to a named Baseline's snapshot
  --both            also build the sibling repository's same-named iteration, in the same mode on its own
                    Baseline, with PRD.md and schema-routes.md (and ${BRIEF_FILE} in brief mode)
  --sibling <path>  sibling repository path (default: ../<package name with -fe → -be>)
  --replace         replace a different existing snapshot (only while Status is planning)
  --dry-run         check and report; write nothing
  --check           the gate: every mandatory file present and the Intake hash unchanged
  --baseline <it>   with --check: check that iteration too, and that it is the README's Baseline
  --compact         an overlay or a brief: remove the stored copies identical to the Baseline's,
                    keeping what was received (any Status; the snapshot and its hash do not change)`;

/**
 * Parses `<iteration> <source> [--mode <mode>] [--both] [--sibling <path>] [--replace] [--dry-run]`,
 * `<iteration> --check [--baseline <iteration>]` or `<iteration> --compact [--dry-run]`.
 *
 * @param {readonly string[]} commandLine
 * @throws on an unknown mode, `--check` or `--compact` mixed with intake options, or `--baseline`
 *   without `--check`
 */
export function parseIntakeArguments(commandLine) {
  const parsed = parseCommandLine(commandLine, {
    flags: ['--both', '--replace', '--dry-run', '--check', '--compact'],
    values: ['--mode', '--baseline'],
    maxPositionals: 2,
    usage: 'expected <iteration> <source>, <iteration> --check or <iteration> --compact.',
  });
  const mode = parsed.values.get('--mode') ?? DEFAULT_INTAKE_MODE;
  if (!INTAKE_MODES.includes(mode))
    throw new Error(`Unknown --mode "${mode}" — use ${INTAKE_MODES.join(', ')}.`);
  const options = {
    iteration: parsed.positionals[0],
    source: parsed.positionals[1],
    mode,
    check: parsed.flags.has('--check'),
    compact: parsed.flags.has('--compact'),
    baseline: parsed.values.get('--baseline'),
    createInSibling: parsed.createInSibling,
    siblingPath: parsed.siblingPath,
    replace: parsed.flags.has('--replace'),
    dryRun: parsed.flags.has('--dry-run'),
    help: parsed.help,
  };
  const intakeOptions =
    options.source !== undefined ||
    parsed.values.has('--mode') ||
    options.createInSibling ||
    options.replace ||
    options.dryRun;
  if (options.check && intakeOptions)
    throw new Error('--check takes only <iteration> [--baseline <iteration>].');
  const placeOptions =
    options.source !== undefined ||
    parsed.values.has('--mode') ||
    options.createInSibling ||
    options.replace;
  if (options.compact && (options.check || placeOptions))
    throw new Error('--compact takes only <iteration> [--dry-run].');
  if (!options.check && options.baseline !== undefined) {
    throw new Error(
      "--baseline works only with --check — an intake builds on the README's Baseline (pnpm iteration:baseline).",
    );
  }
  return options;
}

/**
 * Shows a source the way a person typed it: repository-relative, `~/…`, or absolute.
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
    env: gitEnvironmentWithoutInheritedRepository(),
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

const SKIPPED_README = 'README.md (never copied — the iteration owns its README)';

/**
 * Lists what arrived: a folder's visible files, flat (subfolders and `README.md` are skipped and
 * reported), or one file.
 *
 * @param {string} source an absolute path
 * @returns {{ folder: string, names: string[], skipped: string[] }}
 * @throws when the source does not exist
 */
export function readReceived(source) {
  if (!existsSync(source)) throw new Error(`Source not found: ${source}`);
  if (statSync(source).isFile()) {
    const name = basename(source);
    if (name === 'README.md')
      return { folder: dirname(source), names: [], skipped: [SKIPPED_README] };
    return {
      folder: dirname(source),
      names: name.startsWith('.') ? [] : [name],
      skipped: [],
    };
  }
  const names = [];
  const skipped = [];
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory())
      skipped.push(`${entry.name}/ (the intake is flat — subfolders are not copied)`);
    else if (entry.name === 'README.md') skipped.push(SKIPPED_README);
    else if (entry.isFile()) names.push(entry.name);
  }
  names.sort((left, right) => left.localeCompare(right));
  return { folder: source, names, skipped };
}

/**
 * The Intake note: what was received versus carried forward — `<n> received` for a full drop;
 * `<n> received (<names>) · <m> carried forward from <baseline>` for an overlay or a brief, whose
 * last word is the Baseline the gate checks the snapshot was built on; `… · from scratch` for a
 * brief on Baseline `none`, which carries nothing forward.
 *
 * @param {{ mode: string, taken: readonly string[], total: number, baseline: string | undefined }} intake
 */
export function renderIntakeNote({ mode, taken, total, baseline }) {
  if (mode === DEFAULT_INTAKE_MODE) return `${taken.length} received`;
  if (baseline === undefined)
    return `${taken.length} received (${taken.join(', ')}) · from scratch`;
  return `${taken.length} received (${taken.join(', ')}) · ${total - taken.length} carried forward from ${baseline}`;
}

/** `--mode <mode>` as typed on a command line (nothing for the default). */
function modeOption(mode) {
  return mode === DEFAULT_INTAKE_MODE ? '' : ` --mode ${mode}`;
}

function relativeIntakeFolder(iteration) {
  return `iterations/${iteration}/${INTAKE_DIRECTORY}/`;
}

function changeKind(code) {
  if (code.startsWith('A')) return 'added';
  if (code.startsWith('D')) return 'deleted';
  if (code.startsWith('R')) return 'renamed';
  return 'modified';
}

/**
 * What git can say about how an intake folder changed, and how to restore it.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 * @returns {{ details: string[], restore: string }}
 */
function gitIntakeChanges({ repositoryRoot, iteration }) {
  const path = relativeIntakeFolder(iteration);
  if (!tryGit(repositoryRoot, ['ls-files', '--', path])) {
    return {
      details: [`${path} is not committed yet, so git cannot name the changed file.`],
      restore: '',
    };
  }
  const tracked = (
    tryGit(repositoryRoot, ['diff', '--name-status', 'HEAD', '--', path]) ?? ''
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [code, ...paths] = line.split('\t');
      return `${changeKind(code)} ${basename(paths[0] ?? '')}`;
    });
  const untracked = (
    tryGit(repositoryRoot, ['ls-files', '--others', '--exclude-standard', '--', path]) ??
    ''
  )
    .split('\n')
    .filter(Boolean)
    .map((file) => `added ${basename(file)}`);
  const changes = [...tracked, ...untracked];
  if (changes.length === 0) {
    return {
      details: [
        `No uncommitted change — a commit changed it: git log --oneline -- ${path}`,
      ],
      restore: 'restore the files from the commit before that change',
    };
  }
  return {
    details: [`Uncommitted: ${changes.join(', ')}`],
    restore: `restore the delivered files (git restore --source=HEAD -- ${path}, and delete any file added since)`,
  };
}

/**
 * The gate's checks on a resolved snapshot: a mandatory file missing for the recorded mode, and a
 * recomputed Intake hash that differs from the README's.
 *
 * @returns {{ what: string, details: string[], fix: string }[]}
 */
function snapshotFailures({
  repositoryRoot,
  iteration,
  resolved,
  mode,
  fields,
  reintake,
}) {
  const failures = [];
  const { missing } = checkIntakeSet({
    names: [...resolved.files.keys()],
    readText: (name) => readFileSync(resolved.files.get(name), 'utf-8'),
    mode,
    standalone: resolved.standalone,
  });
  if (missing.length > 0) {
    failures.push({
      what: `missing mandatory file(s): ${missing.join(', ')}`,
      details: [],
      fix: reintake,
    });
  }
  const recorded = fields.get('Intake hash') ?? EMPTY_FIELD;
  const actual = snapshotFingerprint(readResolvedSnapshot({ repositoryRoot, iteration }));
  if (actual === recorded) return failures;
  const { details, restore } = gitIntakeChanges({ repositoryRoot, iteration });
  const chain =
    resolved.baseline === undefined
      ? []
      : [
          `The hash covers the resolved snapshot, so a change anywhere in the Baseline chain (${resolved.baseline}) changes it too: pnpm iteration:intake ${resolved.baseline} --check`,
        ];
  failures.push({
    what: `changed since the intake — the Intake hash is ${actual}, the README records ${recorded}`,
    details: [...details, ...chain],
    fix:
      restore === '' ? reintake : `${restore} — or, for a deliberate change, ${reintake}`,
  });
  return failures;
}

/**
 * The gate's check that an overlay or a brief was built on the Baseline the README records (the
 * Intake note's `carried forward from <baseline>`); a brief whose note carries nothing forward was
 * built from scratch, on Baseline `none`.
 *
 * @returns {{ what: string, details: string[], fix: string }[]}
 */
function builtOnFailures({ fields, mode, reintake }) {
  if (mode === DEFAULT_INTAKE_MODE) return [];
  const builtOn =
    BUILT_ON.exec(fields.get('Intake note') ?? '')?.[1] ??
    (mode === 'brief' ? NO_BASELINE : undefined);
  const baseline = fields.get('Baseline') ?? EMPTY_FIELD;
  if (builtOn === baseline) return [];
  const from = builtOn === NO_BASELINE ? 'no Baseline (from scratch)' : builtOn;
  return [
    {
      what: `the ${mode} snapshot was built on ${from ?? 'no recorded Baseline'}, but the README's Baseline is ${baseline}`,
      details: [],
      fix: `rebuild it on ${baseline} — ${reintake}`,
    },
  ];
}

/**
 * What the gate finds wrong with one iteration's intake — empty when it passes: no intake yet; an
 * unknown Intake mode; an overlay or a brief whose snapshot cannot be resolved from its Baseline;
 * a mandatory file missing from the resolved snapshot for the recorded mode; a recomputed Intake
 * hash that differs from the README's; an overlay or brief snapshot built on another Baseline than
 * the README records.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 * @returns {{ what: string, details: string[], fix: string }[]}
 * @throws when the iteration has no README
 */
export function gateFailures({ repositoryRoot, iteration }) {
  const { fields } = readIterationReadme({ repositoryRoot, iteration });
  const resolved = resolveIntakeSnapshot({ repositoryRoot, iteration });
  if (resolved.stored.length === 0) {
    return [
      {
        what: 'no intake yet',
        details: [],
        fix: `place it: pnpm iteration:intake ${iteration} <source>`,
      },
    ];
  }
  const mode = recordedIntakeMode(fields);
  const reintake =
    fields.get('Status') === 'planning'
      ? `re-run the intake: pnpm iteration:intake ${iteration} <source>${modeOption(mode)} --replace`
      : `move it back first (pnpm iteration:status ${iteration} planning --reason "<why>"), then re-run the intake with --replace`;
  const failures = [];
  const recordedMode = fields.get('Intake mode') ?? EMPTY_FIELD;
  if (!INTAKE_MODES.includes(recordedMode)) {
    failures.push({
      what: `the README's Intake mode is "${recordedMode}", not ${INTAKE_MODES.join(', ')}`,
      details: [],
      fix: reintake,
    });
  }
  if (resolved.problem === undefined) {
    failures.push(
      ...snapshotFailures({
        repositoryRoot,
        iteration,
        resolved,
        mode,
        fields,
        reintake,
      }),
    );
  } else {
    failures.push({
      what: `the ${mode} snapshot cannot be resolved — ${resolved.problem}`,
      details: [],
      fix: `record a Baseline whose intake passes the gate (pnpm iteration:baseline ${iteration} <baseline>), then ${reintake}`,
    });
  }
  failures.push(...builtOnFailures({ fields, mode, reintake }));
  return failures;
}

/**
 * How many files a resolved snapshot has, and where they are: `23 files` for a full intake;
 * `23 files (1 stored, 22 from <baseline>)` for an overlay or a brief.
 *
 * @param {ReturnType<typeof resolveIntakeSnapshot>} resolved
 */
function describeResolved({ files, stored, baseline }) {
  const total = `${files.size} ${files.size === 1 ? 'file' : 'files'}`;
  if (baseline === undefined) return total;
  return `${total} (${stored.length} stored, ${files.size - stored.length} from ${baseline})`;
}

/**
 * Runs the gate, `pnpm iteration:intake <iteration> --check [--baseline <baseline>]`: the
 * iteration's intake and, with a Baseline, that it is the README's Baseline and that its intake
 * passes too. Every failure names the folder, what is missing or changed and the fix.
 *
 * @param {{ repositoryRoot: string, iteration: string, baseline: string | undefined }} request
 * @returns {{ exitCode: number, lines: string[] }} exit code 1 on any failure
 */
export function runGate({ repositoryRoot, iteration, baseline }) {
  const lines = [];
  let failed = 0;
  const exists = (name) =>
    parseIterationName(name) !== undefined &&
    existsSync(join(iterationFolder({ repositoryRoot, iteration: name }), 'README.md'));
  if (baseline !== undefined && exists(iteration)) {
    const recorded =
      readIterationReadme({ repositoryRoot, iteration }).fields.get('Baseline') ??
      EMPTY_FIELD;
    if (recorded !== baseline) {
      failed += 1;
      lines.push(
        `✗ iterations/${iteration}/README.md: the Baseline is ${recorded}, not ${baseline}`,
        `    fix: record it first: pnpm iteration:baseline ${iteration} ${baseline}`,
      );
    }
  }
  for (const name of baseline === undefined ? [iteration] : [iteration, baseline]) {
    const folder = relativeIntakeFolder(name);
    if (!exists(name)) {
      failed += 1;
      lines.push(
        `✗ iterations/${name}/: no such iteration (no README.md)`,
        '    fix: pick an existing one — pnpm iteration:list',
      );
      continue;
    }
    const failures = gateFailures({ repositoryRoot, iteration: name });
    if (failures.length === 0) {
      const { fields } = readIterationReadme({ repositoryRoot, iteration: name });
      lines.push(
        `✓ ${folder} — ${describeResolved(resolveIntakeSnapshot({ repositoryRoot, iteration: name }))}, mandatory set complete, Intake hash ${fields.get('Intake hash')} unchanged (Intake mode ${recordedIntakeMode(fields)})`,
      );
      continue;
    }
    failed += failures.length;
    for (const failure of failures) {
      lines.push(
        `✗ ${folder}: ${failure.what}`,
        ...failure.details.map((detail) => `    ${detail}`),
        `    fix: ${failure.fix}`,
      );
    }
  }
  if (failed > 0) {
    return {
      exitCode: 1,
      lines: [
        `Gate failed — ${failed} ${failed === 1 ? 'problem' : 'problems'}. Stop here: write nothing, change no status.`,
        ...lines,
      ],
    };
  }
  return { exitCode: 0, lines: [...lines, 'Gate passed.'] };
}

/** The received names an Intake note lists: `1 received (BRIEF.md) · …` → `['BRIEF.md']`. */
const RECEIVED_NAMES = /^\d+ received \(([^)]*)\)/;

/**
 * Plans `--compact`: which files an overlay or a brief stores that are byte-identical to its
 * Baseline's resolved snapshot and were not received — the copies every intake used to store. The
 * received files (the Intake note's list) always stay. Refused for a `full` intake, when the gate
 * fails, and when the resolved Intake hash would change.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 * @returns {{ iteration: string, folder: string, baseline: string | undefined, removable: string[], kept: string[], hash: string, problems: string[] }}
 * @throws when the iteration has no README
 */
export function planCompaction({ repositoryRoot, iteration }) {
  const { fields } = readIterationReadme({ repositoryRoot, iteration });
  const folder = intakeFolder({ repositoryRoot, iteration });
  const mode = recordedIntakeMode(fields);
  const recorded = fields.get('Intake hash') ?? EMPTY_FIELD;
  const plan = {
    iteration,
    folder,
    baseline: undefined,
    removable: [],
    kept: [],
    hash: recorded,
    problems: [],
  };
  if (!LAYERED_INTAKE_MODES.has(mode)) {
    plan.problems.push(
      `${iteration} is a ${mode} intake — it stores the whole drop, so there is nothing to compact.`,
    );
    return plan;
  }
  if (isStandaloneBrief(fields)) {
    plan.problems.push(
      `${iteration} is a brief from scratch — it stores only its ${BRIEF_FILE} and has no Baseline, so there is nothing to compact.`,
    );
    return plan;
  }
  const failures = gateFailures({ repositoryRoot, iteration });
  if (failures.length > 0) {
    plan.problems.push(
      ...failures.map(
        (failure) =>
          `the gate fails first — ${failure.what} (pnpm iteration:intake ${iteration} --check)`,
      ),
    );
    return plan;
  }
  const resolved = resolveIntakeSnapshot({ repositoryRoot, iteration });
  const baseline = resolveIntakeSnapshot({
    repositoryRoot,
    iteration: resolved.baseline,
  });
  plan.baseline = resolved.baseline;
  const received = new Set(
    (RECEIVED_NAMES.exec(fields.get('Intake note') ?? '')?.[1] ?? '')
      .split(', ')
      .filter(Boolean),
  );
  for (const name of resolved.stored) {
    const from = baseline.files.get(name);
    const identical =
      !received.has(name) && from !== undefined && sameBytes(join(folder, name), from);
    (identical ? plan.removable : plan.kept).push(name);
  }
  if (plan.kept.length === 0) {
    plan.problems.push(
      `every stored file is a copy of the Baseline's and the Intake note names none as received — ${INTAKE_DIRECTORY}/ would be empty, so nothing is removed.`,
    );
    return plan;
  }
  const after = new Map(baseline.files);
  for (const name of plan.kept) after.set(name, join(folder, name));
  plan.hash = snapshotFingerprint(
    new Map([...after].map(([name, path]) => [name, readFileSync(path)])),
  );
  if (plan.hash !== recorded) {
    plan.problems.push(
      `compacting would change the Intake hash (${recorded} → ${plan.hash}), so nothing is removed.`,
    );
  }
  return plan;
}

/**
 * Runs `pnpm iteration:intake <iteration> --compact [--dry-run]`: removes the files
 * {@link planCompaction} finds. The resolved snapshot, its Intake hash and the README stay as
 * they are, so it works at any Status.
 *
 * @param {{ repositoryRoot: string, iteration: string, dryRun: boolean }} request
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runCompaction({ repositoryRoot, iteration, dryRun }) {
  const plan = planCompaction({ repositoryRoot, iteration });
  const folder = relativeIntakeFolder(iteration);
  if (plan.problems.length > 0) {
    return {
      exitCode: 1,
      lines: [
        ...plan.problems.map((problem) => `✗ ${folder}: ${problem}`),
        'Nothing removed.',
      ],
    };
  }
  const kept = `kept ${plan.kept.join(', ')}`;
  if (plan.removable.length === 0) {
    return {
      exitCode: 0,
      lines: [
        `${folder} already stores only what arrived — ${kept} · Intake hash ${plan.hash}`,
      ],
    };
  }
  const removed = `${plan.removable.length} ${plan.removable.length === 1 ? 'copy' : 'copies'} identical to ${plan.baseline} (${plan.removable.join(', ')})`;
  if (dryRun) {
    return {
      exitCode: 0,
      lines: [
        `Dry run — nothing removed; would remove ${removed} from ${folder} · ${kept} · Intake hash ${plan.hash} unchanged`,
      ],
    };
  }
  for (const name of plan.removable) rmSync(join(plan.folder, name));
  return {
    exitCode: 0,
    lines: [
      `Compacted ${folder}: removed ${removed} · ${kept} · Intake hash ${plan.hash} unchanged`,
    ],
  };
}

/**
 * The snapshot an overlay or a brief builds on: the README's Baseline's resolved snapshot — an
 * earlier iteration the user named, whose intake passes the gate (`checkGate`) or, for the sibling
 * repository, which has one that resolves. A brief on Baseline `none` starts from scratch and
 * builds on nothing (`null`); an overlay always needs a named Baseline.
 *
 * @returns {{ name: string, files: Map<string, string> } | null | undefined} file name → path;
 *   `null` for a brief from scratch; `undefined` after recording why it cannot be used
 */
function baselineSnapshot({
  repositoryRoot,
  iteration,
  fields,
  mode,
  label,
  problems,
  checkGate,
}) {
  const baseline = fields.get('Baseline') ?? EMPTY_FIELD;
  if (baseline === NO_BASELINE && mode === 'brief') return null;
  if (baseline === NO_BASELINE) {
    problems.push(
      `${label}: --mode ${mode} lays the received files over a Baseline's snapshot, and ${iteration} starts from scratch (Baseline none) — send the whole drop with --mode full or a ${BRIEF_FILE} with --mode brief; only when the user names an earlier iteration, record it first: pnpm iteration:baseline ${iteration} <baseline>.`,
    );
    return undefined;
  }
  if (baseline === EMPTY_FIELD) {
    problems.push(
      `${label}: ${iteration} has no Baseline (—) — record none, the default (pnpm iteration:baseline ${iteration} none), or the earlier iteration the user named.`,
    );
    return undefined;
  }
  const resolved = resolveIntakeSnapshot({ repositoryRoot, iteration: baseline });
  let failures = [];
  if (checkGate) failures = gateFailures({ repositoryRoot, iteration: baseline });
  else if (resolved.stored.length === 0) failures = [{ what: 'no intake yet' }];
  else if (resolved.problem !== undefined)
    failures = [{ what: `its snapshot cannot be resolved — ${resolved.problem}` }];
  if (failures.length > 0) {
    problems.push(
      ...failures.map(
        (failure) =>
          `${label}: the Baseline ${baseline} fails the gate — ${failure.what} (pnpm iteration:intake ${baseline} --check).`,
      ),
    );
    return undefined;
  }
  return { name: baseline, files: resolved.files };
}

/**
 * Builds a snapshot by mode — the resolved snapshot (file name → the path it is read from), the
 * files `intake-files/` stores (file name → the path it is copied from) and the names taken from
 * what came in. `full`: what came in, stored whole. `overlay`: the Baseline's files with what came
 * in laid over them (at least one file); only what came in is stored. `brief`: the Baseline's
 * files plus the `BRIEF.md` that came in, which is all that is stored; any other file that came in
 * must match the Baseline's. A brief from scratch (`baseline` `null`) is the `BRIEF.md` alone, and
 * nothing else may come in with it.
 *
 * @param {{ mode: string, incoming: Map<string, string>, baseline: { name: string, files: Map<string, string> } | null | undefined, label: string, problems: string[] }} intake
 * @returns {{ files: Map<string, string>, stored: Map<string, string>, taken: string[] }}
 */
function buildSnapshot({ mode, incoming, baseline, label, problems }) {
  const names = [...incoming.keys()];
  if (mode === DEFAULT_INTAKE_MODE || baseline === undefined)
    return { files: new Map(incoming), stored: new Map(incoming), taken: names };
  if (baseline === null) {
    if (!incoming.has(BRIEF_FILE)) {
      problems.push(
        `${label}: --mode brief needs a received ${BRIEF_FILE} — start from ${BRIEF_TEMPLATE}.`,
      );
      return { files: new Map(), stored: new Map(), taken: [] };
    }
    const others = names.filter((name) => name !== BRIEF_FILE);
    if (others.length > 0) {
      problems.push(
        `${label}: a brief from scratch is ${BRIEF_FILE} alone, but ${others.join(', ')} also came in — send design files with --mode full.`,
      );
    }
    const brief = new Map([[BRIEF_FILE, incoming.get(BRIEF_FILE)]]);
    return { files: brief, stored: new Map(brief), taken: [BRIEF_FILE] };
  }
  if (mode === 'overlay') {
    if (names.length === 0)
      problems.push(`${label}: --mode overlay needs at least one received file.`);
    return {
      files: new Map([...baseline.files, ...incoming]),
      stored: new Map(incoming),
      taken: names,
    };
  }
  const files = new Map(baseline.files);
  if (!incoming.has(BRIEF_FILE)) {
    problems.push(
      `${label}: --mode brief needs a received ${BRIEF_FILE} — start from ${BRIEF_TEMPLATE}.`,
    );
    return { files, stored: new Map(), taken: [] };
  }
  files.set(BRIEF_FILE, incoming.get(BRIEF_FILE));
  const changed = names.filter(
    (name) =>
      name !== BRIEF_FILE &&
      !(
        baseline.files.has(name) &&
        sameBytes(incoming.get(name), baseline.files.get(name))
      ),
  );
  if (changed.length > 0) {
    problems.push(
      `${label}: --mode brief changes only ${BRIEF_FILE}, but ${changed.join(', ')} ${changed.length === 1 ? 'differs' : 'differ'} from the Baseline ${baseline.name} — use --mode overlay when other files change.`,
    );
  }
  return {
    files,
    stored: new Map([[BRIEF_FILE, incoming.get(BRIEF_FILE)]]),
    taken: [BRIEF_FILE],
  };
}

function describeChanges(changes) {
  const named = (action, title) => {
    const names = changes
      .filter((file) => file.action === action)
      .map((file) => file.name);
    return names.length === 0 ? [] : [`${title} ${names.join(', ')}`];
  };
  return [
    ...named('replace', 'changed:'),
    ...named('add', 'added:'),
    ...named('remove', 'removed:'),
  ].join(' · ');
}

/**
 * Plans one repository's side: compares the files the snapshot stores with `intake-files/` file by
 * file (add, unchanged, replace, remove) and fills the README rows — the Intake hash and
 * Schema-routes from the resolved snapshot. Replacing a different existing snapshot
 * needs `--replace` while Status is planning; nothing changes once the intake is locked.
 */
function planSide({
  repositoryRoot,
  iteration,
  readme,
  snapshot,
  mode,
  note,
  today,
  sourceDisplay,
  replace,
  label,
  problems,
  diffs,
}) {
  const status = readme.fields.get('Status') ?? '';
  const missingRows = README_FIELD_LABELS.filter(
    (field) => !readme.fields.has(field) && !OPTIONAL_README_FIELDS.has(field),
  );
  if (missingRows.length > 0) {
    problems.push(
      `${label}: README.md has no ${missingRows.join(', ')} row — it predates the field; add the rows from tooling/iterations/templates/README.md.`,
    );
  }
  const folder = intakeFolder({ repositoryRoot, iteration });
  const existing = flatFileNames(folder);
  const files = [...snapshot.stored].map(([name, from]) => {
    const to = join(folder, name);
    if (!existing.includes(name)) return { name, from, to, action: 'add' };
    return { name, from, to, action: sameBytes(from, to) ? 'unchanged' : 'replace' };
  });
  for (const name of existing) {
    if (!snapshot.stored.has(name))
      files.push({ name, from: undefined, to: join(folder, name), action: 'remove' });
  }
  const changes = files.filter((file) => file.action !== 'unchanged');
  const hash = snapshotFingerprint(
    new Map([...snapshot.files].map(([name, from]) => [name, readFileSync(from)])),
  );
  const recordedDiffers =
    readme.fields.get('Intake hash') !== hash ||
    readme.fields.get('Intake mode') !== mode;
  const replacing = existing.length > 0 && changes.length > 0;
  let refused = false;
  if ((changes.length > 0 || recordedDiffers) && LOCKED_INTAKE_STATUSES.has(status)) {
    refused = true;
    problems.push(
      `${label}: the intake is locked (Status ${status}) — move it back first: pnpm iteration:status ${iteration} planning --reason "<why>".`,
    );
  } else if (replacing && !replace) {
    refused = true;
    problems.push(
      `${label}: ${INTAKE_DIRECTORY}/ already holds a different snapshot (${describeChanges(changes)}) — re-run with --replace (only while planning) to replace it.`,
    );
  } else if (replacing && status !== 'planning') {
    refused = true;
    problems.push(
      `${label}: --replace replaces a snapshot only while Status is planning (it is ${status}).`,
    );
  }
  if (refused) {
    for (const file of changes.filter((change) => change.action === 'replace')) {
      diffs.push(
        `${label}: ${INTAKE_DIRECTORY}/${file.name} differs from the new snapshot:\n${fileDiff({ before: file.to, after: file.from })}`,
      );
    }
  }
  let filled;
  if ((changes.length > 0 || recordedDiffers) && missingRows.length === 0) {
    filled = readme.content;
    for (const [field, value] of [
      ['Drop placed', today],
      ['Drop source', sourceDisplay],
      ['Intake mode', mode],
      ['Intake note', note],
      ['Schema-routes', schemaRoutesHash(snapshot.files.get('schema-routes.md'))],
      ['Intake hash', hash],
    ]) {
      filled = setReadmeField({ readme: filled, label: field, value });
    }
  }
  return {
    folder,
    readmePath: readme.path,
    readme: filled,
    status,
    note,
    hash,
    files,
  };
}

/**
 * Decides everything `pnpm iteration:intake` will do, without writing anything.
 *
 * Reads what arrived ({@link readReceived}); builds the snapshot for the mode — on the README's
 * Baseline, which must pass the gate, for an overlay or for a brief on a Baseline the user named,
 * or the `BRIEF.md` alone for a brief from scratch; checks it against the frontend's
 * mandatory set and a received `BRIEF.md` against its template, warning about extras and screen
 * files `_index.md` does not list; compares it with `intake-files/` file by file. Under `--both`
 * the sibling's same-named iteration (which must exist) gets a snapshot in the same mode on its
 * own Baseline, with {@link SHARED_INTAKE_FILES} (and `BRIEF.md` in brief mode) from this
 * snapshot.
 *
 * @param {{ repositoryRoot: string, iteration: string | undefined, source: string | undefined, mode?: string, siblingRoot: string | undefined, replace: boolean, today?: string }} request
 * @throws when the source or the iteration does not exist; every other refusal is a `problems`
 *   entry, so a dry run reports all of them at once
 */
export function planIntake(request) {
  const { repositoryRoot, iteration, siblingRoot, replace } = request;
  const mode = request.mode ?? DEFAULT_INTAKE_MODE;
  if (iteration === undefined || request.source === undefined) throw new Error(USAGE);
  const source = resolve(repositoryRoot, request.source);
  const received = readReceived(source);
  const readme = readIterationReadme({ repositoryRoot, iteration });
  const problems = [];
  const diffs = [];
  const sourceDisplay = displaySourcePath({ repositoryRoot, source });
  const plan = {
    iteration,
    mode,
    source,
    sourceDisplay,
    baseline: undefined,
    local: undefined,
    sibling: undefined,
    extras: [],
    unlistedScreens: [],
    skipped: received.skipped,
    diffs,
    problems,
  };
  if (parseIterationName(iteration)?.type === 'launch' && mode !== DEFAULT_INTAKE_MODE) {
    problems.push(
      `The launch is always --mode ${DEFAULT_INTAKE_MODE}: it has no Baseline to build on.`,
    );
    return plan;
  }
  const label = 'This repository';
  const baseline =
    mode === DEFAULT_INTAKE_MODE
      ? undefined
      : baselineSnapshot({
          repositoryRoot,
          iteration,
          fields: readme.fields,
          mode,
          label,
          problems,
          checkGate: true,
        });
  if (mode !== DEFAULT_INTAKE_MODE && baseline === undefined) return plan;
  plan.baseline = baseline?.name;
  const snapshot = buildSnapshot({
    mode,
    incoming: new Map(received.names.map((name) => [name, join(received.folder, name)])),
    baseline,
    label,
    problems,
  });
  const brief = received.names.includes(BRIEF_FILE)
    ? missingBriefSections(readFileSync(join(received.folder, BRIEF_FILE), 'utf-8'))
    : [];
  if (brief.length > 0) {
    problems.push(
      `${BRIEF_FILE} is missing section(s): ${brief.join(', ')} — start from ${BRIEF_TEMPLATE}.`,
    );
  }
  const { missing, extras, unlistedScreens } = checkIntakeSet({
    names: [...snapshot.files.keys()],
    readText: (name) => readFileSync(snapshot.files.get(name), 'utf-8'),
    mode,
    standalone: baseline === null,
  });
  if (missing.length > 0)
    problems.push(`The snapshot is missing mandatory file(s): ${missing.join(', ')}.`);
  plan.extras = extras;
  plan.unlistedScreens = unlistedScreens;

  const today = request.today ?? localDate(new Date());
  plan.local = planSide({
    repositoryRoot,
    iteration,
    readme,
    snapshot,
    mode,
    note: renderIntakeNote({
      mode,
      taken: snapshot.taken,
      total: snapshot.files.size,
      baseline: baseline?.name,
    }),
    today,
    sourceDisplay,
    replace,
    label,
    problems,
    diffs,
  });

  if (siblingRoot === undefined) return plan;
  const siblingLabel = 'Sibling repository';
  if (
    !existsSync(
      join(iterationFolder({ repositoryRoot: siblingRoot, iteration }), 'README.md'),
    )
  ) {
    problems.push(
      `${siblingLabel}: there is no iteration ${iteration} — open it in both first: pnpm iteration:new <type> <topic> --both.`,
    );
    return plan;
  }
  const siblingReadme = readIterationReadme({ repositoryRoot: siblingRoot, iteration });
  const siblingBaseline =
    mode === DEFAULT_INTAKE_MODE
      ? undefined
      : baselineSnapshot({
          repositoryRoot: siblingRoot,
          iteration,
          fields: siblingReadme.fields,
          mode,
          label: siblingLabel,
          problems,
          checkGate: false,
        });
  if (mode !== DEFAULT_INTAKE_MODE && siblingBaseline === undefined) return plan;
  const shared = [
    ...SHARED_INTAKE_FILES,
    ...(mode === 'brief' ? [BRIEF_FILE] : []),
  ].filter((name) => snapshot.files.has(name));
  const siblingSnapshot = buildSnapshot({
    mode,
    incoming: new Map(shared.map((name) => [name, snapshot.files.get(name)])),
    baseline: siblingBaseline,
    label: siblingLabel,
    problems,
  });
  plan.sibling = planSide({
    repositoryRoot: siblingRoot,
    iteration,
    readme: siblingReadme,
    snapshot: siblingSnapshot,
    mode,
    note: renderIntakeNote({
      mode,
      taken: siblingSnapshot.taken,
      total: siblingSnapshot.files.size,
      baseline: siblingBaseline?.name,
    }),
    today,
    sourceDisplay,
    replace,
    label: siblingLabel,
    problems,
    diffs,
  });
  return plan;
}

/**
 * Writes an intake plan: adds, replaces and removes files, then writes the filled READMEs.
 *
 * @param {ReturnType<typeof planIntake>} plan
 * @throws without writing anything when the plan has problems
 */
export function applyIntake(plan) {
  if (plan.problems.length > 0) throw new Error(plan.problems.join('\n'));
  for (const side of [plan.local, plan.sibling]) {
    if (side === undefined) continue;
    for (const file of side.files) {
      if (file.action === 'remove') rmSync(file.to);
      else if (file.action !== 'unchanged') {
        mkdirSync(dirname(file.to), { recursive: true });
        copyFileSync(file.from, file.to);
      }
    }
    if (side.readme !== undefined) writeFileSync(side.readmePath, side.readme);
  }
}

function describeIntake(plan, workspace) {
  const sideLines = (title, side) => {
    if (side === undefined) return [];
    const count = (action) => side.files.filter((file) => file.action === action).length;
    return [
      `${title} (${relative(workspace, side.folder)}) — Status ${side.status}: ${count('add')} new, ${count('replace')} replaced, ${count('remove')} removed, ${count('unchanged')} unchanged`,
      `  Intake note: ${side.note} · Intake hash: ${side.hash}`,
    ];
  };
  return [
    `Drop: ${plan.sourceDisplay} · --mode ${plan.mode}${plan.baseline === undefined ? '' : ` on ${plan.baseline}`}`,
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
 * Runs `pnpm iteration:intake` — an intake, or the gate with `--check` — and returns what to
 * print; the exit code is non-zero when anything stops the intake or the gate fails.
 *
 * @param {readonly string[]} commandLine
 * @param {{ repositoryRoot?: string, today?: string }} [context]
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runIntake(commandLine, context = {}) {
  const options = parseIntakeArguments(commandLine);
  if (options.help) return { exitCode: 0, lines: [USAGE] };
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  if (options.check) {
    if (options.iteration === undefined) return { exitCode: 1, lines: [USAGE] };
    return runGate({
      repositoryRoot,
      iteration: options.iteration,
      baseline: options.baseline,
    });
  }
  if (options.compact) {
    if (options.iteration === undefined) return { exitCode: 1, lines: [USAGE] };
    return runCompaction({
      repositoryRoot,
      iteration: options.iteration,
      dryRun: options.dryRun,
    });
  }
  if (options.source === undefined) return { exitCode: 1, lines: [USAGE] };
  const plan = planIntake({
    repositoryRoot,
    iteration: options.iteration,
    source: options.source,
    mode: options.mode,
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
      lines: ['Dry run — nothing written; the snapshot passes.', ...lines],
    };
  applyIntake(plan);
  return {
    exitCode: 0,
    lines: [
      'Placed.',
      ...lines,
      `Next: say "plan iteration ${plan.iteration}" — planning runs the gate first: pnpm iteration:intake ${plan.iteration} --check`,
    ],
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
