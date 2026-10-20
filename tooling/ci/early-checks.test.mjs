/**
 * The early checks (`early-checks.mjs`, `push-semgrep.mjs`): a finding blocks, when each commit
 * check runs, how each reads its command's result, and which pushed
 * files Semgrep scans.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EARLY_CHECKS_FALSE_POSITIVE_LOG,
  reportEarlyCheck,
  runClientEnv,
  runLockfileAudit,
  shouldRunCommitCheck,
} from './early-checks.mjs';
import { pushSemgrepTargets } from './push-semgrep.mjs';

/** A spawnSync stand-in that answers each call from `answers` in order and records the calls. */
function stub(answers) {
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args]);
    return answers[calls.length - 1] ?? { status: 0, stdout: '', stderr: '' };
  };
  return { run, calls };
}

/** Runs `body` with console and stderr output swallowed. */
function quietly(body) {
  const saved = [console.log, console.warn, console.error, process.stderr.write];
  console.log = console.warn = console.error = () => {};
  process.stderr.write = () => true;
  try {
    return body();
  } finally {
    [console.log, console.warn, console.error, process.stderr.write] = saved;
  }
}

describe('a finding blocks', () => {
  it('a finding fails; no finding passes', () => {
    expect(quietly(() => reportEarlyCheck({ check: 'x', findings: ['a finding'] }))).toBe(
      1,
    );
    expect(quietly(() => reportEarlyCheck({ check: 'x', findings: [] }))).toBe(0);
  });

  it('names the false-positive log, the one clinozy-be keeps', () => {
    expect(EARLY_CHECKS_FALSE_POSITIVE_LOG).toBe('agent-os/evals/false-positives.md');
  });
});

describe('the commit checks', () => {
  it('the audit runs on a staged lockfile; the allowlist on a staged env schema', () => {
    expect(
      shouldRunCommitCheck({ check: 'audit', stagedFiles: ['pnpm-lock.yaml'] }),
    ).toBe(true);
    expect(shouldRunCommitCheck({ check: 'audit', stagedFiles: ['package.json'] })).toBe(
      false,
    );
    for (const file of ['src/core/config/env-schema.ts', '.env.example'])
      expect(shouldRunCommitCheck({ check: 'client-env', stagedFiles: [file] })).toBe(
        true,
      );
    expect(
      shouldRunCommitCheck({
        check: 'client-env',
        stagedFiles: ['src/core/config/env.ts'],
      }),
    ).toBe(false);
  });

  it('the audit: clean passes, an unreachable registry passes, an advisory blocks', () => {
    expect(quietly(() => runLockfileAudit({ run: stub([{ status: 0 }]).run }))).toBe(0);
    const offline = stub([
      { status: 1, stdout: '', stderr: 'ERR_PNPM_AUDIT_NO_RESPONSE' },
    ]);
    expect(quietly(() => runLockfileAudit({ run: offline.run }))).toBe(0);
    expect(offline.calls).toStrictEqual([['pnpm', 'deps:audit:prod']]);
    const advisory = () => stub([{ status: 1, stdout: '1 high', stderr: '' }]).run;
    expect(quietly(() => runLockfileAudit({ run: advisory() }))).toBe(1);
  });

  it('the allowlist checks both deploy environments and fails on either', () => {
    const clean = stub([]);
    expect(quietly(() => runClientEnv({ run: clean.run }))).toBe(0);
    expect(clean.calls).toStrictEqual([
      ['pnpm', 'validate:client-env', '--env', 'development'],
      ['pnpm', 'validate:client-env', '--env', 'production'],
    ]);
    const production = stub([{ status: 0 }, { status: 1, stdout: 'out of range' }]);
    expect(quietly(() => runClientEnv({ run: production.run }))).toBe(1);
  });
});

describe('Semgrep at push', () => {
  it('scans every app source file and Vite plugin — never their tests', () => {
    expect(
      pushSemgrepTargets([
        'src/shared/auth/service.ts',
        'src/shared/auth/service.test.ts',
        'src/core/http/fetch-client.ts',
        'plugins/csp-api-origin.ts',
        'src/shared/tenancy/resolver.ts',
        'src/pages/login/LoginPage.tsx',
        'src/pages/login/LoginPage.test.tsx',
        'tooling/ci/affected.mjs',
        'docs/reference/security-model.md',
      ]),
    ).toStrictEqual([
      'src/shared/auth/service.ts',
      'src/core/http/fetch-client.ts',
      'plugins/csp-api-origin.ts',
      'src/shared/tenancy/resolver.ts',
      'src/pages/login/LoginPage.tsx',
    ]);
  });

  it('runs the same rules as the PR CI Semgrep SAST step, and that step can fail', () => {
    const sast = readFileSync('.github/workflows/pr-ci.yml', 'utf8')
      .split('\n')
      .find((line) => line.includes('run: semgrep scan'));
    expect(readFileSync('tooling/ci/push-semgrep.mjs', 'utf8')).toContain("'p/default'");
    expect(sast).toContain('--config p/default');
    // Without --error Semgrep exits 0 on a finding, so the lane passed whatever it found.
    expect(sast).toContain('--error');
    expect(sast).toContain('--baseline-commit "$BASE_SHA"');
  });
});
