/**
 * The early checks — the dependency audit and the client env allowlist at commit
 * (`.husky/pre-commit` steps 11 and 12), Semgrep at push (`pnpm security:semgrep:push`) and the
 * live CSP and HSTS check after each Netlify deploy (`pnpm deploy:probe-live`) — report their
 * findings one way, and a finding blocks. A finding the user judges wrong goes into
 * {@link EARLY_CHECKS_FALSE_POSITIVE_LOG}, so the rule gets fixed rather than worked around. The
 * same rule and log as clinozy-be's `src/scripts/tooling/early-checks.util.ts`.
 *
 * Usage (the commit checks, from `tooling/validate/before-commit-guard.sh`):
 *   node tooling/ci/early-checks.mjs audit        # pnpm deps:audit:prod on a staged lockfile
 *   node tooling/ci/early-checks.mjs client-env   # validate:client-env for each deploy environment
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where a finding the user judges wrong is recorded, one row each. */
export const EARLY_CHECKS_FALSE_POSITIVE_LOG = 'agent-os/evals/false-positives.md';

/** The staged files that make the client env allowlist run at commit. */
export const CLIENT_ENV_TRIGGERS = [
  'src/core/config/env-schema.ts',
  '.env.example',
  'tooling/validate/client-env.ts',
];

/** The deploy environments the allowlist is checked for. */
export const DEPLOY_ENVIRONMENTS = ['development', 'production'];

/** `pnpm audit` could not reach the registry — no verdict on the lockfile. */
export const AUDIT_UNREACHABLE =
  /ERR_PNPM_AUDIT_(?:BAD_RESPONSE|NO_RESPONSE)|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i;

/**
 * Prints an early check's findings and returns its exit code: 0 with no finding, 1 with any. The
 * message names the false-positive log.
 *
 * @param {{ check: string, findings: readonly string[] }} options
 * @returns {number}
 */
export function reportEarlyCheck({ check, findings }) {
  if (findings.length === 0) {
    console.log(`✓ ${check}: no findings`);
    return 0;
  }
  console.error(`✗ ${check}: ${findings.length} finding(s)`);
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error(
    `  A finding that is wrong: add a row to ${EARLY_CHECKS_FALSE_POSITIVE_LOG}.`,
  );
  return 1;
}

/**
 * Whether the staged files make a commit check run.
 *
 * @param {{ check: 'audit' | 'client-env', stagedFiles: readonly string[] }} options
 * @returns {boolean}
 */
export function shouldRunCommitCheck({ check, stagedFiles }) {
  if (check === 'audit') return stagedFiles.includes('pnpm-lock.yaml');
  return stagedFiles.some((file) => CLIENT_ENV_TRIGGERS.includes(file));
}

/**
 * `pnpm deps:audit:prod` on a staged lockfile: an advisory blocks; an unreachable registry warns
 * and passes (the PR's dependency audit lane runs it).
 *
 * @param {{ run?: typeof spawnSync }} [options]
 * @returns {number}
 */
export function runLockfileAudit({ run = spawnSync } = {}) {
  const result = run('pnpm', ['deps:audit:prod'], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status === 0)
    return reportEarlyCheck({ check: 'Dependency audit', findings: [] });
  process.stderr.write(output);
  if (AUDIT_UNREACHABLE.test(output)) {
    console.warn(
      '⚠ Dependency audit: the registry could not be reached — the PR audits it',
    );
    return 0;
  }
  return reportEarlyCheck({
    check: 'Dependency audit (lockfile staged)',
    findings: ['pnpm deps:audit:prod reported high advisories — see above'],
  });
}

/**
 * `pnpm validate:client-env --env <environment>` for each deploy environment, when the env schema
 * changed: an out-of-range value in a profile blocks.
 *
 * @param {{ run?: typeof spawnSync }} [options]
 * @returns {number}
 */
export function runClientEnv({ run = spawnSync } = {}) {
  const findings = [];
  for (const environment of DEPLOY_ENVIRONMENTS) {
    const result = run('pnpm', ['validate:client-env', '--env', environment], {
      encoding: 'utf8',
    });
    if (result.status === 0) continue;
    process.stderr.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    findings.push(`validate:client-env --env ${environment} failed — see above`);
  }
  return reportEarlyCheck({
    check: 'Client env allowlist (env schema staged)',
    findings,
  });
}

/** What each commit check says when the staged files do not call for it. */
const SKIPPED = {
  audit: 'skipped — pnpm-lock.yaml is not staged',
  'client-env': 'skipped — the env schema is not staged',
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv[2];
  if (check !== 'audit' && check !== 'client-env') {
    console.error('Usage: node tooling/ci/early-checks.mjs <audit|client-env>');
    process.exitCode = 2;
  } else {
    const staged = spawnSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=d'],
      {
        encoding: 'utf8',
      },
    );
    const stagedFiles = (staged.stdout ?? '').split('\n').filter(Boolean);
    if (!shouldRunCommitCheck({ check, stagedFiles })) console.log(`  ${SKIPPED[check]}`);
    else process.exitCode = check === 'audit' ? runLockfileAudit() : runClientEnv();
  }
}
