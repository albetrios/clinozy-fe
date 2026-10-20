/**
 * The one list of every check that warns instead of blocking — a workflow step with
 * `continue-on-error`, a `--report-only` flag, or a package script whose command ends by
 * swallowing its own exit code. A check is warn-only only when it is listed here with the reason
 * it does not block; `tests/ci/warn-only.policy.test.ts` fails on one that is not listed, and on a
 * listed one that no longer exists. The same registry as clinozy-be's `tooling/validate/warn-only.ts`.
 */

/** How a check is kept from blocking. */
export type WarnOnlyMechanism =
  'continue-on-error' | 'report-only flag' | 'report script';

/** One non-blocking check: a workflow or composite-action step, or a package script. */
export type WarnOnlyCheck =
  | {
      /** The file under `.github/`. */
      readonly workflow: string;
      /** The step's `name:`. */
      readonly step: string;
      readonly mechanism: 'continue-on-error' | 'report-only flag';
      /** One line on why it warns rather than blocks — what blocks instead. */
      readonly reason: string;
    }
  | {
      /** The `package.json` script name. */
      readonly script: string;
      readonly mechanism: 'report-only flag' | 'report script';
      readonly reason: string;
    };

/** Every warn-only check. Add an entry in the change that makes a check non-blocking. */
export const WARN_ONLY_CHECKS: readonly WarnOnlyCheck[] = [
  {
    workflow: '.github/workflows/reusable-vitest-unit-only.yml',
    step: 'Selector miss check',
    mechanism: 'continue-on-error',
    reason:
      'reports the failed test files `pnpm test:select` would have skipped, for selector-fixtures.json; the merged suite itself is the gate',
  },
  {
    workflow: '.github/workflows/pr-ci.yml',
    step: 'Dependency audit (all deps, advisory)',
    mechanism: 'continue-on-error',
    reason:
      'a dev-only advisory published this week says nothing about the PR in hand; scheduled-deps-audit.yml runs the full tree weekly as a blocking job',
  },
  {
    workflow: '.github/workflows/scheduled-unit-nightly.yml',
    step: 'ESLint (fills its cache)',
    mechanism: 'continue-on-error',
    reason:
      'the nightly runs it to fill the ESLint cache for the next PRs; the PR lint lane is the gate',
  },
  {
    workflow: '.github/workflows/scheduled-unit-nightly.yml',
    step: 'Type check (writes its build info)',
    mechanism: 'continue-on-error',
    reason:
      'the nightly runs it to write the incremental build info for the next PRs; the PR type-check lane is the gate',
  },
  {
    workflow: '.github/workflows/preview.yml',
    step: 'Preview smoke (best-effort)',
    mechanism: 'continue-on-error',
    reason:
      'a preview deploy is a review aid, not a release; the governed deploys run the same smoke as a blocking step',
  },
  {
    workflow: '.github/workflows/preview.yml',
    step: 'Probe live CSP and HSTS (best-effort)',
    mechanism: 'continue-on-error',
    reason:
      'best-effort on a preview, like the smoke; every governed deploy runs the same probe as a blocking step',
  },
];
