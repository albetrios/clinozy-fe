/**
 * `pnpm iteration:diff` — the summary of two iterations' `intake-files/` (files, screens via
 * `_index.md` Slugs, PRD / schema-routes / prototype, and the schema-routes entities, fields,
 * enums, routes and operations), the refusal when either side has no `intake-files/`, and the
 * missing-Baseline prompt. The same JSON shape as clinozy-be's.
 */
import { afterEach, describe, expect, it } from 'vitest';
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
  it('reads routes, entity fields, enum values and screen operations', () => {
    const model = parseSchemaRoutes(SCHEMA_ROUTES);
    expect([...model.routes.keys()]).toStrictEqual(['/alpha', '/beta']);
    expect([...model.entities.keys()]).toStrictEqual(['Patient', 'Note']);
    expect([...model.entities.get('Patient').keys()]).toStrictEqual(['id', 'name']);
    expect([...model.enums.get('gender').keys()]).toStrictEqual(['female', 'male']);
    expect([...model.operations.keys()]).toStrictEqual(['Alpha › listPatients']);
  });

  it('compares two files', () => {
    expect(
      compareSchemaRoutes({
        before: parseSchemaRoutes(SCHEMA_ROUTES),
        after: parseSchemaRoutes(CHANGED_SCHEMA_ROUTES),
      }),
    ).toStrictEqual({
      entities: { added: ['Invoice'], removed: ['Note'], changed: ['Patient'] },
      fields: { added: ['Patient.dob'], removed: [], changed: ['Patient.name'] },
      enums: { added: [], removed: [], changed: ['gender'] },
      routes: { added: ['/gamma'], removed: ['/beta'], changed: ['/alpha'] },
      operations: {
        added: ['Alpha › createPatient'],
        removed: [],
        changed: ['Alpha › listPatients'],
      },
    });
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

  it('names the files, screens, PRD, schema-routes and prototype changes', () => {
    const summary = summarizeIntakeDiff({
      repositoryRoot: twoDrops(),
      baseline: BASELINE,
      current: CURRENT,
    });
    expect(summary.files).toStrictEqual({
      added: ['gamma.md'],
      removed: ['beta.md'],
      changed: ['_index.md', 'alpha.md', 'schema-routes.md', 'support.js'],
    });
    expect(summary.screens).toStrictEqual({
      added: ['gamma'],
      removed: ['beta'],
      changed: ['alpha'],
    });
    expect(summary.prdChanged).toBe(false);
    expect(summary.schemaRoutesChanged).toBe(true);
    expect(summary.prototypeChanged).toBe(true);
    expect(summary.schemaRoutes.routes).toStrictEqual({
      added: ['/gamma'],
      removed: ['/beta'],
      changed: ['/alpha'],
    });
  });

  it('--json prints the summary; the text form adds the raw git diff', () => {
    const repositoryRoot = twoDrops();
    const json = runDiff([BASELINE, CURRENT, '--json'], { repositoryRoot });
    expect(Object.keys(JSON.parse(json.lines[0]))).toStrictEqual([
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
    expect(text).toMatch(/Screens \(via _index\.md\):\n {2}\+ added {3}\(1\): gamma/);
    expect(text).toMatch(/── git diff --no-index ──\ndiff --git/);
  });

  it('compares a brief that stores only BRIEF.md as its resolved snapshot, paths as in the repository', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: BASELINE,
      fields: { status: 'done' },
      intake: completeDrop(),
    });
    writeIteration({
      repositoryRoot,
      name: CURRENT,
      fields: {
        baseline: BASELINE,
        intakeMode: 'brief',
        intakeNote: `1 received (BRIEF.md) · ${Object.keys(completeDrop()).length} carried forward from ${BASELINE}`,
      },
      intake: { 'BRIEF.md': '# Brief\n' },
    });
    const summary = summarizeIntakeDiff({
      repositoryRoot,
      baseline: BASELINE,
      current: CURRENT,
    });
    expect(summary.files).toStrictEqual({
      added: ['BRIEF.md'],
      removed: [],
      changed: [],
    });
    expect(summary.schemaRoutesChanged).toBe(false);
    const text = runDiff([BASELINE, CURRENT], { repositoryRoot }).lines.join('\n');
    expect(text).toMatch(
      new RegExp(
        `diff --git a/iterations/${CURRENT}/intake-files/BRIEF\\.md b/iterations/${CURRENT}/intake-files/BRIEF\\.md\nnew file mode`,
      ),
    );
    expect(text).not.toMatch(/deleted file mode/);
  });

  it('refuses an iteration without intake-files/ — the delta is a diff of intake-files/ only', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: BASELINE, fields: { status: 'done' } });
    writeIteration({ repositoryRoot, name: CURRENT, intake: completeDrop() });
    expect(() =>
      summarizeIntakeDiff({ repositoryRoot, baseline: BASELINE, current: CURRENT }),
    ).toThrow(new RegExp(`${BASELINE} has no intake-files/`));
  });
});

describe('without a Baseline', () => {
  it('names the Baseline the user recorded, or says the iteration starts from scratch — never suggests one — and exits 2', () => {
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
      fields: { baseline: 'none' },
      intake: completeDrop(),
    });
    const scratch = runDiff([CURRENT], { repositoryRoot });
    expect(scratch.exitCode).toBe(2);
    expect(scratch.lines[0]).toMatch(
      /starts from scratch \(Baseline none\), so there is nothing to compare/,
    );
    expect(scratch.lines[0]).not.toMatch(/Suggested/);
    expect(scratch.lines[0]).not.toMatch(new RegExp(BASELINE));

    writeIteration({
      repositoryRoot,
      name: CURRENT,
      fields: { baseline: BASELINE },
      intake: completeDrop(),
    });
    const recorded = runDiff([CURRENT], { repositoryRoot });
    expect(recorded.exitCode).toBe(2);
    expect(recorded.lines[0]).toMatch(
      new RegExp(`Recorded in ${CURRENT}/README.md: ${BASELINE}`),
    );
    expect(recorded.lines[0]).toMatch(
      new RegExp(`Re-run: pnpm iteration:diff ${BASELINE} ${CURRENT}`),
    );
  });

  it('reads [<baseline>] <current> [--json]', () => {
    expect(parseDiffArguments([CURRENT])).toStrictEqual({
      baseline: undefined,
      current: CURRENT,
      json: false,
      help: false,
    });
    expect(parseDiffArguments([BASELINE, CURRENT, '--json'])).toStrictEqual({
      baseline: BASELINE,
      current: CURRENT,
      json: true,
      help: false,
    });
    expect(() => parseDiffArguments(['a', 'b', 'c'])).toThrow(/Too many arguments/);
    expect(() => parseDiffArguments(['--stat'])).toThrow(/Unknown option/);
  });
});
