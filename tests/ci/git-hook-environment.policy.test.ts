import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  git,
  gitEnvironmentWithoutInheritedRepository,
  INHERITED_GIT_REPOSITORY_VARIABLES,
  resolveBase,
  tryGit,
} from '../../tooling/ci/git-environment.mjs';
import {
  createThrowawayRepository,
  removeThrowawayRepositories,
} from '../../tooling/ci/throwaway-repository.mjs';

// Git exports GIT_DIR and friends into every hook it runs, and they outrank `cwd`. A test or
// fixture that builds a throwaway repository runs inside the pre-push hook too, and there its
// `git init` / `git config` / `git update-ref` rewrite the developer's own repository (clinozy-be,
// 19 Oct 2026: a linked worktree's pre-push set core.bare, an identity and origin/main on the
// shared repository). Every throwaway repository under tooling/ and tests/ is built by one
// fixture, tooling/ci/throwaway-repository.mjs, whose git calls strip them.

const ROOT = process.cwd();
const SCANNED_DIRECTORIES = ['tooling', 'tests'];
const HELPER_FILE = 'tooling/ci/git-environment.mjs';
/** The one file that may run `git init`: the throwaway-repository fixture. */
const REPOSITORY_FIXTURE = 'tooling/ci/throwaway-repository.mjs';
/** This file: its `init` lines are samples for the scan pattern, not a repository it builds. */
const THIS_FILE = 'tests/ci/git-hook-environment.policy.test.ts';
/** A `git init` handed to a child process: `git('init'`, `git(root, ['init'`, `'git', ['init'`. */
const BUILDS_REPOSITORY = /(?:\bgit\(|['"]git['"],)[^\n]*['"]init['"]/;

/** A `git` child process started by hand: `spawnSync('git'`, `execFileSync(\n 'git'`, `execSync('git …`. */
const STARTS_GIT =
  /\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec)\(\s*['"`]git\b/;
/**
 * The `tooling/` files that may start `git` themselves instead of through `git` / `tryGit` (tests
 * build their throwaway repositories as they need; they are not scanned).
 */
const OWN_GIT_ALLOWED = new Map([
  ['tooling/ci/early-checks.mjs', "reads the staged files from the hook's own index"],
]);

function toolingFilesStartingGit(): string[] {
  return sourceFiles(join(ROOT, 'tooling'))
    .map((path) => relative(ROOT, path))
    .filter((file) => file !== HELPER_FILE && !/\.test\.[cm]?[jt]s$/.test(file))
    .filter((file) => {
      const code = readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .map((line) => (/^\s*(?:\/\/|\*)/.test(line) ? '' : line))
        .join('\n');
      return STARTS_GIT.test(code);
    });
}

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (/\.(?:[cm]?[jt]s|tsx)$/.test(entry.name)) found.push(path);
  }
  return found;
}

/** The files that run `git init` themselves. */
function repositoryBuilders(): string[] {
  return SCANNED_DIRECTORIES.flatMap((directory) => sourceFiles(join(ROOT, directory)))
    .map((path) => relative(ROOT, path))
    .filter((file) => file !== HELPER_FILE && file !== THIS_FILE)
    .filter((file) =>
      readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .some((line) => BUILDS_REPOSITORY.test(line.split('//')[0] ?? '')),
    );
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

  it('builds every throwaway repository through the one fixture, which strips them', () => {
    // The scan finds the fixture itself (anti-vacuity: a pattern that quietly stopped matching
    // would find nothing) and nothing else.
    expect(repositoryBuilders()).toEqual([REPOSITORY_FIXTURE]);
    expect(BUILDS_REPOSITORY.test("git(['init', '-q'], { cwd })")).toBe(true);
    expect(BUILDS_REPOSITORY.test("spawnSync('git', ['init'])")).toBe(true);

    // Run as if from a hook pinned to another repository: the fixture still builds its own.
    const pinned = createThrowawayRepository({ prefix: 'git-environment-pinned-' });
    const saved = new Map(
      ['GIT_DIR', 'GIT_WORK_TREE'].map((variable) => [variable, process.env[variable]]),
    );
    try {
      process.env.GIT_DIR = join(pinned.root, '.git');
      process.env.GIT_WORK_TREE = pinned.root;
      const fresh = createThrowawayRepository({ prefix: 'git-environment-fresh-' });
      expect(fresh.git(['rev-parse', '--show-toplevel'])).toBe(fresh.root);
      expect(fresh.git(['rev-list', '--count', 'HEAD'])).toBe('1');
    } finally {
      for (const [variable, value] of saved) {
        if (value === undefined) Reflect.deleteProperty(process.env, variable);
        else process.env[variable] = value;
      }
    }
    expect(pinned.git(['rev-list', '--count', 'HEAD'])).toBe('1');
  });
});

describe('git hook environment — one way to run git in tooling', () => {
  it('starts git only through git / tryGit, outside the allowlisted exceptions', () => {
    const starting = toolingFilesStartingGit();
    // Anti-vacuity: every allowlisted file still starts git itself, so the scan sees them.
    expect(starting).toEqual(expect.arrayContaining([...OWN_GIT_ALLOWED.keys()]));
    expect(starting.filter((file) => !OWN_GIT_ALLOWED.has(file))).toEqual([]);
  });

  it('flags a hand-started git call, on one line or split across two', () => {
    expect(STARTS_GIT.test("spawnSync('git', ['status'])")).toBe(true);
    expect(STARTS_GIT.test("execFileSync(\n  'git',\n  ['diff'],\n)")).toBe(true);
    expect(STARTS_GIT.test('execSync(`git remote get-url origin`)')).toBe(true);
    expect(STARTS_GIT.test("spawnSync('gitleaks', ['detect'])")).toBe(false);
    expect(STARTS_GIT.test("tryGit(['status'])")).toBe(false);
  });
});

afterEach(removeThrowawayRepositories);

describe('git hook environment — git, tryGit and resolveBase', () => {
  /** A throwaway repository on branch `work` with one commit and a second branch `other`. */
  function repository(): string {
    const { root } = createThrowawayRepository({
      prefix: 'git-environment-',
      branch: 'work',
    });
    git(['branch', 'other'], { cwd: root });
    return root;
  }

  it('git returns the trimmed output in cwd and throws naming the command', () => {
    const cwd = repository();
    expect(git(['branch', '--show-current'], { cwd })).toBe('work');
    expect(() => git(['rev-parse', '--verify', 'missing-ref'], { cwd })).toThrow(
      /^git rev-parse --verify missing-ref: /,
    );
  });

  it('tryGit reports success and failure without throwing', () => {
    const cwd = repository();
    expect(tryGit(['branch', '--show-current'], { cwd })).toEqual({
      ok: true,
      output: 'work',
    });
    expect(tryGit(['rev-parse', '--verify', '--quiet', 'missing-ref'], { cwd })).toEqual({
      ok: false,
      output: '',
    });
  });

  it('resolveBase: the given base, else the upstream, else origin/<trunk> from the config', () => {
    const cwd = repository();
    const trunk = (
      JSON.parse(readFileSync(join(ROOT, 'tooling/setup/setup.config.json'), 'utf8')) as {
        git: { defaultBranch: string };
      }
    ).git.defaultBranch;
    expect(resolveBase({ cwd })).toBe(`origin/${trunk}`);
    git(['config', 'branch.work.remote', '.'], { cwd });
    git(['config', 'branch.work.merge', 'refs/heads/other'], { cwd });
    expect(resolveBase({ cwd })).toBe('other');
    expect(resolveBase({ base: 'given-ref', cwd })).toBe('given-ref');
  });
});
