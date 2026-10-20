/**
 * `pnpm iteration:baseline` — `none` or an existing earlier iteration in this repository whose
 * `intake-files/` holds the required set (the incremental delta is a diff of `intake-files/`
 * only), written to the Baseline row with a History line.
 */
import { afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

it('records the confirmed Baseline with a History line', () => {
  const repositoryRoot = repositoryWithLaunch();
  const result = runBaseline([CURRENT, LAUNCH], { repositoryRoot, today: TODAY });
  expect(result.exitCode).toBe(0);
  const readme = readFileSync(
    join(repositoryRoot, 'iterations', CURRENT, 'README.md'),
    'utf-8',
  );
  expect(parseIterationReadme(readme).get('Baseline')).toBe(LAUNCH);
  expect(
    readme.endsWith(`## History\n\n- ${TODAY} · Baseline — → ${LAUNCH} · — · ${OWNER}\n`),
  ).toBeTruthy();
  expect(() => runBaseline([CURRENT, LAUNCH], { repositoryRoot })).toThrow(
    /already has Baseline/,
  );
  runBaseline([CURRENT, 'none'], { repositoryRoot, today: TODAY });
  expect(
    parseIterationReadme(
      readFileSync(join(repositoryRoot, 'iterations', CURRENT, 'README.md'), 'utf-8'),
    ).get('Baseline'),
  ).toBe('none');
});

it('refuses itself, a later or unknown iteration', () => {
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
    expect(
      () => planBaselineChange({ repositoryRoot, iteration: CURRENT, baseline }),
      baseline,
    ).toThrow(/earlier iteration/);
  }
});

it("refuses a Baseline whose intake-files/ is missing or incomplete — it's what the diff compares", () => {
  const { 'schema-routes.md': _schema, ...withoutSchema } = completeDrop();
  const incomplete = repositoryWithLaunch(withoutSchema);
  expect(() =>
    planBaselineChange({
      repositoryRoot: incomplete,
      iteration: CURRENT,
      baseline: LAUNCH,
    }),
  ).toThrow(/missing: schema-routes\.md/);

  const repositoryRoot = createRepository();
  writeIteration({ repositoryRoot, name: LAUNCH, fields: { status: 'done' } });
  writeIteration({ repositoryRoot, name: CURRENT });
  expect(() =>
    planBaselineChange({ repositoryRoot, iteration: CURRENT, baseline: LAUNCH }),
  ).toThrow(/missing: intake-files\//);
});

it('prints the usage for a wrong command line', () => {
  expect(runBaseline([CURRENT]).exitCode).toBe(1);
  expect(runBaseline(['--help']).exitCode).toBe(0);
  expect(() => runBaseline([CURRENT, LAUNCH, '--force'])).toThrow(/Unknown option/);
});
