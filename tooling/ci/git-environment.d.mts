/**
 * Types for `git-environment.mjs`. The module is plain JS (the tooling runs under bare `node`), so
 * its contract is declared here for the TypeScript consumers — the `tests/ci` hook tests,
 * `tests/ci/git-hook-environment.policy.test.ts` and the `.ts` tooling.
 */

/** The variables git exports into hooks that pin a child `git` process to a repository. */
export declare const INHERITED_GIT_REPOSITORY_VARIABLES: readonly string[];

/** `process.env` without the inherited repository variables, so a child `git` honours `cwd`. */
export declare function gitEnvironmentWithoutInheritedRepository(): NodeJS.ProcessEnv;

/** Where a git command runs; the current directory when omitted. */
export interface GitOptions {
  cwd?: string;
}

/** `git <args>` → trimmed stdout; throws an Error naming the command on a non-zero exit. */
export declare function git(args: readonly string[], options?: GitOptions): string;

/** `git <args>` → whether it exited 0 and its trimmed stdout; never throws. */
export declare function tryGit(
  args: readonly string[],
  options?: GitOptions,
): { ok: boolean; output: string };

/** `base` when given, else the upstream (`@{u}`), else `origin/<trunk>` from the setup config. */
export declare function resolveBase(options?: { base?: string; cwd?: string }): string;
