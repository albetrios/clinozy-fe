#!/usr/bin/env node
/**
 * pnpm iteration:new — open a design-iteration folder.
 *
 * Usage:
 *   pnpm iteration:new launch
 *   pnpm iteration:new <feat|change|fix> <topic> [--both] [--sibling <path>] [--dry-run]
 *
 * Creates `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/README.md` — Owner, Opened, Branch, a
 * suggested Baseline and Status `planning` filled in. An iteration starts with its README only;
 * `pnpm iteration:intake` fills `intake-files/`. `--both` opens the same folder in the sibling
 * repository (clinozy-be), whose README suggests its own Baseline. The model: iterations/README.md.
 */
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSetupConfig } from '../setup/github/setup-config.mjs';
import {
  EMPTY_FIELD,
  INITIAL_ITERATION_STATUS,
  ITERATION_TYPES,
  ITERATIONS_DIRECTORY,
  localDate,
  NO_BASELINE,
  parseCommandLine,
  parseIterationName,
  resolveSiblingRoot,
  suggestBaseline,
  gitUserName,
  tryGit,
  workingTreeIterationNames,
} from './iterations.mjs';

/** Maximum random ids tried before giving up on a unique name. */
export const MAXIMUM_NAME_ATTEMPTS = 20;

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');
const TEMPLATES_DIRECTORY = join(import.meta.dirname, 'templates');
const SIBLING_README_TEMPLATE = join('tooling', 'iterations', 'templates', 'README.md');
const TOPIC_PATTERN = /^[a-z]+(?:-[a-z]+)*$/;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 4;
const TEMPLATE_PLACEHOLDER = /\{\{(\w+)\}\}/g;

const USAGE = `Usage:
  pnpm iteration:new launch
  pnpm iteration:new <feat|change|fix> <topic> [--both] [--sibling <path>] [--dry-run]

  --both            also open the folder in the sibling repository (clinozy-be)
  --sibling <path>  sibling repository path (default: ../<package name with -fe → -be>)
  --dry-run         print what would be created; write nothing`;

/**
 * Parses `<type> [topic] [--both] [--sibling <path>] [--dry-run]`. `--sibling` implies `--both`.
 *
 * @param {readonly string[]} commandLine
 * @returns {{ type: string | undefined, topic: string | undefined, createInSibling: boolean, siblingPath: string | undefined, dryRun: boolean, help: boolean }}
 */
export function parseNewIterationArguments(commandLine) {
  const parsed = parseCommandLine(commandLine, {
    flags: ['--both', '--dry-run'],
    maxPositionals: 2,
    usage: 'expected <type> [topic].',
  });
  return {
    type: parsed.positionals[0],
    topic: parsed.positionals[1],
    createInSibling: parsed.createInSibling,
    siblingPath: parsed.siblingPath,
    dryRun: parsed.flags.has('--dry-run'),
    help: parsed.help,
  };
}

/**
 * Checks the type and topic of a new iteration.
 *
 * @param {{ type: string | undefined, topic: string | undefined }} request
 * @returns {{ type: string, topic: string | undefined }}
 * @throws when the type is unknown, a launch is given a topic, any other type has no topic, or the
 *   topic is not lowercase kebab-case words without digits
 */
export function validateTypeAndTopic({ type, topic }) {
  if (type === undefined || !ITERATION_TYPES.includes(type)) {
    throw new Error(
      `Unknown type "${type ?? ''}" — use ${ITERATION_TYPES.join(', ')}. Usage: pnpm iteration:new <type> [topic]`,
    );
  }
  if (type === 'launch') {
    if (topic !== undefined)
      throw new Error('launch takes no topic: pnpm iteration:new launch');
    return { type, topic: undefined };
  }
  if (topic === undefined)
    throw new Error(
      `${type} needs a topic, e.g. pnpm iteration:new ${type} pharmacy-returns`,
    );
  if (!TOPIC_PATTERN.test(topic)) {
    throw new Error(
      `Topic "${topic}" must be lowercase kebab-case words with no digits (e.g. pharmacy-returns).`,
    );
  }
  return { type, topic };
}

/**
 * Builds `<type>-<topic>-<YYYY-MM-DD>-<id>` (no topic segment for a launch).
 *
 * @param {{ type: string, topic: string | undefined, opened: string, id: string }} parts
 */
export function buildIterationName({ type, topic, opened, id }) {
  return `${type}${topic === undefined ? '' : `-${topic}`}-${opened}-${id}`;
}

/** Four random lowercase letters — the `<id>` that keeps names unique across people. */
export function randomIterationId() {
  let id = '';
  for (let position = 0; position < ID_LENGTH; position += 1)
    id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}

/**
 * Fills `{{placeholder}}` slots in a template.
 *
 * @param {{ template: string, values: Readonly<Record<string, string>> }} source
 * @throws when the template names a placeholder `values` does not supply, so a renamed field can
 *   never ship as a literal `{{field}}`
 */
export function renderTemplate({ template, values }) {
  return template.replace(TEMPLATE_PLACEHOLDER, (_placeholder, key) => {
    const value = values[key];
    if (value === undefined)
      throw new Error(`Template placeholder {{${key}}} has no value.`);
    return value;
  });
}

/** Reads the README template (byte-identical to clinozy-be's). */
export function readReadmeTemplate() {
  return readFileSync(join(TEMPLATES_DIRECTORY, 'README.md'), 'utf-8');
}

/**
 * Renders an iteration's `README.md` from the template.
 *
 * @param {{ name: string, fields: Record<string, string> }} readme
 */
export function renderIterationReadme({ name, fields }) {
  return renderTemplate({ template: readReadmeTemplate(), values: { name, ...fields } });
}

/**
 * The trunk iterations merge into, from `git.defaultBranch` in `tooling/setup/setup.config.json`.
 *
 * @throws when the config has no default branch
 */
export function configuredBaseBranch() {
  const { defaultBranch } = loadSetupConfig();
  if (!defaultBranch)
    throw new Error('tooling/setup/setup.config.json has no git.defaultBranch.');
  return defaultBranch;
}

/**
 * Iteration folder names committed on `baseBranch`; empty when the branch does not exist.
 *
 * @param {{ repositoryRoot: string, baseBranch: string }} location
 * @returns {string[]}
 */
export function baseBranchIterationNames({ repositoryRoot, baseBranch }) {
  const listing = tryGit(repositoryRoot, [
    'ls-tree',
    '-d',
    '--name-only',
    baseBranch,
    '--',
    `${ITERATIONS_DIRECTORY}/`,
  ]);
  if (!listing) return [];
  return listing
    .split('\n')
    .map((path) => path.slice(ITERATIONS_DIRECTORY.length + 1))
    .filter((name) => parseIterationName(name) !== undefined);
}

function pickUniqueName({ type, topic, opened, takenNames, folderExists, nextId }) {
  for (let attempt = 0; attempt < MAXIMUM_NAME_ATTEMPTS; attempt += 1) {
    const name = buildIterationName({ type, topic, opened, id: nextId() });
    if (!(takenNames.has(name) || folderExists(name))) return name;
  }
  throw new Error(
    `No free iteration name after ${MAXIMUM_NAME_ATTEMPTS} attempts — run it again.`,
  );
}

/** `none` for the launch; otherwise the repository's suggestion, or `—` until the user confirms one. */
function suggestedBaseline({ repositoryRoot, type }) {
  if (type === 'launch') return NO_BASELINE;
  return suggestBaseline({ repositoryRoot }) ?? EMPTY_FIELD;
}

/**
 * Decides everything `pnpm iteration:new` will do, without writing anything.
 *
 * Validates type and topic; collects the iterations already known (this working tree, the base
 * branch, and the sibling's working tree under `--both`); refuses a second launch and any
 * non-launch before an iteration exists; draws a name with a fresh random id, retrying while it is
 * taken; suggests each repository's Baseline from its own iterations; reads Owner and Branch from
 * git; renders the README for this repository and, under `--both`, the sibling.
 *
 * @param {{ repositoryRoot: string, baseBranch: string, type: string | undefined, topic: string | undefined, siblingRoot: string | undefined, today?: string, nextId?: () => string }} request
 * @throws with a terminal-ready message on any refusal, a missing `user.name` or a detached HEAD
 */
export function planNewIteration(request) {
  const { repositoryRoot, baseBranch, siblingRoot } = request;
  const { type, topic } = validateTypeAndTopic(request);
  const localNames = workingTreeIterationNames(repositoryRoot);
  const baseNames = baseBranchIterationNames({ repositoryRoot, baseBranch });
  const siblingNames =
    siblingRoot === undefined ? [] : workingTreeIterationNames(siblingRoot);
  const knownNames = new Set([...localNames, ...baseNames, ...siblingNames]);

  const existingLaunch = [...knownNames].find(
    (name) => parseIterationName(name)?.type === 'launch',
  );
  if (type === 'launch' && existingLaunch !== undefined) {
    throw new Error(
      `A launch already exists (${existingLaunch}) — there is only ever one launch; open a feat, change or fix instead.`,
    );
  }
  if (type !== 'launch' && localNames.length + baseNames.length === 0) {
    throw new Error(
      'No iteration exists yet — open the launch first: pnpm iteration:new launch',
    );
  }

  const opened = request.today ?? localDate(new Date());
  const name = pickUniqueName({
    type,
    topic,
    opened,
    takenNames: knownNames,
    folderExists: (candidate) =>
      existsSync(join(repositoryRoot, ITERATIONS_DIRECTORY, candidate)) ||
      (siblingRoot !== undefined &&
        existsSync(join(siblingRoot, ITERATIONS_DIRECTORY, candidate))),
    nextId: request.nextId ?? randomIterationId,
  });
  const owner = gitUserName(repositoryRoot);
  const branch = tryGit(repositoryRoot, ['branch', '--show-current']) ?? '';
  if (branch === '')
    throw new Error(
      'HEAD is detached — check out the branch this iteration will be built on.',
    );

  const fields = {
    type,
    topic: topic ?? EMPTY_FIELD,
    owner,
    opened,
    branch,
    baseline: suggestedBaseline({ repositoryRoot, type }),
    status: INITIAL_ITERATION_STATUS,
    summary: EMPTY_FIELD,
    dropPlaced: EMPTY_FIELD,
    dropSource: EMPTY_FIELD,
    schemaRoutes: EMPTY_FIELD,
  };
  const localFolder = join(repositoryRoot, ITERATIONS_DIRECTORY, name);
  const files = [
    {
      path: join(localFolder, 'README.md'),
      content: renderIterationReadme({ name, fields }),
    },
  ];
  const warnings = [];
  let siblingFolder;
  let siblingBaseline;
  if (siblingRoot !== undefined) {
    siblingFolder = join(siblingRoot, ITERATIONS_DIRECTORY, name);
    siblingBaseline = suggestedBaseline({ repositoryRoot: siblingRoot, type });
    files.push({
      path: join(siblingFolder, 'README.md'),
      content: renderIterationReadme({
        name,
        fields: { ...fields, baseline: siblingBaseline },
      }),
    });
    const siblingTemplate = join(siblingRoot, SIBLING_README_TEMPLATE);
    if (
      existsSync(siblingTemplate) &&
      readFileSync(siblingTemplate, 'utf-8') !== readReadmeTemplate()
    ) {
      warnings.push(
        `The README templates of ${basename(repositoryRoot)} and ${basename(siblingRoot)} differ — they must stay byte-identical.`,
      );
    }
  }
  return {
    name,
    fields,
    localFolder,
    siblingRoot,
    siblingFolder,
    siblingBaseline,
    files,
    warnings,
  };
}

/**
 * Writes planned files, refusing to overwrite.
 *
 * @param {{ files: readonly { path: string, content: string }[] }} plan
 * @throws before writing anything if any planned file already exists
 */
export function writeIterationPlan(plan) {
  const existing = plan.files.find((file) => existsSync(file.path));
  if (existing !== undefined)
    throw new Error(`${existing.path} already exists — not overwriting.`);
  for (const file of plan.files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content);
  }
}

function describePlan(plan, repositoryRoot) {
  const workspace = resolve(repositoryRoot, '..');
  const suggested =
    plan.fields.type === 'launch' ? '' : ' (suggested — confirm it at planning Step 0)';
  return [
    `Iteration: ${plan.name}`,
    `Baseline:  ${plan.fields.baseline}${suggested}`,
    ...(plan.siblingRoot === undefined
      ? []
      : [`           ${basename(plan.siblingRoot)}: ${plan.siblingBaseline}`]),
    `Owner:     ${plan.fields.owner} · Branch: ${plan.fields.branch} · Opened: ${plan.fields.opened}`,
    'Files:',
    ...plan.files.map((file) => `  ${relative(workspace, file.path)}`),
    ...plan.warnings.map((warning) => `! ${warning}`),
  ];
}

function nextSteps(plan) {
  const both = plan.siblingRoot === undefined ? '' : ' --both';
  return [
    'Next:',
    `  1. Write the Summary line in ${ITERATIONS_DIRECTORY}/${plan.name}/README.md.`,
    `  2. Place the full drop: pnpm iteration:intake ${plan.name} <drop-folder>${both}`,
    `  3. Say "plan iteration ${plan.name}" — fe-iteration-planning confirms the Baseline and writes KICKOFF.md.`,
  ];
}

/**
 * Runs `pnpm iteration:new` and returns what to print. Errors propagate as exceptions whose
 * message is meant for the terminal.
 *
 * @param {readonly string[]} commandLine
 * @param {{ repositoryRoot?: string, baseBranch?: string, today?: string, nextId?: () => string }} [context]
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runNewIteration(commandLine, context = {}) {
  const options = parseNewIterationArguments(commandLine);
  if (options.help || options.type === undefined)
    return { exitCode: options.help ? 0 : 1, lines: [USAGE] };
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  const plan = planNewIteration({
    repositoryRoot,
    baseBranch: context.baseBranch ?? configuredBaseBranch(),
    type: options.type,
    topic: options.topic,
    siblingRoot: options.createInSibling
      ? resolveSiblingRoot({ repositoryRoot, siblingPath: options.siblingPath })
      : undefined,
    today: context.today,
    nextId: context.nextId,
  });
  if (options.dryRun)
    return {
      exitCode: 0,
      lines: ['Dry run — nothing written.', ...describePlan(plan, repositoryRoot)],
    };
  writeIterationPlan(plan);
  return {
    exitCode: 0,
    lines: ['Created.', ...describePlan(plan, repositoryRoot), '', ...nextSteps(plan)],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { exitCode, lines } = runNewIteration(process.argv.slice(2));
    console.log(lines.join('\n'));
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
