/**
 * Types for `build.mjs`. The module is plain JS (it runs under bare `node` as `pnpm build`,
 * with no tsx step), so its contract is declared here for the TypeScript consumers —
 * `tests/ci/build-environment.policy.test.ts`.
 */

/** The environments a build can read, one `.env.<environment>` file each. */
export declare const ENVIRONMENTS: readonly string[];

/** Reads `--env <environment>` / `--env=<environment>`; throws on anything else. */
export declare function parseBuildArguments(argv: readonly string[]): {
  environment?: string;
};

/** The environments whose env file exists under `root`, in {@link ENVIRONMENTS} order. */
export declare function availableEnvironments(root: string): string[];

/** An answer to the question — a number, a name, or empty for the first listed. */
export declare function resolveAnswer(
  answer: string,
  available: readonly string[],
): string | undefined;

/** The environment to build with, asking only when interactive; `undefined` = Vite defaults. */
export declare function chooseEnvironment(options: {
  argv: readonly string[];
  env: NodeJS.ProcessEnv;
  root: string;
  interactive: boolean;
  ask: (available: string[]) => Promise<string>;
}): Promise<string | undefined>;
