/**
 * The one throwaway git repository for tests and test fixtures: a fresh folder (under the OS temp
 * directory, or one the caller names) with `git init` on `branch`, a test identity, no commit
 * signing, and an initial commit of `files` (an empty commit when there are none).
 *
 * Every git call goes through {@link git} from `git-environment.mjs`, so the variables git exports
 * into a hook (GIT_DIR, GIT_INDEX_FILE, …) are stripped: a test run from the pre-push hook builds
 * its repository from `cwd` and never rewrites the hook's own repository.
 * `tests/ci/git-hook-environment.policy.test.ts` holds every test to this fixture.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { git } from './git-environment.mjs';

/** The identity every throwaway repository commits as. */
export const THROWAWAY_IDENTITY = Object.freeze({
  name: 'Test Owner',
  email: 'owner@example.test',
});

/** The temp-folder repositories made so far, for {@link removeThrowawayRepositories}. */
const temporaryRepositories = [];

/**
 * Git's author and committer dates fixed at `unixSeconds`, so a commit's id and time do not
 * depend on the clock.
 *
 * @param {number} unixSeconds
 * @returns {Record<string, string>}
 */
export function fixedCommitDates(unixSeconds) {
  const date = `@${unixSeconds} +0000`;
  return { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
}

/**
 * @typedef {object} ThrowawayRepository
 * @property {string} root The repository's folder.
 * @property {(args: readonly string[], options?: { commitTime?: number }) => string} git
 *   `git <args>` in the repository (trimmed stdout; throws on a non-zero exit), with the commit
 *   dates fixed at `commitTime` (Unix seconds) when given.
 * @property {(files: Record<string, string | Uint8Array>) => void} writeFiles Writes each
 *   repository-relative path, creating its folders.
 * @property {(options: { message: string, commitTime?: number }) => void} commitAll Stages
 *   everything and commits it.
 */

/**
 * Creates a throwaway repository with one commit on `branch`.
 *
 * @param {{
 *   prefix?: string,
 *   directory?: string,
 *   branch?: string,
 *   files?: Record<string, string | Uint8Array>,
 *   commitTime?: number,
 * }} [options] `prefix` names the temp folder (`mkdtemp` under the OS temp directory, removed by
 *   {@link removeThrowawayRepositories}); `directory` is an exact folder instead, which the caller
 *   removes; `files` are the initial commit's content; `commitTime` fixes its dates.
 * @returns {ThrowawayRepository}
 */
export function createThrowawayRepository({
  prefix = 'throwaway-repository-',
  directory,
  branch = 'main',
  files = {},
  commitTime,
} = {}) {
  let root = directory;
  if (root === undefined) {
    root = mkdtempSync(join(tmpdir(), prefix));
    temporaryRepositories.push(root);
  } else mkdirSync(root, { recursive: true });

  const run = (args, { commitTime: time } = {}) =>
    git(args, {
      cwd: root,
      environment: time === undefined ? {} : fixedCommitDates(time),
    });
  const writeFiles = (contents) => {
    for (const [path, content] of Object.entries(contents)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
  };
  const commitAll = ({ message, commitTime: time }) => {
    run(['add', '-A']);
    run(['commit', '-q', '-m', message], { commitTime: time });
  };

  git(['init', '-q', '-b', branch], { cwd: root });
  run(['config', 'user.name', THROWAWAY_IDENTITY.name]);
  run(['config', 'user.email', THROWAWAY_IDENTITY.email]);
  run(['config', 'commit.gpgsign', 'false']);
  writeFiles(files);
  run(['add', '-A']);
  run(['commit', '-q', '--allow-empty', '-m', 'initial'], { commitTime });
  return { root, git: run, writeFiles, commitAll };
}

/** Removes every temp-folder repository {@link createThrowawayRepository} made; call from `afterEach`. */
export function removeThrowawayRepositories() {
  for (const root of temporaryRepositories.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
}
