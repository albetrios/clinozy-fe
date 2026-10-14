/**
 * `pnpm iteration:new` — names (digit-free topic, single launch, launch first), Baseline `none` in
 * each repository (every iteration starts from scratch; nothing is suggested), the README-only folder, the `--both` sibling README, and the id
 * retry on a collision. The same behaviour as clinozy-be's generator.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
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
  test('reads the type, topic and flags; --sibling implies --both', () => {
    assert.deepEqual(
      parseNewIterationArguments(['feat', 'pharmacy-returns', '--both', '--dry-run']),
      {
        type: 'feat',
        topic: 'pharmacy-returns',
        createInSibling: true,
        siblingPath: undefined,
        dryRun: true,
        help: false,
      },
    );
    assert.equal(
      parseNewIterationArguments(['fix', 'x', '--sibling', '../other-be']).siblingPath,
      '../other-be',
    );
    assert.throws(
      () => parseNewIterationArguments(['feat', 'x', '--sibling']),
      /needs a path/,
    );
    assert.throws(
      () => parseNewIterationArguments(['feat', 'x', '--force']),
      /Unknown option/,
    );
    assert.throws(
      () => parseNewIterationArguments(['feat', 'x', 'y']),
      /Too many arguments/,
    );
  });

  test('accepts a launch without a topic and a feat with a kebab-case topic', () => {
    assert.deepEqual(validateTypeAndTopic({ type: 'launch', topic: undefined }), {
      type: 'launch',
      topic: undefined,
    });
    assert.deepEqual(validateTypeAndTopic({ type: 'change', topic: 'patient-consent' }), {
      type: 'change',
      topic: 'patient-consent',
    });
    assert.throws(
      () => validateTypeAndTopic({ type: 'release', topic: 'x' }),
      /Unknown type/,
    );
    assert.throws(
      () => validateTypeAndTopic({ type: 'launch', topic: 'clinic' }),
      /no topic/,
    );
    assert.throws(
      () => validateTypeAndTopic({ type: 'fix', topic: undefined }),
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
    test(`rejects the topic "${topic}"`, () => {
      assert.throws(() => validateTypeAndTopic({ type: 'feat', topic }), /no digits/);
    });
  }

  test('builds names and draws four lowercase letters', () => {
    assert.equal(
      buildIterationName({
        type: 'launch',
        topic: undefined,
        opened: '2026-09-30',
        id: 'jxmr',
      }),
      'launch-2026-09-30-jxmr',
    );
    assert.equal(
      buildIterationName({
        type: 'feat',
        topic: 'pharmacy-returns',
        opened: '2026-10-06',
        id: 'kqzx',
      }),
      'feat-pharmacy-returns-2026-10-06-kqzx',
    );
    for (let draw = 0; draw < 50; draw += 1)
      assert.match(randomIterationId(), /^[a-z]{4}$/);
  });
});

describe('the README template', () => {
  test('lists exactly the README fields, in order, and refuses an unknown placeholder', () => {
    const rendered = renderIterationReadme({
      name: 'feat-x-2026-10-06-abcd',
      fields: Object.fromEntries(
        [
          'type',
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
    assert.ok(rendered.startsWith('# feat-x-2026-10-06-abcd\n'));
    assert.deepEqual([...parseIterationReadme(rendered).keys()], README_FIELD_LABELS);
    assert.throws(
      () => renderTemplate({ template: 'Hello {{who}}', values: {} }),
      /\{\{who\}\}/,
    );
  });

  test('every iteration README in this repository carries all the fields', () => {
    for (const name of readdirSync(join(ROOT, 'iterations')).filter(
      (entry) => !entry.includes('.'),
    )) {
      const readme = readFileSync(join(ROOT, 'iterations', name, 'README.md'), 'utf-8');
      assert.deepEqual(
        [...parseIterationReadme(readme).keys()],
        README_FIELD_LABELS,
        name,
      );
      assert.ok(
        readme.startsWith(readReadmeTemplate().split('\n')[0].replace('{{name}}', name)),
        name,
      );
    }
  });
});

describe('planNewIteration', () => {
  test('refuses anything but a launch while no iteration exists', () => {
    assert.throws(() => plan(createRepository()), /open the launch first/);
  });

  test('plans a launch — README only, Baseline none, empty drop rows — and writes it only when asked', () => {
    const repositoryRoot = createRepository();
    const launch = plan(repositoryRoot, {
      type: 'launch',
      topic: undefined,
      nextId: () => 'jxmr',
    });
    assert.equal(launch.name, `launch-${TODAY}-jxmr`);
    assert.deepEqual(launch.fields, {
      type: 'launch',
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
    assert.deepEqual(
      launch.files.map((file) => file.path),
      [join(launch.localFolder, 'README.md')],
    );
    assert.equal(existsSync(launch.localFolder), false);
    writeIterationPlan(launch);
    assert.deepEqual(readdirSync(launch.localFolder), ['README.md']);
    assert.throws(() => writeIterationPlan(launch), /already exists/);
  });

  test('refuses a second launch — here, on the base branch, or in the sibling', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    assert.throws(
      () => plan(repositoryRoot, { type: 'launch', topic: undefined }),
      /only ever one launch/,
    );

    const fresh = createRepository();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(fresh),
    });
    writeIteration({ repositoryRoot: siblingRoot, name: 'launch-2026-09-30-jxmr' });
    assert.throws(
      () => plan(fresh, { type: 'launch', topic: undefined, siblingRoot }),
      /only ever one launch/,
    );
  });

  test('starts every iteration from scratch — Baseline none, even beside a finished one — and records the branch', () => {
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
    assert.equal(early.fields.baseline, 'none');
    assert.equal(early.fields.branch, WORK_BRANCH);

    writeIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      fields: { status: 'done' },
      history: DONE,
      intake: completeDrop(),
    });
    assert.equal(
      plan(repositoryRoot, { type: 'fix', topic: 'rounding' }).fields.baseline,
      'none',
    );
  });

  test('a non-launch may open while the launch exists only on the base branch', () => {
    const repositoryRoot = createRepository();
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr', commitTime: 2_000 });
    git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
    git(repositoryRoot, ['rm', '-rq', 'iterations']);
    commitAll(repositoryRoot, 'drop the folder on this branch', 3_000);
    assert.match(
      plan(repositoryRoot).name,
      new RegExp(`^feat-returns-${TODAY}-[a-z]{4}$`),
    );
  });

  test('draws a new id while the name is taken here or in the sibling, then gives up', () => {
    const repositoryRoot = createRepository();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(repositoryRoot),
    });
    writeIteration({ repositoryRoot, name: 'launch-2026-09-30-jxmr' });
    writeIteration({ repositoryRoot, name: `feat-returns-${TODAY}-aaaa` });
    writeIteration({ repositoryRoot: siblingRoot, name: `feat-returns-${TODAY}-bbbb` });
    assert.equal(
      plan(repositoryRoot, { siblingRoot, nextId: idSequence(['aaaa', 'bbbb', 'cccc']) })
        .name,
      `feat-returns-${TODAY}-cccc`,
    );
    assert.throws(
      () => plan(repositoryRoot, { nextId: () => 'aaaa' }),
      new RegExp(`after ${MAXIMUM_NAME_ATTEMPTS} attempts`),
    );
  });

  test('--both writes the sibling README, from scratch too, and warns on template drift', () => {
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
    assert.equal(both.fields.baseline, 'none');
    assert.equal(both.siblingBaseline, 'none');
    const siblingReadme = both.files.find(
      (file) => file.path === join(siblingRoot, 'iterations', both.name, 'README.md'),
    );
    assert.equal(parseIterationReadme(siblingReadme.content).get('Baseline'), 'none');
    assert.deepEqual(both.warnings, []);

    mkdirSync(join(siblingRoot, 'tooling/iterations/templates'), { recursive: true });
    writeFileSync(
      join(siblingRoot, 'tooling/iterations/templates/README.md'),
      '# {{name}}\n',
    );
    assert.match(plan(repositoryRoot, { siblingRoot }).warnings[0], /byte-identical/);
  });

  test('refuses a detached HEAD and a missing user.name', () => {
    const detached = createRepository();
    git(detached, ['checkout', '-q', '--detach']);
    assert.throws(() => plan(detached, { type: 'launch', topic: undefined }), /detached/);
    const anonymous = createRepository();
    git(anonymous, ['config', 'user.name', '']);
    assert.throws(
      () => plan(anonymous, { type: 'launch', topic: undefined }),
      /user\.name/,
    );
  });
});

describe('runNewIteration', () => {
  test('a dry run prints the plan and writes nothing; a real run writes the README and the next steps', () => {
    const repositoryRoot = createRepository();
    const dry = runNewIteration(['launch', '--dry-run'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'jxmr',
    });
    assert.equal(dry.exitCode, 0);
    assert.equal(dry.lines[0], 'Dry run — nothing written.');
    assert.ok(dry.lines.includes(`Iteration: launch-${TODAY}-jxmr`));
    assert.equal(existsSync(join(repositoryRoot, 'iterations')), false);

    const real = runNewIteration(['launch'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'jxmr',
    });
    assert.equal(real.lines[0], 'Created.');
    assert.ok(
      real.lines.some((line) =>
        line.includes(`pnpm iteration:intake launch-${TODAY}-jxmr <drop-folder>`),
      ),
    );
    assert.ok(
      existsSync(join(repositoryRoot, 'iterations', `launch-${TODAY}-jxmr`, 'README.md')),
    );
    assert.ok(!real.lines.some((line) => line.includes('--mode overlay')));

    const feature = runNewIteration(['feat', 'returns'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'kqzx',
    });
    assert.ok(
      feature.lines.some(
        (line) =>
          line.includes('--mode overlay') &&
          line.includes('--mode brief') &&
          line.includes(`pnpm iteration:baseline feat-returns-${TODAY}-kqzx <baseline>`),
      ),
    );

    assert.equal(runNewIteration([], { repositoryRoot }).exitCode, 1);
    assert.equal(runNewIteration(['--help'], { repositoryRoot }).exitCode, 0);
  });
});
