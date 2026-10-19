/**
 * Design-iteration model behind the `pnpm iteration:*` commands: names, the README field table
 * and its History, the Status lifecycle, the intake modes, the snapshot's required set and its
 * Intake hash, the from-scratch default and the sibling repository. The rules: iterations/README.md.
 *
 * clinozy-be's `tooling/iterations/iteration.util.ts` implements the same rules, and the README
 * template is byte-identical to its own, so an iteration reads the same in both repositories.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { gitEnvironmentWithoutInheritedRepository } from '../ci/git-environment.mjs';

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

/**
 * How an iteration is run: `full`, the whole planning procedure with its approval; or `lite`, for a
 * small fix — planned in one step and moved `planning → implementing → done → frozen` (as in
 * clinozy-be).
 */
export const ITERATION_PROCESSES = ['full', 'lite'];

/** The process a README without a Process row runs — every iteration opened before lite mode. */
export const DEFAULT_ITERATION_PROCESS = 'full';

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

/**
 * Baseline of an iteration that starts from scratch — every new iteration's default. Only the
 * user names an earlier iteration as a Baseline (`pnpm iteration:baseline`); nothing suggests one.
 */
export const NO_BASELINE = 'none';

/** Placeholder for an empty README field. */
export const EMPTY_FIELD = '—';

/**
 * Hex characters of the sha256 shown for a fingerprint — the Schema-routes row (`schema-routes.md`)
 * and the Intake hash row (the whole snapshot) — the same in both repositories.
 */
export const FINGERPRINT_LENGTH = 12;

/** README field labels, in table order — the template lists exactly these rows. */
export const README_FIELD_LABELS = [
  'Type',
  'Process',
  'Topic',
  'Owner',
  'Opened',
  'Branch',
  'Baseline',
  'Status',
  'Summary',
  'Drop placed',
  'Drop source',
  'Intake mode',
  'Intake note',
  'Schema-routes',
  'Intake hash',
];

/** README rows an older iteration may lack: a README without a Process row runs `full`. */
export const OPTIONAL_README_FIELDS = new Set(['Process']);

/**
 * How `pnpm iteration:intake` builds the snapshot: `full` — the whole drop as received; `overlay`
 * — the received files laid over the Baseline's snapshot; `brief` — the Baseline's snapshot plus a
 * received `BRIEF.md`, with no other changed file.
 */
export const INTAKE_MODES = ['full', 'overlay', 'brief'];

/** The Intake mode when `--mode` is not given — and always the launch's. */
export const DEFAULT_INTAKE_MODE = 'full';

/** The written change a `brief` intake receives instead of design files. */
export const BRIEF_FILE = 'BRIEF.md';

/** The `## ` sections every `BRIEF.md` has, as in `templates/BRIEF.md`. */
export const BRIEF_SECTIONS = [
  'What changes',
  'Why',
  'Affected screens, entities and routes',
  'Rules',
  'Acceptance criteria',
  'Out of scope',
];

/** Files every frontend snapshot must contain, besides the screens `_index.md` lists and the prototype. */
export const REQUIRED_INTAKE_FILES = [
  'PRD.md',
  'schema-routes.md',
  '_index.md',
  'preset.md',
  'shell.md',
];

/** Name patterns a snapshot may also contain without a warning — mandatory once `_index.md` names them. */
const OPTIONAL_INTAKE_PATTERNS = [
  /^_[a-z][a-z-]*\.md$/, // shared files: _patterns.md, _report.md
  /^design-brief[a-z-]*\.md$/,
  /^(auth|public)[a-z-]*\.md$/,
  /^(system-surfaces?|overlays?|loading)[a-z-]*\.md$/,
  /^preset\.json$/,
  /^design-overview\.md$/,
  /^BRIEF\.md$/, // carried forward from a brief-mode Baseline
];

const ITERATION_NAME_PATTERN = new RegExp(
  `^(${ITERATION_TYPES.join('|')})(?:-([a-z]+(?:-[a-z]+)*))?-(\\d{4}-\\d{2}-\\d{2})-([a-z]{4})$`,
);
const FIELD_LABEL = /^[A-Za-z][A-Za-z -]*$/;
const HISTORY_HEADING = '## History';
const SCRIPT_SOURCE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
const FILE_REFERENCE = /[\w.-]+\.(?:md|json)\b/g;
const EXTERNAL_SOURCE = /^(?:[a-z]+:|\/\/|\/)/i;
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
 * A lite fix's lifecycle: the user's go on the one-step plan moves `planning` straight to
 * `implementing` (no `ready-for-approval` or `approved`).
 */
const LITE_FORWARD_TRANSITIONS = new Map([
  ['planning', 'implementing'],
  ['implementing', 'done'],
  ['done', 'frozen'],
]);

/** The statuses a lite fix may take back to `planning`, with a reason. */
const LITE_BACK_TO_PLANNING = new Set(['implementing', 'done']);

/**
 * The process an iteration runs, from its README's Process row (`full` when the row is missing).
 *
 * @param {ReadonlyMap<string, string>} fields
 * @returns {'full' | 'lite'}
 */
export function recordedProcess(fields) {
  return fields.get('Process') === 'lite' ? 'lite' : DEFAULT_ITERATION_PROCESS;
}

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
      env: gitEnvironmentWithoutInheritedRepository(),
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
 * `planning` with a reason. A `lite` fix moves `planning → implementing → done → frozen`, and
 * `implementing` or `done` back to `planning` with a reason.
 *
 * @param {{ from: string, to: string, reason: string | undefined, process?: 'full' | 'lite' }} move
 * @throws with the allowed next statuses on any other move, and on a reasonless move back
 */
export function validateStatusTransition({ from, to, reason, process: runAs }) {
  const lite = runAs === 'lite';
  const forward = lite ? LITE_FORWARD_TRANSITIONS : FORWARD_TRANSITIONS;
  const backToPlanning = lite ? LITE_BACK_TO_PLANNING : BACK_TO_PLANNING;
  if (forward.get(from) === to) return;
  if (to === 'planning' && backToPlanning.has(from)) {
    if (reason === undefined || reason.trim() === '') {
      throw new Error(`Moving ${from} → planning needs --reason "<why it goes back>".`);
    }
    return;
  }
  const allowed = [
    ...(forward.has(from) ? [forward.get(from)] : []),
    ...(backToPlanning.has(from) ? ['planning (with --reason)'] : []),
  ];
  throw new Error(
    `Cannot move ${from} → ${to}${lite ? ' (a lite fix)' : ''}. From ${from} the allowed next status is ${
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
 * The optional files `_index.md` names (for example "Shared: `_patterns.md`") — those become
 * mandatory, because the screens rely on them.
 *
 * @param {string | undefined} indexMarkdown
 * @returns {string[]}
 */
export function referencedOptionalFiles(indexMarkdown) {
  if (indexMarkdown === undefined) return [];
  const names = new Set();
  for (const [name] of indexMarkdown.matchAll(FILE_REFERENCE)) {
    if (OPTIONAL_INTAKE_PATTERNS.some((pattern) => pattern.test(name))) names.add(name);
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

/**
 * Checks a frontend snapshot against the mandatory set: `PRD.md`, `schema-routes.md`, `_index.md`,
 * `preset.md`, `shell.md`, one `<slug>.md` per Slug in `_index.md`, every optional file
 * `_index.md` names, a prototype `*.html`, every local `*.js` it loads, and `BRIEF.md` in `brief`
 * mode. Everything else is optional (`_`-prefixed shared files, design-brief / auth /
 * system-surface notes, `preset.json`, `design-overview.md`, a carried-forward `BRIEF.md`) or an
 * extra. A brief that starts from scratch (`standalone`: Baseline `none`) has no design files to
 * carry, so its whole mandatory set is `BRIEF.md`.
 *
 * @param {{ names: readonly string[], readText: (name: string) => string, mode?: string, standalone?: boolean }} snapshot
 *   the flat file names, a reader for their text, the Intake mode (default `full`), and whether
 *   it is a brief from scratch
 * @returns {{ missing: string[], extras: string[], unlistedScreens: string[] }} `unlistedScreens`
 *   are `.md` files outside the required and optional sets that `_index.md` does not list
 */
export function checkIntakeSet({
  names,
  readText,
  mode = DEFAULT_INTAKE_MODE,
  standalone = false,
}) {
  if (mode === 'brief' && standalone) {
    const others = names.filter((name) => name !== BRIEF_FILE);
    return {
      missing: names.includes(BRIEF_FILE) ? [] : [BRIEF_FILE],
      extras: others.filter((name) => !name.endsWith('.md')),
      unlistedScreens: others.filter((name) => name.endsWith('.md')),
    };
  }
  const present = new Set(names);
  const index = present.has('_index.md') ? readText('_index.md') : undefined;
  const pages = names.filter((name) => name.endsWith('.html'));
  const scripts = pages.flatMap((page) => prototypeScripts(readText(page)));
  const required = new Set([
    ...REQUIRED_INTAKE_FILES,
    ...(mode === 'brief' ? [BRIEF_FILE] : []),
    ...indexSlugs(index).map((slug) => `${slug}.md`),
    ...referencedOptionalFiles(index),
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
 * The Intake mode a README records — `full` when the row is missing or not a known mode.
 *
 * @param {Map<string, string>} fields
 */
export function recordedIntakeMode(fields) {
  const mode = fields.get('Intake mode') ?? '';
  return INTAKE_MODES.includes(mode) ? mode : DEFAULT_INTAKE_MODE;
}

/**
 * Whether a README records a brief that starts from scratch — Intake mode `brief` on Baseline
 * `none` — whose snapshot is its `BRIEF.md` alone.
 *
 * @param {Map<string, string>} fields
 */
export function isStandaloneBrief(fields) {
  return recordedIntakeMode(fields) === 'brief' && fields.get('Baseline') === NO_BASELINE;
}

/**
 * The mandatory files an iteration's resolved snapshot ({@link resolveIntakeSnapshot}) is
 * missing, for the Intake mode its README records — empty when the snapshot is complete.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 * @returns {string[]}
 */
export function missingIntakeFiles(location) {
  if (!existsSync(intakeFolder(location))) return [`${INTAKE_DIRECTORY}/`];
  const { files, mode, standalone, problem } = resolveIntakeSnapshot(location);
  if (problem !== undefined) return [`${INTAKE_DIRECTORY}/ (${problem})`];
  return checkIntakeSet({
    names: [...files.keys()],
    readText: (name) => readFileSync(files.get(name), 'utf-8'),
    mode,
    standalone,
  }).missing;
}

/**
 * The `## ` sections of {@link BRIEF_SECTIONS} a `BRIEF.md` lacks.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function missingBriefSections(markdown) {
  const headings = new Set(
    markdown
      .split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.slice(3).trim()),
  );
  return BRIEF_SECTIONS.filter((section) => !headings.has(section));
}

/**
 * Fingerprints a `schema-routes.md`: the first {@link FINGERPRINT_LENGTH} hex characters of the
 * sha256 of its bytes, or {@link EMPTY_FIELD} when the file is missing. The same file sits in both
 * repositories, so equal fingerprints mean the copies match.
 *
 * @param {string | undefined} path
 */
export function schemaRoutesHash(path) {
  if (path === undefined || !existsSync(path)) return EMPTY_FIELD;
  return createHash('sha256')
    .update(readFileSync(path))
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH);
}

/** Code-unit order: the same on every machine and in clinozy-be, unlike `localeCompare`. */
function byCodeUnit(left, right) {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

/**
 * Fingerprints a whole snapshot — the Intake hash: the first {@link FINGERPRINT_LENGTH} hex
 * characters of one sha256 over every file, names in code-unit order, each fed as its name, a NUL,
 * its bytes and a NUL. {@link EMPTY_FIELD} for an empty snapshot. Any added, removed, renamed or
 * edited file changes it.
 *
 * @param {ReadonlyMap<string, Buffer>} files file name → bytes
 */
export function snapshotFingerprint(files) {
  if (files.size === 0) return EMPTY_FIELD;
  const hash = createHash('sha256');
  for (const name of [...files.keys()].sort(byCodeUnit)) {
    hash.update(name);
    hash.update('\0');
    hash.update(files.get(name));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, FINGERPRINT_LENGTH);
}

/**
 * A folder's flat, visible files and their bytes ({@link flatFileNames}).
 *
 * @param {string} folder
 * @returns {Map<string, Buffer>}
 */
export function readSnapshot(folder) {
  return new Map(
    flatFileNames(folder).map((name) => [name, readFileSync(join(folder, name))]),
  );
}

/**
 * The Intake hash of a folder as it is on disk ({@link snapshotFingerprint}).
 *
 * @param {string} folder
 */
export function intakeHash(folder) {
  return snapshotFingerprint(readSnapshot(folder));
}

/**
 * Intake modes whose `intake-files/` stores only what arrived — the received files of an overlay,
 * the `BRIEF.md` of a brief — and takes everything else from the Baseline.
 */
export const LAYERED_INTAKE_MODES = new Set(['overlay', 'brief']);

/**
 * Resolves an iteration's snapshot: file name → the path that holds it. A `full` intake is its own
 * `intake-files/`, and so is a `brief` from scratch (Baseline `none`): its `BRIEF.md` alone. An
 * `overlay`, or a `brief` on a named Baseline, stores only what arrived, so its snapshot is its
 * Baseline's resolved snapshot (up the Baseline chain) with its own files laid over it. An
 * iteration with no README resolves as `full`, and one that stores nothing resolves to nothing (no
 * intake yet). Every reader of a snapshot — the gate, the Intake
 * hash, `iteration:diff`, `iteration:list`, the Baseline checks — goes through here.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 * @returns {{ files: Map<string, string>, stored: string[], mode: string, baseline: string | undefined, standalone: boolean, problem: string | undefined }}
 *   `stored` are the files in the iteration's own `intake-files/`; `baseline` the iteration the
 *   rest comes from; `standalone` whether it is a brief from scratch; `problem` why the snapshot
 *   cannot be resolved (then `files` holds only the stored files)
 */
export function resolveIntakeSnapshot({ repositoryRoot, iteration }) {
  const visited = [];
  const layers = [];
  let current = iteration;
  let problem;
  while (current !== undefined) {
    const folder = intakeFolder({ repositoryRoot, iteration: current });
    const stored = flatFileNames(folder);
    const readmePath = join(
      iterationFolder({ repositoryRoot, iteration: current }),
      'README.md',
    );
    const fields = existsSync(readmePath)
      ? parseIterationReadme(readFileSync(readmePath, 'utf-8'))
      : new Map();
    const mode = recordedIntakeMode(fields);
    if (visited.length > 0 && stored.length === 0) {
      problem = `its Baseline chain reaches ${current}, which has no intake`;
      break;
    }
    visited.push(current);
    layers.push({ folder, stored, mode, baseline: fields.get('Baseline') });
    if (!LAYERED_INTAKE_MODES.has(mode) || stored.length === 0) break;
    const baseline = fields.get('Baseline') ?? EMPTY_FIELD;
    // A brief from scratch stands alone: its BRIEF.md is the whole snapshot.
    if (mode === 'brief' && baseline === NO_BASELINE) break;
    if (baseline === NO_BASELINE || baseline === EMPTY_FIELD) {
      problem = `${current} is a ${mode} intake with Baseline ${baseline}, so the files it does not store have nowhere to come from`;
      break;
    }
    if (visited.includes(baseline)) {
      problem = `its Baseline chain loops: ${[...visited, baseline].join(' → ')}`;
      break;
    }
    if (
      parseIterationName(baseline) === undefined ||
      !existsSync(
        join(iterationFolder({ repositoryRoot, iteration: baseline }), 'README.md'),
      )
    ) {
      problem = `its Baseline chain reaches ${baseline}, which is not an iteration with a README`;
      break;
    }
    current = baseline;
  }
  const [own] = layers;
  const standalone = own.mode === 'brief' && own.baseline === NO_BASELINE;
  const files = new Map();
  for (const layer of problem === undefined ? [...layers].reverse() : [own]) {
    for (const name of layer.stored) files.set(name, join(layer.folder, name));
  }
  return {
    files,
    stored: own.stored,
    mode: own.mode,
    baseline:
      LAYERED_INTAKE_MODES.has(own.mode) && !standalone ? own.baseline : undefined,
    standalone,
    problem,
  };
}

/**
 * An iteration's resolved snapshot ({@link resolveIntakeSnapshot}) read into memory.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 * @returns {Map<string, Buffer>}
 */
export function readResolvedSnapshot(location) {
  return new Map(
    [...resolveIntakeSnapshot(location).files].map(([name, path]) => [
      name,
      readFileSync(path),
    ]),
  );
}

/**
 * An iteration's Intake hash as it is on disk: the {@link snapshotFingerprint} of its resolved
 * snapshot, so an overlay or a brief that stores only what arrived hashes the same as one that
 * holds the whole snapshot.
 *
 * @param {{ repositoryRoot: string, iteration: string }} location
 */
export function resolvedIntakeHash(location) {
  return snapshotFingerprint(readResolvedSnapshot(location));
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
 * Parses `--sibling <path>`, `--both`, the given flags and the given value options
 * (`--name <value>` or `--name=<value>`) out of a command line.
 *
 * @param {readonly string[]} commandLine
 * @param {{ flags: readonly string[], values?: readonly string[], maxPositionals: number, usage: string }} shape
 * @returns {{ positionals: string[], flags: Set<string>, values: Map<string, string>, createInSibling: boolean, siblingPath: string | undefined, help: boolean }}
 * @throws on an unknown option, a `--sibling` or value option without its value, or too many
 *   positionals
 */
export function parseCommandLine(
  commandLine,
  { flags, values = [], maxPositionals, usage },
) {
  const positionals = [];
  const seen = new Set();
  const optionValues = new Map();
  let createInSibling = false;
  let siblingPath;
  let help = false;
  for (let index = 0; index < commandLine.length; index += 1) {
    const token = commandLine[index];
    const equals = token.indexOf('=');
    const option =
      token.startsWith('--') && equals !== -1 ? token.slice(0, equals) : token;
    if (values.includes(option)) {
      const value = option === token ? commandLine[index + 1] : token.slice(equals + 1);
      if (value === undefined || value === '' || value.startsWith('--')) {
        throw new Error(`${option} needs a value — ${usage}`);
      }
      optionValues.set(option, value);
      if (option === token) index += 1;
    } else if (token === '--help' || token === '-h') help = true;
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
  return {
    positionals,
    flags: seen,
    values: optionValues,
    createInSibling,
    siblingPath,
    help,
  };
}
