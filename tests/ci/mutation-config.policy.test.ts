import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, matchesGlob, normalize } from 'node:path';

import { describe, expect, it } from 'vitest';

// The mutation lane (`.github/workflows/mutation-test.yml`) runs only on its weekly
// cron, so a config that cannot finish stays red for weeks before anyone looks — it
// failed every Monday for weeks: first `ENOENT copyfile .mcp.json` (Stryker
// copies every non-ignored file into its sandbox, and a tracked symlink to a
// gitignored file is dangling on a fresh checkout), then the 15-minute dry-run
// timeout (with no `testFiles`, the Vitest runner's `related` mode pulled in nearly
// every suite, because `cn` and the auth/tenancy runtime are imported everywhere,
// and it runs them in ONE thread). Both failure classes are pinned here, on the PR
// gate, along with the runner shim that keeps the score honest on Vitest 5
// (tooling/stryker/vitest-runner-shim.mjs).
const PROJECT_ROOT = process.cwd();
const CONFIG_FILE = 'stryker.config.json';
const WORKFLOW = '.github/workflows/mutation-test.yml';

interface StrykerConfig {
  ignorePatterns: string[];
  plugins: string[];
  testFiles?: string[];
  thresholds: { break: number };
}

const config = JSON.parse(
  readFileSync(join(PROJECT_ROOT, CONFIG_FILE), 'utf8'),
) as StrykerConfig;

function git(args: string[]): string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixed 'git' binary, no user input
  return execFileSync('git', args, { cwd: PROJECT_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

const trackedFiles = git(['ls-files']);
const trackedSymlinks = git(['ls-files', '--stage'])
  .map((line) => /^120000 \S+ \d+\t(.+)$/.exec(line)?.[1])
  .filter((path): path is string => path !== undefined);

/** A tracked symlink whose target is not in the repository dangles on a fresh checkout. */
function danglesOnCheckout(link: string): boolean {
  const target = normalize(join(dirname(link), readlinkSync(join(PROJECT_ROOT, link))));
  return !trackedFiles.some((file) => file === target || file.startsWith(`${target}/`));
}

/** Root-anchored reading of the patterns — stricter than Stryker's gitignore semantics. */
function ignoredByStryker(path: string): boolean {
  return config.ignorePatterns.some(
    (pattern) => path === pattern || path.startsWith(`${pattern}/`),
  );
}

describe('mutation lane config policy', () => {
  it('finds tracked symlinks (scanner sanity)', () => {
    expect(trackedSymlinks.length).toBeGreaterThan(0);
  });

  it('keeps every symlink that dangles on a fresh checkout out of the Stryker sandbox', () => {
    const unignored = trackedSymlinks
      .filter(danglesOnCheckout)
      .filter((link) => !ignoredByStryker(link));
    expect(unignored, `add these to ignorePatterns in ${CONFIG_FILE}`).toEqual([]);
  });

  it('has exactly one Stryker config (the first one found wins; a second is dead config)', () => {
    const configs = trackedFiles.filter((file) =>
      /^\.?stryker\.(conf|config)\.(json|js|mjs|cjs)$/.test(file),
    );
    expect(configs).toEqual([CONFIG_FILE]);
  });

  it('scopes the dry run to the lane’s own tests, every glob matching a tracked test', () => {
    const patterns = config.testFiles ?? [];
    expect(patterns.length).toBeGreaterThan(0);
    const unmatched = patterns.filter(
      (pattern) => !trackedFiles.some((file) => matchesGlob(file, pattern)),
    );
    expect(unmatched).toEqual([]);
  });

  it('loads only local plugins that exist (the Vitest runner shim)', () => {
    const local = config.plugins.filter((plugin) => plugin.startsWith('./'));
    expect(local.length).toBeGreaterThan(0);
    expect(local.filter((plugin) => !existsSync(join(PROJECT_ROOT, plugin)))).toEqual([]);
  });

  it('never lowers the break threshold below 70', () => {
    expect(config.thresholds.break).toBeGreaterThanOrEqual(70);
  });

  it('installs one pinned Stryker version for core and the Vitest runner', () => {
    const workflow = readFileSync(join(PROJECT_ROOT, WORKFLOW), 'utf8');
    const core = /@stryker-mutator\/core@(\d+\.\d+\.\d+)\b/.exec(workflow)?.[1];
    const runner = /@stryker-mutator\/vitest-runner@(\d+\.\d+\.\d+)\b/.exec(
      workflow,
    )?.[1];
    expect(core).toBeDefined();
    expect(runner).toBe(core);
  });
});
