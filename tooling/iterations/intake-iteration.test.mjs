/**
 * `pnpm iteration:intake` — the three intake modes (full, overlay, brief): what each stores and the
 * snapshot each resolves to, the frontend's mandatory set on that snapshot, replacing a snapshot
 * (diff and stop unless --replace, which only works while planning), the lock from `approved`,
 * `--both` into the sibling's same-named iteration on its own Baseline, the README rows it fills,
 * the gate (`--check`) and `--compact`. Any problem stops the intake with nothing written.
 */
import { afterEach, describe, expect, it } from 'vitest';
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
  it('reads the flags and values; --sibling implies --both', () => {
    expect(
      parseIntakeArguments([
        NAME,
        '~/drop',
        '--mode=overlay',
        '--replace',
        '--dry-run',
        '--sibling',
        '../x-be',
      ]),
    ).toStrictEqual({
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
    });
    expect(parseIntakeArguments([NAME, 'drop']).mode).toBe('full');
    const check = parseIntakeArguments([NAME, '--check', '--baseline', LAUNCH]);
    expect(check.check).toBe(true);
    expect(check.baseline).toBe(LAUNCH);
    const compact = parseIntakeArguments([NAME, '--compact', '--dry-run']);
    expect(compact.compact).toBe(true);
    expect(compact.dryRun).toBe(true);
  });

  it('--compact takes only the iteration and --dry-run', () => {
    for (const commandLine of [
      [NAME, 'drop', '--compact'],
      [NAME, '--compact', '--check'],
      [NAME, '--compact', '--mode', 'brief'],
      [NAME, '--compact', '--replace'],
      [NAME, '--compact', '--both'],
    ]) {
      expect(() => parseIntakeArguments(commandLine)).toThrow(
        /--(compact|check) takes only/,
      );
    }
  });

  it('refuses an unknown mode, --check mixed with intake options, and a lone --baseline', () => {
    expect(() => parseIntakeArguments([NAME, 'drop', '--mode', 'partial'])).toThrow(
      /Unknown --mode "partial"/,
    );
    expect(() => parseIntakeArguments([NAME, 'drop', '--mode'])).toThrow(/needs a value/);
    expect(() => parseIntakeArguments([NAME, 'drop', '--check'])).toThrow(
      /--check takes only/,
    );
    expect(() => parseIntakeArguments([NAME, '--check', '--mode', 'brief'])).toThrow(
      /--check takes only/,
    );
    expect(() => parseIntakeArguments([NAME, 'drop', '--baseline', LAUNCH])).toThrow(
      /--baseline works only with --check/,
    );
    expect(() => parseIntakeArguments([NAME, 'drop', 'extra'])).toThrow(
      /Too many arguments/,
    );
  });

  it('shows the source repository-relative, home-relative or absolute', () => {
    expect(
      displaySourcePath({ repositoryRoot: '/work/fe', source: '/work/fe/drops/a' }),
    ).toBe('drops/a');
    expect(
      displaySourcePath({ repositoryRoot: '/work/fe', source: '/elsewhere/a' }),
    ).toBe('/elsewhere/a');
  });

  it('renders the Intake note: received, then carried forward from the Baseline', () => {
    expect(
      renderIntakeNote({
        mode: 'full',
        taken: ['a', 'b'],
        total: 2,
        baseline: undefined,
      }),
    ).toBe('2 received');
    expect(
      renderIntakeNote({
        mode: 'overlay',
        taken: ['a.md', 'b.md'],
        total: 9,
        baseline: LAUNCH,
      }),
    ).toBe(`2 received (a.md, b.md) · 7 carried forward from ${LAUNCH}`);
  });
});

describe('full mode', () => {
  it('copies a complete drop flat and fills the six intake rows', () => {
    const { repositoryRoot, drop } = setup();
    writeFileSync(join(drop, 'README.md'), '# not copied\n');
    writeFileSync(join(drop, '.DS_Store'), '');
    mkdirSync(join(drop, 'screenshots'));
    const result = runIntake([NAME, drop], { repositoryRoot, today: TODAY });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(repositoryRoot)).toStrictEqual(Object.keys(completeDrop()).sort());
    const fields = readmeFields(repositoryRoot);
    expect(fields.get('Drop placed')).toBe(TODAY);
    expect(fields.get('Drop source')).toBe(drop);
    expect(fields.get('Intake mode')).toBe('full');
    expect(fields.get('Intake note')).toBe(`${DROP_SIZE} received`);
    expect(fields.get('Schema-routes')).toBe(SCHEMA_ROUTES_HASH);
    expect(fields.get('Intake hash')).toBe(intakeHash(intakePath(repositoryRoot)));
    expect(hasLine(result, 'skipped README.md')).toBeTruthy();
    expect(hasLine(result, 'skipped screenshots/')).toBeTruthy();
    expect(hasLine(result, 'planning runs the gate first')).toBeTruthy();
  });

  it('a missing mandatory file stops the intake with nothing written', () => {
    const { repositoryRoot } = setup();
    const { 'preset.md': _preset, 'beta.md': _beta, ...partial } = completeDrop();
    const missing = writeDrop(join(scratchFolder(), 'partial'), partial);
    const result = runIntake([NAME, missing], { repositoryRoot, today: TODAY });
    expect(result.exitCode).toBe(1);
    expect(hasLine(result, 'missing mandatory file(s): beta.md, preset.md')).toBeTruthy();
    expect(existsSync(intakePath(repositoryRoot))).toBe(false);
    expect(readmeFields(repositoryRoot).get('Drop placed')).toBe('—');
  });

  it('an optional file _index.md names is mandatory', () => {
    const { repositoryRoot } = setup();
    const { '_patterns.md': _patterns, ...drop } = completeDrop();
    drop['_index.md'] += '\nShared: `_patterns.md` (drawer, table).\n';
    const source = writeDrop(join(scratchFolder(), 'drop'), drop);
    const result = runIntake([NAME, source], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(hasLine(result, 'missing mandatory file(s): _patterns.md')).toBeTruthy();
  });

  it('warns about extras and screen files _index.md does not list, but still places the drop', () => {
    const { repositoryRoot, drop } = setup();
    writeFileSync(join(drop, 'gamma.md'), '# Screen: Gamma\n');
    writeFileSync(join(drop, 'notes.txt'), 'x');
    const result = runIntake([NAME, drop], { repositoryRoot, today: TODAY });
    expect(result.exitCode).toBe(0);
    expect(
      result.lines.includes(
        '! extra file (not in the required or optional set): notes.txt',
      ),
    ).toBeTruthy();
    expect(
      result.lines.includes('! screen file not listed in _index.md: gamma.md'),
    ).toBeTruthy();
  });

  it('the same drop again changes nothing; a dry run writes nothing', () => {
    const { repositoryRoot, drop } = setup();
    const dry = runIntake([NAME, drop, '--dry-run'], { repositoryRoot });
    expect(dry.exitCode, dry.lines.join('\n')).toBe(0);
    expect(dry.lines[0]).toMatch(/the snapshot passes/);
    expect(existsSync(intakePath(repositoryRoot))).toBe(false);
    expect(runIntake([NAME, drop], { repositoryRoot, today: TODAY }).exitCode).toBe(0);
    const readme = readmeText(repositoryRoot);
    const again = runIntake([NAME, drop], { repositoryRoot, today: '2026-10-09' });
    expect(again.exitCode).toBe(0);
    expect(
      hasLine(again, `0 new, 0 replaced, 0 removed, ${DROP_SIZE} unchanged`),
    ).toBeTruthy();
    expect(readmeText(repositoryRoot)).toBe(readme);
  });

  it('the launch is always full', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: LAUNCH });
    const drop = writeDrop(join(scratchFolder(), 'drop'), completeDrop());
    const result = runIntake([LAUNCH, drop, '--mode', 'overlay'], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(hasLine(result, 'The launch is always --mode full')).toBeTruthy();
  });
});

describe('replacing a snapshot', () => {
  it('a different drop shows its diff and stops; --replace replaces the whole snapshot while planning', () => {
    const { repositoryRoot, drop } = setup({ intake: completeDrop() });
    writeFileSync(join(drop, 'alpha.md'), '# Screen: Alpha — redesigned\n');
    rmSync(join(drop, '_patterns.md'));
    const conflict = runIntake([NAME, drop], { repositoryRoot });
    expect(conflict.exitCode).toBe(1);
    expect(
      conflict.lines.some(
        (line) =>
          line.includes('intake-files/alpha.md differs from the new snapshot') &&
          line.includes('redesigned'),
      ),
    ).toBeTruthy();
    expect(
      hasLine(
        conflict,
        'already holds a different snapshot (changed: alpha.md · removed: _patterns.md) — re-run with --replace',
      ),
    ).toBeTruthy();
    expect(readIntake(repositoryRoot, 'alpha.md')).toBe('# Screen: Alpha\n');

    const replaced = runIntake([NAME, drop, '--replace'], {
      repositoryRoot,
      today: TODAY,
    });
    expect(replaced.exitCode, replaced.lines.join('\n')).toBe(0);
    expect(readIntake(repositoryRoot, 'alpha.md')).toBe('# Screen: Alpha — redesigned\n');
    expect(existsSync(join(intakePath(repositoryRoot), '_patterns.md'))).toBe(false);
    expect(readmeFields(repositoryRoot).get('Intake hash')).toBe(
      intakeHash(intakePath(repositoryRoot)),
    );
  });

  it('--replace works only while planning', () => {
    const ready = setup({ status: 'ready-for-approval', intake: completeDrop() });
    writeFileSync(join(ready.drop, 'alpha.md'), 'changed\n');
    const refused = planIntake({
      repositoryRoot: ready.repositoryRoot,
      iteration: NAME,
      source: ready.drop,
      siblingRoot: undefined,
      replace: true,
    });
    expect(
      refused.problems.some((problem) =>
        problem.includes('--replace replaces a snapshot only while Status is planning'),
      ),
    ).toBeTruthy();
    expect(() => applyIntake(refused)).toThrow(/only while Status is planning/);
  });

  it('refuses any change once the Status is approved or later — files or the recorded hash', () => {
    for (const status of ['approved', 'implementing', 'done', 'frozen']) {
      const { repositoryRoot, drop } = setup({ status });
      const result = runIntake([NAME, drop], { repositoryRoot });
      expect(result.exitCode, status).toBe(1);
      expect(
        hasLine(result, `the intake is locked (Status ${status})`),
        status,
      ).toBeTruthy();
    }
    const { repositoryRoot } = setup({ status: 'approved', intake: completeDrop() });
    writeFileSync(
      join(intakePath(repositoryRoot), 'alpha.md'),
      'edited after approval\n',
    );
    const rerecord = runIntake([NAME, intakePath(repositoryRoot)], { repositoryRoot });
    expect(rerecord.exitCode).toBe(1);
    expect(hasLine(rerecord, 'the intake is locked (Status approved)')).toBeTruthy();
  });
});

describe('overlay mode', () => {
  it("stores the received files, resolved over the Baseline's snapshot", () => {
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
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(repositoryRoot)).toStrictEqual([
      '_index.md',
      'alpha.md',
      'gamma.md',
    ]);
    expect(readIntake(repositoryRoot, 'alpha.md')).toBe(
      '# Screen: Alpha — with a returns badge\n',
    );
    const { files } = resolveIntakeSnapshot({ repositoryRoot, iteration: NAME });
    expect([...files.keys()].sort()).toStrictEqual(
      [...Object.keys(completeDrop()), 'gamma.md'].sort(),
    );
    expect(files.get('beta.md')).toBe(
      join(intakePath(repositoryRoot, LAUNCH), 'beta.md'),
    );
    const fields = readmeFields(repositoryRoot);
    expect(fields.get('Intake mode')).toBe('overlay');
    expect(fields.get('Intake note')).toBe(
      `3 received (_index.md, alpha.md, gamma.md) · ${DROP_SIZE - 2} carried forward from ${LAUNCH}`,
    );
    expect(fields.get('Intake hash')).toBe(
      resolvedIntakeHash({ repositoryRoot, iteration: NAME }),
    );
    expect(fields.get('Schema-routes')).toBe(SCHEMA_ROUTES_HASH);
    expect(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
    ).toBe(0);
  });

  it('needs a Baseline the user named and at least one received file', () => {
    const received = writeDrop(join(scratchFolder(), 'changes'), { 'alpha.md': 'x\n' });
    const scratch = runIntake([NAME, received, '--mode', 'overlay'], {
      repositoryRoot: withBaseline({ fields: { baseline: 'none' } }),
    });
    expect(scratch.exitCode).toBe(1);
    expect(hasLine(scratch, `${NAME} starts from scratch (Baseline none)`)).toBeTruthy();
    expect(
      hasLine(scratch, `record it first: pnpm iteration:baseline ${NAME} <baseline>`),
    ).toBeTruthy();

    const repositoryRoot = withBaseline({ fields: { baseline: '—' } });
    const noBaseline = runIntake([NAME, received, '--mode', 'overlay'], {
      repositoryRoot,
    });
    expect(noBaseline.exitCode).toBe(1);
    expect(
      hasLine(noBaseline, `${NAME} has no Baseline (—) — record none, the default`),
    ).toBeTruthy();

    const withLaunch = withBaseline();
    const empty = writeDrop(join(scratchFolder(), 'empty'), {});
    const nothing = runIntake([NAME, empty, '--mode', 'overlay'], {
      repositoryRoot: withLaunch,
    });
    expect(nothing.exitCode).toBe(1);
    expect(
      hasLine(nothing, '--mode overlay needs at least one received file'),
    ).toBeTruthy();
  });

  it('refuses a Baseline that fails the gate', () => {
    const repositoryRoot = withBaseline();
    writeFileSync(join(intakePath(repositoryRoot, LAUNCH), 'beta.md'), 'edited\n');
    const received = writeDrop(join(scratchFolder(), 'changes'), { 'alpha.md': 'x\n' });
    const result = runIntake([NAME, received, '--mode', 'overlay'], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(
      hasLine(result, `the Baseline ${LAUNCH} fails the gate — changed since the intake`),
    ).toBeTruthy();
    expect(existsSync(intakePath(repositoryRoot))).toBe(false);
  });

  it('checks the mandatory set on the resulting snapshot', () => {
    const repositoryRoot = withBaseline();
    const received = writeDrop(join(scratchFolder(), 'changes'), {
      '_index.md': `${completeDrop()['_index.md']}| gamma | /gamma | Third |\n`,
    });
    const result = runIntake([NAME, received, '--mode', 'overlay'], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(
      hasLine(result, 'The snapshot is missing mandatory file(s): gamma.md'),
    ).toBeTruthy();
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

  it('is the BRIEF.md alone — nothing carried forward — and passes the gate', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    const result = runIntake([NAME, folder, '--mode', 'brief'], {
      repositoryRoot,
      today: TODAY,
    });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(repositoryRoot)).toStrictEqual(['BRIEF.md']);
    const fields = readmeFields(repositoryRoot);
    expect(fields.get('Intake mode')).toBe('brief');
    expect(fields.get('Intake note')).toBe('1 received (BRIEF.md) · from scratch');
    expect(fields.get('Baseline')).toBe('none');
    expect(runIntake([NAME, '--check'], { repositoryRoot }).exitCode).toBe(0);
  });

  it('refuses design files beside the BRIEF.md — those go in with --mode full', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), {
      'BRIEF.md': brief(),
      'alpha.md': '# Screen: Alpha\n',
    });
    const result = runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(
      hasLine(
        result,
        'a brief from scratch is BRIEF.md alone, but alpha.md also came in',
      ),
    ).toBeTruthy();
    expect(existsSync(intakePath(repositoryRoot))).toBe(false);
  });

  it('the gate fails when its BRIEF.md is gone or a Baseline is recorded after the intake', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    expect(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot }).exitCode,
    ).toBe(0);
    const readme = join(repositoryRoot, 'iterations', NAME, 'README.md');
    writeFileSync(
      readme,
      readFileSync(readme, 'utf-8').replace(
        '| Baseline | none |',
        `| Baseline | ${LAUNCH} |`,
      ),
    );
    const moved = runIntake([NAME, '--check'], { repositoryRoot });
    expect(moved.exitCode).toBe(1);
    expect(
      hasLine(
        moved,
        `built on no Baseline (from scratch), but the README's Baseline is ${LAUNCH}`,
      ),
    ).toBeTruthy();
  });

  it('--compact has nothing to compact: the BRIEF.md is the whole snapshot', () => {
    const repositoryRoot = fromScratch();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    expect(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot }).exitCode,
    ).toBe(0);
    const result = runIntake([NAME, '--compact'], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(
      hasLine(result, 'is a brief from scratch — it stores only its BRIEF.md'),
    ).toBeTruthy();
    expect(intakeNames(repositoryRoot)).toStrictEqual(['BRIEF.md']);
  });
});

describe('brief mode', () => {
  it("stores only BRIEF.md, resolves to the Baseline's snapshot plus it — and the diff shows nothing else", () => {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), {
      'BRIEF.md': brief(),
      'PRD.md': completeDrop()['PRD.md'],
    });
    const result = runIntake([NAME, folder, '--mode', 'brief'], {
      repositoryRoot,
      today: TODAY,
    });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(repositoryRoot)).toStrictEqual(['BRIEF.md']);
    const fields = readmeFields(repositoryRoot);
    expect(fields.get('Intake mode')).toBe('brief');
    expect(fields.get('Intake hash')).toBe(
      resolvedIntakeHash({ repositoryRoot, iteration: NAME }),
    );
    expect(fields.get('Intake note')).toBe(
      `1 received (BRIEF.md) · ${DROP_SIZE} carried forward from ${LAUNCH}`,
    );
    const diff = summarizeIntakeDiff({ repositoryRoot, baseline: LAUNCH, current: NAME });
    expect(diff.files).toStrictEqual({ added: ['BRIEF.md'], removed: [], changed: [] });
    expect(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
    ).toBe(0);
  });

  it('takes the BRIEF.md file itself as the source', () => {
    const repositoryRoot = withBaseline();
    const file = join(
      writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() }),
      'BRIEF.md',
    );
    const result = runIntake([NAME, file, '--mode', 'brief'], { repositoryRoot });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(readIntake(repositoryRoot, 'BRIEF.md')).toBe(brief());
  });

  it('needs a BRIEF.md with every template section', () => {
    const repositoryRoot = withBaseline();
    const none = writeDrop(join(scratchFolder(), 'none'), { 'notes.md': 'x\n' });
    const missing = runIntake([NAME, none, '--mode', 'brief'], { repositoryRoot });
    expect(missing.exitCode).toBe(1);
    expect(hasLine(missing, '--mode brief needs a received BRIEF.md')).toBeTruthy();

    const thin = writeDrop(join(scratchFolder(), 'thin'), {
      'BRIEF.md': brief().replace('## Acceptance criteria', '## Done when'),
    });
    const incomplete = runIntake([NAME, thin, '--mode', 'brief'], { repositoryRoot });
    expect(incomplete.exitCode).toBe(1);
    expect(
      hasLine(incomplete, 'BRIEF.md is missing section(s): Acceptance criteria'),
    ).toBeTruthy();
  });

  it('refuses any other changed file', () => {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), {
      'BRIEF.md': brief(),
      'alpha.md': '# Screen: Alpha — changed\n',
      'gamma.md': '# Screen: Gamma\n',
    });
    const result = runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(
      hasLine(
        result,
        `--mode brief changes only BRIEF.md, but alpha.md, gamma.md differ from the Baseline ${LAUNCH}`,
      ),
    ).toBeTruthy();
    expect(existsSync(intakePath(repositoryRoot))).toBe(false);
  });
});

describe('the gate (--check)', () => {
  /** The iteration under test with a brief intake on the launch, committed. */
  function briefed() {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    expect(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot }).exitCode,
    ).toBe(0);
    commitAll(repositoryRoot, 'intake', 2_000);
    return repositoryRoot;
  }
  const gate = (repositoryRoot, ...options) =>
    runIntake([NAME, '--check', ...options], { repositoryRoot });

  it('a clean intake passes, with its Baseline', () => {
    const repositoryRoot = briefed();
    const result = gate(repositoryRoot, '--baseline', LAUNCH);
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(
      hasLine(
        result,
        `✓ iterations/${NAME}/intake-files/ — ${DROP_SIZE + 1} files (1 stored, ${DROP_SIZE} from ${LAUNCH})`,
      ),
    ).toBeTruthy();
    expect(hasLine(result, `✓ iterations/${LAUNCH}/intake-files/`)).toBeTruthy();
    expect(result.lines.at(-1)).toBe('Gate passed.');
  });

  it('a missing mandatory file fails, naming the folder, the file and the fix', () => {
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
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toMatch(/^Gate failed — 2 problems\. Stop here/);
    expect(
      result.lines.includes(
        `✗ iterations/${NAME}/intake-files/: missing mandatory file(s): shell.md`,
      ),
    ).toBeTruthy();
    expect(
      result.lines.includes(
        `    fix: re-run the intake: pnpm iteration:intake ${NAME} <source> --replace`,
      ),
    ).toBeTruthy();
  });

  it('a brief whose BRIEF.md is removed stores nothing: no intake yet', () => {
    const repositoryRoot = briefed();
    rmSync(join(intakePath(repositoryRoot), 'BRIEF.md'));
    const result = gate(repositoryRoot);
    expect(result.exitCode).toBe(1);
    expect(
      result.lines.includes(`✗ iterations/${NAME}/intake-files/: no intake yet`),
    ).toBeTruthy();
  });

  it("a file missing from the Baseline's intake fails in the Baseline's folder — and in each iteration resolved through it", () => {
    const repositoryRoot = briefed();
    rmSync(join(intakePath(repositoryRoot, LAUNCH), 'shell.md'));
    const result = gate(repositoryRoot, '--baseline', LAUNCH);
    expect(result.exitCode).toBe(1);
    expect(
      result.lines.includes(
        `✗ iterations/${NAME}/intake-files/: missing mandatory file(s): shell.md`,
      ),
    ).toBeTruthy();
    expect(
      hasLine(
        result,
        `a change anywhere in the Baseline chain (${LAUNCH}) changes it too: pnpm iteration:intake ${LAUNCH} --check`,
      ),
    ).toBeTruthy();
    expect(
      result.lines.includes(
        `✗ iterations/${LAUNCH}/intake-files/: missing mandatory file(s): shell.md`,
      ),
    ).toBeTruthy();
    expect(
      hasLine(result, `move it back first (pnpm iteration:status ${LAUNCH} planning`),
    ).toBeTruthy();
  });

  it('an edited file fails on the Intake hash and names the file git saw change', () => {
    const repositoryRoot = briefed();
    const recorded = readmeFields(repositoryRoot).get('Intake hash');
    writeFileSync(
      join(intakePath(repositoryRoot), 'BRIEF.md'),
      `${brief()}\nA late edit.\n`,
    );
    const uncommitted = gate(repositoryRoot);
    expect(uncommitted.exitCode).toBe(1);
    expect(
      uncommitted.lines.includes(
        `✗ iterations/${NAME}/intake-files/: changed since the intake — the Intake hash is ${resolvedIntakeHash({ repositoryRoot, iteration: NAME })}, the README records ${recorded}`,
      ),
    ).toBeTruthy();
    expect(uncommitted.lines.includes('    Uncommitted: modified BRIEF.md')).toBeTruthy();
    expect(
      hasLine(uncommitted, 'fix: restore the delivered files (git restore --source=HEAD'),
    ).toBeTruthy();

    commitAll(repositoryRoot, 'edit an intake file', 3_000);
    const committed = gate(repositoryRoot);
    expect(committed.exitCode).toBe(1);
    expect(
      hasLine(committed, 'No uncommitted change — a commit changed it'),
    ).toBeTruthy();
  });

  it('an intake that is not committed yet still fails on the hash', () => {
    const repositoryRoot = withBaseline();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot });
    writeFileSync(join(intakePath(repositoryRoot), 'notes.md'), 'added later\n');
    const result = gate(repositoryRoot);
    expect(result.exitCode).toBe(1);
    expect(
      hasLine(result, 'is not committed yet, so git cannot name the changed file'),
    ).toBeTruthy();
  });

  it('fails when there is no intake, or the Baseline is not the one the snapshot was built on', () => {
    const empty = setup().repositoryRoot;
    const none = runIntake([NAME, '--check'], { repositoryRoot: empty });
    expect(none.exitCode).toBe(1);
    expect(
      none.lines.includes(`✗ iterations/${NAME}/intake-files/: no intake yet`),
    ).toBeTruthy();

    const repositoryRoot = briefed();
    const other = gate(repositoryRoot, '--baseline', 'feat-other-2026-10-01-abcd');
    expect(other.exitCode).toBe(1);
    expect(
      hasLine(other, `the Baseline is ${LAUNCH}, not feat-other-2026-10-01-abcd`),
    ).toBeTruthy();

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
    expect(rebased.exitCode).toBe(1);
    expect(!hasLine(rebased, 'cannot be resolved')).toBeTruthy();
    expect(hasLine(rebased, 'changed since the intake')).toBeTruthy();
    expect(
      hasLine(
        rebased,
        `the brief snapshot was built on ${LAUNCH}, but the README's Baseline is none`,
      ),
    ).toBeTruthy();
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

  it('full: copies PRD.md and schema-routes.md into the sibling and fills its rows', () => {
    const { repositoryRoot, drop, siblingRoot } = withSibling();
    const result = runIntake([NAME, drop, '--both'], { repositoryRoot, today: TODAY });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(siblingRoot)).toStrictEqual(['PRD.md', 'schema-routes.md']);
    const fields = readmeFields(siblingRoot);
    expect(fields.get('Schema-routes')).toBe(SCHEMA_ROUTES_HASH);
    expect(fields.get('Drop placed')).toBe(TODAY);
    expect(fields.get('Intake mode')).toBe('full');
    expect(fields.get('Intake note')).toBe('2 received');
    expect(fields.get('Intake hash')).toBe(intakeHash(intakePath(siblingRoot)));
  });

  it('overlay: builds the sibling snapshot on its own Baseline', () => {
    const { repositoryRoot, siblingRoot, siblingBaseline } = withBaselines();
    const received = writeDrop(join(scratchFolder(), 'changes'), {
      'PRD.md': '# Demo — PRD, with returns\n',
    });
    const result = runIntake([NAME, received, '--mode', 'overlay', '--both'], {
      repositoryRoot,
      today: TODAY,
    });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(siblingRoot)).toStrictEqual(['PRD.md', 'schema-routes.md']);
    expect(
      [
        ...resolveIntakeSnapshot({
          repositoryRoot: siblingRoot,
          iteration: NAME,
        }).files.keys(),
      ].sort(),
    ).toStrictEqual(['PRD.md', 'design-overview.md', 'schema-routes.md']);
    expect(readIntake(siblingRoot, 'PRD.md')).toBe('# Demo — PRD, with returns\n');
    expect(readmeFields(siblingRoot).get('Intake note')).toBe(
      `2 received (PRD.md, schema-routes.md) · 1 carried forward from ${siblingBaseline}`,
    );
  });

  it('brief: sends BRIEF.md onto the sibling Baseline, whose shared files must match', () => {
    const { repositoryRoot, siblingRoot, siblingBaseline } = withBaselines();
    const folder = writeDrop(join(scratchFolder(), 'brief'), { 'BRIEF.md': brief() });
    const result = runIntake([NAME, folder, '--mode', 'brief', '--both'], {
      repositoryRoot,
    });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(readIntake(siblingRoot, 'BRIEF.md')).toBe(brief());
    expect(readmeFields(siblingRoot).get('Intake note')).toBe(
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
    expect(stopped.exitCode).toBe(1);
    expect(
      hasLine(
        stopped,
        `Sibling repository: --mode brief changes only BRIEF.md, but PRD.md differs from the Baseline ${drifted.siblingBaseline}`,
      ),
    ).toBeTruthy();
  });

  it('stops when the sibling has no such iteration, or no Baseline for an overlay', () => {
    const { repositoryRoot, drop } = withSibling({ openSibling: false });
    const result = runIntake([NAME, drop, '--both'], { repositoryRoot });
    expect(result.exitCode).toBe(1);
    expect(
      hasLine(result, 'open it in both first: pnpm iteration:new <type> <topic> --both'),
    ).toBeTruthy();
    expect(existsSync(intakePath(repositoryRoot))).toBe(false);

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
    expect(noBaseline.exitCode).toBe(1);
    expect(
      hasLine(noBaseline, `Sibling repository: ${NAME} has no Baseline (—)`),
    ).toBeTruthy();
  });

  it('a differing sibling copy shows the diff and stops, unless --replace while the sibling is planning', () => {
    const differing = {
      'PRD.md': '# Demo — PRD, older\n',
      'schema-routes.md': SCHEMA_ROUTES,
    };
    const { repositoryRoot, drop, siblingRoot } = withSibling({
      siblingIntake: differing,
    });
    const stopped = runIntake([NAME, drop, '--both'], { repositoryRoot });
    expect(stopped.exitCode).toBe(1);
    expect(
      stopped.lines.some((line) =>
        line.startsWith(
          'Sibling repository: intake-files/PRD.md differs from the new snapshot',
        ),
      ),
    ).toBeTruthy();
    expect(existsSync(intakePath(repositoryRoot))).toBe(false);

    expect(
      runIntake([NAME, drop, '--both', '--replace'], { repositoryRoot, today: TODAY })
        .exitCode,
    ).toBe(0);
    expect(readIntake(siblingRoot, 'PRD.md')).toBe('# Demo — PRD\n');

    const locked = withSibling({ siblingIntake: differing, siblingStatus: 'approved' });
    const refused = runIntake([NAME, locked.drop, '--both', '--replace'], {
      repositoryRoot: locked.repositoryRoot,
    });
    expect(refused.exitCode).toBe(1);
    expect(
      hasLine(refused, 'Sibling repository: the intake is locked (Status approved)'),
    ).toBeTruthy();
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
    expect(
      runIntake([NAME, folder, '--mode', 'brief'], { repositoryRoot, today: TODAY })
        .exitCode,
    ).toBe(0);
    writeDrop(intakePath(repositoryRoot), completeDrop());
    setStatus(repositoryRoot, NAME, status);
    commitAll(repositoryRoot, 'legacy brief', 2_000);
    return repositoryRoot;
  }
  const compact = (repositoryRoot, ...options) =>
    runIntake([NAME, '--compact', ...options], { repositoryRoot });

  it('a legacy full copy hashes the same as what it resolves to', () => {
    const repositoryRoot = legacyBrief();
    expect(intakeNames(repositoryRoot).length).toBe(DROP_SIZE + 1);
    expect(intakeHash(intakePath(repositoryRoot))).toBe(
      readmeFields(repositoryRoot).get('Intake hash'),
    );
    expect(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
    ).toBe(0);
  });

  it("removes the copies of the Baseline's files and keeps what was received, even when frozen", () => {
    const repositoryRoot = legacyBrief();
    const readmeBefore = readmeText(repositoryRoot);
    const result = compact(repositoryRoot);
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(repositoryRoot)).toStrictEqual(['BRIEF.md']);
    const hash = readmeFields(repositoryRoot).get('Intake hash');
    expect(result.lines[0]).toMatch(
      new RegExp(
        `^Compacted iterations/${NAME}/intake-files/: removed ${DROP_SIZE} copies identical to ${LAUNCH} \\(.+\\) · kept BRIEF\\.md · Intake hash ${hash} unchanged$`,
      ),
    );
    expect(readmeText(repositoryRoot)).toBe(readmeBefore);
    expect(resolvedIntakeHash({ repositoryRoot, iteration: NAME })).toBe(hash);
    expect(
      runIntake([NAME, '--check', '--baseline', LAUNCH], { repositoryRoot }).exitCode,
    ).toBe(0);
    const again = compact(repositoryRoot);
    expect(again.exitCode).toBe(0);
    expect(again.lines[0]).toMatch(/already stores only what arrived — kept BRIEF\.md/);
  });

  it('--dry-run removes nothing', () => {
    const repositoryRoot = legacyBrief();
    const result = compact(repositoryRoot, '--dry-run');
    expect(result.exitCode).toBe(0);
    expect(result.lines[0]).toMatch(/^Dry run — nothing removed; would remove /);
    expect(intakeNames(repositoryRoot).length).toBe(DROP_SIZE + 1);
  });

  it('keeps a stored file that differs from the Baseline’s', () => {
    const repositoryRoot = withBaseline();
    const received = writeDrop(join(scratchFolder(), 'changes'), {
      'alpha.md': '# Screen: Alpha — with a returns badge\n',
    });
    expect(
      runIntake([NAME, received, '--mode', 'overlay'], { repositoryRoot }).exitCode,
    ).toBe(0);
    writeDrop(intakePath(repositoryRoot), {
      'beta.md': completeDrop()['beta.md'],
      'shell.md': completeDrop()['shell.md'],
    });
    commitAll(repositoryRoot, 'legacy overlay', 2_000);
    const result = compact(repositoryRoot);
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(repositoryRoot)).toStrictEqual(['alpha.md']);
    expect(readIntake(repositoryRoot, 'alpha.md')).toBe(
      '# Screen: Alpha — with a returns badge\n',
    );
  });

  it('refuses a full intake, and an intake that fails the gate', () => {
    const repositoryRoot = withBaseline();
    const launch = runIntake([LAUNCH, '--compact'], { repositoryRoot });
    expect(launch.exitCode).toBe(1);
    expect(hasLine(launch, 'is a full intake — it stores the whole drop')).toBeTruthy();
    expect(launch.lines.at(-1)).toBe('Nothing removed.');

    const failing = legacyBrief();
    writeFileSync(join(intakePath(failing), 'BRIEF.md'), `${brief()}\nEdited.\n`);
    const refused = compact(failing);
    expect(refused.exitCode).toBe(1);
    expect(
      hasLine(refused, 'the gate fails first — changed since the intake'),
    ).toBeTruthy();
    expect(intakeNames(failing).length).toBe(DROP_SIZE + 1);
  });
});

describe('resolving a snapshot', () => {
  it('follows a chain of layered intakes, the nearest file winning', () => {
    const repositoryRoot = withBaseline();
    const first = writeDrop(join(scratchFolder(), 'first'), {
      'alpha.md': '# Screen: Alpha — first\n',
    });
    expect(
      runIntake([NAME, first, '--mode', 'overlay'], { repositoryRoot }).exitCode,
    ).toBe(0);
    setStatus(repositoryRoot, NAME, 'done');
    const next = 'fix-badge-2026-10-08-wxyz';
    writeIteration({ repositoryRoot, name: next, fields: { baseline: NAME } });
    const second = writeDrop(join(scratchFolder(), 'second'), { 'BRIEF.md': brief() });
    const result = runIntake([next, second, '--mode', 'brief'], { repositoryRoot });
    expect(result.exitCode, result.lines.join('\n')).toBe(0);
    expect(intakeNames(repositoryRoot, next)).toStrictEqual(['BRIEF.md']);
    const { files, stored, baseline, problem } = resolveIntakeSnapshot({
      repositoryRoot,
      iteration: next,
    });
    expect(problem).toBe(undefined);
    expect(stored).toStrictEqual(['BRIEF.md']);
    expect(baseline).toBe(NAME);
    expect(files.get('alpha.md')).toBe(join(intakePath(repositoryRoot), 'alpha.md'));
    expect(files.get('beta.md')).toBe(
      join(intakePath(repositoryRoot, LAUNCH), 'beta.md'),
    );
    expect(files.size).toBe(DROP_SIZE + 1);
  });

  it('names a Baseline chain that loops or reaches no iteration', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: NAME,
      fields: { baseline: 'feat-other-2026-10-01-abcd', intakeMode: 'brief' },
      intake: { 'BRIEF.md': brief() },
    });
    expect(resolveIntakeSnapshot({ repositoryRoot, iteration: NAME }).problem).toMatch(
      /reaches feat-other-2026-10-01-abcd, which is not an iteration with a README/,
    );
    writeIteration({
      repositoryRoot,
      name: 'feat-other-2026-10-01-abcd',
      fields: { baseline: NAME, intakeMode: 'brief' },
      intake: { 'BRIEF.md': brief() },
    });
    expect(resolveIntakeSnapshot({ repositoryRoot, iteration: NAME }).problem).toMatch(
      new RegExp(`loops: ${NAME} → feat-other-2026-10-01-abcd → ${NAME}`),
    );
  });
});
