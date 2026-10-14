/**
 * `pnpm iteration:intake` — the three intake modes (full, overlay, brief): what each stores and the
 * snapshot each resolves to, the frontend's mandatory set on that snapshot, replacing a snapshot
 * (diff and stop unless --replace, which only works while planning), the lock from `approved`,
 * `--both` into the sibling's same-named iteration on its own Baseline, the README rows it fills,
 * the gate (`--check`) and `--compact`. Any problem stops the intake with nothing written.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { summarizeIntakeDiff } from './diff-iterations.mjs';
import {
  brief,
  cleanScratch,
  commitAll,
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
  renderIntakeNote,
  runIntake,
} from './intake-iteration.mjs';
import {
  intakeHash,
  parseIterationReadme,
  resolvedIntakeHash,
  resolveIntakeSnapshot,
} from './iterations.mjs';

afterEach(cleanScratch);

const NAME = 'feat-returns-2026-10-06-kqzx';
const LAUNCH = 'launch-2026-09-30-jxmr';
const SCHEMA_ROUTES_HASH = createHash('sha256')
  .update(SCHEMA_ROUTES)
  .digest('hex')
  .slice(0, 12);
const DROP_SIZE = Object.keys(completeDrop()).length;

const intakePath = (repositoryRoot, iteration = NAME) =>
  join(repositoryRoot, 'iterations', iteration, 'intake-files');
const intakeNames = (repositoryRoot, iteration = NAME) =>
  readdirSync(intakePath(repositoryRoot, iteration)).sort();
const readIntake = (repositoryRoot, name, iteration = NAME) =>
  readFileSync(join(intakePath(repositoryRoot, iteration), name), 'utf-8');
const readmeText = (repositoryRoot, iteration = NAME) =>
  readFileSync(join(repositoryRoot, 'iterations', iteration, 'README.md'), 'utf-8');
const readmeFields = (repositoryRoot, iteration = NAME) =>
  parseIterationReadme(readmeText(repositoryRoot, iteration));
const hasLine = (result, text) => result.lines.some((line) => line.includes(text));
const setStatus = (repositoryRoot, iteration, status) => {
  const readme = join(repositoryRoot, 'iterations', iteration, 'README.md');
  writeFileSync(
    readme,
    readFileSync(readme, 'utf-8').replace(
      /\| Status \| [a-z-]+ \|/,
      `| Status | ${status} |`,
    ),
  );
};

/** A repository with the iteration under test and a complete drop in a scratch folder. */
function setup({ status = 'planning', intake } = {}) {
  const repositoryRoot = createRepository();
  writeIteration({ repositoryRoot, name: NAME, fields: { status }, intake });
  const drop = writeDrop(join(scratchFolder(), 'drop'), completeDrop());
  return { repositoryRoot, drop };
}

/** A repository whose launch (done, complete intake) is the Baseline of the iteration under test. */
function withBaseline({ fields = {} } = {}) {
  const repositoryRoot = createRepository();
  writeIteration({
    repositoryRoot,
    name: LAUNCH,
    fields: { status: 'done' },
    intake: completeDrop(),
  });
  writeIteration({ repositoryRoot, name: NAME, fields: { baseline: LAUNCH, ...fields } });
  return repositoryRoot;
}

describe('arguments and paths', () => {
  test('reads the flags and values; --sibling implies --both', () => {
    assert.deepEqual(
      parseIntakeArguments([
        NAME,
        '~/drop',
        '--mode=overlay',
        '--replace',
        '--dry-run',
        '--sibling',
        '../x-be',
      ]),
      {
        iteration: NAME,
        source: '~/drop',
        mode: 'overlay',
        check: false,
        compact: false,
        baseline: undefined,
        createInSibling: true,
        siblingPath: '../x-be',
        replace: true,
        dryRun: true,
        help: false,
      },
    );
    assert.equal(parseIntakeArguments([NAME, 'drop']).mode, 'full');
    const check = parseIntakeArguments([NAME, '--check', '--baseline', LAUNCH]);
    assert.equal(check.check, true);
    assert.equal(check.baseline, LAUNCH);
    const compact = parseIntakeArguments([NAME, '--compact', '--dry-run']);
    assert.equal(compact.compact, true);
    assert.equal(compact.dryRun, true);
  });

  test('--compact takes only the iteration and --dry-run', () => {
    for (const commandLine of [
      [NAME, 'drop', '--compact'],
      [NAME, '--compact', '--check'],
      [NAME, '--compact', '--mode', 'brief'],
      [NAME, '--compact', '--replace'],
      [NAME, '--compact', '--both'],
    ]) {
      assert.throws(
        () => parseIntakeArguments(commandLine),
        /--(compact|check) takes only/,
      );
    }
  });

  test('refuses an unknown mode, --check mixed with intake options, and a lone --baseline', () => {
    assert.throws(
      () => parseIntakeArguments([NAME, 'drop', '--mode', 'partial']),
      /Unknown --mode "partial"/,
    );
    assert.throws(() => parseIntakeArguments([NAME, 'drop', '--mode']), /needs a value/);
    assert.throws(
      () => parseIntakeArguments([NAME, 'drop', '--check']),
      /--check takes only/,
    );
    assert.throws(
      () => parseIntakeArguments([NAME, '--check', '--mode', 'brief']),
      /--check takes only/,
    );
    assert.throws(
      () => parseIntakeArguments([NAME, 'drop', '--baseline', LAUNCH]),
      /--baseline works only with --check/,
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

  test('renders the Intake note: received, then carried forward from the Baseline', () => {
    assert.equal(
      renderIntakeNote({
        mode: 'full',
        taken: ['a', 'b'],
        total: 2,
        baseline: undefined,
      }),
      '2 received',
    );
    assert.equal(
      renderIntakeNote({
        mode: 'overlay',
        taken: ['a.md', 'b.md'],
        total: 9,
        baseline: LAUNCH,
      }),
      `2 received (a.md, b.md) · 7 carried forward from ${LAUNCH}`,
    );
  });
});

describe('full mode', () => {
  test('copies a complete drop flat and fills the six intake rows', () => {
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
    assert.equal(fields.get('Intake mode'), 'full');
    assert.equal(fields.get('Intake note'), `${DROP_SIZE} received`);
    assert.equal(fields.get('Schema-routes'), SCHEMA_ROUTES_HASH);
    assert.equal(fields.get('Intake hash'), intakeHash(intakePath(repositoryRoot)));
    assert.ok(hasLine(result, 'skipped README.md'));
    assert.ok(hasLine(result, 'skipped screenshots/'));
    assert.ok(hasLine(result, 'planning runs the gate first'));
  });

  test('a missing mandatory file stops the intake with nothing written', () => {
    const { repositoryRoot } = setup();
    const { 'preset.md': _preset, 'beta.md': _beta, ...partial } = completeDrop();
    const missing = writeDrop(join(scratchFolder(), 'partial'), partial);
    const result = runIntake([NAME, missing], { repositoryRoot, today: TODAY });
    assert.equal(result.exitCode, 1);
    assert.ok(hasLine(result, 'missing mandatory file(s): beta.md, preset.md'));
    assert.equal(existsSync(intakePath(repositoryRoot)), false);
    assert.equal(readmeFields(repositoryRoot).get('Drop placed'), '—');
  });

  test('an optional file _index.md names is mandatory', () => {
    const { repositoryRoot } = setup();
    const { '_patterns.md': _patterns, ...drop } = completeDrop();
    drop['_index.md'] += '\nShared: `_patterns.md` (drawer, table).\n';
    const source = writeDrop(join(scratchFolder(), 'drop'), drop);
    const result = runIntake([NAME, source], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(hasLine(result, 'missing mandatory file(s): _patterns.md'));
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

  test('the same drop again changes nothing; a dry run writes nothing', () => {
    const { repositoryRoot, drop } = setup();
    const dry = runIntake([NAME, drop, '--dry-run'], { repositoryRoot });
    assert.equal(dry.exitCode, 0, dry.lines.join('\n'));
    assert.match(dry.lines[0], /the snapshot passes/);
    assert.equal(existsSync(intakePath(repositoryRoot)), false);
    assert.equal(runIntake([NAME, drop], { repositoryRoot, today: TODAY }).exitCode, 0);
    const readme = readmeText(repositoryRoot);
    const again = runIntake([NAME, drop], { repositoryRoot, today: '2026-10-09' });
    assert.equal(again.exitCode, 0);
    assert.ok(hasLine(again, `0 new, 0 replaced, 0 removed, ${DROP_SIZE} unchanged`));
    assert.equal(readmeText(repositoryRoot), readme);
  });

  test('the launch is always full', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: LAUNCH });
    const drop = writeDrop(join(scratchFolder(), 'drop'), completeDrop());
    const result = runIntake([LAUNCH, drop, '--mode', 'overlay'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(hasLine(result, 'The launch is always --mode full'));
  });
});

describe('replacing a snapshot', () => {
  test('a different drop shows its diff and stops; --replace replaces the whole snapshot while planning', () => {
    const { repositoryRoot, drop } = setup({ intake: completeDrop() });
    writeFileSync(join(drop, 'alpha.md'), '# Screen: Alpha — redesigned\n');
    rmSync(join(drop, '_patterns.md'));
    const conflict = runIntake([NAME, drop], { repositoryRoot });
    assert.equal(conflict.exitCode, 1);
    assert.ok(
      conflict.lines.some(
        (line) =>
          line.includes('intake-files/alpha.md differs from the new snapshot') &&
          line.includes('redesigned'),
      ),
    );
    assert.ok(
      hasLine(
        conflict,
        'already holds a different snapshot (changed: alpha.md · removed: _patterns.md) — re-run with --replace',
      ),
    );
    assert.equal(readIntake(repositoryRoot, 'alpha.md'), '# Screen: Alpha\n');

    const replaced = runIntake([NAME, drop, '--replace'], {
      repositoryRoot,
      today: TODAY,
    });
    assert.equal(replaced.exitCode, 0, replaced.lines.join('\n'));
    assert.equal(
      readIntake(repositoryRoot, 'alpha.md'),
      '# Screen: Alpha — redesigned\n',
    );
    assert.equal(existsSync(join(intakePath(repositoryRoot), '_patterns.md')), false);
    assert.equal(
      readmeFields(repositoryRoot).get('Intake hash'),
      intakeHash(intakePath(repositoryRoot)),
    );
  });

  test('--replace works only while planning', () => {
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
        problem.includes('--replace replaces a snapshot only while Status is planning'),
      ),
    );
    assert.throws(() => applyIntake(refused), /only while Status is planning/);
  });

  test('refuses any change once the Status is approved or later — files or the recorded hash', () => {
    for (const status of ['approved', 'implementing', 'done', 'frozen']) {
      const { repositoryRoot, drop } = setup({ status });
      const result = runIntake([NAME, drop], { repositoryRoot });
      assert.equal(result.exitCode, 1, status);
      assert.ok(hasLine(result, `the intake is locked (Status ${status})`), status);
    }
    const { repositoryRoot } = setup({ status: 'approved', intake: completeDrop() });
    writeFileSync(
      join(intakePath(repositoryRoot), 'alpha.md'),
      'edited after approval\n',
    );
    const rerecord = runIntake([NAME, intakePath(repositoryRoot)], { repositoryRoot });
    assert.equal(rerecord.exitCode, 1);
    assert.ok(hasLine(rerecord, 'the intake is locked (Status approved)'));
  });
});

describe('overlay mode', () => {
  test("stores the received files, resolved over the Baseline's snapshot", () => {
    const repositoryRoot = withBaseline();
    const received = writeDrop(join(scratchFolder(), 'changes'), {
      'alpha.md': '# Screen: Alpha — with a returns badge\n',
      '_index.md': `${completeDrop()['_index.md']}| gamma | /gamma | Third |\n`,
      'gamma.md': '# Screen: Gamma\n',
    });
    const result = runIntake([NAME, received, '--mode', 'overlay'], {
      repositoryRoot,
      today: TODAY,
    });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(repositoryRoot), ['_index.md', 'alpha.md', 'gamma.md']);
    assert.equal(
      readIntake(repositoryRoot, 'alpha.md'),
      '# Screen: Alpha — with a returns badge\n',
    );
    const { files } = resolveIntakeSnapshot({ repositoryRoot, iteration: NAME });
    assert.deepEqual(
      [...files.keys()].sort(),
      [...Object.keys(completeDrop()), 'gamma.md'].sort(),
    );
    assert.equal(
      files.get('beta.md'),
      join(intakePath(repositoryRoot, LAUNCH), 'beta.md'),
    );
    const fields = readmeFields(repositoryRoot);
    assert.equal(fields.get('Intake mode'), 'overlay');
    assert.equal(
      fields.get('Intake note'),
      `3 received (_index.md, alpha.md, gamma.md) · ${DROP_SIZE - 2} carried forward from ${LAUNCH}`,
    );
    assert.equal(
      fields.get('Intake hash'),
      resolvedIntakeHash({ repositoryRoot, iteration: NAME }),
    );
    assert.equal(fields.get('Schema-routes'), SCHEMA_ROUTES_HASH);
    assert.equal(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
      0,
    );
  });

  test('needs a Baseline the user named and at least one received file', () => {
    const received = writeDrop(join(scratchFolder(), 'changes'), { 'alpha.md': 'x\n' });
    const scratch = runIntake([NAME, received, '--mode', 'overlay'], {
      repositoryRoot: withBaseline({ fields: { baseline: 'none' } }),
    });
    assert.equal(scratch.exitCode, 1);
    assert.ok(hasLine(scratch, `${NAME} starts from scratch (Baseline none)`));
    assert.ok(
      hasLine(scratch, `record it first: pnpm iteration:baseline ${NAME} <baseline>`),
    );

    const repositoryRoot = withBaseline({ fields: { baseline: '—' } });
    const noBaseline = runIntake([NAME, received, '--mode', 'overlay'], {
      repositoryRoot,
    });
    assert.equal(noBaseline.exitCode, 1);
    assert.ok(
      hasLine(noBaseline, `${NAME} has no Baseline (—) — record none, the default`),
    );

    const withLaunch = withBaseline();
    const empty = writeDrop(join(scratchFolder(), 'empty'), {});
    const nothing = runIntake([NAME, empty, '--mode', 'overlay'], {
      repositoryRoot: withLaunch,
    });
    assert.equal(nothing.exitCode, 1);
    assert.ok(hasLine(nothing, '--mode overlay needs at least one received file'));
  });

  test('refuses a Baseline that fails the gate', () => {
    const repositoryRoot = withBaseline();
    writeFileSync(join(intakePath(repositoryRoot, LAUNCH), 'beta.md'), 'edited\n');
    const received = writeDrop(join(scratchFolder(), 'changes'), { 'alpha.md': 'x\n' });
    const result = runIntake([NAME, received, '--mode', 'overlay'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(
      hasLine(result, `the Baseline ${LAUNCH} fails the gate — changed since the intake`),
    );
    assert.equal(existsSync(intakePath(repositoryRoot)), false);
  });

  test('checks the mandatory set on the resulting snapshot', () => {
    const repositoryRoot = withBaseline();
    const received = writeDrop(join(scratchFolder(), 'changes'), {
      '_index.md': `${completeDrop()['_index.md']}| gamma | /gamma | Third |\n`,
    });
    const result = runIntake([NAME, received, '--mode', 'overlay'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(hasLine(result, 'The snapshot is missing mandatory file(s): gamma.md'));
  });
});

describe('brief from scratch (Baseline none, the default)', () => {
  /** A repository whose iteration under test starts from scratch, beside a finished launch. */
  function fromScratch() {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: LAUNCH,
      fields: { status: 'done' },
      intake: completeDrop(),
    });
    writeIteration({ repositoryRoot, name: NAME, fields: { baseline: 'none' } });
    return repositoryRoot;
  }

  test('is the BRIEF.md alone — nothing carried forward — and passes the gate', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    const result = runIntake([NAME, folder, '--mode', 'brief'], {
      repositoryRoot,
      today: TODAY,
    });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(repositoryRoot), ['BRIEF.md']);
    const fields = readmeFields(repositoryRoot);
    assert.equal(fields.get('Intake mode'), 'brief');
    assert.equal(fields.get('Intake note'), '1 received (BRIEF.md) · from scratch');
    assert.equal(fields.get('Baseline'), 'none');
    assert.equal(runIntake([NAME, '--check'], { repositoryRoot }).exitCode, 0);
  });

  test('refuses design files beside the BRIEF.md — those go in with --mode full', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), {
      'BRIEF.md': brief(),
      'alpha.md': '# Screen: Alpha\n',
    });
    const result = runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(
      hasLine(
        result,
        'a brief from scratch is BRIEF.md alone, but alpha.md also came in',
      ),
    );
    assert.equal(existsSync(intakePath(repositoryRoot)), false);
  });

  test('the gate fails when its BRIEF.md is gone or a Baseline is recorded after the intake', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    assert.equal(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot }).exitCode,
      0,
    );
    const readme = join(repositoryRoot, 'iterations', NAME, 'README.md');
    writeFileSync(
      readme,
      readFileSync(readme, 'utf-8').replace(
        '| Baseline | none |',
        `| Baseline | ${LAUNCH} |`,
      ),
    );
    const moved = runIntake([NAME, '--check'], { repositoryRoot });
    assert.equal(moved.exitCode, 1);
    assert.ok(
      hasLine(
        moved,
        `built on no Baseline (from scratch), but the README's Baseline is ${LAUNCH}`,
      ),
    );
  });

  test('--compact has nothing to compact: the BRIEF.md is the whole snapshot', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    assert.equal(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot }).exitCode,
      0,
    );
    const result = runIntake([NAME, '--compact'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(hasLine(result, 'is a brief from scratch — it stores only its BRIEF.md'));
    assert.deepEqual(intakeNames(repositoryRoot), ['BRIEF.md']);
  });
});

describe('brief mode', () => {
  test("stores only BRIEF.md, resolves to the Baseline's snapshot plus it — and the diff shows nothing else", () => {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), {
      'BRIEF.md': brief(),
      'PRD.md': completeDrop()['PRD.md'],
    });
    const result = runIntake([NAME, folder, '--mode', 'brief'], {
      repositoryRoot,
      today: TODAY,
    });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(repositoryRoot), ['BRIEF.md']);
    const fields = readmeFields(repositoryRoot);
    assert.equal(fields.get('Intake mode'), 'brief');
    assert.equal(
      fields.get('Intake hash'),
      resolvedIntakeHash({ repositoryRoot, iteration: NAME }),
    );
    assert.equal(
      fields.get('Intake note'),
      `1 received (BRIEF.md) · ${DROP_SIZE} carried forward from ${LAUNCH}`,
    );
    const diff = summarizeIntakeDiff({ repositoryRoot, baseline: LAUNCH, current: NAME });
    assert.deepEqual(diff.files, { added: ['BRIEF.md'], removed: [], changed: [] });
    assert.equal(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
      0,
    );
  });

  test('takes the BRIEF.md file itself as the source', () => {
    const repositoryRoot = withBaseline();
    const file = join(
      writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() }),
      'BRIEF.md',
    );
    const result = runIntake([NAME, file, '--mode', 'brief'], { repositoryRoot });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.equal(readIntake(repositoryRoot, 'BRIEF.md'), brief());
  });

  test('needs a BRIEF.md with every template section', () => {
    const repositoryRoot = withBaseline();
    const none = writeDrop(join(scratchFolder(), 'none'), { 'notes.md': 'x\n' });
    const missing = runIntake([NAME, none, '--mode', 'brief'], { repositoryRoot });
    assert.equal(missing.exitCode, 1);
    assert.ok(hasLine(missing, '--mode brief needs a received BRIEF.md'));

    const thin = writeDrop(join(scratchFolder(), 'thin'), {
      'BRIEF.md': brief().replace('## Acceptance criteria', '## Done when'),
    });
    const incomplete = runIntake([NAME, thin, '--mode', 'brief'], { repositoryRoot });
    assert.equal(incomplete.exitCode, 1);
    assert.ok(hasLine(incomplete, 'BRIEF.md is missing section(s): Acceptance criteria'));
  });

  test('refuses any other changed file', () => {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), {
      'BRIEF.md': brief(),
      'alpha.md': '# Screen: Alpha — changed\n',
      'gamma.md': '# Screen: Gamma\n',
    });
    const result = runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(
      hasLine(
        result,
        `--mode brief changes only BRIEF.md, but alpha.md, gamma.md differ from the Baseline ${LAUNCH}`,
      ),
    );
    assert.equal(existsSync(intakePath(repositoryRoot)), false);
  });
});

describe('the gate (--check)', () => {
  /** The iteration under test with a brief intake on the launch, committed. */
  function briefed() {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    assert.equal(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot }).exitCode,
      0,
    );
    commitAll(repositoryRoot, 'intake', 2_000);
    return repositoryRoot;
  }
  const gate = (repositoryRoot, ...options) =>
    runIntake([NAME, '--check', ...options], { repositoryRoot });

  test('a clean intake passes, with its Baseline', () => {
    const repositoryRoot = briefed();
    const result = gate(repositoryRoot, '--baseline', LAUNCH);
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.ok(
      hasLine(
        result,
        `✓ iterations/${NAME}/intake-files/ — ${DROP_SIZE + 1} files (1 stored, ${DROP_SIZE} from ${LAUNCH})`,
      ),
    );
    assert.ok(hasLine(result, `✓ iterations/${LAUNCH}/intake-files/`));
    assert.equal(result.lines.at(-1), 'Gate passed.');
  });

  test('a missing mandatory file fails, naming the folder, the file and the fix', () => {
    const repositoryRoot = setup().repositoryRoot;
    const drop = { ...completeDrop() };
    delete drop['shell.md'];
    writeIteration({
      repositoryRoot,
      name: NAME,
      fields: { intakeMode: 'full', intakeHash: 'aaaaaaaaaaaa' },
      intake: drop,
    });
    const result = gate(repositoryRoot);
    assert.equal(result.exitCode, 1);
    assert.match(result.lines[0], /^Gate failed — 2 problems\. Stop here/);
    assert.ok(
      result.lines.includes(
        `✗ iterations/${NAME}/intake-files/: missing mandatory file(s): shell.md`,
      ),
    );
    assert.ok(
      result.lines.includes(
        `    fix: re-run the intake: pnpm iteration:intake ${NAME} <source> --replace`,
      ),
    );
  });

  test('a brief whose BRIEF.md is removed stores nothing: no intake yet', () => {
    const repositoryRoot = briefed();
    rmSync(join(intakePath(repositoryRoot), 'BRIEF.md'));
    const result = gate(repositoryRoot);
    assert.equal(result.exitCode, 1);
    assert.ok(result.lines.includes(`✗ iterations/${NAME}/intake-files/: no intake yet`));
  });

  test("a file missing from the Baseline's intake fails in the Baseline's folder — and in each iteration resolved through it", () => {
    const repositoryRoot = briefed();
    rmSync(join(intakePath(repositoryRoot, LAUNCH), 'shell.md'));
    const result = gate(repositoryRoot, '--baseline', LAUNCH);
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.lines.includes(
        `✗ iterations/${NAME}/intake-files/: missing mandatory file(s): shell.md`,
      ),
    );
    assert.ok(
      hasLine(
        result,
        `a change anywhere in the Baseline chain (${LAUNCH}) changes it too: pnpm iteration:intake ${LAUNCH} --check`,
      ),
    );
    assert.ok(
      result.lines.includes(
        `✗ iterations/${LAUNCH}/intake-files/: missing mandatory file(s): shell.md`,
      ),
    );
    assert.ok(
      hasLine(result, `move it back first (pnpm iteration:status ${LAUNCH} planning`),
    );
  });

  test('an edited file fails on the Intake hash and names the file git saw change', () => {
    const repositoryRoot = briefed();
    const recorded = readmeFields(repositoryRoot).get('Intake hash');
    writeFileSync(
      join(intakePath(repositoryRoot), 'BRIEF.md'),
      `${brief()}\nA late edit.\n`,
    );
    const uncommitted = gate(repositoryRoot);
    assert.equal(uncommitted.exitCode, 1);
    assert.ok(
      uncommitted.lines.includes(
        `✗ iterations/${NAME}/intake-files/: changed since the intake — the Intake hash is ${resolvedIntakeHash({ repositoryRoot, iteration: NAME })}, the README records ${recorded}`,
      ),
    );
    assert.ok(uncommitted.lines.includes('    Uncommitted: modified BRIEF.md'));
    assert.ok(
      hasLine(uncommitted, 'fix: restore the delivered files (git restore --source=HEAD'),
    );

    commitAll(repositoryRoot, 'edit an intake file', 3_000);
    const committed = gate(repositoryRoot);
    assert.equal(committed.exitCode, 1);
    assert.ok(hasLine(committed, 'No uncommitted change — a commit changed it'));
  });

  test('an intake that is not committed yet still fails on the hash', () => {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot });
    writeFileSync(join(intakePath(repositoryRoot), 'notes.md'), 'added later\n');
    const result = gate(repositoryRoot);
    assert.equal(result.exitCode, 1);
    assert.ok(
      hasLine(result, 'is not committed yet, so git cannot name the changed file'),
    );
  });

  test('fails when there is no intake, or the Baseline is not the one the snapshot was built on', () => {
    const empty = setup().repositoryRoot;
    const none = runIntake([NAME, '--check'], { repositoryRoot: empty });
    assert.equal(none.exitCode, 1);
    assert.ok(none.lines.includes(`✗ iterations/${NAME}/intake-files/: no intake yet`));

    const repositoryRoot = briefed();
    const other = gate(repositoryRoot, '--baseline', 'feat-other-2026-10-01-abcd');
    assert.equal(other.exitCode, 1);
    assert.ok(
      hasLine(other, `the Baseline is ${LAUNCH}, not feat-other-2026-10-01-abcd`),
    );

    const readme = join(repositoryRoot, 'iterations', NAME, 'README.md');
    writeFileSync(
      readme,
      readFileSync(readme, 'utf-8').replace(
        `| Baseline | ${LAUNCH} |`,
        '| Baseline | none |',
      ),
    );
    // On Baseline none the brief stands alone — BRIEF.md is its whole snapshot — so the snapshot
    // resolves, but it was built on the launch and its hash covered the launch's files too.
    const rebased = gate(repositoryRoot);
    assert.equal(rebased.exitCode, 1);
    assert.ok(!hasLine(rebased, 'cannot be resolved'));
    assert.ok(hasLine(rebased, 'changed since the intake'));
    assert.ok(
      hasLine(
        rebased,
        `the brief snapshot was built on ${LAUNCH}, but the README's Baseline is none`,
      ),
    );
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

  /** This repository and the sibling, each with its own Baseline for the iteration under test. */
  function withBaselines() {
    const repositoryRoot = withBaseline();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(repositoryRoot),
    });
    const siblingBaseline = 'fix-api-2026-10-02-abcd';
    writeIteration({
      repositoryRoot: siblingRoot,
      name: siblingBaseline,
      fields: { status: 'done' },
      intake: {
        'PRD.md': completeDrop()['PRD.md'],
        'schema-routes.md': SCHEMA_ROUTES,
        'design-overview.md': '# Overview\n',
      },
    });
    writeIteration({
      repositoryRoot: siblingRoot,
      name: NAME,
      fields: { baseline: siblingBaseline },
    });
    return { repositoryRoot, siblingRoot, siblingBaseline };
  }

  test('full: copies PRD.md and schema-routes.md into the sibling and fills its rows', () => {
    const { repositoryRoot, drop, siblingRoot } = withSibling();
    const result = runIntake([NAME, drop, '--both'], { repositoryRoot, today: TODAY });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(siblingRoot), ['PRD.md', 'schema-routes.md']);
    const fields = readmeFields(siblingRoot);
    assert.equal(fields.get('Schema-routes'), SCHEMA_ROUTES_HASH);
    assert.equal(fields.get('Drop placed'), TODAY);
    assert.equal(fields.get('Intake mode'), 'full');
    assert.equal(fields.get('Intake note'), '2 received');
    assert.equal(fields.get('Intake hash'), intakeHash(intakePath(siblingRoot)));
  });

  test('overlay: builds the sibling snapshot on its own Baseline', () => {
    const { repositoryRoot, siblingRoot, siblingBaseline } = withBaselines();
    const received = writeDrop(join(scratchFolder(), 'changes'), {
      'PRD.md': '# Demo — PRD, with returns\n',
    });
    const result = runIntake([NAME, received, '--mode', 'overlay', '--both'], {
      repositoryRoot,
      today: TODAY,
    });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(siblingRoot), ['PRD.md', 'schema-routes.md']);
    assert.deepEqual(
      [
        ...resolveIntakeSnapshot({
          repositoryRoot: siblingRoot,
          iteration: NAME,
        }).files.keys(),
      ].sort(),
      ['PRD.md', 'design-overview.md', 'schema-routes.md'],
    );
    assert.equal(readIntake(siblingRoot, 'PRD.md'), '# Demo — PRD, with returns\n');
    assert.equal(
      readmeFields(siblingRoot).get('Intake note'),
      `2 received (PRD.md, schema-routes.md) · 1 carried forward from ${siblingBaseline}`,
    );
  });

  test('brief: sends BRIEF.md onto the sibling Baseline, whose shared files must match', () => {
    const { repositoryRoot, siblingRoot, siblingBaseline } = withBaselines();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    const result = runIntake([NAME, folder, '--mode', 'brief', '--both'], {
      repositoryRoot,
    });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.equal(readIntake(siblingRoot, 'BRIEF.md'), brief());
    assert.equal(
      readmeFields(siblingRoot).get('Intake note'),
      `1 received (BRIEF.md) · 3 carried forward from ${siblingBaseline}`,
    );

    const drifted = withBaselines();
    writeIteration({
      repositoryRoot: drifted.siblingRoot,
      name: drifted.siblingBaseline,
      fields: { status: 'done' },
      intake: {
        'PRD.md': '# Demo — PRD, backend edit\n',
        'schema-routes.md': SCHEMA_ROUTES,
      },
    });
    const stopped = runIntake([NAME, folder, '--mode', 'brief', '--both'], {
      repositoryRoot: drifted.repositoryRoot,
    });
    assert.equal(stopped.exitCode, 1);
    assert.ok(
      hasLine(
        stopped,
        `Sibling repository: --mode brief changes only BRIEF.md, but PRD.md differs from the Baseline ${drifted.siblingBaseline}`,
      ),
    );
  });

  test('stops when the sibling has no such iteration, or no Baseline for an overlay', () => {
    const { repositoryRoot, drop } = withSibling({ openSibling: false });
    const result = runIntake([NAME, drop, '--both'], { repositoryRoot });
    assert.equal(result.exitCode, 1);
    assert.ok(
      hasLine(result, 'open it in both first: pnpm iteration:new <type> <topic> --both'),
    );
    assert.equal(existsSync(intakePath(repositoryRoot)), false);

    const { repositoryRoot: local, siblingRoot } = withBaselines();
    writeIteration({
      repositoryRoot: siblingRoot,
      name: NAME,
      fields: { baseline: '—' },
    });
    const received = writeDrop(join(scratchFolder(), 'changes'), { 'PRD.md': 'x\n' });
    const noBaseline = runIntake([NAME, received, '--mode', 'overlay', '--both'], {
      repositoryRoot: local,
    });
    assert.equal(noBaseline.exitCode, 1);
    assert.ok(hasLine(noBaseline, `Sibling repository: ${NAME} has no Baseline (—)`));
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
        line.startsWith(
          'Sibling repository: intake-files/PRD.md differs from the new snapshot',
        ),
      ),
    );
    assert.equal(existsSync(intakePath(repositoryRoot)), false);

    assert.equal(
      runIntake([NAME, drop, '--both', '--replace'], { repositoryRoot, today: TODAY })
        .exitCode,
      0,
    );
    assert.equal(readIntake(siblingRoot, 'PRD.md'), '# Demo — PRD\n');

    const locked = withSibling({ siblingIntake: differing, siblingStatus: 'approved' });
    const refused = runIntake([NAME, locked.drop, '--both', '--replace'], {
      repositoryRoot: locked.repositoryRoot,
    });
    assert.equal(refused.exitCode, 1);
    assert.ok(
      hasLine(refused, 'Sibling repository: the intake is locked (Status approved)'),
    );
  });
});

describe('--compact', () => {
  /**
   * The iteration under test as every brief used to be placed: committed, with the launch's files
   * copied into its own `intake-files/` beside `BRIEF.md`, and the README's hash over all of them.
   */
  function legacyBrief({ status = 'frozen' } = {}) {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    assert.equal(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot, today: TODAY })
        .exitCode,
      0,
    );
    writeDrop(intakePath(repositoryRoot), completeDrop());
    setStatus(repositoryRoot, NAME, status);
    commitAll(repositoryRoot, 'legacy brief', 2_000);
    return repositoryRoot;
  }
  const compact = (repositoryRoot, ...options) =>
    runIntake([NAME, '--compact', ...options], { repositoryRoot });

  test('a legacy full copy hashes the same as what it resolves to', () => {
    const repositoryRoot = legacyBrief();
    assert.equal(intakeNames(repositoryRoot).length, DROP_SIZE + 1);
    assert.equal(
      intakeHash(intakePath(repositoryRoot)),
      readmeFields(repositoryRoot).get('Intake hash'),
    );
    assert.equal(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
      0,
    );
  });

  test("removes the copies of the Baseline's files and keeps what was received, even when frozen", () => {
    const repositoryRoot = legacyBrief();
    const readmeBefore = readmeText(repositoryRoot);
    const result = compact(repositoryRoot);
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(repositoryRoot), ['BRIEF.md']);
    const hash = readmeFields(repositoryRoot).get('Intake hash');
    assert.match(
      result.lines[0],
      new RegExp(
        `^Compacted iterations/${NAME}/intake-files/: removed ${DROP_SIZE} copies identical to ${LAUNCH} \\(.+\\) · kept BRIEF\\.md · Intake hash ${hash} unchanged$`,
      ),
    );
    assert.equal(readmeText(repositoryRoot), readmeBefore);
    assert.equal(resolvedIntakeHash({ repositoryRoot, iteration: NAME }), hash);
    assert.equal(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
      0,
    );
    const again = compact(repositoryRoot);
    assert.equal(again.exitCode, 0);
    assert.match(again.lines[0], /already stores only what arrived — kept BRIEF\.md/);
  });

  test('--dry-run removes nothing', () => {
    const repositoryRoot = legacyBrief();
    const result = compact(repositoryRoot, '--dry-run');
    assert.equal(result.exitCode, 0);
    assert.match(result.lines[0], /^Dry run — nothing removed; would remove /);
    assert.equal(intakeNames(repositoryRoot).length, DROP_SIZE + 1);
  });

  test('keeps a stored file that differs from the Baseline’s', () => {
    const repositoryRoot = withBaseline();
    const received = writeDrop(join(scratchFolder(), 'changes'), {
      'alpha.md': '# Screen: Alpha — with a returns badge\n',
    });
    assert.equal(
      runIntake([NAME, received, '--mode', 'overlay'], { repositoryRoot }).exitCode,
      0,
    );
    writeDrop(intakePath(repositoryRoot), {
      'beta.md': completeDrop()['beta.md'],
      'shell.md': completeDrop()['shell.md'],
    });
    commitAll(repositoryRoot, 'legacy overlay', 2_000);
    const result = compact(repositoryRoot);
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(repositoryRoot), ['alpha.md']);
    assert.equal(
      readIntake(repositoryRoot, 'alpha.md'),
      '# Screen: Alpha — with a returns badge\n',
    );
  });

  test('refuses a full intake, and an intake that fails the gate', () => {
    const repositoryRoot = withBaseline();
    const launch = runIntake([LAUNCH, '--compact'], { repositoryRoot });
    assert.equal(launch.exitCode, 1);
    assert.ok(hasLine(launch, 'is a full intake — it stores the whole drop'));
    assert.equal(launch.lines.at(-1), 'Nothing removed.');

    const failing = legacyBrief();
    writeFileSync(join(intakePath(failing), 'BRIEF.md'), `${brief()}\nEdited.\n`);
    const refused = compact(failing);
    assert.equal(refused.exitCode, 1);
    assert.ok(hasLine(refused, 'the gate fails first — changed since the intake'));
    assert.equal(intakeNames(failing).length, DROP_SIZE + 1);
  });
});

describe('resolving a snapshot', () => {
  test('follows a chain of layered intakes, the nearest file winning', () => {
    const repositoryRoot = withBaseline();
    const first = writeDrop(join(scratchFolder(), 'first'), {
      'alpha.md': '# Screen: Alpha — first\n',
    });
    assert.equal(
      runIntake([NAME, first, '--mode', 'overlay'], { repositoryRoot }).exitCode,
      0,
    );
    setStatus(repositoryRoot, NAME, 'done');
    const next = 'fix-badge-2026-10-08-wxyz';
    writeIteration({ repositoryRoot, name: next, fields: { baseline: NAME } });
    const second = writeDrop(join(scratchFolder(), 'second'), { 'BRIEF.md': brief() });
    const result = runIntake([next, second, '--mode', 'brief'], { repositoryRoot });
    assert.equal(result.exitCode, 0, result.lines.join('\n'));
    assert.deepEqual(intakeNames(repositoryRoot, next), ['BRIEF.md']);
    const { files, stored, baseline, problem } = resolveIntakeSnapshot({
      repositoryRoot,
      iteration: next,
    });
    assert.equal(problem, undefined);
    assert.deepEqual(stored, ['BRIEF.md']);
    assert.equal(baseline, NAME);
    assert.equal(files.get('alpha.md'), join(intakePath(repositoryRoot), 'alpha.md'));
    assert.equal(
      files.get('beta.md'),
      join(intakePath(repositoryRoot, LAUNCH), 'beta.md'),
    );
    assert.equal(files.size, DROP_SIZE + 1);
  });

  test('names a Baseline chain that loops or reaches no iteration', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: NAME,
      fields: { baseline: 'feat-other-2026-10-01-abcd', intakeMode: 'brief' },
      intake: { 'BRIEF.md': brief() },
    });
    assert.match(
      resolveIntakeSnapshot({ repositoryRoot, iteration: NAME }).problem,
      /reaches feat-other-2026-10-01-abcd, which is not an iteration with a README/,
    );
    writeIteration({
      repositoryRoot,
      name: 'feat-other-2026-10-01-abcd',
      fields: { baseline: NAME, intakeMode: 'brief' },
      intake: { 'BRIEF.md': brief() },
    });
    assert.match(
      resolveIntakeSnapshot({ repositoryRoot, iteration: NAME }).problem,
      new RegExp(`loops: ${NAME} → feat-other-2026-10-01-abcd → ${NAME}`),
    );
  });
});
