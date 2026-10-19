/**
 * `pnpm iteration:new` — names (digit-free topic, single launch, launch first), Baseline `none` in
 * each repository (every iteration starts from scratch; nothing is suggested), the README-only folder, the `--both` sibling README, and the id
 * retry on a collision. The same behaviour as clinozy-be's generator.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_BRANCH,
  cleanScratch,
  commitAll,
  completeDrop,
  createRepository,
  git,
  OWNER,
  TODAY,
  WORK_BRANCH,
  writeIteration,
} from './iteration-fixtures.mjs';
import { parseIterationReadme, README_FIELD_LABELS } from './iterations.mjs';
import {
  buildIterationName,
  MAXIMUM_NAME_ATTEMPTS,
  parseNewIterationArguments,
  planNewIteration,
  randomIterationId,
  readReadmeTemplate,
  renderIterationReadme,
  renderTemplate,
  runNewIteration,
  validateTypeAndTopic,
  writeIterationPlan,
} from './new-iteration.mjs';

afterEach(cleanScratch);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DONE = ['- 2026-10-02 · implementing → done · — · A'];

function plan(repositoryRoot, overrides = {}) {
  return planNewIteration({
    repositoryRoot,
    baseBranch: BASE_BRANCH,
    type: 'feat',
    topic: 'returns',
    siblingRoot: undefined,
    today: TODAY,
    ...overrides,
  });
}

function idSequence(ids) {
  let position = 0;
  return () => ids[Math.min(position++, ids.length - 1)];
}

describe('arguments and names', () => {
  it('reads the type, topic and flags; --sibling implies --both', () => {
    expect(
      parseNewIterationArguments(['feat', 'pharmacy-returns', '--both', '--dry-run']),
    ).toStrictEqual({
      type: 'feat',
      topic: 'pharmacy-returns',
      createInSibling: true,
      siblingPath: undefined,
      lite: false,
      dryRun: true,
      help: false,
    });
    expect(parseNewIterationArguments(['fix', 'rounding', '--lite']).lite).toBe(true);
    expect(
      parseNewIterationArguments(['fix', 'x', '--sibling', '../other-be']).siblingPath,
    ).toBe('../other-be');
    expect(
      parseNewIterationArguments(['fix', 'x', '--sibling', '../other-be'])
        .createInSibling,
    ).toBe(true);
    expect(() => parseNewIterationArguments(['feat', 'x', '--sibling'])).toThrow(
      /needs a path/,
    );
    expect(() => parseNewIterationArguments(['feat', 'x', '--force'])).toThrow(
      /Unknown option/,
    );
    expect(() => parseNewIterationArguments(['feat', 'x', 'y'])).toThrow(
      /Too many arguments/,
    );
  });

  it('accepts a launch without a topic and a feat with a kebab-case topic', () => {
    expect(validateTypeAndTopic({ type: 'launch', topic: undefined })).toStrictEqual({
      type: 'launch',
      topic: undefined,
    });
    expect(
      validateTypeAndTopic({ type: 'change', topic: 'patient-consent' }),
    ).toStrictEqual({
      type: 'change',
      topic: 'patient-consent',
    });
    expect(() => validateTypeAndTopic({ type: 'release', topic: 'x' })).toThrow(
      /Unknown type/,
    );
    expect(() => validateTypeAndTopic({ type: 'launch', topic: 'clinic' })).toThrow(
      /no topic/,
    );
    expect(() => validateTypeAndTopic({ type: 'fix', topic: undefined })).toThrow(
      /needs a topic/,
    );
  });

  for (const topic of [
    'returns2',
    'phase-two-2',
    'Pharmacy',
    'pharmacy_returns',
    '-returns',
    'returns-',
    'pharmacy--returns',
  ]) {
    it(`rejects the topic "${topic}"`, () => {
      expect(() => validateTypeAndTopic({ type: 'feat', topic })).toThrow(/no digits/);
    });
  }

  it('builds names and draws four lowercase letters', () => {
    expect(
      buildIterationName({
        type: 'launch',
        topic: undefined,
        opened: '2026-09-30',
        id: 'jxmr',
      }),
    ).toBe('launch-2026-09-30-jxmr');
    expect(
      buildIterationName({
        type: 'feat',
        topic: 'pharmacy-returns',
        opened: '2026-10-06',
        id: 'kqzx',
      }),
    ).toBe('feat-pharmacy-returns-2026-10-06-kqzx');
    for (let draw = 0; draw < 50; draw += 1)
      expect(randomIterationId()).toMatch(/^[a-z]{4}$/);
  });
});

describe('the README template', () => {
  it('lists exactly the README fields, in order, and refuses an unknown placeholder', () => {
    const rendered = renderIterationReadme({
      name: 'feat-x-2026-10-06-abcd',
      fields: Object.fromEntries(
        [
          'type',
          'process',
          'topic',
          'owner',
          'opened',
          'branch',
          'baseline',
          'status',
          'summary',
          'dropPlaced',
          'dropSource',
          'intakeMode',
          'intakeNote',
          'schemaRoutes',
          'intakeHash',
        ].map((key) => [key, key]),
      ),
    });
    expect(rendered.startsWith('# feat-x-2026-10-06-abcd\n')).toBeTruthy();
    expect([...parseIterationReadme(rendered).keys()]).toStrictEqual(README_FIELD_LABELS);
    expect(() => renderTemplate({ template: 'Hello {{who}}', values: {} })).toThrow(
      /\{\{who\}\}/,
    );
  });

  it('every iteration README in this repository carries all the fields (Process optional: none is full)', () => {
    for (const name of readdirSync(join(ROOT, 'iterations')).filter(
      (entry) => !entry.includes('.'),
    )) {
      const readme = readFileSync(join(ROOT, 'iterations', name, 'README.md'), 'utf-8');
      const keys = [...parseIterationReadme(readme).keys()];
      expect(keys, name).toStrictEqual(
        README_FIELD_LABELS.filter(
          (label) => label !== 'Process' || keys.includes('Process'),
        ),
      );
      expect(
        readme.startsWith(readReadmeTemplate().split('\n')[0].replace('{{name}}', name)),
        name,
      ).toBeTruthy();
    }
  });
});

describe('planNewIteration', () => {
  it('refuses anything but a launch while no iteration exists', () => {
    expect(() => plan(createRepository())).toThrow(/open the launch first/);
  });

  it('plans a launch — README only, Baseline none, empty drop rows — and writes it only when asked', () => {
    const repositoryRoot = createRepository();
    const launch = plan(repositoryRoot, {
      type: 'launch',
      topic: undefined,
      nextId: () => 'jxmr',
    });
    expect(launch.name).toBe(`launch-${TODAY}-jxmr`);
    expect(launch.fields).toStrictEqual({
      type: 'launch',
      process: 'full',
      topic: '—',
      owner: OWNER,
      opened: TODAY,
      branch: BASE_BRANCH,
      baseline: 'none',
      status: 'planning',
      summary: '—',
      dropPlaced: '—',
      dropSource: '—',
      intakeMode: '—',
      intakeNote: '—',
      schemaRoutes: '—',
      intakeHash: '—',
    });
    expect(launch.files.map((file) => file.path)).toStrictEqual([
      join(launch.localFolder, 'README.md'),
    ]);
    expect(existsSync(launch.localFolder)).toBe(false);
    writeIterationPlan(launch);
    expect(readdirSync(launch.localFolder)).toStrictEqual(['README.md']);
    expect(() => writeIterationPlan(launch)).toThrow(/already exists/);
  });

  it('refuses a second launch — here, on the base branch, or in the sibling', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    expect(() => plan(repositoryRoot, { type: 'launch', topic: undefined })).toThrow(
      /only ever one launch/,
    );

    const fresh = createRepository();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(fresh),
    });
    writeIteration({ repositoryRoot: siblingRoot, name: 'launch-2026-09-30-jxmr' });
    expect(() => plan(fresh, { type: 'launch', topic: undefined, siblingRoot })).toThrow(
      /only ever one launch/,
    );
  });

  it('starts every iteration from scratch — Baseline none, even beside a finished one — and records the branch', () => {
    const repositoryRoot = createRepository();
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      fields: { status: 'implementing' },
      intake: completeDrop(),
      commitTime: 2_000,
    });
    git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
    const early = plan(repositoryRoot);
    expect(early.fields.baseline).toBe('none');
    expect(early.fields.branch).toBe(WORK_BRANCH);

    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      fields: { status: 'done' },
      history: DONE,
      intake: completeDrop(),
    });
    expect(plan(repositoryRoot, { type: 'fix', topic: 'rounding' }).fields.baseline).toBe(
      'none',
    );
  });

  it('a non-launch may open while the launch exists only on the base branch', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr', commitTime: 2_000 });
    git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
    git(repositoryRoot, ['rm', '-rq', 'iterations']);
    commitAll(repositoryRoot, 'drop the folder on this branch', 3_000);
    expect(plan(repositoryRoot).name).toMatch(
      new RegExp(`^feat-returns-${TODAY}-[a-z]{4}$`),
    );
  });

  it('draws a new id while the name is taken here or in the sibling, then gives up', () => {
    const repositoryRoot = createRepository();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(repositoryRoot),
    });
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    writeIteration({ repositoryRoot, name: `feat-returns-${TODAY}-aaaa` });
    writeIteration({ repositoryRoot: siblingRoot, name: `feat-returns-${TODAY}-bbbb` });
    expect(
      plan(repositoryRoot, { siblingRoot, nextId: idSequence(['aaaa', 'bbbb', 'cccc']) })
        .name,
    ).toBe(`feat-returns-${TODAY}-cccc`);
    expect(() => plan(repositoryRoot, { nextId: () => 'aaaa' })).toThrow(
      new RegExp(`after ${MAXIMUM_NAME_ATTEMPTS} attempts`),
    );
  });

  it('--both writes the sibling README, from scratch too, and warns on template drift', () => {
    const repositoryRoot = createRepository();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(repositoryRoot),
    });
    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      fields: { status: 'done' },
      history: DONE,
      intake: completeDrop(),
    });
    writeIteration({
      repositoryRoot: siblingRoot,
      name: 'launch-2026-09-30-jxmr',
      fields: { status: 'implementing' },
    });

    const both = plan(repositoryRoot, { siblingRoot });
    expect(both.fields.baseline).toBe('none');
    expect(both.siblingBaseline).toBe('none');
    const siblingReadme = both.files.find(
      (file) => file.path === join(siblingRoot, 'iterations', both.name, 'README.md'),
    );
    expect(parseIterationReadme(siblingReadme.content).get('Baseline')).toBe('none');
    expect(both.warnings).toStrictEqual([]);

    mkdirSync(join(siblingRoot, 'tooling/iterations/templates'), { recursive: true });
    writeFileSync(
      join(siblingRoot, 'tooling/iterations/templates/README.md'),
      '# {{name}}\n',
    );
    expect(plan(repositoryRoot, { siblingRoot }).warnings[0]).toMatch(/byte-identical/);
  });

  it('refuses a detached HEAD and a missing user.name', () => {
    const detached = createRepository();
    git(detached, ['checkout', '-q', '--detach']);
    expect(() => plan(detached, { type: 'launch', topic: undefined })).toThrow(
      /detached/,
    );
    const anonymous = createRepository();
    git(anonymous, ['config', 'user.name', '']);
    expect(() => plan(anonymous, { type: 'launch', topic: undefined })).toThrow(
      /user\.name/,
    );
  });

  it('opens a lite fix with Process lite, and refuses --lite on anything but a fix', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    const lite = plan(repositoryRoot, { type: 'fix', topic: 'rounding', lite: true });
    expect(lite.fields.process).toBe('lite');
    expect(parseIterationReadme(lite.files[0].content).get('Process')).toBe('lite');
    expect(plan(repositoryRoot, { type: 'fix', topic: 'rounding' }).fields.process).toBe(
      'full',
    );
    expect(() =>
      plan(repositoryRoot, { type: 'feat', topic: 'returns', lite: true }),
    ).toThrow(/--lite is for a fix only/);
  });
});

describe('runNewIteration', () => {
  it('a lite fix is told to plan in one step — no drop to place', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    const real = runNewIteration(['fix', 'rounding', '--lite'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'kqzx',
    });
    expect(real.lines.includes('Next (a lite fix):')).toBeTruthy();
    expect(real.lines.some((line) => line.includes('Plan it in one step'))).toBeTruthy();
    expect(real.lines.some((line) => line.includes('pnpm iteration:intake'))).toBe(false);
  });

  it('a dry run prints the plan and writes nothing; a real run writes the README and the next steps', () => {
    const repositoryRoot = createRepository();
    const dry = runNewIteration(['launch', '--dry-run'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'jxmr',
    });
    expect(dry.exitCode).toBe(0);
    expect(dry.lines[0]).toBe('Dry run — nothing written.');
    expect(dry.lines.includes(`Iteration: launch-${TODAY}-jxmr`)).toBeTruthy();
    expect(existsSync(join(repositoryRoot, 'iterations'))).toBe(false);

    const real = runNewIteration(['launch'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'jxmr',
    });
    expect(real.lines[0]).toBe('Created.');
    expect(
      real.lines.some((line) =>
        line.includes(`pnpm iteration:intake launch-${TODAY}-jxmr <drop-folder>`),
      ),
    ).toBeTruthy();
    expect(
      existsSync(join(repositoryRoot, 'iterations', `launch-${TODAY}-jxmr`, 'README.md')),
    ).toBeTruthy();
    expect(!real.lines.some((line) => line.includes('--mode overlay'))).toBeTruthy();

    const feature = runNewIteration(['feat', 'returns'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'kqzx',
    });
    expect(
      feature.lines.some(
        (line) =>
          line.includes('--mode overlay') &&
          line.includes('--mode brief') &&
          line.includes(`pnpm iteration:baseline feat-returns-${TODAY}-kqzx <baseline>`),
      ),
    ).toBeTruthy();

    expect(runNewIteration([], { repositoryRoot }).exitCode).toBe(1);
    expect(runNewIteration(['--help'], { repositoryRoot }).exitCode).toBe(0);
  });
});
