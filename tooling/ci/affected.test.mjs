/**
 * Pins `pnpm test:affected` (`/fe-validate --affected`) to `.husky/pre-push`: the same pnpm steps
 * in the same order, and one rule for which pushed files make a conditional step run — the hook
 * asks `pushSteps` instead of matching files itself (it used to carry its own grep patterns, kept
 * equal to these by string comparison) — so the preview never describes a push that runs
 * differently.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pushSteps, selectionTable, stepRunsAnswer } from './affected.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = join(ROOT, 'tooling/ci/affected.mjs');
const PRE_PUSH = readFileSync(join(ROOT, '.husky/pre-push'), 'utf8');
/** The hook's `step_runs` function, as a script of its own. */
const STEP_RUNS = PRE_PUSH.slice(
  PRE_PUSH.indexOf('step_runs() {'),
  PRE_PUSH.indexOf('}\n', PRE_PUSH.indexOf('step_runs() {')) + 2,
);
const firstWords = (command) => command.split(' ').slice(0, 2).join(' ');

describe('test:affected mirrors .husky/pre-push', () => {
  it('lists exactly the pnpm steps the hook runs, in its order', () => {
    const hookSteps = [...PRE_PUSH.matchAll(/^\s*(pnpm [a-z][\w:.-]*)/gm)].map(
      (match) => match[1],
    );
    const previewSteps = pushSteps([])
      .map((step) => firstWords(step.command))
      .filter((command) => command.startsWith('pnpm '));
    expect(previewSteps).toStrictEqual(hookSteps);
  });

  it('asks pushSteps for every conditional step and matches no pushed file itself', () => {
    const asked = [...PRE_PUSH.matchAll(/\bstep_runs '([^']+)'/g)].map(
      (match) => match[1],
    );
    const conditional = pushSteps([])
      .filter((step) => !step.why.startsWith('always'))
      .map((step) => step.command)
      .filter((command) => command !== 'pnpm security:semgrep:push');
    expect(asked).toStrictEqual(conditional);
    expect(PRE_PUSH).not.toMatch(/git diff --name-only/);
  });

  it('answers yes or no for the pushed files', () => {
    const answer = (command, changedFiles) => stepRunsAnswer({ changedFiles, command });
    for (const file of [
      'src/app/a.tsx',
      'tests/utils/setup.ts',
      'vitest.config.ts',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tooling/ci/a.mjs',
      // The CI policy tests read the workflows and the hook tests spawn the hooks, so a push of
      // only a workflow or only a hook runs the ones naming it; a changed policy test selects
      // itself.
      '.github/workflows/post-merge-ci.yml',
      'agent-os/hooks/fe-push-ci-watch.mjs',
      'tests/ci/a.policy.test.ts',
    ])
      expect(answer('pnpm test:pre-push', [file]), file).toBe('yes');
    for (const file of ['docs/a.md'])
      expect(answer('pnpm test:pre-push', [file]), file).toBe('no');
    expect(answer('pnpm sonar:scan', ['src/app/a.tsx'])).toBe('yes');
    for (const file of [
      'src/a.test.tsx',
      'src/x/__tests__/y.ts',
      'src/a.d.ts',
      'src/a.css',
    ])
      expect(answer('pnpm sonar:scan', [file]), file).toBe('no');
    // A hooks.json edit with the generated platform settings behind (planted-bug drill, 20 Oct
    // 2026) is caught at push, not first in CI.
    for (const file of ['agent-os/hooks/hooks.json', 'tooling/agent-os/generate.ts'])
      expect(answer('pnpm agent-os:generate:check', [file]), file).toBe('yes');
    expect(answer('pnpm agent-os:generate:check', ['src/app/a.tsx'])).toBe('no');
    expect(answer('pnpm docs:lint:changed', ['docs/a.md'])).toBe('yes');
    expect(answer('pnpm docs:lint:changed', ['src/a.ts'])).toBe('no');
    expect(answer('pnpm knip', [])).toBe('yes');
    expect(answer('pnpm not-a-step', [])).toBeUndefined();
  });

  it('prints the answer for the hook, and stops on a step it does not run', () => {
    const asked = (command) =>
      spawnSync(process.execPath, [SCRIPT, '--base', 'HEAD', '--runs', command], {
        cwd: ROOT,
        encoding: 'utf8',
      });
    const unit = asked('pnpm test:pre-push');
    expect(unit.status).toBe(0);
    expect(unit.stdout).toBe('no\n');
    const unknown = asked('pnpm not-a-step');
    expect(unknown.status).toBe(1);
    expect(unknown.stdout).toBe('');
    expect(unknown.stderr).toContain('"pnpm not-a-step" is not a .husky/pre-push step');
  });

  it("runs the step when the hook's answer is anything but no", () => {
    const folder = mkdtempSync(join(tmpdir(), 'affected-step-runs-'));
    try {
      const fakeNode = (answer) => {
        writeFileSync(join(folder, 'node'), `#!/bin/sh\nprintf '${answer}'\nexit 0\n`);
        chmodSync(join(folder, 'node'), 0o755);
        return spawnSync(
          '/bin/sh',
          [
            '-c',
            `${STEP_RUNS}\nPUSH_BASE=x\nstep_runs 'pnpm test:pre-push' && echo runs`,
          ],
          { encoding: 'utf8', env: { PATH: `${folder}:/usr/bin:/bin` } },
        ).stdout;
      };
      expect(fakeNode('yes\\n')).toBe('runs\n');
      expect(fakeNode('no\\n')).toBe('');
      expect(fakeNode('')).toBe('runs\n');
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('says why each step runs, and summarizes the always-run tests', () => {
    const steps = pushSteps(['src/shared/auth/service.ts', 'docs/x.md']);
    const runs = (command) => steps.find((step) => step.command === command)?.runs;
    expect(runs('pnpm security:semgrep:push')).toBe(true);
    expect(runs('pnpm sonar:scan')).toBe(true);
    expect(runs('pnpm test:pre-push')).toBe(true);
    expect(steps.find((step) => step.command === 'pnpm docs:lint:changed')?.why).toBe(
      'pushed Markdown',
    );
    const docsOnly = pushSteps(['docs/x.md']);
    expect(docsOnly.find((step) => step.command === 'pnpm test:pre-push')?.runs).toBe(
      false,
    );
    expect(docsOnly.find((step) => step.command === 'pnpm sonar:scan')?.runs).toBe(false);
    const table = selectionTable({
      mode: 'selected',
      reasons: ['2 of 9'],
      projects: { unit: ['src/a.test.ts', 'src/b.test.ts'] },
      why: { 'src/a.test.ts': ['imports src/a.ts'], 'src/b.test.ts': ['always run'] },
    });
    expect(table.includes('| unit | `src/a.test.ts` | imports src/a.ts |')).toBeTruthy();
    expect(
      table.includes('| unit | 1 file(s) | always run (any source change) |'),
    ).toBeTruthy();
  });
});
