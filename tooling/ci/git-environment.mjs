/**
 * Detaching a child `git` process from the repository its parent was pinned to (clinozy-be's
 * `tooling/setup/common/git-environment.ts`).
 *
 * Git exports these variables into every hook it runs, and the hook's whole process tree inherits
 * them. They outrank `cwd`, so `spawnSync('git', […], { cwd })` run from inside a hook acts on the
 * hook's repository instead: a throwaway repository's `git init`, `git config` or `git update-ref`
 * rewrites the developer's own repository (19 Oct 2026: a linked worktree's pre-push set
 * `core.bare`, an identity and `origin/main` on clinozy-be's shared repository).
 * `tests/ci/git-hook-environment.policy.test.ts` holds every file that builds a repository to this
 * helper.
 *
 * Not for a call that is meant to act on the hook's own repository (`push-semgrep.mjs`, the staged-
 * file gates): those keep the inherited variables on purpose.
 */

/** The variables git exports into hooks that pin a child `git` process to a repository. */
export const INHERITED_GIT_REPOSITORY_VARIABLES = Object.freeze([
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_WORK_TREE',
  'GIT_PREFIX',
  'GIT_OBJECT_DIRECTORY',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
]);

/**
 * `process.env` without {@link INHERITED_GIT_REPOSITORY_VARIABLES}, so a child `git` finds its
 * repository from `cwd`. The rest passes through (PATH, credential helpers, proxy settings), and
 * `process.env` itself is not changed.
 *
 * @returns {Record<string, string | undefined>}
 */
export function gitEnvironmentWithoutInheritedRepository() {
  const environment = { ...process.env };
  for (const variable of INHERITED_GIT_REPOSITORY_VARIABLES) delete environment[variable];
  return environment;
}
