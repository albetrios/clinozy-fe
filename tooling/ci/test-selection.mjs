/**
 * Test selection behind `pnpm test:select` — which Vitest files a set of changed files can affect
 * (clinozy-be's `tooling/vitest/test-selection.util.ts`, on this repository's simpler shape).
 *
 * Three ways a test is selected, each recorded in `why`:
 *
 * - **Imports** — a test whose import graph (static and dynamic `import`, `export … from`,
 *   `vi.mock` and friends, `import.meta.glob`) reaches a changed file. Exact here: every test loads
 *   the code it tests, and pages never import pages, so a page change stays inside its island.
 * - **Mentions** — a test that names the changed path, its file name, a folder above it or a glob
 *   that matches it, also as `join('agent-os', 'hooks')` segments: the `tests/ci` policy tests that
 *   read files instead of importing them.
 * - **The changed test itself.**
 *
 * Any changed source under `src/` also runs the always-run set: the security project
 * (`tests/security/`), every test that imports nothing from the repository (a scanner) and every
 * test no single change selects ({@link findUnreachableTests}). The
 * escalation list runs everything: dependencies, the Vitest and Vite config and the plugins they
 * load, `tsconfig`, the locales the test setup loads, and the test setup with everything it
 * imports — every test runs through it. It fails closed: a path outside the known roots, a deleted
 * file it cannot place, or any error selects everything.
 */
import { existsSync, globSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, matchesGlob, posix } from 'node:path';

/** The Vitest projects of `vitest.config.ts` (pinned to it by `test-selection.test.mjs`). */
export const VITEST_PROJECTS = [
  {
    name: 'unit',
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
  },
  { name: 'security', include: ['tests/security/**/*.test.ts'] },
  { name: 'ci-policy', include: ['tests/ci/**/*.test.ts'] },
  { name: 'tooling', include: ['tooling/**/*.test.{mjs,ts}'] },
];

/** `vitest.config.ts` → `setupFiles`: every test runs through them. */
export const SETUP_FILES = ['tests/utils/setup.ts'];

/** Paths that run everything — a change there reaches every test. */
export const ESCALATION_GLOBS = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'patches/**',
  'tsconfig*.json',
  'vitest.config.ts',
  'vite.config.ts',
  'plugins/**',
  'tooling/test/**',
  'src/locales/**',
  'src/vite-env.d.ts',
];

/** Paths no test imports: they select only the tests that mention them. */
export const MENTION_ONLY_GLOBS = [
  '**/*.md',
  'docs/**',
  'agent-os/**',
  'iterations/**',
  'public/**',
  'scripts/**',
  '.github/**',
  '.husky/**',
  '.claude/**',
  '.cursor/**',
  '.codex/**',
  '.vscode/**',
  '.*',
  'biome.json',
  'catalog-info.yaml',
  'components.json',
  'context7.json',
  'docker-compose*.yml',
  'eslint.config.mjs',
  'index.html',
  'knip.jsonc',
  'LICENSE',
  'Makefile',
  'netlify.toml',
  'playwright*.config.ts',
  'sonar-project.properties',
  'stryker.config.json',
  'typedoc.json',
];

/**
 * Policy tests that read every test file's source rather than import it — no test builds a git
 * repository outside the throwaway-repository fixture. Nothing imports a test, so a changed test
 * selects them; otherwise a new test's own `git init` runs inside pre-push before CI judges it.
 */
export const TEST_SOURCE_POLICIES = ['tests/ci/git-hook-environment.policy.test.ts'];

/** Test files that run on any source change under `src/`. */
export const ALWAYS_RUN_GLOBS = ['tests/security/**/*.test.ts'];

/** How every always-run reason starts — the tests a source change selects whatever it is. */
export const ALWAYS_RUN_REASON = 'always run';

const GRAPH_ROOTS = ['src', 'tests', 'plugins', 'tooling'];
const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.cjs'];
/**
 * Directories the walk never enters: names `.gitignore` ignores at any depth, so they are never
 * code. Not `reports` — the generated reports live in the root `reports/`, outside the walked
 * roots, while `reports` inside them is code (the patient reports page, `tooling/reports/`).
 */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  'test-results',
  '.git',
]);
const TEST_FILE = /\.test\.(?:ts|tsx|mts|mjs)$/;
const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bvi\.(?:mock|doMock|unmock|importActual|importMock)\(\s*['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];
/** `import.meta.glob('./data/*.json')` or `import.meta.glob(['./a/*.ts', './b/*.ts'])`. */
const GLOB_IMPORT = /\bimport\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g;
/** A run of string literals separated by commas — `'agent-os', 'hooks'` reads as `agent-os/hooks`. */
const LITERAL_RUN = /(['"`])([^'"`\n$]+)\1(?:\s*,\s*(['"`])[^'"`\n$]+\3)*/g;
const LITERAL = /(['"`])([^'"`\n$]+)\1/g;

/**
 * @typedef {object} ImportGraph
 * @property {string[]} files every code file under the graph roots, repository-relative
 * @property {string[]} tests the Vitest files among them
 * @property {Map<string, Set<string>>} imports file → the repository files it imports
 * @property {Map<string, Set<string>>} importers file → the repository files that import it
 * @property {Map<string, { source: string, named: string[] }>} [texts] test texts, read once
 * @property {{ setup: Set<string>, sharedNames: Set<string>, unreachable: Set<string> }} [analysis]
 *   what every selection shares ({@link analyzeGraph})
 */

/**
 * @typedef {object} TestSelection
 * @property {'all' | 'selected' | 'none'} mode `all` runs every test, `selected` the files in `projects`
 * @property {string[]} reasons why the mode was chosen
 * @property {Record<string, string[]>} projects selected test files by Vitest project
 * @property {Record<string, string[]>} why each selected test file → why it was selected
 */

const toPosix = (path) => path.split('\\').join('/');

const matchesAny = ({ path, globs }) => globs.some((glob) => matchesGlob(path, glob));

/**
 * The Vitest project a file belongs to, or null when no project runs it (a Playwright spec).
 *
 * @param {string} file
 * @returns {string | null}
 */
export function projectOf(file) {
  const project = VITEST_PROJECTS.find(({ include }) =>
    matchesAny({ path: file, globs: include }),
  );
  return project?.name ?? null;
}

/** True for a Vitest file. */
export function isTestFile(path) {
  return TEST_FILE.test(path) && projectOf(path) !== null;
}

function listCodeFiles({ repositoryRoot, directory }) {
  const absolute = join(repositoryRoot, directory);
  if (!existsSync(absolute)) return [];
  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory())
      files.push(...listCodeFiles({ repositoryRoot, directory: path }));
    else if (CODE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)))
      files.push(path);
  }
  return files;
}

/**
 * The repository path a specifier names, or null when it is a package.
 *
 * @param {{ repositoryRoot: string, importer: string, specifier: string }} options
 * @returns {string | null}
 */
export function resolveSpecifier({ repositoryRoot, importer, specifier }) {
  const bare = specifier.replace(/\?.*$/, '');
  let target;
  if (bare.startsWith('@/tests/')) target = `tests/${bare.slice('@/tests/'.length)}`;
  else if (bare.startsWith('@/')) target = `src/${bare.slice(2)}`;
  else if (bare.startsWith('./') || bare.startsWith('../'))
    target = posix.normalize(posix.join(posix.dirname(importer), bare));
  else return null;
  const candidates = [target];
  if (target.endsWith('.js')) candidates.unshift(`${target.slice(0, -3)}.ts`);
  else if (!/\.[a-z]+$/.test(posix.basename(target)))
    candidates.push(
      `${target}.ts`,
      `${target}.tsx`,
      `${target}/index.ts`,
      `${target}/index.tsx`,
      `${target}.mjs`,
      `${target}.js`,
    );
  const found = candidates.find((candidate) => {
    const absolute = join(repositoryRoot, candidate);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  // A deleted file keeps its node, so the files that still import it are found.
  return found ?? candidates[0] ?? null;
}

/** The repository files an `import.meta.glob` pattern list matches, from `importer`'s folder. */
function globTargets({ repositoryRoot, importer, patterns }) {
  const targets = [];
  for (const literal of patterns.matchAll(LITERAL)) {
    const pattern = literal[2] ?? '';
    const resolved = pattern.startsWith('@/')
      ? `src/${pattern.slice(2)}`
      : posix.normalize(posix.join(posix.dirname(importer), pattern));
    targets.push(...globSync(resolved, { cwd: repositoryRoot }).map(toPosix));
  }
  return targets;
}

/**
 * Build the import graph of `src/`, `tests/`, `plugins/` and `tooling/`.
 *
 * @param {string} repositoryRoot
 * @returns {ImportGraph}
 */
export function buildImportGraph(repositoryRoot) {
  const files = GRAPH_ROOTS.flatMap((directory) =>
    listCodeFiles({ repositoryRoot, directory }),
  );
  const imports = new Map();
  const importers = new Map();
  for (const file of files) {
    const source = readFileSync(join(repositoryRoot, file), 'utf8');
    const targets = new Set();
    for (const pattern of IMPORT_PATTERNS)
      for (const match of source.matchAll(pattern)) {
        const target = match[1]
          ? resolveSpecifier({ repositoryRoot, importer: file, specifier: match[1] })
          : null;
        if (target && target !== file) targets.add(target);
      }
    for (const match of source.matchAll(GLOB_IMPORT))
      for (const target of globTargets({
        repositoryRoot,
        importer: file,
        patterns: match[1],
      }))
        if (target !== file) targets.add(target);
    imports.set(file, targets);
    for (const target of targets) {
      const set = importers.get(target) ?? new Set();
      set.add(file);
      importers.set(target, set);
    }
  }
  return { files, tests: files.filter(isTestFile), imports, importers };
}

/** Every file that reaches `start` through imports (`start` included). */
function importersClosure({ graph, start }) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.shift();
    for (const importer of graph.importers.get(file) ?? [])
      if (!seen.has(importer)) {
        seen.add(importer);
        queue.push(importer);
      }
  }
  return seen;
}

/**
 * The test setup and everything it imports: a change there reaches every test, so it escalates.
 *
 * @param {ImportGraph} graph
 * @returns {Set<string>}
 */
export function setupClosure(graph) {
  const seen = new Set(SETUP_FILES);
  const queue = [...SETUP_FILES];
  while (queue.length > 0) {
    const file = queue.shift();
    for (const target of graph.imports.get(file) ?? [])
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
  }
  return seen;
}

/** The file names more than one graph file has. */
function namesHeldTwice(graph) {
  const seen = new Set();
  const twice = new Set();
  for (const file of graph.files) {
    const name = posix.basename(file);
    if (seen.has(name)) twice.add(name);
    seen.add(name);
  }
  return twice;
}

/**
 * A test's text and the paths it names, read once per graph.
 *
 * @param {{ graph: ImportGraph, repositoryRoot: string, test: string }} options
 * @returns {{ source: string, named: string[] }}
 */
function testTextOf({ graph, repositoryRoot, test }) {
  graph.texts ??= new Map();
  let entry = graph.texts.get(test);
  if (!entry) {
    const source = readFileSync(join(repositoryRoot, test), 'utf8');
    entry = { source, named: namedPaths({ test, source }) };
    graph.texts.set(test, entry);
  }
  return entry;
}

/** True when `path` names something in the repository: a file, a folder, or a glob that matches. */
function namesRepositoryPath({ repositoryRoot, path }) {
  if (path.startsWith('../')) return false;
  try {
    return path.includes('*')
      ? globSync(path, { cwd: repositoryRoot }).length > 0
      : existsSync(join(repositoryRoot, path));
  } catch {
    return false;
  }
}

/**
 * The tests no single change selects: they import nothing from the repository and name no path in
 * it, so neither an import nor a mention reaches them (a test that builds its paths at run time).
 * They stay on the always-run list. A test whose code is all on the escalation list is not one:
 * any change to that code runs everything.
 *
 * @param {{ graph: ImportGraph, repositoryRoot: string }} options
 * @returns {Set<string>}
 */
export function findUnreachableTests({ graph, repositoryRoot }) {
  const unreachable = new Set();
  for (const test of graph.tests) {
    if (matchesAny({ path: test, globs: ALWAYS_RUN_GLOBS })) continue;
    if ([...(graph.imports.get(test) ?? [])].some((target) => !isTestFile(target)))
      continue;
    const { named } = testTextOf({ graph, repositoryRoot, test });
    if (!named.some((path) => namesRepositoryPath({ repositoryRoot, path })))
      unreachable.add(test);
  }
  return unreachable;
}

/**
 * What every selection on a graph shares, computed once and kept on the graph: the setup closure,
 * the file names more than one file has, and the unreachable tests.
 *
 * @param {{ graph: ImportGraph, repositoryRoot: string }} options
 * @returns {{ setup: Set<string>, sharedNames: Set<string>, unreachable: Set<string> }}
 */
export function analyzeGraph({ graph, repositoryRoot }) {
  graph.analysis ??= {
    setup: setupClosure(graph),
    sharedNames: namesHeldTwice(graph),
    unreachable: findUnreachableTests({ graph, repositoryRoot }),
  };
  return graph.analysis;
}

/** The path-like strings a test names: each literal, and each comma-separated run joined by `/`. */
function namedPaths({ test, source }) {
  const paths = new Set();
  for (const run of source.matchAll(LITERAL_RUN)) {
    const parts = [...run[0].matchAll(LITERAL)].map((literal) => literal[2] ?? '');
    for (const part of parts) paths.add(part);
    if (parts.length > 1) paths.add(parts.join('/'));
  }
  const resolved = [];
  for (const path of paths) {
    const trimmed = path.replace(/^\/+|\/+$/g, '');
    if (!(trimmed.includes('/') || trimmed.includes('.'))) continue;
    if (trimmed.startsWith('./') || trimmed.startsWith('../'))
      resolved.push(posix.normalize(posix.join(posix.dirname(test), trimmed)));
    else resolved.push(trimmed);
  }
  return resolved;
}

/**
 * True when a test names `changed`: the path, its file name (when no other file has it — two
 * islands may both hold a `PurchasesPage.tsx`), a folder above it, or a glob over it.
 */
function mentions({ changed, source, named, sharedNames }) {
  const name = posix.basename(changed);
  if (source.includes(changed)) return true;
  // The file name on its own, not inside a longer one (`AppointmentPage.tsx` in `NewAppointmentPage.tsx`).
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (
    !/^index\.tsx?$/.test(name) &&
    !sharedNames.has(name) &&
    new RegExp(`(?:^|[^\\w$-])${escaped}`).test(source)
  )
    return true;
  return named.some((path) =>
    path.includes('*')
      ? matchesGlob(changed, path)
      : path.split('/').length >= 2 && changed.startsWith(`${path}/`),
  );
}

/** Whether a test was selected only because it always runs (every reason is an always-run one). */
export function isAlwaysRunOnly(reasons) {
  return reasons.every((reason) => reason.startsWith(ALWAYS_RUN_REASON));
}

function filterSelection({ selection, keep, reason }) {
  if (selection.mode !== 'selected') return selection;
  const projects = Object.fromEntries(
    Object.entries(selection.projects)
      .map(([project, tests]) => [project, tests.filter(keep)])
      .filter(([, tests]) => tests.length > 0),
  );
  const why = Object.fromEntries(
    Object.entries(selection.why).filter(([test]) => keep(test)),
  );
  const left = Object.values(projects).flat().length;
  return {
    mode: left === 0 ? 'none' : 'selected',
    reasons: [...selection.reasons, `${reason} (${left} test files left)`],
    projects,
    why,
  };
}

/**
 * The part of a selection picked for the change itself: no always-run tests, and nothing when
 * everything is selected (the full suite is the signal then).
 *
 * @param {TestSelection} selection
 * @returns {TestSelection}
 */
export function changedOnly(selection) {
  if (selection.mode === 'all')
    return {
      mode: 'none',
      reasons: [
        ...selection.reasons,
        'everything is selected, so the full suite is the signal',
      ],
      projects: {},
      why: {},
    };
  return filterSelection({
    selection,
    keep: (test) => !isAlwaysRunOnly(selection.why[test] ?? []),
    reason: 'the always-run tests left to the full suite',
  });
}

/**
 * The selection without the tests that match any of `globs` (`--exclude`).
 *
 * @param {{ selection: TestSelection, globs: readonly string[] }} options
 * @returns {TestSelection}
 */
export function withoutTests({ selection, globs }) {
  if (globs.length === 0) return selection;
  return filterSelection({
    selection,
    keep: (test) => !globs.some((glob) => matchesGlob(test, glob)),
    reason: `excluded ${globs.join(', ')}`,
  });
}

const all = (reason) => ({ mode: 'all', reasons: [reason], projects: {}, why: {} });

/**
 * A changed test: itself, and each test-source policy the repository has ({@link TEST_SOURCE_POLICIES}).
 *
 * @param {{ changed: string, repositoryRoot: string, select: (test: string, reason: string) => void }} options
 */
function selectChangedTest({ changed, repositoryRoot, select }) {
  select(changed, 'the changed test itself');
  for (const policy of TEST_SOURCE_POLICIES) {
    if (policy !== changed && existsSync(join(repositoryRoot, policy))) {
      select(policy, `reads every test's source (${changed})`);
    }
  }
}

/**
 * Select the tests a set of changed files can affect (see the module comment for the rules). Any
 * error selects everything.
 *
 * @param {{ changedFiles: string[], repositoryRoot: string, graph?: ImportGraph }} options
 * @returns {TestSelection}
 */
export function selectTests(options) {
  try {
    return selectTestsOrThrow(options);
  } catch (error) {
    return all(
      `selector error, so everything runs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function selectTestsOrThrow({
  changedFiles: changedInput,
  repositoryRoot,
  graph: given,
}) {
  const changedFiles = [...new Set(changedInput.map(toPosix))].filter(Boolean);
  if (changedFiles.length === 0)
    return { mode: 'none', reasons: ['no changed files'], projects: {}, why: {} };

  for (const file of changedFiles) {
    if (isTestFile(file)) continue;
    if (matchesAny({ path: file, globs: ESCALATION_GLOBS }))
      return all(`${file} is on the escalation list, so everything runs`);
    const known =
      GRAPH_ROOTS.some((root) => file.startsWith(`${root}/`)) ||
      matchesAny({ path: file, globs: MENTION_ONLY_GLOBS });
    if (!known) return all(`${file} is outside the known roots, so everything runs`);
  }

  const graph = given ?? buildImportGraph(repositoryRoot);
  const { setup, sharedNames, unreachable } = analyzeGraph({ graph, repositoryRoot });
  const testText = (test) => testTextOf({ graph, repositoryRoot, test });
  const why = new Map();
  const select = (test, reason) => {
    const reasons = why.get(test) ?? new Set();
    reasons.add(reason);
    why.set(test, reasons);
  };

  let sourceChanged = false;
  for (const changed of changedFiles) {
    const exists = existsSync(join(repositoryRoot, changed));
    if (isTestFile(changed)) {
      if (exists) selectChangedTest({ changed, repositoryRoot, select });
      continue;
    }
    if (setup.has(changed))
      return all(`${changed} is loaded by the test setup, so everything runs`);
    const inGraph = GRAPH_ROOTS.some((root) => changed.startsWith(`${root}/`));
    const isCode = CODE_EXTENSIONS.some((extension) => changed.endsWith(extension));
    if (inGraph && isCode && !exists && !graph.importers.has(changed))
      return all(`${changed} was deleted and nothing imports it now, so everything runs`);
    if (changed.startsWith('src/') && !changed.endsWith('.md')) sourceChanged = true;

    if (inGraph)
      for (const file of importersClosure({ graph, start: changed }))
        if (isTestFile(file) && file !== changed) select(file, `imports ${changed}`);

    for (const test of graph.tests) {
      const { source, named } = testText(test);
      if (mentions({ changed, source, named, sharedNames }))
        select(test, `mentions ${changed}`);
    }
  }

  if (sourceChanged)
    for (const test of graph.tests) {
      if (matchesAny({ path: test, globs: ALWAYS_RUN_GLOBS }))
        select(test, ALWAYS_RUN_REASON);
      const reachesRepository = [...(graph.imports.get(test) ?? [])].some(
        (target) => !isTestFile(target),
      );
      if (!reachesRepository)
        select(test, `${ALWAYS_RUN_REASON} (imports nothing from the repository)`);
      if (unreachable.has(test))
        select(test, `${ALWAYS_RUN_REASON} (no single change selects it)`);
    }

  const projects = {};
  for (const test of [...why.keys()].sort()) {
    const project = projectOf(test);
    if (!project) {
      why.delete(test);
      continue;
    }
    projects[project] = [...(projects[project] ?? []), test];
  }
  if (why.size === 0)
    return {
      mode: 'none',
      reasons: ['no test imports or mentions a changed file'],
      projects,
      why: {},
    };
  const counts = Object.entries(projects).map(
    ([project, tests]) => `${project} ${tests.length}`,
  );
  return {
    mode: 'selected',
    reasons: [`${why.size} of ${graph.tests.length} test files: ${counts.join(', ')}`],
    projects,
    why: Object.fromEntries([...why].map(([test, reasons]) => [test, [...reasons]])),
  };
}
