/**
 * The test selection's fixtures, checked by `pnpm agent-os:check` (clinozy-be's
 * `selector-fixtures.check.ts`, on this repository's shape):
 *
 * - **One per page**, generated from `src/pages/`: for every route island (a folder with a
 *   `*.route.tsx`), a change to its main file (`<Page>Page.tsx` / `<Page>Layout.tsx`, else the route
 *   file) selects its colocated test, and no test in another section — pages never import pages. A
 *   section is a top-level page (`login/`) or an organization room
 *   (`organization/$organizationSlug/patients/`): a layout island wires its own children (its
 *   section registry imports their routes), so a page inside a section may reach its siblings.
 *   The always-run set is not counted.
 * - **The escalation list** — one file of each kind runs everything.
 * - **The recorded ones** in `tooling/ci/selector-fixtures.json` — each a miss the merged PR suite
 *   found (`pnpm test:selector-misses`): the selection for `changed` holds `mustSelect`.
 * - **The unreachable tests** (no single change selects them) are always run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import {
  ALWAYS_RUN_REASON,
  analyzeGraph,
  buildImportGraph,
  isTestFile,
  selectTests,
} from './test-selection.mjs';

const FIXTURES_FILE = 'tooling/ci/selector-fixtures.json';
const PAGES = 'src/pages/';
const ORGANIZATION_ROOMS = 'src/pages/organization/$organizationSlug/';
/** One file of each escalating kind: a change there must run everything. */
const ESCALATING_FILES = [
  'package.json',
  'vitest.config.ts',
  'plugins/test-env.ts',
  'tests/utils/setup.ts',
  'src/lib/i18n/i18n.ts',
  'src/locales/en/common.json',
];

/**
 * The section a page file belongs to: its top-level page folder, or its organization room.
 *
 * @param {string} file
 * @returns {string}
 */
export function sectionOf(file) {
  if (file.startsWith(ORGANIZATION_ROOMS)) {
    const [room, ...rest] = file.slice(ORGANIZATION_ROOMS.length).split('/');
    return rest.length > 0
      ? `${ORGANIZATION_ROOMS}${room}`
      : ORGANIZATION_ROOMS.slice(0, -1);
  }
  return `${PAGES}${file.slice(PAGES.length).split('/')[0]}`;
}

/**
 * One generated fixture per route island: its main file, its colocated test (when it has one) and
 * the section its tests may not leave.
 *
 * @param {import('./test-selection.mjs').ImportGraph} graph
 * @returns {{ name: string, changed: string[], mustSelect: string[], section: string }[]}
 */
export function pageFixtures(graph) {
  const islands = graph.files
    .filter((file) => file.startsWith(PAGES) && file.endsWith('.route.tsx'))
    .map((file) => posix.dirname(file));
  return islands.flatMap((island) => {
    const own = graph.files.filter(
      (file) => posix.dirname(file) === island && !isTestFile(file),
    );
    const main =
      own.find((file) => /\/[A-Z]\w*(?:Page|Layout)\.tsx$/.test(file)) ??
      own.find((file) => file.endsWith('.route.tsx'));
    if (!main) return [];
    const colocated = main.replace(/\.tsx$/, '.test.tsx');
    return [
      {
        name: `${island.slice(PAGES.length)} (generated)`,
        changed: [main],
        mustSelect: graph.tests.includes(colocated) ? [colocated] : [],
        section: sectionOf(main),
      },
    ];
  });
}

function recordedFixtures(repositoryRoot) {
  const path = join(repositoryRoot, FIXTURES_FILE);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8')).fixtures ?? [];
}

const pickedFor = (selection) => Object.values(selection.projects).flat();

/**
 * Runs every fixture; returns one problem per fixture that fails, and the counts checked. Builds
 * the import graph once and reuses it (and its analysis) for every selection.
 *
 * @param {string} repositoryRoot
 * @returns {{ problems: string[], fixtures: number, unreachable: number }}
 */
export function checkSelectorFixtures(repositoryRoot) {
  const graph = buildImportGraph(repositoryRoot);
  const problems = [];
  const pages = pageFixtures(graph);
  for (const fixture of pages) {
    const selection = selectTests({
      changedFiles: fixture.changed,
      repositoryRoot,
      graph,
    });
    if (selection.mode === 'all') {
      problems.push(
        `${fixture.name}: a page change runs everything, so its isolation is unchecked`,
      );
      continue;
    }
    const picked = pickedFor(selection);
    const missing = fixture.mustSelect.filter((test) => !picked.includes(test));
    if (missing.length > 0)
      problems.push(
        `${fixture.name}: a change to ${fixture.changed[0]} does not select ${missing[0]}`,
      );
    const foreign = picked.filter(
      (test) =>
        test.startsWith(PAGES) &&
        sectionOf(test) !== fixture.section &&
        !fixture.section.startsWith(`${sectionOf(test)}/`) &&
        (selection.why[test] ?? []).some(
          (reason) => !reason.startsWith(ALWAYS_RUN_REASON),
        ),
    );
    if (foreign.length > 0)
      problems.push(
        `${fixture.name}: a change to ${fixture.changed[0]} selects ${foreign.length} test(s) in another section, e.g. ${foreign[0]} — does a page import another page?`,
      );
  }
  const recorded = recordedFixtures(repositoryRoot);
  for (const fixture of recorded) {
    const selection = selectTests({
      changedFiles: fixture.changed,
      repositoryRoot,
      graph,
    });
    if (selection.mode === 'all') continue;
    const picked = pickedFor(selection);
    const missing = fixture.mustSelect.filter((test) => !picked.includes(test));
    if (missing.length > 0)
      problems.push(
        `${fixture.name}: a change to ${fixture.changed.join(', ')} does not select ${missing.length} test(s), e.g. ${missing[0]}`,
      );
  }
  for (const file of ESCALATING_FILES.filter((path) =>
    existsSync(join(repositoryRoot, path)),
  )) {
    const selection = selectTests({ changedFiles: [file], repositoryRoot, graph });
    if (selection.mode !== 'all')
      problems.push(`${file}: an escalating change must run everything`);
  }
  const { unreachable } = analyzeGraph({ graph, repositoryRoot });
  const sample = pages[0]?.changed ?? [];
  if (sample.length > 0 && unreachable.size > 0) {
    const selection = selectTests({ changedFiles: sample, repositoryRoot, graph });
    const picked = new Set(pickedFor(selection));
    const notRun = [...unreachable].filter((test) => !picked.has(test));
    if (selection.mode !== 'all' && notRun.length > 0)
      problems.push(
        `${notRun.length} unreachable test(s) are not always run, e.g. ${notRun[0]}`,
      );
  }
  return {
    problems,
    fixtures: pages.length + recorded.length,
    unreachable: unreachable.size,
  };
}
