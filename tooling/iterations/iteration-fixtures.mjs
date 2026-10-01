/**
 * Test fixtures for the `pnpm iteration:*` tests: throwaway git repositories under the OS temp
 * folder, iterations with READMEs rendered from the real template, and a complete frontend drop
 * that a test can break one file at a time. Never touches this checkout.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_FIELD, gitEnvironment, intakeHash } from './iterations.mjs';
import { configuredBaseBranch, renderIterationReadme } from './new-iteration.mjs';

export const BASE_BRANCH = configuredBaseBranch();
export const WORK_BRANCH = 'feat/iteration-work';
export const TODAY = '2026-10-01';
export const OWNER = 'Test Owner';
/** Commit times in these tests are offsets (seconds) from this Unix time. */
const COMMIT_EPOCH = 1_790_000_000;

const scratchFolders = [];

/** Removes every folder the fixtures created; call from `afterEach`. */
export function cleanScratch() {
  for (const folder of scratchFolders.splice(0))
    rmSync(folder, { recursive: true, force: true });
}

/** A scratch folder that {@link cleanScratch} removes. */
export function scratchFolder() {
  const folder = mkdtempSync(join(tmpdir(), 'iteration-test-'));
  scratchFolders.push(folder);
  return folder;
}

/**
 * Runs git in a fixture repository, with fixed dates when `commitTime` is given.
 *
 * @param {string} repositoryRoot
 * @param {readonly string[]} gitArguments
 * @param {number} [commitTime]
 */
export function git(repositoryRoot, gitArguments, commitTime) {
  const dates =
    commitTime === undefined
      ? {}
      : {
          GIT_AUTHOR_DATE: `@${COMMIT_EPOCH + commitTime} +0000`,
          GIT_COMMITTER_DATE: `@${COMMIT_EPOCH + commitTime} +0000`,
        };
  return execFileSync('git', gitArguments, {
    cwd: repositoryRoot,
    encoding: 'utf-8',
    env: { ...gitEnvironment(), ...dates },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * A repository on the base branch with one commit; `parent` keeps siblings side by side.
 *
 * @param {{ packageName?: string, parent?: string }} [options]
 */
export function createRepository({ packageName = 'demo-fe', parent } = {}) {
  const repositoryRoot = join(parent ?? scratchFolder(), packageName);
  mkdirSync(repositoryRoot);
  git(repositoryRoot, ['init', '-q', '-b', BASE_BRANCH]);
  git(repositoryRoot, ['config', 'user.name', OWNER]);
  git(repositoryRoot, ['config', 'user.email', 'owner@example.test']);
  git(repositoryRoot, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(
    join(repositoryRoot, 'package.json'),
    JSON.stringify({ name: packageName }),
  );
  git(repositoryRoot, ['add', '-A']);
  git(repositoryRoot, ['commit', '-q', '-m', 'initial'], 1_000);
  return repositoryRoot;
}

/** Commits everything in a fixture repository. */
export function commitAll(repositoryRoot, message, commitTime) {
  git(repositoryRoot, ['add', '-A']);
  git(repositoryRoot, ['commit', '-q', '-m', message], commitTime);
}

/** A `schema-routes.md` small enough to reason about, in the real file's shape. */
export const SCHEMA_ROUTES = `# schema-routes.md — Demo

# Route map

| Route (full path) | Screen | Kind | Parent layout | Access | Params | Notes |
| ----------------- | ------ | ---- | ------------- | ------ | ------ | ----- |
| \`/alpha\` | Alpha | page | app shell | any | n/a | |
| \`/beta\` | Beta | page | app shell | any | n/a | |

# Entities

## Entity: Patient

| Field | Type | Required | Nullable | Default | Constraints | Server-set? | Notes |
| ----- | ---- | -------- | -------- | ------- | ----------- | ----------- | ----- |
| id | string (uuid) | yes | no | — | — | yes | |
| name | string | yes | no | — | 1–120 chars | no | |

## Entity: Note (embedded in Patient.notes)

| Field | Type | Required | Nullable | Default | Constraints | Server-set? | Notes |
| ----- | ---- | -------- | -------- | ------- | ----------- | ----------- | ----- |
| text | string | yes | no | — | — | no | |

# Enums

## Enum: gender
| Machine value | UI label (verbatim) | Meaning / when set |
| ------------- | ------------------- | ------------------ |
| female | Female | |
| male | Male | |

# Operations

## Screen: Alpha

| Operation | Kind | Params | Optimistic? | Errors |
| --------- | ---- | ------ | ----------- | ------ |
| listPatients | read | q | no | — |
`;

/** A complete frontend drop: the required set plus one optional shared file. */
export function completeDrop() {
  return {
    'PRD.md': '# Demo — PRD\n',
    'schema-routes.md': SCHEMA_ROUTES,
    '_index.md':
      '# Screens\n\n| Slug | Route | Purpose |\n| ---- | ----- | ------- |\n| alpha | /alpha | First |\n| `beta` | /beta | Second |\n',
    'alpha.md': '# Screen: Alpha\n',
    'beta.md': '# Screen: Beta\n',
    'preset.md': '# Preset\n',
    'shell.md': '# Shell\n',
    'Demo.dc.html':
      '<html><script src="./support.js?v=2"></script><script src="https://cdn.example.test/x.js"></script></html>\n',
    'support.js': 'export const runtime = true;\n',
    '_patterns.md': '# Patterns\n',
  };
}

/**
 * Writes drop files into a folder (created if needed).
 *
 * @param {string} folder
 * @param {Record<string, string>} files
 */
export function writeDrop(folder, files) {
  mkdirSync(folder, { recursive: true });
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(folder, name), content);
  return folder;
}

/** A `BRIEF.md` with every template section. */
export function brief(change = 'Show a returned badge on sales') {
  return `# Brief — ${change}

## What changes

${change}.

## Why

Staff cannot tell which sales were returned.

## Affected screens, entities and routes

- Screens: alpha
- Entities: Patient
- Routes: /alpha

## Rules

Only a returned sale shows the badge.

## Acceptance criteria

- [ ] A returned sale shows the badge.

## Out of scope

Refunds.
`;
}

/**
 * Writes an iteration folder: optionally its `intake-files/`, then a README rendered from the real
 * template (plus History lines) — with an intake, its Intake mode, note and hash are filled as a
 * full intake would (`fields` overrides them); commits when `commitTime` is given.
 *
 * @param {{ repositoryRoot: string, name: string, fields?: Record<string, string>, history?: string[], intake?: Record<string, string>, commitTime?: number }} iteration
 */
export function writeIteration({
  repositoryRoot,
  name,
  fields = {},
  history = [],
  intake,
  commitTime,
}) {
  const folder = join(repositoryRoot, 'iterations', name);
  mkdirSync(folder, { recursive: true });
  if (intake !== undefined) writeDrop(join(folder, 'intake-files'), intake);
  const intakeFields =
    intake === undefined
      ? {}
      : {
          intakeMode: 'full',
          intakeNote: `${Object.keys(intake).length} received`,
          intakeHash: intakeHash(join(folder, 'intake-files')),
        };
  const readme = renderIterationReadme({
    name,
    fields: {
      type: name.split('-')[0],
      topic: EMPTY_FIELD,
      owner: OWNER,
      opened: /\d{4}-\d{2}-\d{2}/.exec(name)?.[0] ?? TODAY,
      branch: WORK_BRANCH,
      baseline: 'none',
      status: 'planning',
      summary: EMPTY_FIELD,
      dropPlaced: EMPTY_FIELD,
      dropSource: EMPTY_FIELD,
      intakeMode: EMPTY_FIELD,
      intakeNote: EMPTY_FIELD,
      schemaRoutes: EMPTY_FIELD,
      intakeHash: EMPTY_FIELD,
      ...intakeFields,
      ...fields,
    },
  });
  const withHistory =
    history.length === 0 ? readme : `${readme}\n## History\n\n${history.join('\n')}\n`;
  writeFileSync(join(folder, 'README.md'), withHistory);
  if (commitTime !== undefined) commitAll(repositoryRoot, `add ${name}`, commitTime);
  return folder;
}
