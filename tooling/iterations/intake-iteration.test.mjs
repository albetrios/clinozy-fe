/**
 * `pnpm iteration:intake` — the frontend's required set, the lock from `approved`, conflicts
 * (diff and stop unless --replace, which only works while planning), `--both` into the sibling's
 * same-named iteration, and the README rows it fills. Any problem stops the intake with nothing
 * written.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import {
  cleanScratch,
  completeDrop,
  createRepository,
  SCHEMA_ROUTES,
  scratchFolder,
  TODAY,
  writeDrop,
  writeIteration,
} from './iteration-fixtures.mjs';
import {
  applyIntake,
  displaySourcePath,
  parseIntakeArguments,
  planIntake,
  runIntake,
} from './intake-iteration.mjs';
import { parseIterationReadme } from './iterations.mjs';

afterEach(cleanScratch);

const NAME = 'feat-returns-2026-10-06-kqzx';
const HASH = createHash('sha256').update(SCHEMA_ROUTES).digest('hex').slice(0, 12);

function setup({ status = 'planning', intake } = {}) {
  const repositoryRoot = createRepository();
  writeIteration({ repositoryRoot, name: NAME, fields: { status }, intake });
  const drop = writeDrop(join(scratchFolder(), 'drop'), completeDrop());
  return { repositoryRoot, drop };
}

const intakeNames = (repositoryRoot, iteration = NAME) =>
  readdirSync(join(repositoryRoot, 'iterations', iteration, 'intake-files')).sort();
const readmeFields = (repositoryRoot, iteration = NAME) =>
  parseIterationReadme(
    readFileSync(join(repositoryRoot, 'iterations', iteration, 'README.md'), 'utf-8'),
  );

describe('arguments and paths', () => {
  test('reads the flags; --sibling implies --both', () => {
    assert.deepEqual(
      parseIntakeArguments([
        NAME,
        '~/drop',
        '--replace',
        '--dry-run',
        '--sibling',
        '../x-be',
      ]),
      {
        iteration: NAME,
        source: '~/drop',
        createInSibling: true,
        siblingPath: '../x-be',
        replace: true,
        dryRun: true,
        help: false,
      },
    );
    assert.throws(
      () => parseIntakeArguments([NAME, 'drop', 'extra']),
      /Too many arguments/,
    );
  });

  test('shows the source repository-relative, home-relative or absolute', () => {
    assert.equal(
      displaySourcePath({ repositoryRoot: '/work/fe', source: '/work/fe/drops/a' }),
      'drops/a',
    );
    assert.equal(
      displaySourcePath({ repositoryRoot: '/work/fe', source: '/elsewhere/a' }),
      '/elsewhere/a',
    );
  });
});

describe('completeness', () => {
  test('copies a complete drop flat and fills Drop placed, Drop source and Schema-routes', () => {
    const { repositoryRoot, drop } = setup();
    writeFileSync(join(drop, 'README.md'), '# not copied\n');
    writeFileSync(join(drop, '.DS_Store'), '');
    mkdirSync(join(drop, 'screenshots'));
    const result = runIntake([NAME, drop], { repositoryRoot, today: TODAY });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(repositoryRoot), Object.keys(completeDrop()).sort());
    const fields = readmeFields(repositoryRoot);
    assert.equal(fields.get('Drop placed'), TODAY);
    assert.equal(fields.get('Drop source'), drop);
    assert.equal(fields.get('Schema-routes'), HASH);
    assert.ok(result.lines.some((line) => line.includes('skipped README.md')));
    assert.ok(result.lines.some((line) => line.includes('skipped screenshots/')));
  });

  test('a missing required file stops the intake with nothing written', () => {
    const { repositoryRoot } = setup();
    const { 'preset.md': _preset, 'beta.md': _beta, ...partial } = completeDrop();
    const missing = writeDrop(join(scratchFolder(), 'partial'), partial);
    const result = runIntake([NAME, missing], { repositoryRoot, today: TODAY });
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.lines.some((line) =>
        line.includes('missing required file(s): beta.md, preset.md'),
      ),
    );
    assert.equal(
      existsSync(join(repositoryRoot, 'iterations', NAME, 'intake-files')),
      false,
    );
    assert.equal(readmeFields(repositoryRoot).get('Drop placed'), '—');
  });

  test('warns about extras and screen files _index.md does not list, but still places the drop', () => {
    const { repositoryRoot, drop } = setup();
    writeFileSync(join(drop, 'gamma.md'), '# Screen: Gamma\n');
    writeFileSync(join(drop, 'notes.txt'), 'x');
    const result = runIntake([NAME, drop], { repositoryRoot, today: TODAY });
    assert.equal(result.exitCode, 0);
    assert.ok(
      result.lines.includes(
        '! extra file (not in the required or optional set): notes.txt',
      ),
    );
    assert.ok(result.lines.includes('! screen file not listed in _index.md: gamma.md'));
  });

  test("a dry run of the iteration's own intake-files/ passes — the planning Step 1 check", () => {
    const { repositoryRoot } = setup({ status: 'approved', intake: completeDrop() });
    const own = join(repositoryRoot, 'iterations', NAME, 'intake-files');
    const result = runIntake([NAME, own, '--dry-run'], { repositoryRoot });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.match(result.lines[0], /the drop passes/);
  });
});

describe('the lock and conflicts', () => {
  test('refuses any change once the Status is approved or later', () => {
    for (const status of ['approved', 'implementing', 'done', 'frozen']) {
      const { repositoryRoot, drop } = setup({ status });
      const result = runIntake([NAME, drop], { repositoryRoot });
      assert.equal(result.exitCode, 1, status);
      assert.ok(
        result.lines.some((line) =>
          line.includes(`the intake is locked (Status ${status})`),
        ),
        status,
      );
    }
  });

  test('a differing file shows its diff and stops; --replace overwrites only while planning', () => {
    const { repositoryRoot, drop } = setup({ intake: completeDrop() });
    writeFileSync(join(drop, 'alpha.md'), '# Screen: Alpha — redesigned\n');
    const conflict = runIntake([NAME, drop], { repositoryRoot });
    assert.equal(conflict.exitCode, 1);
    assert.ok(
      conflict.lines.some(
        (line) =>
          line.includes('intake-files/alpha.md differs from the drop') &&
          line.includes('redesigned'),
      ),
    );
    assert.equal(
      readFileSync(
        join(repositoryRoot, 'iterations', NAME, 'intake-files', 'alpha.md'),
        'utf-8',
      ),
      '# Screen: Alpha\n',
    );

    const replaced = runIntake([NAME, drop, '--replace'], {
      repositoryRoot,
      today: TODAY,
    });
    assert.equal(replaced.exitCode, 0);
    assert.equal(
      readFileSync(
        join(repositoryRoot, 'iterations', NAME, 'intake-files', 'alpha.md'),
        'utf-8',
      ),
      '# Screen: Alpha — redesigned\n',
    );

    const ready = setup({ status: 'ready-for-approval', intake: completeDrop() });
    writeFileSync(join(ready.drop, 'alpha.md'), 'changed\n');
    const refused = planIntake({
      repositoryRoot: ready.repositoryRoot,
      iteration: NAME,
      source: ready.drop,
      siblingRoot: undefined,
      replace: true,
    });
    assert.ok(
      refused.problems.some((problem) =>
        problem.includes('--replace overwrites only while Status is planning'),
      ),
    );
    assert.throws(() => applyIntake(refused), /only while Status is planning/);
  });
});

describe('--both', () => {
  function withSibling({
    siblingIntake,
    siblingStatus = 'planning',
    openSibling = true,
  } = {}) {
    const { repositoryRoot, drop } = setup();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(repositoryRoot),
    });
    if (openSibling)
      writeIteration({
        repositoryRoot: siblingRoot,
        name: NAME,
        fields: { status: siblingStatus },
        intake: siblingIntake,
      });
    return { repositoryRoot, drop, siblingRoot };
  }

  test('copies PRD.md and schema-routes.md into the sibling and fills its rows', () => {
    const { repositoryRoot, drop, siblingRoot } = withSibling();
    const result = runIntake([NAME, drop, '--both'], { repositoryRoot, today: TODAY });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(siblingRoot), ['PRD.md', 'schema-routes.md']);
    assert.equal(readmeFields(siblingRoot).get('Schema-routes'), HASH);
    assert.equal(readmeFields(siblingRoot).get('Drop placed'), TODAY);
  });

  test('stops when the sibling has no such iteration', () => {
    const { repositoryRoot, drop } = withSibling({ openSibling: false });
    const result = runIntake([NAME, drop, '--both'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.lines.some((line) =>
        line.includes('open it in both first: pnpm iteration:new <type> <topic> --both'),
      ),
    );
    assert.equal(
      existsSync(join(repositoryRoot, 'iterations', NAME, 'intake-files')),
      false,
    );
  });

  test('a differing sibling copy shows the diff and stops, unless --replace while the sibling is planning', () => {
    const differing = {
      'PRD.md': '# Demo — PRD, older\n',
      'schema-routes.md': SCHEMA_ROUTES,
    };
    const { repositoryRoot, drop, siblingRoot } = withSibling({
      siblingIntake: differing,
    });
    const stopped = runIntake([NAME, drop, '--both'], { repositoryRoot });
    assert.equal(stopped.exitCode, 1);
    assert.ok(
      stopped.lines.some((line) =>
        line.startsWith('Sibling repository: intake-files/PRD.md differs from the drop'),
      ),
    );
    assert.equal(
      existsSync(join(repositoryRoot, 'iterations', NAME, 'intake-files')),
      false,
    );

    assert.equal(
      runIntake([NAME, drop, '--both', '--replace'], { repositoryRoot, today: TODAY })
        .exitCode,
      0,
    );
    assert.equal(
      readFileSync(
        join(siblingRoot, 'iterations', NAME, 'intake-files', 'PRD.md'),
        'utf-8',
      ),
      '# Demo — PRD\n',
    );

    const locked = withSibling({ siblingIntake: differing, siblingStatus: 'approved' });
    const refused = runIntake([NAME, locked.drop, '--both', '--replace'], {
      repositoryRoot: locked.repositoryRoot,
    });
    assert.equal(refused.exitCode, 1);
    assert.ok(
      refused.lines.some((line) =>
        line.includes('Sibling repository: the intake is locked (Status approved)'),
      ),
    );
  });
});
