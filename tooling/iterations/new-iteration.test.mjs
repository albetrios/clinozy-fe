/**
 * Design-iteration generator (`pnpm iteration:new`).
 *
 * Pins the naming rules (digit-free topic, single launch, launch first), the Baseline
 * choice (latest Opened on the base branch, merge order on a tie, working-tree fallback),
 * the id retry on a collision, and the `--both` sibling folder — the same behaviour as
 * clinozy-be's generator. Git-backed cases run in throwaway repositories under the OS temp
 * folder, never in this checkout.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseIterationName, parseIterationReadme } from './list-iterations.mjs';
import {
  buildIterationName,
  chooseBaseline,
  configuredBaseBranch,
  gitEnvironment,
  LOCAL_ITERATION_TEMPLATES,
  localDate,
  MAXIMUM_NAME_ATTEMPTS,
  parseNewIterationArguments,
  planNewIteration,
  randomIterationId,
  readIterationTemplate,
  renderIterationReadme,
  renderTemplate,
  resolveSiblingRoot,
  runNewIteration,
  SIBLING_ITERATION_TEMPLATES,
  siblingPackageName,
  validateTypeAndTopic,
  writeIterationPlan,
} from './new-iteration.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_BRANCH = configuredBaseBranch();
const WORK_BRANCH = 'feat/iteration-work';
const TODAY = '2026-10-01';
const OWNER = 'Test Owner';
/** Commit times in these tests are offsets (seconds) from this Unix time. */
const COMMIT_EPOCH = 1_790_000_000;
const PRODUCT_PLAN_TEMPLATE = '# {{name}} — product plan\n\nBaseline `{{baseline}}`.\n';

const scratchFolders = [];

afterEach(() => {
  for (const folder of scratchFolders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});

function git(repositoryRoot, gitArguments, commitTime) {
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

/** A throwaway repository on the base branch with one commit; `parent` keeps siblings side by side. */
function createRepository({ packageName = 'demo-fe', parent } = {}) {
  const container = parent ?? mkdtempSync(join(tmpdir(), 'iteration-unit-'));
  if (parent === undefined) scratchFolders.push(container);
  const repositoryRoot = join(container, packageName);
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

/** A sibling (`demo-be`) next to `repositoryRoot`, holding the product-plan template. */
function createSibling(repositoryRoot) {
  const siblingRoot = createRepository({
    packageName: 'demo-be',
    parent: dirname(repositoryRoot),
  });
  const templates = join(siblingRoot, 'tooling/iterations/templates/plans');
  mkdirSync(templates, { recursive: true });
  writeFileSync(join(templates, 'product-plan.md'), PRODUCT_PLAN_TEMPLATE);
  return siblingRoot;
}

function addIteration({ repositoryRoot, name, opened, commitTime }) {
  const folder = join(repositoryRoot, 'iterations', name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'README.md'),
    `| Field | Value |\n| --- | --- |\n| Opened | ${opened} |\n`,
  );
  if (commitTime === undefined) return;
  git(repositoryRoot, ['add', '-A']);
  git(repositoryRoot, ['commit', '-q', '-m', `add ${name}`], commitTime);
}

function idSequence(ids) {
  let position = 0;
  return () => ids[Math.min(position++, ids.length - 1)];
}

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

describe('parseNewIterationArguments', () => {
  test('reads the type, topic and flags', () => {
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
  });

  test('treats --sibling <path> as --both', () => {
    const parsed = parseNewIterationArguments([
      'fix',
      'rounding',
      '--sibling',
      '../other-be',
    ]);
    assert.equal(parsed.createInSibling, true);
    assert.equal(parsed.siblingPath, '../other-be');
  });

  test('rejects --sibling without a path, unknown options and extra positionals', () => {
    assert.throws(
      () => parseNewIterationArguments(['feat', 'x', '--sibling']),
      /needs a path/,
    );
    assert.throws(
      () => parseNewIterationArguments(['feat', 'x', '--sibling', '--dry-run']),
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
});

describe('validateTypeAndTopic', () => {
  test('accepts a launch without a topic and a feat with a kebab-case topic', () => {
    assert.deepEqual(validateTypeAndTopic({ type: 'launch', topic: undefined }), {
      type: 'launch',
      topic: undefined,
    });
    assert.deepEqual(validateTypeAndTopic({ type: 'change', topic: 'patient-consent' }), {
      type: 'change',
      topic: 'patient-consent',
    });
  });

  test('rejects an unknown type, a launch topic and a missing topic', () => {
    assert.throws(
      () => validateTypeAndTopic({ type: 'release', topic: 'x' }),
      /Unknown type/,
    );
    assert.throws(
      () => validateTypeAndTopic({ type: undefined, topic: undefined }),
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
});

describe('iteration names', () => {
  test('builds and parses launch and topic names', () => {
    const launch = buildIterationName({
      type: 'launch',
      topic: undefined,
      opened: '2026-09-30',
      id: 'jxmr',
    });
    const feature = buildIterationName({
      type: 'feat',
      topic: 'pharmacy-returns',
      opened: '2026-10-06',
      id: 'kqzx',
    });
    assert.equal(launch, 'launch-2026-09-30-jxmr');
    assert.equal(feature, 'feat-pharmacy-returns-2026-10-06-kqzx');
    assert.deepEqual(parseIterationName(feature), {
      type: 'feat',
      topic: 'pharmacy-returns',
      opened: '2026-10-06',
    });
    assert.equal(parseIterationName(launch)?.topic, undefined);
  });

  test('does not recognise folders outside the pattern', () => {
    for (const name of [
      'b-pharmacy-returns',
      'v1',
      'feat-returns2-2026-10-06-kqzx',
      'feat-x-2026-10-06-KQZX',
    ]) {
      assert.equal(parseIterationName(name), undefined, name);
    }
  });

  test('draws four lowercase letters and formats the local date', () => {
    for (let draw = 0; draw < 50; draw += 1)
      assert.match(randomIterationId(), /^[a-z]{4}$/);
    assert.equal(localDate(new Date(2026, 8, 5)), '2026-09-05');
  });
});

describe('README and templates', () => {
  const fields = {
    type: 'feat',
    topic: 'pharmacy-returns',
    owner: OWNER,
    opened: '2026-10-06',
    branch: 'feat/pharmacy-returns',
    baseline: 'launch-2026-09-30-jxmr',
    status: 'planning',
    summary: '—',
  };

  test('renders the README field table and reads it back', () => {
    const markdown = renderIterationReadme({
      name: 'feat-pharmacy-returns-2026-10-06-kqzx',
      fields,
    });
    assert.ok(markdown.startsWith('# feat-pharmacy-returns-2026-10-06-kqzx\n'));
    const parsed = parseIterationReadme(markdown);
    assert.deepEqual(
      [...parsed.keys()],
      ['Type', 'Topic', 'Owner', 'Opened', 'Branch', 'Baseline', 'Status', 'Summary'],
    );
    assert.equal(parsed.get('Baseline'), 'launch-2026-09-30-jxmr');
  });

  test('fills every placeholder in every template', () => {
    const values = { name: 'feat-pharmacy-returns-2026-10-06-kqzx', ...fields };
    for (const relativePath of LOCAL_ITERATION_TEMPLATES) {
      const rendered = renderTemplate({
        template: readIterationTemplate(relativePath),
        values,
      });
      assert.doesNotMatch(rendered, /\{\{\w+\}\}/, relativePath);
    }
  });

  test('refuses a placeholder it has no value for', () => {
    assert.throws(
      () => renderTemplate({ template: 'Hello {{who}}', values: {} }),
      /\{\{who\}\}/,
    );
  });

  // The launch README is kept in the generator's exact format (Prettier and markdownlint
  // skip it) so it stays byte-identical to the clinozy-be copy.
  test('the launch README is in the generator format', () => {
    const name = 'launch-2026-09-30-jxmr';
    const actual = readFileSync(join(ROOT, 'iterations', name, 'README.md'), 'utf-8');
    const parsed = parseIterationReadme(actual);
    const rendered = renderIterationReadme({
      name,
      fields: Object.fromEntries(
        [
          'Type',
          'Topic',
          'Owner',
          'Opened',
          'Branch',
          'Baseline',
          'Status',
          'Summary',
        ].map((label) => [label.toLowerCase(), parsed.get(label) ?? '']),
      ),
    });
    assert.equal(actual, rendered);
    assert.equal(parsed.get('Type'), 'launch');
    assert.equal(parsed.get('Baseline'), 'none');
  });

  // Local check only: CI has no clinozy-be checkout next to this one.
  const siblingTemplates = join(ROOT, '..', 'clinozy-be', 'tooling/iterations/templates');
  test(
    'the shared templates are byte-identical to clinozy-be',
    {
      skip: existsSync(siblingTemplates)
        ? false
        : 'no ../clinozy-be checkout with templates',
    },
    () => {
      for (const relativePath of LOCAL_ITERATION_TEMPLATES) {
        assert.equal(
          readIterationTemplate(relativePath),
          readFileSync(join(siblingTemplates, relativePath), 'utf-8'),
          relativePath,
        );
      }
    },
  );
});

describe('chooseBaseline', () => {
  test('prefers the latest Opened, then the newest commit, then the name', () => {
    assert.equal(
      chooseBaseline([
        { name: 'launch-2026-09-30-jxmr', opened: '2026-09-30', lastCommitTime: 900 },
        { name: 'feat-a-2026-10-02-aaaa', opened: '2026-10-02', lastCommitTime: 100 },
      ]),
      'feat-a-2026-10-02-aaaa',
    );
    assert.equal(
      chooseBaseline([
        { name: 'feat-b-2026-10-02-bbbb', opened: '2026-10-02', lastCommitTime: 200 },
        { name: 'feat-a-2026-10-02-aaaa', opened: '2026-10-02', lastCommitTime: 300 },
      ]),
      'feat-a-2026-10-02-aaaa',
    );
    assert.equal(
      chooseBaseline([
        { name: 'feat-a-2026-10-02-aaaa', opened: '2026-10-02', lastCommitTime: 300 },
        { name: 'feat-b-2026-10-02-bbbb', opened: '2026-10-02', lastCommitTime: 300 },
      ]),
      'feat-b-2026-10-02-bbbb',
    );
    assert.equal(chooseBaseline([]), undefined);
  });
});

describe('planNewIteration', () => {
  test('refuses anything but a launch while no iteration exists', () => {
    const repositoryRoot = createRepository();
    assert.throws(() => plan(repositoryRoot), /open the launch first/);
  });

  test('plans a launch with Baseline none and writes it only when asked', () => {
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
    });
    assert.deepEqual(
      launch.files.map((file) => file.path.slice(launch.localFolder.length + 1)),
      LOCAL_ITERATION_TEMPLATES,
    );
    assert.equal(existsSync(launch.localFolder), false);

    writeIterationPlan(launch);
    const prd = readFileSync(join(launch.localFolder, 'PRD.md'), 'utf-8');
    assert.ok(prd.startsWith(`# ${launch.name} — PRD\n`));
    assert.throws(() => writeIterationPlan(launch), /already exists/);
  });

  test('refuses a second launch', () => {
    const repositoryRoot = createRepository();
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
    });
    assert.throws(
      () => plan(repositoryRoot, { type: 'launch', topic: undefined }),
      /only ever one launch/,
    );
  });

  test('takes the Baseline from the base branch and records the current branch', () => {
    const repositoryRoot = createRepository();
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
      commitTime: 2_000,
    });
    addIteration({
      repositoryRoot,
      name: 'feat-a-2026-10-02-aaaa',
      opened: '2026-10-02',
      commitTime: 3_000,
    });
    git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
    // Newer, but only in this branch's working tree — not on the base branch.
    addIteration({
      repositoryRoot,
      name: 'feat-local-2026-10-05-cccc',
      opened: '2026-10-05',
    });

    const fix = plan(repositoryRoot, { type: 'fix', topic: 'rounding' });
    assert.equal(fix.fields.baseline, 'feat-a-2026-10-02-aaaa');
    assert.equal(fix.baselineOnBaseBranch, true);
    assert.equal(fix.fields.branch, WORK_BRANCH);
    assert.match(fix.name, new RegExp(`^fix-rounding-${TODAY}-[a-z]{4}$`));
  });

  test('breaks an Opened tie on the base branch by merge order', () => {
    const repositoryRoot = createRepository();
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
      commitTime: 2_000,
    });
    addIteration({
      repositoryRoot,
      name: 'feat-zeta-2026-10-02-zzzz',
      opened: '2026-10-02',
      commitTime: 3_000,
    });
    addIteration({
      repositoryRoot,
      name: 'feat-alpha-2026-10-02-aaaa',
      opened: '2026-10-02',
      commitTime: 4_000,
    });

    assert.equal(
      plan(repositoryRoot, { type: 'change', topic: 'consent' }).fields.baseline,
      'feat-alpha-2026-10-02-aaaa',
    );
  });

  test('falls back to the working tree while the base branch holds no iteration', () => {
    const repositoryRoot = createRepository();
    git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
      commitTime: 2_000,
    });

    const demo = plan(repositoryRoot, { topic: 'demo-check' });
    assert.equal(demo.fields.baseline, 'launch-2026-09-30-jxmr');
    assert.equal(demo.baselineOnBaseBranch, false);
  });

  test('draws a new id while the name is taken, here or in the sibling', () => {
    const repositoryRoot = createRepository();
    const siblingRoot = createSibling(repositoryRoot);
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
    });
    addIteration({ repositoryRoot, name: `feat-returns-${TODAY}-aaaa`, opened: TODAY });
    addIteration({
      repositoryRoot: siblingRoot,
      name: `feat-returns-${TODAY}-bbbb`,
      opened: TODAY,
    });

    const retried = plan(repositoryRoot, {
      siblingRoot,
      nextId: idSequence(['aaaa', 'bbbb', 'cccc']),
    });
    assert.equal(retried.name, `feat-returns-${TODAY}-cccc`);

    assert.throws(
      () => plan(repositoryRoot, { nextId: () => 'aaaa' }),
      new RegExp(`after ${MAXIMUM_NAME_ATTEMPTS} attempts`),
    );
  });

  test('plans the sibling folder under --both, with the same README and its own product plan', () => {
    const repositoryRoot = createRepository();
    const siblingRoot = createSibling(repositoryRoot);
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
    });

    const both = plan(repositoryRoot, { siblingRoot });
    const siblingFolder = join(siblingRoot, 'iterations', both.name);
    assert.equal(both.siblingFolder, siblingFolder);
    const siblingFiles = both.files.filter((file) => file.path.startsWith(siblingFolder));
    assert.deepEqual(
      siblingFiles.map((file) => file.path.slice(siblingFolder.length + 1)),
      SIBLING_ITERATION_TEMPLATES,
    );
    const contentOf = (folder, relativePath) =>
      both.files.find((file) => file.path === join(folder, relativePath))?.content;
    for (const relativePath of LOCAL_ITERATION_TEMPLATES) {
      assert.equal(
        contentOf(siblingFolder, relativePath),
        contentOf(both.localFolder, relativePath),
      );
    }
    assert.equal(
      contentOf(siblingFolder, 'plans/product-plan.md'),
      `# ${both.name} — product plan\n\nBaseline \`launch-2026-09-30-jxmr\`.\n`,
    );

    writeIterationPlan(both);
    assert.ok(existsSync(join(siblingFolder, 'plans/product-plan.md')));
  });

  test('refuses --both when the sibling has no product-plan template', () => {
    const repositoryRoot = createRepository();
    const siblingRoot = createRepository({
      packageName: 'demo-be',
      parent: dirname(repositoryRoot),
    });
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
    });
    assert.throws(
      () => plan(repositoryRoot, { siblingRoot }),
      /product-plan\.md not found/,
    );
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

describe('resolveSiblingRoot', () => {
  test('maps the package name -fe → -be next to this repository', () => {
    const repositoryRoot = createRepository();
    const siblingRoot = createSibling(repositoryRoot);
    assert.equal(
      resolveSiblingRoot({ repositoryRoot, siblingPath: undefined }),
      siblingRoot,
    );
    assert.equal(
      resolveSiblingRoot({ repositoryRoot, siblingPath: '../demo-be' }),
      siblingRoot,
    );
    assert.throws(
      () => resolveSiblingRoot({ repositoryRoot, siblingPath: '../missing-be' }),
      /not found/,
    );
  });

  test('needs --sibling when the package name does not end in -fe', () => {
    assert.equal(siblingPackageName('demo-fe'), 'demo-be');
    assert.throws(() => siblingPackageName('demo'), /--sibling/);
  });
});

describe('runNewIteration', () => {
  test('a dry run prints the plan and writes nothing', () => {
    const repositoryRoot = createRepository();
    git(repositoryRoot, ['switch', '-q', '-c', WORK_BRANCH]);
    addIteration({
      repositoryRoot,
      name: 'launch-2026-09-30-jxmr',
      opened: '2026-09-30',
      commitTime: 2_000,
    });

    const { exitCode, lines } = runNewIteration(['feat', 'demo-check', '--dry-run'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'abcd',
    });
    assert.equal(exitCode, 0);
    assert.equal(lines[0], 'Dry run — nothing written.');
    assert.ok(lines.includes(`Iteration: feat-demo-check-${TODAY}-abcd`));
    assert.ok(
      lines.includes(`Baseline:  launch-2026-09-30-jxmr (not on ${BASE_BRANCH} yet)`),
    );
    assert.equal(
      existsSync(join(repositoryRoot, 'iterations', `feat-demo-check-${TODAY}-abcd`)),
      false,
    );
  });

  test('creates the folder, then prints the next steps; no type prints the usage', () => {
    const repositoryRoot = createRepository();
    const { exitCode, lines } = runNewIteration(['launch'], {
      repositoryRoot,
      baseBranch: BASE_BRANCH,
      today: TODAY,
      nextId: () => 'jxmr',
    });
    assert.equal(exitCode, 0);
    assert.equal(lines[0], 'Created.');
    assert.ok(lines.includes('Next:'));
    for (const relativePath of LOCAL_ITERATION_TEMPLATES) {
      assert.ok(
        existsSync(
          join(repositoryRoot, 'iterations', `launch-${TODAY}-jxmr`, relativePath),
        ),
      );
    }

    assert.equal(runNewIteration([], { repositoryRoot }).exitCode, 1);
    assert.equal(runNewIteration(['--help'], { repositoryRoot }).exitCode, 0);
  });
});
