/**
 * `pnpm iteration:diff` — the summary of two iterations' `intake-files/` (files, screens via
 * `_index.md` Slugs, PRD / schema-routes / prototype, and the schema-routes entities, fields,
 * enums, routes and operations), the refusal when either side has no `intake-files/`, and the
 * missing-Baseline prompt. The same JSON shape as clinozy-be's.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  cleanScratch,
  completeDrop,
  createRepository,
  SCHEMA_ROUTES,
  writeIteration,
} from './iteration-fixtures.mjs';
import {
  compareSchemaRoutes,
  parseDiffArguments,
  parseSchemaRoutes,
  runDiff,
  summarizeIntakeDiff,
} from './diff-iterations.mjs';

afterEach(cleanScratch);

const BASELINE = 'launch-2026-09-30-jxmr';
const CURRENT = 'feat-returns-2026-10-06-kqzx';

const CHANGED_SCHEMA_ROUTES = SCHEMA_ROUTES.replace(
  '| `/beta` | Beta | page | app shell | any | n/a | |\n',
  '',
)
  .replace(
    '| `/alpha` | Alpha | page | app shell | any | n/a | |',
    '| `/alpha` | Alpha | page | app shell | Doctor | n/a | |\n| `/gamma` | Gamma | page | app shell | any | n/a | |',
  )
  .replace(
    '| name | string | yes | no | — | 1–120 chars | no | |',
    '| name | string | yes | no | — | 1–200 chars | no | |\n| dob | string | no | yes | null | YYYY-MM-DD | no | |',
  )
  .replace('| male | Male | |', '| male | Male | |\n| other | Other | |')
  .replace('## Entity: Note (embedded in Patient.notes)', '## Entity: Invoice')
  .replace(
    '| listPatients | read | q | no | — |',
    '| listPatients | read | q, sort | no | — |\n| createPatient | write | body | yes | 409 duplicate |',
  );

describe('parseSchemaRoutes', () => {
  test('reads routes, entity fields, enum values and screen operations', () => {
    const model = parseSchemaRoutes(SCHEMA_ROUTES);
    assert.deepEqual([...model.routes.keys()], ['/alpha', '/beta']);
    assert.deepEqual([...model.entities.keys()], ['Patient', 'Note']);
    assert.deepEqual([...model.entities.get('Patient').keys()], ['id', 'name']);
    assert.deepEqual([...model.enums.get('gender').keys()], ['female', 'male']);
    assert.deepEqual([...model.operations.keys()], ['Alpha › listPatients']);
  });

  test('compares two files', () => {
    assert.deepEqual(
      compareSchemaRoutes({
        before: parseSchemaRoutes(SCHEMA_ROUTES),
        after: parseSchemaRoutes(CHANGED_SCHEMA_ROUTES),
      }),
      {
        entities: { added: ['Invoice'], removed: ['Note'], changed: ['Patient'] },
        fields: { added: ['Patient.dob'], removed: [], changed: ['Patient.name'] },
        enums: { added: [], removed: [], changed: ['gender'] },
        routes: { added: ['/gamma'], removed: ['/beta'], changed: ['/alpha'] },
        operations: {
          added: ['Alpha › createPatient'],
          removed: [],
          changed: ['Alpha › listPatients'],
        },
      },
    );
  });
});

describe('summarizeIntakeDiff', () => {
  function twoDrops() {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: BASELINE,
      fields: { status: 'done' },
      intake: completeDrop(),
    });
    const after = completeDrop();
    delete after['beta.md'];
    after['_index.md'] = after['_index.md'].replace(
      '| `beta` | /beta | Second |',
      '| gamma | /gamma | Third |',
    );
    after['gamma.md'] = '# Screen: Gamma\n';
    after['alpha.md'] = '# Screen: Alpha — v two\n';
    after['schema-routes.md'] = CHANGED_SCHEMA_ROUTES;
    after['support.js'] = 'export const runtime = false;\n';
    writeIteration({
      repositoryRoot,
      name: CURRENT,
      fields: { baseline: BASELINE },
      intake: after,
    });
    return repositoryRoot;
  }

  test('names the files, screens, PRD, schema-routes and prototype changes', () => {
    const summary = summarizeIntakeDiff({
      repositoryRoot: twoDrops(),
      baseline: BASELINE,
      current: CURRENT,
    });
    assert.deepEqual(summary.files, {
      added: ['gamma.md'],
      removed: ['beta.md'],
      changed: ['_index.md', 'alpha.md', 'schema-routes.md', 'support.js'],
    });
    assert.deepEqual(summary.screens, {
      added: ['gamma'],
      removed: ['beta'],
      changed: ['alpha'],
    });
    assert.equal(summary.prdChanged, false);
    assert.equal(summary.schemaRoutesChanged, true);
    assert.equal(summary.prototypeChanged, true);
    assert.deepEqual(summary.schemaRoutes.routes, {
      added: ['/gamma'],
      removed: ['/beta'],
      changed: ['/alpha'],
    });
  });

  test('--json prints the summary; the text form adds the raw git diff', () => {
    const repositoryRoot = twoDrops();
    const json = runDiff([BASELINE, CURRENT, '--json'], { repositoryRoot });
    assert.deepEqual(Object.keys(JSON.parse(json.lines[0])), [
      'baseline',
      'current',
      'files',
      'screens',
      'prdChanged',
      'schemaRoutesChanged',
      'prototypeChanged',
      'schemaRoutes',
    ]);
    const text = runDiff([BASELINE, CURRENT], { repositoryRoot }).lines.join('\n');
    assert.match(text, /Screens \(via _index\.md\):\n {2}\+ added {3}\(1\): gamma/);
    assert.match(text, /── git diff --no-index ──\ndiff --git/);
  });

  test('refuses an iteration without intake-files/ — the delta is a diff of intake-files/ only', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: BASELINE, fields: { status: 'done' } });
    writeIteration({ repositoryRoot, name: CURRENT, intake: completeDrop() });
    assert.throws(
      () => summarizeIntakeDiff({ repositoryRoot, baseline: BASELINE, current: CURRENT }),
      new RegExp(`${BASELINE} has no intake-files/`),
    );
  });
});

describe('without a Baseline', () => {
  test('prints the recorded and suggested Baselines and exits 2', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: BASELINE,
      fields: { status: 'done' },
      history: ['- 2026-10-02 · implementing → done · — · A'],
      intake: completeDrop(),
    });
    writeIteration({
      repositoryRoot,
      name: CURRENT,
      fields: { baseline: '—' },
      intake: completeDrop(),
    });
    const result = runDiff([CURRENT], { repositoryRoot });
    assert.equal(result.exitCode, 2);
    assert.match(
      result.lines[0],
      /Suggested \(latest done\/frozen in this repository\): launch-2026-09-30-jxmr/,
    );
    assert.match(
      result.lines[0],
      new RegExp(`Confirm and re-run: pnpm iteration:diff ${BASELINE} ${CURRENT}`),
    );
  });

  test('reads [<baseline>] <current> [--json]', () => {
    assert.deepEqual(parseDiffArguments([CURRENT]), {
      baseline: undefined,
      current: CURRENT,
      json: false,
      help: false,
    });
    assert.deepEqual(parseDiffArguments([BASELINE, CURRENT, '--json']), {
      baseline: BASELINE,
      current: CURRENT,
      json: true,
      help: false,
    });
    assert.throws(() => parseDiffArguments(['a', 'b', 'c']), /Too many arguments/);
    assert.throws(() => parseDiffArguments(['--stat']), /Unknown option/);
  });
});
