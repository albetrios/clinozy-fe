/**
 * Types for `git-environment.mjs`. The module is plain JS (the tooling runs under bare `node`), so
 * its contract is declared here for the TypeScript consumers — the `tests/ci` hook tests and
 * `tests/ci/git-hook-environment.policy.test.ts`.
 */

/** The variables git exports into hooks that pin a child `git` process to a repository. */
export declare const INHERITED_GIT_REPOSITORY_VARIABLES: readonly string[];

/** `process.env` without the inherited repository variables, so a child `git` honours `cwd`. */
export declare function gitEnvironmentWithoutInheritedRepository(): NodeJS.ProcessEnv;
