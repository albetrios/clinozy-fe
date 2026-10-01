/**
 * Design-iteration model behind the `pnpm iteration:*` commands: names, the README field table
 * and its History, the Status lifecycle, the intake's required set, the Baseline suggestion and the
 * sibling repository. The rules: iterations/README.md.
 *
 * clinozy-be's `tooling/iterations/iteration.util.ts` implements the same rules, and the README
 * template is byte-identical to its own, so an iteration reads the same in both repositories.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** The four iteration types, in the order the docs list them. */
export const ITERATION_TYPES = ['launch', 'feat', 'change', 'fix'];

/** README Status values, in lifecycle order. */
export const ITERATION_STATUSES = [
  'planning',
  'ready-for-approval',
  'approved',
  'implementing',
  'done',
  'frozen',
];

/** Status a freshly opened iteration starts in. */
export const INITIAL_ITERATION_STATUS = 'planning';

/** Statuses from which `intake-files/` is locked — the approved plan rests on it. */
export const LOCKED_INTAKE_STATUSES = new Set([
  'approved',
  'implementing',
  'done',
  'frozen',
]);

/** Folder (relative to a repository root) that holds every iteration. */
export const ITERATIONS_DIRECTORY = 'iterations';

/** Folder inside an iteration holding the files received from outside, exactly as delivered. */
export const INTAKE_DIRECTORY = 'intake-files';

/** Baseline of an initial iteration — the first one in a repository. */
export const NO_BASELINE = 'none';

/** Placeholder for an empty README field. */
export const EMPTY_FIELD = '—';

/** Hex characters of the sha256 shown for `schema-routes.md` (the same in both repositories). */
export const SCHEMA_ROUTES_HASH_LENGTH = 12;

/** README field labels, in table order — the template lists exactly these rows. */
export const README_FIELD_LABELS = [
  'Type',
  'Topic',
  'Owner',
  'Opened',
  'Branch',
  'Baseline',
  'Status',
  'Summary',
  'Drop placed',
  'Drop source',
  'Schema-routes',
];

/** Files every frontend drop must contain, besides the screens `_index.md` lists and the prototype. */
export const REQUIRED_INTAKE_FILES = [
  'PRD.md',
  'schema-routes.md',
  '_index.md',
  'preset.md',
  'shell.md',
];

/** Name patterns a drop may also contain without a warning. */
const OPTIONAL_INTAKE_PATTERNS = [
  /^_[a-z][a-z-]*\.md$/, // shared files: _patterns.md, _report.md
  /^design-brief[a-z-]*\.md$/,
  /^(auth|public)[a-z-]*\.md$/,
  /^(system-surfaces?|overlays?|loading)[a-z-]*\.md$/,
  /^preset\.json$/,
  /^design-overview\.md$/,
];

const ITERATION_NAME_PATTERN = new RegExp(
  `^(${ITERATION_TYPES.join('|')})(?:-([a-z]+(?:-[a-z]+)*))?-(\\d{4}-\\d{2}-\\d{2})-([a-z]{4})$`,
);
const FIELD_LABEL = /^[A-Za-z][A-Za-z -]*$/;
const HISTORY_HEADING = '## History';
const FINISHED_ENTRY = /^- (\d{4}-\d{2}-\d{2}) · \S+ → (done|frozen) · /;
const SCRIPT_SOURCE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
const EXTERNAL_SOURCE = /^(?:[a-z]+:|\/\/|\/)/i;
const BASELINE_STATUSES = new Set(['done', 'frozen']);
const SIBLING_SUFFIXES = { '-fe': '-be', '-be': '-fe' };

/** Forward Status moves: one step along the lifecycle at a time. */
const FORWARD_TRANSITIONS = new Map([
  ['planning', 'ready-for-approval'],
  ['ready-for-approval', 'approved'],
  ['approved', 'implementing'],
  ['implementing', 'done'],
  ['done', 'frozen'],
]);

/** Statuses that may move back to `planning` — only with a reason. */
const BACK_TO_PLANNING = new Set(['ready-for-approval', 'approved', 'implementing']);

/**
 * Variables git exports into the hooks it runs. They take precedence over `cwd`, so a child
 * `git` launched from inside a hook would read the hook's repository instead of the one it was
 * pointed at; every git call here drops them.
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

// ── names ────────────────────────────────────────────────────────────────────

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
 * Formats a date as local `YYYY-MM-DD` — the day as the person running the command sees it.
 *
 * @param {Date} date
 */
export function localDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// ── README ───────────────────────────────────────────────────────────────────

/**
 * Reads the field table of an iteration's `README.md` into a label → value map.
 *
 * Only two-cell `| Label | Value |` rows count, where the label is words (letters, spaces,
 * hyphens); the header row (`Field`) and the separator are skipped.
 *
 * @param {string} markdown
 * @returns {Map<string, string>}
 */
export function parseIterationReadme(markdown) {
  const fields = new Map();
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (line.length < 2 || !line.startsWith('|') || !line.endsWith('|')) continue;
    const cells = line.slice(1, -1).split('|');
    if (cells.length !== 2) continue;
    const label = cells[0].trim();
    if (!FIELD_LABEL.test(label) || label === 'Field') continue;
    fields.set(label, cells[1].trim());
  }
  return fields;
}

/**
 * Sets one row of a README field table, keeping every other line as it is.
 *
 * @param {{ readme: string, label: string, value: string }} update
 * @throws when the README has no `| <label> | … |` row, or the value would break the table
 */
export function setReadmeField({ readme, label, value }) {
  if (/[|\n]/.test(value))
    throw new Error(`A README value cannot hold "|" or a line break: ${value}`);
  const lines = readme.split('\n');
  const index = lines.findIndex((line) => {
    const cells = line.trim().slice(1, -1).split('|');
    return line.trim().startsWith('|') && cells.length === 2 && cells[0].trim() === label;
  });
  if (index === -1) throw new Error(`The README has no "| ${label} | … |" row.`);
  lines[index] = `| ${label} | ${value} |`;
  return lines.join('\n');
}

/**
 * Formats one History line: `- <date> · <change> · <reason or —> · <who>`, where the change is
 * `<from> → <to>` for a Status move and `Baseline <from> → <to>` for a Baseline change.
 *
 * @param {{ date: string, change: string, reason: string | undefined, owner: string }} entry
 */
export function renderHistoryEntry({ date, change, reason, owner }) {
  const text = reason?.replace(/\s+/g, ' ').trim() || EMPTY_FIELD;
  return `- ${date} · ${change} · ${text} · ${owner}`;
}

/**
 * Appends a line to the README's `## History` list: at the end of that section (before the next
 * `## ` section if one follows), creating the section at the end of the file when it is missing.
 *
 * @param {{ readme: string, historyEntry: string }} update
 */
export function appendHistoryEntry({ readme, historyEntry }) {
  const lines = readme.replace(/\s+$/, '').split('\n');
  const headingIndex = lines.findIndex((line) => line.trim() === HISTORY_HEADING);
  if (headingIndex === -1)
    return `${[...lines, '', HISTORY_HEADING, '', historyEntry].join('\n')}\n`;
  const nextSection = lines.findIndex(
    (line, index) => index > headingIndex && line.startsWith('## '),
  );
  let insertAt = nextSection === -1 ? lines.length : nextSection;
  while (insertAt > headingIndex + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1;
  lines.splice(
    insertAt,
    0,
    ...(insertAt === headingIndex + 1 ? ['', historyEntry] : [historyEntry]),
  );
  return `${lines.join('\n')}\n`;
}

/** @param {{ repositoryRoot: string, iteration: string }} location */
export function iterationFolder({ repositoryRoot, iteration }) {
  return join(repositoryRoot, ITERATIONS_DIRECTORY, iteration);
}

/** @param {{ repositoryRoot: string, iteration: string }} location */
export function intakeFolder({ repositoryRoot, iteration }) {
  return join(repositoryRoot, ITERATIONS_DIRECTORY, iteration, INTAKE_DIRECTORY);
}

/**
 * Reads an iteration's README after checking the name and the file.
 *
 * @param {{ repositoryRoot: string, iteration: string | undefined }} location
 * @returns {{ path: string, content: string, fields: Map<string, string> }}
 * @throws when the name is not an iteration name or the README is missing
 */
export function readIterationReadme({ repositoryRoot, iteration }) {
  const path = join(repositoryRoot, ITERATIONS_DIRECTORY, iteration ?? '', 'README.md');
  if (
    iteration === undefined ||
    parseIterationName(iteration) === undefined ||
    !existsSync(path)
  ) {
    throw new Error(
      `No iteration "${iteration ?? ''}" with a README — see pnpm iteration:list.`,
    );
  }
  const content = readFileSync(path, 'utf-8');
  return { path, content, fields: parseIterationReadme(content) };
}

/**
 * Iteration folder names in a repository's working tree, sorted. Folders outside the name
 * grammar (an old letter-named folder, a stray `notes/`) are not iterations.
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
 * Every working-tree iteration's README text (empty for one without a README).
 *
 * @param {string} repositoryRoot
 * @returns {Map<string, string>}
 */
export function readAllIterationReadmes(repositoryRoot) {
  const all = new Map();
  for (const name of workingTreeIterationNames(repositoryRoot)) {
    const path = join(repositoryRoot, ITERATIONS_DIRECTORY, name, 'README.md');
    all.set(name, existsSync(path) ? readFileSync(path, 'utf-8') : '');
  }
  return all;
}

// ── git ──────────────────────────────────────────────────────────────────────

/** `process.env` without the variables that would pin a child `git` to another repository. */
export function gitEnvironment() {
  const environment = { ...process.env };
  for (const variable of INHERITED_GIT_REPOSITORY_VARIABLES) delete environment[variable];
  return environment;
}

/**
 * Runs a read-only git command and returns its trimmed output, or `undefined` when it fails.
 *
 * @param {string} repositoryRoot
 * @param {readonly string[]} gitArguments
 */
export function tryGit(repositoryRoot, gitArguments) {
  try {
    return execFileSync('git', gitArguments, {
      cwd: repositoryRoot,
      encoding: 'utf-8',
      env: gitEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * `git config user.name` — who owns new iterations and signs History lines.
 *
 * @param {string} repositoryRoot
 * @throws when it is not set
 */
export function gitUserName(repositoryRoot) {
  const owner = tryGit(repositoryRoot, ['config', 'user.name']) ?? '';
  if (owner === '')
    throw new Error('git config user.name is not set — it signs the README.');
  return owner;
}

// ── Status ───────────────────────────────────────────────────────────────────

/**
 * Checks one Status move: one step forward along `planning → ready-for-approval → approved →
 * implementing → done → frozen`, or `ready-for-approval`, `approved` or `implementing` back to
 * `planning` with a reason.
 *
 * @param {{ from: string, to: string, reason: string | undefined }} move
 * @throws with the allowed next statuses on any other move, and on a reasonless move back
 */
export function validateStatusTransition({ from, to, reason }) {
  if (FORWARD_TRANSITIONS.get(from) === to) return;
  if (to === 'planning' && BACK_TO_PLANNING.has(from)) {
    if (reason === undefined || reason.trim() === '') {
      throw new Error(`Moving ${from} → planning needs --reason "<why it goes back>".`);
    }
    return;
  }
  const allowed = [
    ...(FORWARD_TRANSITIONS.has(from) ? [FORWARD_TRANSITIONS.get(from)] : []),
    ...(BACK_TO_PLANNING.has(from) ? ['planning (with --reason)'] : []),
  ];
  throw new Error(
    `Cannot move ${from} → ${to}. From ${from} the allowed next status is ${
      allowed.length === 0
        ? 'none — a frozen iteration is never edited'
        : allowed.join(' or ')
    }.`,
  );
}

// ── intake ───────────────────────────────────────────────────────────────────

/**
 * The Slugs of `_index.md`'s table — the column headed `Slug`.
 *
 * @param {string | undefined} indexMarkdown
 * @returns {string[]}
 */
export function indexSlugs(indexMarkdown) {
  if (indexMarkdown === undefined) return [];
  let slugColumn = -1;
  const slugs = [];
  for (const line of indexMarkdown.split('\n')) {
    const cells = tableCells(line);
    if (cells === undefined) continue;
    const header = cells.findIndex((cell) => cell.toLowerCase() === 'slug');
    if (header !== -1) {
      slugColumn = header;
      continue;
    }
    const slug =
      slugColumn === -1 ? undefined : cells[slugColumn]?.replaceAll('`', '').trim();
    if (slug) slugs.push(slug);
  }
  return slugs;
}

/**
 * The cells of one markdown table row, or `undefined` for a non-row or a separator row.
 *
 * @param {string} line
 * @returns {string[] | undefined}
 */
export function tableCells(line) {
  const trimmed = line.trim();
  if (trimmed.length < 2 || !trimmed.startsWith('|') || !trimmed.endsWith('|'))
    return undefined;
  const cells = trimmed
    .replaceAll('\\|', '\u0000')
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.replaceAll('\u0000', '|').trim());
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell)) ? undefined : cells;
}

/**
 * The local scripts a prototype page loads (`<script src>` that is not a URL or absolute path).
 *
 * @param {string} html
 * @returns {string[]} file names, as the flat intake holds them
 */
export function prototypeScripts(html) {
  const scripts = new Set();
  for (const match of html.matchAll(SCRIPT_SOURCE)) {
    const source = match[1].split(/[?#]/)[0];
    if (!EXTERNAL_SOURCE.test(source) && source.endsWith('.js'))
      scripts.add(basename(source));
  }
  return [...scripts].sort((left, right) => left.localeCompare(right));
}

/**
 * Checks a frontend drop against the required set: `PRD.md`, `schema-routes.md`, `_index.md`,
 * `preset.md`, `shell.md`, one `<slug>.md` per Slug in `_index.md`, a prototype `*.html` and
 * every local `*.js` it loads. Everything else is optional (`_`-prefixed shared files,
 * design-brief / auth / system-surface notes, `preset.json`, `design-overview.md`) or an extra.
 *
 * @param {{ names: readonly string[], readText: (name: string) => string }} drop the flat file
 *   names and a reader for their text
 * @returns {{ missing: string[], extras: string[], unlistedScreens: string[] }} `unlistedScreens`
 *   are `.md` files outside the required and optional sets that `_index.md` does not list
 */
export function checkIntakeSet({ names, readText }) {
  const present = new Set(names);
  const slugs = present.has('_index.md') ? indexSlugs(readText('_index.md')) : [];
  const pages = names.filter((name) => name.endsWith('.html'));
  const scripts = pages.flatMap((page) => prototypeScripts(readText(page)));
  const required = new Set([
    ...REQUIRED_INTAKE_FILES,
    ...slugs.map((slug) => `${slug}.md`),
    ...scripts,
  ]);
  const missing = [...required].filter((name) => !present.has(name));
  if (pages.length === 0) missing.push('a prototype *.html');
  const known = (name) =>
    required.has(name) ||
    name.endsWith('.html') ||
    OPTIONAL_INTAKE_PATTERNS.some((pattern) => pattern.test(name));
  const unknown = names.filter((name) => !known(name));
  return {
    missing: missing.sort((left, right) => left.localeCompare(right)),
    extras: unknown.filter((name) => !name.endsWith('.md')),
    unlistedScreens: unknown.filter((name) => name.endsWith('.md')),
  };
}

/**
 * The flat, visible files of a folder (no subfolders, no dotfiles).
 *
 * @param {string} folder
 * @returns {string[]}
 */
export function flatFileNames(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * The required files an iteration's `intake-files/` is missing — empty when the drop is complete.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 * @returns {string[]}
 */
export function missingIntakeFiles(location) {
  const folder = intakeFolder(location);
  if (!existsSync(folder)) return [`${INTAKE_DIRECTORY}/`];
  return checkIntakeSet({
    names: flatFileNames(folder),
    readText: (name) => readFileSync(join(folder, name), 'utf-8'),
  }).missing;
}

/**
 * Fingerprints a `schema-routes.md`: the first {@link SCHEMA_ROUTES_HASH_LENGTH} hex characters of
 * the sha256 of its bytes, or {@link EMPTY_FIELD} when the file is missing. The same file sits in
 * both repositories, so equal fingerprints mean the copies match.
 *
 * @param {string} path
 */
export function schemaRoutesHash(path) {
  if (!existsSync(path)) return EMPTY_FIELD;
  return createHash('sha256')
    .update(readFileSync(path))
    .digest('hex')
    .slice(0, SCHEMA_ROUTES_HASH_LENGTH);
}

// ── Baseline ─────────────────────────────────────────────────────────────────

/** The date of the last History line that moved an iteration to `done` or `frozen`, if any. */
function finishedDate(readme) {
  let finished = '';
  for (const line of readme.split('\n')) {
    const match = FINISHED_ENTRY.exec(line.trim());
    if (match && match[1] > finished) finished = match[1];
  }
  return finished;
}

/**
 * Suggests a Baseline: the latest `done` or `frozen` iteration in this repository whose
 * `intake-files/` holds the required set — the one that finished last (its latest History move to
 * `done` or `frozen`), then the latest Opened, then the name. The user confirms or picks another at
 * planning Step 0 (`pnpm iteration:baseline`).
 *
 * @param {{ repositoryRoot: string, excluding?: string }} location
 * @returns {string | undefined} `undefined` when no iteration qualifies
 */
export function suggestBaseline({ repositoryRoot, excluding }) {
  const candidates = [];
  for (const [name, readme] of readAllIterationReadmes(repositoryRoot)) {
    const fields = parseIterationReadme(readme);
    if (name === excluding || !BASELINE_STATUSES.has(fields.get('Status') ?? ''))
      continue;
    if (missingIntakeFiles({ repositoryRoot, iteration: name }).length > 0) continue;
    candidates.push({
      name,
      finished: finishedDate(readme),
      opened: fields.get('Opened') ?? parseIterationName(name)?.opened ?? '',
    });
  }
  candidates.sort(
    (left, right) =>
      right.finished.localeCompare(left.finished) ||
      right.opened.localeCompare(left.opened) ||
      right.name.localeCompare(left.name),
  );
  return candidates[0]?.name;
}

// ── sibling repository ──────────────────────────────────────────────────────

/**
 * Maps a package name to its sibling's (`acme-fe` ↔ `acme-be`).
 *
 * @param {string} packageName
 * @throws when the name ends in neither `-fe` nor `-be`
 */
export function siblingPackageName(packageName) {
  for (const [suffix, siblingSuffix] of Object.entries(SIBLING_SUFFIXES)) {
    if (packageName.endsWith(suffix))
      return `${packageName.slice(0, -suffix.length)}${siblingSuffix}`;
  }
  throw new Error(
    `package.json name "${packageName}" does not end in -fe or -be — pass --sibling <path>.`,
  );
}

/**
 * Resolves the sibling repository for `--both`: `--sibling <path>` (against the repository root)
 * wins; otherwise `../<name>` with this repository's `package.json` name mapped `-fe` ↔ `-be`.
 *
 * @param {{ repositoryRoot: string, siblingPath: string | undefined }} location
 * @throws when that folder has no `package.json`, so a typo never writes into a stray folder
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

/**
 * Parses `--sibling <path>`, `--both` and the given flags out of a command line.
 *
 * @param {readonly string[]} commandLine
 * @param {{ flags: readonly string[], maxPositionals: number, usage: string }} shape
 * @returns {{ positionals: string[], flags: Set<string>, createInSibling: boolean, siblingPath: string | undefined, help: boolean }}
 * @throws on an unknown option, a `--sibling` without a path, or too many positionals
 */
export function parseCommandLine(commandLine, { flags, maxPositionals, usage }) {
  const positionals = [];
  const seen = new Set();
  let createInSibling = false;
  let siblingPath;
  let help = false;
  for (let index = 0; index < commandLine.length; index += 1) {
    const token = commandLine[index];
    if (token === '--help' || token === '-h') help = true;
    else if (token === '--both' && flags.includes('--both')) createInSibling = true;
    else if (token === '--sibling' && flags.includes('--both')) {
      siblingPath = commandLine[index + 1];
      if (siblingPath === undefined || siblingPath.startsWith('--')) {
        throw new Error('--sibling needs a path, e.g. --sibling ../clinozy-be');
      }
      createInSibling = true;
      index += 1;
    } else if (flags.includes(token)) seen.add(token);
    else if (token.startsWith('-')) throw new Error(`Unknown option "${token}".`);
    else positionals.push(token);
  }
  if (positionals.length > maxPositionals) {
    throw new Error(`Too many arguments: ${positionals.join(' ')} — ${usage}`);
  }
  return { positionals, flags: seen, createInSibling, siblingPath, help };
}
