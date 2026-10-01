/**
 * `pnpm iteration:baseline` — `none` or an existing earlier iteration in this repository whose
 * `intake-files/` holds the required set (the incremental delta is a diff of `intake-files/`
 * only), written to the Baseline row with a History line.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import {
  cleanScratch,
  completeDrop,
  createRepository,
  OWNER,
  TODAY,
  writeIteration,
} from './iteration-fixtures.mjs';
import { parseIterationReadme } from './iterations.mjs';
import { planBaselineChange, runBaseline } from './set-iteration-baseline.mjs';

afterEach(cleanScratch);

const LAUNCH = 'launch-2026-09-30-jxmr';
const CURRENT = 'feat-returns-2026-10-06-kqzx';

function repositoryWithLaunch(intake = completeDrop()) {
  const repositoryRoot = createRepository();
  writeIteration({ repositoryRoot, name: LAUNCH, fields: { status: 'done' }, intake });
  writeIteration({ repositoryRoot, name: CURRENT, fields: { baseline: '—' } });
  return repositoryRoot;
}

test('records the confirmed Baseline with a History line', () => {
  const repositoryRoot = repositoryWithLaunch();
  const result = runBaseline([CURRENT, LAUNCH], { repositoryRoot, today: TODAY });
  assert.equal(result.exitCode, 0);
  const readme = readFileSync(
    join(repositoryRoot, 'iterations', CURRENT, 'README.md'),
    'utf-8',
  );
  assert.equal(parseIterationReadme(readme).get('Baseline'), LAUNCH);
  assert.ok(
    readme.endsWith(`## History\n\n- ${TODAY} · Baseline — → ${LAUNCH} · — · ${OWNER}\n`),
  );
  assert.throws(
    () => runBaseline([CURRENT, LAUNCH], { repositoryRoot }),
    /already has Baseline/,
  );
  runBaseline([CURRENT, 'none'], { repositoryRoot, today: TODAY });
  assert.equal(
    parseIterationReadme(
      readFileSync(join(repositoryRoot, 'iterations', CURRENT, 'README.md'), 'utf-8'),
    ).get('Baseline'),
    'none',
  );
});

test('refuses itself, a later or unknown iteration', () => {
  const repositoryRoot = repositoryWithLaunch();
  writeIteration({
    repositoryRoot,
    name: 'feat-later-2026-10-09-abcd',
    fields: { status: 'done' },
    intake: completeDrop(),
  });
  for (const baseline of [
    CURRENT,
    'feat-later-2026-10-09-abcd',
    'feat-ghost-2026-09-01-abcd',
  ]) {
    assert.throws(
      () => planBaselineChange({ repositoryRoot, iteration: CURRENT, baseline }),
      /earlier iteration/,
      baseline,
    );
  }
});

test("refuses a Baseline whose intake-files/ is missing or incomplete — it's what the diff compares", () => {
  const { 'schema-routes.md': _schema, ...withoutSchema } = completeDrop();
  const incomplete = repositoryWithLaunch(withoutSchema);
  assert.throws(
    () =>
      planBaselineChange({
        repositoryRoot: incomplete,
        iteration: CURRENT,
        baseline: LAUNCH,
      }),
    /missing: schema-routes\.md/,
  );

  const repositoryRoot = createRepository();
  writeIteration({ repositoryRoot, name: LAUNCH, fields: { status: 'done' } });
  writeIteration({ repositoryRoot, name: CURRENT });
  assert.throws(
    () => planBaselineChange({ repositoryRoot, iteration: CURRENT, baseline: LAUNCH }),
    /missing: intake-files\//,
  );
});

test('prints the usage for a wrong command line', () => {
  assert.equal(runBaseline([CURRENT]).exitCode, 1);
  assert.equal(runBaseline(['--help']).exitCode, 0);
  assert.throws(() => runBaseline([CURRENT, LAUNCH, '--force']), /Unknown option/);
});
