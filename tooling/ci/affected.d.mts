/**
 * Types for `affected.mjs`. The module is plain JS (the tooling runs under bare `node`), so its
 * contract is declared here for the TypeScript consumers — `tests/ci/shared-contract.policy.test.ts`.
 */

/** The pushed files that make pre-push run the selected tests (`pnpm test:pre-push`). */
export declare const UNIT_RELEVANT: RegExp;

/** The pushed files the SonarQube gate analyzes (`pnpm sonar:scan`): src/ runtime, without these. */
export declare const SONAR_RUNTIME: RegExp;

/** The src/ files the SonarQube gate leaves out: tests, fixtures, mocks and declarations. */
export declare const SONAR_EXCLUDED: RegExp;

/** One step of `.husky/pre-push`: its command, whether it runs for the pushed files, and why. */
export interface PushStep {
  command: string;
  runs: boolean;
  why: string;
}

/** The steps of `.husky/pre-push` for the pushed files, in its order. */
export declare function pushSteps(changedFiles: readonly string[]): PushStep[];

/** What a change selects (`test-selection.mjs`): the mode, why, and the test files by project. */
export interface TestSelection {
  mode: 'all' | 'selected' | 'none';
  reasons: string[];
  projects: Record<string, string[]>;
  why: Record<string, string[]>;
}

/** The selection as Markdown: tests picked for a reason of their own, then the always-run counts. */
export declare function selectionTable(selection: TestSelection): string[];

/**
 * Whether pre-push runs the conditional step `command` for the pushed files: `yes` or `no`, or
 * `undefined` when `command` is not one of its steps.
 */
export declare function stepRunsAnswer(options: {
  changedFiles: readonly string[];
  command: string;
}): 'yes' | 'no' | undefined;
