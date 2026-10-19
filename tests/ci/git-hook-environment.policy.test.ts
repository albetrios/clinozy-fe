import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  gitEnvironmentWithoutInheritedRepository,
  INHERITED_GIT_REPOSITORY_VARIABLES,
} from '../../tooling/ci/git-environment.mjs';

// Git exports GIT_DIR and friends into every hook it runs, and they outrank `cwd`. A test or
// fixture that builds a throwaway repository runs inside the pre-push hook too, and there its
// `git init` / `git config` / `git update-ref` rewrite the developer's own repository (clinozy-be,
// 19 Oct 2026: a linked worktree's pre-push set core.bare, an identity and origin/main on the
// shared repository). Every file under tooling/ and tests/ that runs `git init` strips them.

const ROOT = process.cwd();
const SCANNED_DIRECTORIES = ['tooling', 'tests'];
const HELPER_FILE = 'tooling/ci/git-environment.mjs';
const HELPER_NAME = 'gitEnvironmentWithoutInheritedRepository';
/** A `git init` handed to a child process: `git('init'`, `git(root, ['init'`, `'git', ['init'`. */
const BUILDS_REPOSITORY = /(?:\bgit\(|['"]git['"],)[^\n]*['"]init['"]/;
/** Files known to build a repository — pins the scan against a pattern that quietly stops matching. */
const KNOWN_REPOSITORY_BUILDERS = [
  'tests/ci/agent-hook-skip.policy.test.ts',
  'tests/ci/agent-push-review-gate.policy.test.ts',
  'tooling/iterations/iteration-fixtures.mjs',
  'tooling/validate/large-staged-files.test.mjs',
];

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (/\.(?:[cm]?[jt]s|tsx)$/.test(entry.name)) found.push(path);
  }
  return found;
}

function repositoryBuilders(): { builders: string[]; unguarded: string[] } {
  const builders: string[] = [];
  const unguarded: string[] = [];
  for (const path of SCANNED_DIRECTORIES.flatMap((directory) =>
    sourceFiles(join(ROOT, directory)),
  )) {
    const file = relative(ROOT, path);
    if (file === HELPER_FILE) continue;
    const content = readFileSync(path, 'utf8');
    const builds = content
      .split('\n')
      .some((line) => BUILDS_REPOSITORY.test(line.split('//')[0] ?? ''));
    if (!builds) continue;
    builders.push(file);
    if (!content.includes(HELPER_NAME)) unguarded.push(file);
  }
  return { builders, unguarded };
}

describe('git hook environment — inherited repository variables', () => {
  it('pins the variables git exports into a hook', () => {
    expect([...INHERITED_GIT_REPOSITORY_VARIABLES]).toEqual([
      'GIT_DIR',
      'GIT_INDEX_FILE',
      'GIT_WORK_TREE',
      'GIT_PREFIX',
      'GIT_OBJECT_DIRECTORY',
      'GIT_COMMON_DIR',
      'GIT_NAMESPACE',
    ]);
  });

  it('removes every pinned variable and passes the rest through', () => {
    const saved = new Map(
      INHERITED_GIT_REPOSITORY_VARIABLES.map((variable) => [
        variable,
        process.env[variable],
      ]),
    );
    try {
      for (const variable of INHERITED_GIT_REPOSITORY_VARIABLES) {
        process.env[variable] = `/somewhere/else/${variable}`;
      }
      const environment = gitEnvironmentWithoutInheritedRepository();
      for (const variable of INHERITED_GIT_REPOSITORY_VARIABLES) {
        expect(
          environment[variable],
          `${variable} must not reach the child`,
        ).toBeUndefined();
        expect(process.env[variable], `${variable} must not be changed in-process`).toBe(
          `/somewhere/else/${variable}`,
        );
      }
      expect(environment.PATH).toBe(process.env.PATH);
    } finally {
      for (const [variable, value] of saved) {
        if (value === undefined) Reflect.deleteProperty(process.env, variable);
        else process.env[variable] = value;
      }
    }
  });

  it('strips them in every tooling and test file that builds a repository', () => {
    const { builders, unguarded } = repositoryBuilders();
    // Anti-vacuity: an empty scan would satisfy the assertion below for free.
    expect(builders).toEqual(expect.arrayContaining(KNOWN_REPOSITORY_BUILDERS));
    expect(unguarded).toEqual([]);
  });
});
