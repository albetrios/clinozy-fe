/**
 * The early checks (`early-checks.mjs`, `push-semgrep.mjs`): the warn-only window on both sides of
 * its date, when each commit check runs, how each reads its command's result, and which pushed
 * files Semgrep scans.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  EARLY_CHECKS_BLOCK_FROM,
  EARLY_CHECKS_FALSE_POSITIVE_LOG,
  isEarlyCheckWarnOnly,
  reportEarlyCheck,
  runClientEnv,
  runLockfileAudit,
  shouldRunCommitCheck,
} from './early-checks.mjs';
import { pushSemgrepTargets } from './push-semgrep.mjs';

/** 23:59 on the day before the switch, and 00:00 on it — both Asia/Calcutta (UTC+5:30). */
const LAST_WARN_ONLY = new Date('2026-10-30T18:29:00Z');
const FIRST_BLOCKING = new Date('2026-10-30T18:30:00Z');

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

describe('the warn-only window', () => {
  test('warns through the day before the switch in Asia/Calcutta, blocks from it', () => {
    assert.equal(EARLY_CHECKS_BLOCK_FROM, '2026-10-31');
    assert.equal(isEarlyCheckWarnOnly(LAST_WARN_ONLY), true);
    assert.equal(isEarlyCheckWarnOnly(FIRST_BLOCKING), false);
  });

  test('a finding passes while warn-only and fails after; no finding always passes', () => {
    const findings = ['a finding'];
    assert.equal(
      quietly(() => reportEarlyCheck({ check: 'x', findings, now: LAST_WARN_ONLY })),
      0,
    );
    assert.equal(
      quietly(() => reportEarlyCheck({ check: 'x', findings, now: FIRST_BLOCKING })),
      1,
    );
    assert.equal(
      quietly(() => reportEarlyCheck({ check: 'x', findings: [], now: FIRST_BLOCKING })),
      0,
    );
  });

  test('names the false-positive log, the one clinozy-be keeps', () => {
    assert.equal(
      EARLY_CHECKS_FALSE_POSITIVE_LOG,
      'agent-os/evals/warn-only-false-positives.md',
    );
  });
});

describe('the commit checks', () => {
  test('the audit runs on a staged lockfile; the allowlist on a staged env schema', () => {
    assert.equal(
      shouldRunCommitCheck({ check: 'audit', stagedFiles: ['pnpm-lock.yaml'] }),
      true,
    );
    assert.equal(
      shouldRunCommitCheck({ check: 'audit', stagedFiles: ['package.json'] }),
      false,
    );
    for (const file of ['src/core/config/env-schema.ts', '.env.example'])
      assert.equal(
        shouldRunCommitCheck({ check: 'client-env', stagedFiles: [file] }),
        true,
      );
    assert.equal(
      shouldRunCommitCheck({
        check: 'client-env',
        stagedFiles: ['src/core/config/env.ts'],
      }),
      false,
    );
  });

  test('the audit: clean passes, an unreachable registry passes, advisories follow the window', () => {
    assert.equal(
      quietly(() => runLockfileAudit({ run: stub([{ status: 0 }]).run })),
      0,
    );
    const offline = stub([
      { status: 1, stdout: '', stderr: 'ERR_PNPM_AUDIT_NO_RESPONSE' },
    ]);
    assert.equal(
      quietly(() => runLockfileAudit({ run: offline.run, now: FIRST_BLOCKING })),
      0,
    );
    assert.deepEqual(offline.calls, [['pnpm', 'deps:audit:prod']]);
    const advisory = () => stub([{ status: 1, stdout: '1 high', stderr: '' }]).run;
    assert.equal(
      quietly(() => runLockfileAudit({ run: advisory(), now: LAST_WARN_ONLY })),
      0,
    );
    assert.equal(
      quietly(() => runLockfileAudit({ run: advisory(), now: FIRST_BLOCKING })),
      1,
    );
  });

  test('the allowlist checks both deploy environments and fails on either', () => {
    const clean = stub([]);
    assert.equal(
      quietly(() => runClientEnv({ run: clean.run, now: FIRST_BLOCKING })),
      0,
    );
    assert.deepEqual(clean.calls, [
      ['pnpm', 'validate:client-env', '--env', 'development'],
      ['pnpm', 'validate:client-env', '--env', 'production'],
    ]);
    const production = stub([{ status: 0 }, { status: 1, stdout: 'out of range' }]);
    assert.equal(
      quietly(() => runClientEnv({ run: production.run, now: FIRST_BLOCKING })),
      1,
    );
  });
});

describe('Semgrep at push', () => {
  test('scans the auth runtime, the HTTP client and the CSP builders — never their tests', () => {
    assert.deepEqual(
      pushSemgrepTargets([
        'src/shared/auth/service.ts',
        'src/shared/auth/service.test.ts',
        'src/core/http/fetch-client.ts',
        'src/lib/csp-api-origin.ts',
        'plugins/csp-api-origin.ts',
        'src/shared/tenancy/resolver.ts',
        'docs/reference/security-model.md',
      ]),
      [
        'src/shared/auth/service.ts',
        'src/core/http/fetch-client.ts',
        'src/lib/csp-api-origin.ts',
        'plugins/csp-api-origin.ts',
      ],
    );
  });
});
