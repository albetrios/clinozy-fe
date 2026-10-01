#!/usr/bin/env node
/**
 * pnpm iteration:new — open a design-iteration folder.
 *
 * Usage:
 *   pnpm iteration:new launch
 *   pnpm iteration:new <feat|change|fix> <topic> [--both] [--sibling <path>] [--dry-run]
 *
 * Creates `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/` with README.md (Owner, Opened,
 * Branch, Baseline, Status filled in), PRD.md and schema-routes.md. `--both` also creates
 * the same folder in the sibling repository (clinozy-be) with README.md, PRD.md,
 * schema-routes.md and plans/product-plan.md. The model: iterations/README.md.
 *
 * clinozy-be's `tooling/iterations/iteration.util.ts` implements the same rules, and the
 * templates in `templates/` are byte-identical to its own, so `--both` writes the same
 * files from either repository.
 */
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSetupConfig } from '../setup/github/setup-config.mjs';
import {
  EMPTY_FIELD,
  ITERATION_TYPES,
  ITERATIONS_DIRECTORY,
  parseIterationName,
  parseIterationReadme,
  workingTreeIterationNames,
} from './list-iterations.mjs';

/** Status a freshly opened iteration starts in (`planning` → `building` → `frozen`). */
export const INITIAL_ITERATION_STATUS = 'planning';

/** Baseline recorded for the launch, the only iteration that builds on nothing. */
export const NO_BASELINE = 'none';

/** Maximum random ids tried before giving up on a unique name. */
export const MAXIMUM_NAME_ATTEMPTS = 20;

/** Templates written into this repository's iteration folder (relative to `templates/`). */
export const LOCAL_ITERATION_TEMPLATES = ['README.md', 'PRD.md', 'schema-routes.md'];

/**
 * Files written into the sibling's folder under `--both`. The first three come from this
 * repository's templates; the product plan is the sibling's own template, read from its
 * `tooling/iterations/templates/` (git cannot hold an empty `plans/`).
 */
export const SIBLING_ITERATION_TEMPLATES = [
  ...LOCAL_ITERATION_TEMPLATES,
  'plans/product-plan.md',
];

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');
const TEMPLATES_DIRECTORY = join(import.meta.dirname, 'templates');
const SIBLING_TEMPLATES_DIRECTORY = join('tooling', 'iterations', 'templates');
const TOPIC_PATTERN = /^[a-z]+(?:-[a-z]+)*$/;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 4;
const TEMPLATE_PLACEHOLDER = /\{\{(\w+)\}\}/g;
const LOCAL_PACKAGE_SUFFIX = '-fe';
const SIBLING_PACKAGE_SUFFIX = '-be';

/**
 * Variables git exports into the hooks it runs. They take precedence over `cwd`, so a
 * child `git` launched from inside a hook would read the hook's repository instead of the
 * one it was pointed at; every git call here drops them.
 */
const INHERITED_GIT_REPOSITORY_VARIABLES = [
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_WORK_TREE',
  'GIT_PREFIX',
  'GIT_OBJECT_DIRECTORY',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
];

const USAGE = `Usage:
  pnpm iteration:new launch
  pnpm iteration:new <feat|change|fix> <topic> [--both] [--sibling <path>] [--dry-run]

  --both            also create the folder in the sibling repository (clinozy-be)
  --sibling <path>  sibling repository path (default: ../<package name with -fe → -be>)
  --dry-run         print what would be created; write nothing`;

/**
 * Parses `<type> [topic] [--both] [--sibling <path>] [--dry-run]`. `--sibling` implies
 * `--both`.
 *
 * @param {readonly string[]} commandLine
 * @returns {{ type: string | undefined, topic: string | undefined, createInSibling: boolean, siblingPath: string | undefined, dryRun: boolean, help: boolean }}
 * @throws on an unknown flag, a `--sibling` without a path, or a third positional
 */
export function parseNewIterationArguments(commandLine) {
  const positionals = [];
  let createInSibling = false;
  let siblingPath;
  let dryRun = false;
  let help = false;
  for (let index = 0; index < commandLine.length; index += 1) {
    const token = commandLine[index];
    if (token === '--both') createInSibling = true;
    else if (token === '--dry-run') dryRun = true;
    else if (token === '--help' || token === '-h') help = true;
    else if (token === '--sibling') {
      siblingPath = commandLine[index + 1];
      if (siblingPath === undefined || siblingPath.startsWith('--')) {
        throw new Error('--sibling needs a path, e.g. --sibling ../clinozy-be');
      }
      createInSibling = true;
      index += 1;
    } else if (token.startsWith('-')) throw new Error(`Unknown option "${token}".`);
    else positionals.push(token);
  }
  if (positionals.length > 2) {
    throw new Error(
      `Too many arguments: ${positionals.join(' ')} — expected <type> [topic].`,
    );
  }
  return {
    type: positionals[0],
    topic: positionals[1],
    createInSibling,
    siblingPath,
    dryRun,
    help,
  };
}

/**
 * Checks the type and topic of a new iteration.
 *
 * @param {{ type: string | undefined, topic: string | undefined }} request
 * @returns {{ type: string, topic: string | undefined }}
 * @throws when the type is unknown, a launch is given a topic, any other type has no
 *   topic, or the topic is not lowercase kebab-case words without digits
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
  if (topic === undefined) {
    throw new Error(
      `${type} needs a topic, e.g. pnpm iteration:new ${type} pharmacy-returns`,
    );
  }
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
  const topicSegment = topic === undefined ? '' : `-${topic}`;
  return `${type}${topicSegment}-${opened}-${id}`;
}

/** Four random lowercase letters — the `<id>` that keeps names unique across people. */
export function randomIterationId() {
  let id = '';
  for (let position = 0; position < ID_LENGTH; position += 1) {
    id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  }
  return id;
}

/**
 * Formats a date as local `YYYY-MM-DD` — the day as the person opening the iteration
 * sees it.
 *
 * @param {Date} date
 */
export function localDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Fills `{{placeholder}}` slots in a template.
 *
 * @param {{ template: string, values: Readonly<Record<string, string>> }} source
 * @throws when the template names a placeholder `values` does not supply, so a renamed
 *   field can never ship as a literal `{{field}}`
 */
export function renderTemplate({ template, values }) {
  return template.replace(TEMPLATE_PLACEHOLDER, (_placeholder, key) => {
    const value = values[key];
    if (value === undefined)
      throw new Error(`Template placeholder {{${key}}} has no value.`);
    return value;
  });
}

/**
 * Reads a template, by default from this repository's `tooling/iterations/templates/`.
 *
 * @param {string} relativePath
 * @param {string} [templatesDirectory]
 */
export function readIterationTemplate(
  relativePath,
  templatesDirectory = TEMPLATES_DIRECTORY,
) {
  return readFileSync(join(templatesDirectory, relativePath), 'utf-8');
}

/**
 * Renders an iteration's `README.md` from the README template.
 *
 * @param {{ name: string, fields: Record<string, string> }} readme
 */
export function renderIterationReadme({ name, fields }) {
  return renderTemplate({
    template: readIterationTemplate('README.md'),
    values: { name, ...fields },
  });
}

/** `process.env` without the variables that would pin a child `git` to another repository. */
export function gitEnvironment() {
  const environment = { ...process.env };
  for (const variable of INHERITED_GIT_REPOSITORY_VARIABLES) delete environment[variable];
  return environment;
}

function runGit(repositoryRoot, gitArguments) {
  return execFileSync('git', gitArguments, {
    cwd: repositoryRoot,
    encoding: 'utf-8',
    env: gitEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryGit(repositoryRoot, gitArguments) {
  try {
    return runGit(repositoryRoot, gitArguments);
  } catch {
    return undefined;
  }
}

/**
 * The trunk iterations merge into, from `git.defaultBranch` in
 * `tooling/setup/setup.config.json` — never a hardcoded name.
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
    .filter((name) => parseIterationName(name) !== undefined)
    .sort((left, right) => left.localeCompare(right));
}

function openedDate(name, readme) {
  const fromReadme =
    readme === undefined ? undefined : parseIterationReadme(readme).get('Opened');
  return fromReadme ?? parseIterationName(name)?.opened ?? '';
}

function lastCommitTime(repositoryRoot, revision, name) {
  const timestamp = tryGit(repositoryRoot, [
    'log',
    '-1',
    '--format=%ct',
    revision,
    '--',
    `${ITERATIONS_DIRECTORY}/${name}`,
  ]);
  return timestamp ? Number(timestamp) : 0;
}

/**
 * Picks the Baseline among candidates: the latest Opened date, then the newest last commit
 * (merge order), then the name — so the choice is deterministic.
 *
 * @param {readonly { name: string, opened: string, lastCommitTime: number }[]} candidates
 * @returns {string | undefined}
 */
export function chooseBaseline(candidates) {
  const ranked = [...candidates].sort(
    (left, right) =>
      right.opened.localeCompare(left.opened) ||
      right.lastCommitTime - left.lastCommitTime ||
      right.name.localeCompare(left.name),
  );
  return ranked[0]?.name;
}

/**
 * Resolves the Baseline for a new non-launch iteration: the iterations committed on the
 * base branch, ranked by {@link chooseBaseline} with Opened read from each README as
 * committed there. While the base branch holds none, the working tree's iterations are
 * ranked the same way and `onBaseBranch` is false, so the caller can say so.
 *
 * @param {{ repositoryRoot: string, baseBranch: string }} location
 * @returns {{ baseline: string, onBaseBranch: boolean } | undefined} `undefined` when no
 *   iteration exists anywhere
 */
export function resolveBaseline({ repositoryRoot, baseBranch }) {
  const onBase = baseBranchIterationNames({ repositoryRoot, baseBranch }).map((name) => ({
    name,
    opened: openedDate(
      name,
      tryGit(repositoryRoot, [
        'show',
        `${baseBranch}:${ITERATIONS_DIRECTORY}/${name}/README.md`,
      ]),
    ),
    lastCommitTime: lastCommitTime(repositoryRoot, baseBranch, name),
  }));
  const fromBase = chooseBaseline(onBase);
  if (fromBase !== undefined) return { baseline: fromBase, onBaseBranch: true };

  const inWorkingTree = workingTreeIterationNames(repositoryRoot).map((name) => {
    const readmePath = join(repositoryRoot, ITERATIONS_DIRECTORY, name, 'README.md');
    return {
      name,
      opened: openedDate(
        name,
        existsSync(readmePath) ? readFileSync(readmePath, 'utf-8') : undefined,
      ),
      lastCommitTime: lastCommitTime(repositoryRoot, 'HEAD', name),
    };
  });
  const fromWorkingTree = chooseBaseline(inWorkingTree);
  return fromWorkingTree === undefined
    ? undefined
    : { baseline: fromWorkingTree, onBaseBranch: false };
}

/**
 * Maps a `-fe` package name to its `-be` sibling (`clinozy-fe` → `clinozy-be`).
 *
 * @param {string} packageName
 * @throws when the name does not end in `-fe`
 */
export function siblingPackageName(packageName) {
  if (!packageName.endsWith(LOCAL_PACKAGE_SUFFIX)) {
    throw new Error(
      `package.json name "${packageName}" does not end in ${LOCAL_PACKAGE_SUFFIX} — pass --sibling <path>.`,
    );
  }
  return `${packageName.slice(0, -LOCAL_PACKAGE_SUFFIX.length)}${SIBLING_PACKAGE_SUFFIX}`;
}

/**
 * Resolves the sibling repository for `--both`: `--sibling <path>` (against the repository
 * root) wins; otherwise `../<name>` with this repository's `package.json` name mapped
 * `-fe` → `-be`.
 *
 * @param {{ repositoryRoot: string, siblingPath: string | undefined }} location
 * @throws when that folder has no `package.json`, so a typo never creates a stray
 *   `iterations/` folder somewhere else on disk
 */
export function resolveSiblingRoot({ repositoryRoot, siblingPath }) {
  let siblingRoot;
  if (siblingPath === undefined) {
    const packageJson = JSON.parse(
      readFileSync(join(repositoryRoot, 'package.json'), 'utf-8'),
    );
    siblingRoot = resolve(
      repositoryRoot,
      '..',
      siblingPackageName(packageJson.name ?? ''),
    );
  } else {
    siblingRoot = resolve(repositoryRoot, siblingPath);
  }
  if (!existsSync(join(siblingRoot, 'package.json'))) {
    throw new Error(
      `Sibling repository not found at ${siblingRoot} — clone it there or pass --sibling <path>.`,
    );
  }
  return siblingRoot;
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

/**
 * Decides everything `pnpm iteration:new` will do, without writing anything.
 *
 * Validates type and topic; collects the iterations already known (this working tree, the
 * base branch, and the sibling's working tree under `--both`); refuses a second launch and
 * any non-launch before a launch exists; draws a name with a fresh random id, retrying
 * while it is taken; resolves the Baseline; reads Owner (`git config user.name`) and Branch
 * (the current branch); renders the templates for this repository and, under `--both`,
 * the sibling. The README is identical in both.
 *
 * @param {{ repositoryRoot: string, baseBranch: string, type: string | undefined, topic: string | undefined, siblingRoot: string | undefined, today?: string, nextId?: () => string }} request
 * @throws with a terminal-ready message on any refusal, a missing `user.name`, a detached
 *   HEAD, or a sibling without the product-plan template
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

  const resolved =
    type === 'launch' ? undefined : resolveBaseline({ repositoryRoot, baseBranch });
  const owner = tryGit(repositoryRoot, ['config', 'user.name']) ?? '';
  if (owner === '')
    throw new Error('git config user.name is not set — it fills the Owner field.');
  const branch = tryGit(repositoryRoot, ['branch', '--show-current']) ?? '';
  if (branch === '') {
    throw new Error(
      'HEAD is detached — check out the branch this iteration will be built on.',
    );
  }

  const fields = {
    type,
    topic: topic ?? EMPTY_FIELD,
    owner,
    opened,
    branch,
    baseline: resolved?.baseline ?? NO_BASELINE,
    status: INITIAL_ITERATION_STATUS,
    summary: EMPTY_FIELD,
  };
  const values = { name, ...fields };
  const render = (relativePaths, folder, templatesDirectory) =>
    relativePaths.map((relativePath) => ({
      path: join(folder, relativePath),
      content: renderTemplate({
        template: readIterationTemplate(relativePath, templatesDirectory(relativePath)),
        values,
      }),
    }));

  const localFolder = join(repositoryRoot, ITERATIONS_DIRECTORY, name);
  const siblingFolder =
    siblingRoot === undefined ? undefined : join(siblingRoot, ITERATIONS_DIRECTORY, name);
  if (siblingRoot !== undefined) {
    const productPlan = join(
      siblingRoot,
      SIBLING_TEMPLATES_DIRECTORY,
      'plans/product-plan.md',
    );
    if (!existsSync(productPlan)) {
      throw new Error(
        `${productPlan} not found — update ${basename(siblingRoot)}; its iteration generator owns that template.`,
      );
    }
  }
  const siblingTemplates = (relativePath) =>
    LOCAL_ITERATION_TEMPLATES.includes(relativePath)
      ? TEMPLATES_DIRECTORY
      : join(siblingRoot, SIBLING_TEMPLATES_DIRECTORY);

  return {
    name,
    fields,
    baselineOnBaseBranch: resolved?.onBaseBranch ?? true,
    localFolder,
    siblingRoot,
    siblingFolder,
    files: [
      ...render(LOCAL_ITERATION_TEMPLATES, localFolder, () => TEMPLATES_DIRECTORY),
      ...(siblingFolder === undefined
        ? []
        : render(SIBLING_ITERATION_TEMPLATES, siblingFolder, siblingTemplates)),
    ],
  };
}

/**
 * Writes the files of a plan from {@link planNewIteration}.
 *
 * @param {{ files: readonly { path: string, content: string }[] }} plan
 * @throws before writing anything if any planned file already exists — it never overwrites
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

function describePlan(plan, baseBranch, repositoryRoot) {
  const baselineNote = plan.baselineOnBaseBranch ? '' : ` (not on ${baseBranch} yet)`;
  const workspace = resolve(repositoryRoot, '..');
  return [
    `Iteration: ${plan.name}`,
    `Baseline:  ${plan.fields.baseline}${baselineNote}`,
    `Owner:     ${plan.fields.owner} · Branch: ${plan.fields.branch} · Opened: ${plan.fields.opened}`,
    'Files:',
    ...plan.files.map((file) => `  ${relative(workspace, file.path)}`),
  ];
}

function nextSteps(plan) {
  const folder = `${ITERATIONS_DIRECTORY}/${plan.name}`;
  const launch = plan.fields.type === 'launch';
  return [
    'Next:',
    `  1. Write the Summary line in ${folder}/README.md.`,
    `  2. Write ${folder}/PRD.md — ${launch ? 'the whole product' : 'only the changed screens, flows and data'}.`,
    `  3. Generate schema-routes.md from docs/design-workflow/prompts/schema-routes-prompt.md (SCOPE = ${launch ? 'every screen' : 'the changed screens'}), save it over ${folder}/schema-routes.md, and copy it byte-for-byte into the clinozy-be folder of the same name when the backend changes.`,
    `  4. Save ${launch ? 'the prototype and every screen spec' : 'the changed screens’ specs (and their prototype, if any)'} from Claude Design into ${folder}/.`,
    `  5. Say "kickoff ${plan.name}" — fe-kickoff-planning writes ${folder}/KICKOFF.md.`,
    ...(plan.siblingRoot === undefined
      ? []
      : [
          `  6. Work in ${basename(plan.siblingRoot)} on the same branch (${plan.fields.branch}), starting from its ${folder}/plans/product-plan.md.`,
        ]),
  ];
}

/**
 * Runs `pnpm iteration:new` and returns what to print. Errors propagate as exceptions
 * whose message is meant for the terminal.
 *
 * @param {readonly string[]} commandLine
 * @param {{ repositoryRoot?: string, baseBranch?: string, today?: string, nextId?: () => string }} [context]
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function runNewIteration(commandLine, context = {}) {
  const options = parseNewIterationArguments(commandLine);
  if (options.help || options.type === undefined) {
    return { exitCode: options.help ? 0 : 1, lines: [USAGE] };
  }
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  const baseBranch = context.baseBranch ?? configuredBaseBranch();
  const plan = planNewIteration({
    repositoryRoot,
    baseBranch,
    type: options.type,
    topic: options.topic,
    siblingRoot: options.createInSibling
      ? resolveSiblingRoot({ repositoryRoot, siblingPath: options.siblingPath })
      : undefined,
    today: context.today,
    nextId: context.nextId,
  });
  if (options.dryRun) {
    return {
      exitCode: 0,
      lines: [
        'Dry run — nothing written.',
        ...describePlan(plan, baseBranch, repositoryRoot),
      ],
    };
  }
  writeIterationPlan(plan);
  return {
    exitCode: 0,
    lines: [
      'Created.',
      ...describePlan(plan, baseBranch, repositoryRoot),
      '',
      ...nextSteps(plan),
    ],
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
