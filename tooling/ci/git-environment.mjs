/**
 * The one way FE tooling runs `git`: {@link git}, {@link tryGit} and {@link resolveBase}, each
 * detached from the repository its parent was pinned to (clinozy-be's
 * `tooling/setup/common/git-environment.ts`).
 *
 * Git exports these variables into every hook it runs, and the hook's whole process tree inherits
 * them. They outrank `cwd`, so `spawnSync('git', […], { cwd })` run from inside a hook acts on the
 * hook's repository instead: a throwaway repository's `git init`, `git config` or `git update-ref`
 * rewrites the developer's own repository (19 Oct 2026: a linked worktree's pre-push set
 * `core.bare`, an identity and `origin/main` on clinozy-be's shared repository).
 * `tests/ci/git-hook-environment.policy.test.ts` holds every file that builds a repository to this
 * helper, and every `git` child process under `tooling/` to {@link git} / {@link tryGit}.
 *
 * The one exception: pre-commit code that reads the hook's own index (`git diff --cached` in
 * `early-checks.mjs`) keeps the inherited `GIT_INDEX_FILE` on purpose — a partial commit stages
 * into a temporary index that only that variable names.
 *
 * The shell hooks and scripts read the same answers from its command line:
 *   node tooling/ci/git-environment.mjs base    # resolveBase() — `.husky/pre-push`, docs:lint:changed
 *   node tooling/ci/git-environment.mjs trunk   # the trunk from the setup config
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuredBaseBranch } from '../setup/github/setup-config.mjs';

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

/** The most output one git command may print (a whole-repository `ls-files` or `diff`). */
const GIT_OUTPUT_LIMIT = 256 * 1024 * 1024;

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

/**
 * @param {readonly string[]} args
 * @param {string | undefined} cwd
 */
function runGit(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: gitEnvironmentWithoutInheritedRepository(),
    maxBuffer: GIT_OUTPUT_LIMIT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Runs `git <args>` in `cwd` (default: the current directory) and returns its trimmed stdout.
 *
 * @param {readonly string[]} args
 * @param {{ cwd?: string }} [options]
 * @returns {string}
 * @throws {Error} naming the command and git's stderr when git exits non-zero or cannot start
 */
export function git(args, { cwd } = {}) {
  const result = runGit(args, cwd);
  if (result.status !== 0) {
    const detail =
      (result.stderr ?? '').trim() ||
      result.error?.message ||
      `exited ${result.status ?? 'without a code'}`;
    throw new Error(`git ${args.join(' ')}: ${detail}`);
  }
  return (result.stdout ?? '').trim();
}

/**
 * Runs `git <args>` in `cwd` and reports how it went instead of throwing — for a command whose
 * failure is an answer (`merge-base` with an unfetched ref, `@{u}` on a branch without one) or
 * whose non-zero exit carries output (`diff --no-index` exits 1 when the files differ).
 *
 * @param {readonly string[]} args
 * @param {{ cwd?: string }} [options]
 * @returns {{ ok: boolean, output: string }} `ok` when git exited 0; `output` is the trimmed stdout
 */
export function tryGit(args, { cwd } = {}) {
  const result = runGit(args, cwd);
  return { ok: result.status === 0, output: (result.stdout ?? '').trim() };
}

/**
 * The ref a change is measured from: `base` when given, else the branch's upstream (`@{u}`) when
 * it has one, else `origin/<trunk>` — the trunk read from `git.defaultBranch` in
 * `tooling/setup/setup.config.json`, never hardcoded.
 *
 * @param {{ base?: string, cwd?: string }} [options]
 * @returns {string}
 * @throws {Error} when no `base` is given, there is no upstream and the config names no trunk
 */
export function resolveBase({ base, cwd } = {}) {
  if (base) return base;
  const upstream = tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    cwd,
  });
  if (upstream.ok && upstream.output !== '') return upstream.output;
  return `origin/${configuredBaseBranch()}`;
}

/** The command-line answers for the shell hooks, by name. */
const COMMAND_LINE_ANSWERS = new Map([
  ['base', () => resolveBase()],
  ['trunk', configuredBaseBranch],
]);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const answer = COMMAND_LINE_ANSWERS.get(process.argv[2] ?? '');
  if (answer === undefined) {
    console.error('Usage: node tooling/ci/git-environment.mjs <base|trunk>');
    process.exitCode = 2;
  } else process.stdout.write(answer());
}
