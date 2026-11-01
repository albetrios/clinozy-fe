import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// H-12: every tool CI or a cloud session installs is a pinned version, and a downloaded binary is
// checked against a pinned SHA-256 (tooling/setup/agent/tool-versions.sh). A moving tag
// (`:latest`, `@latest`, a `0.15.x` range) or a package with no version installs whatever its
// registry serves that day, inside a job that may hold deploy secrets. clinozy-be pins its own in
// src/tests/unit/ci/pinned-installs.policy.unit.test.ts.

/** Every file under `directory`, recursively. */
function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** Lines of `text` that are not comments, each with its line number. */
function codeLines(text: string): Array<{ line: string; number: number }> {
  return text
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => !line.trimStart().startsWith('#'));
}

const ciFiles = [
  ...listFiles('.github/workflows'),
  ...listFiles('.github/actions'),
].filter((path) => /\.ya?ml$/.test(path));
const setupScripts = listFiles('tooling/setup/agent').filter((path) =>
  path.endsWith('.sh'),
);
const pins = readFileSync('tooling/setup/agent/tool-versions.sh', 'utf8');

/** The pinned value of `key` in tool-versions.sh. */
function pin(key: string): string {
  return (
    pins
      .split('\n')
      .find((line) => line.startsWith(`${key}=`))
      ?.slice(key.length + 1) ?? ''
  );
}

/** A package runner (`npx`, `pnpm dlx`, …) and where it starts in a line. */
const RUNNER = /\b(?:npx|pnpx|bunx|pnpm dlx|yarn dlx)\b/;
/** True when `prefix`, the text before a runner, ends where a command starts: nothing, `run:`, `;`, `&&`, `|`, `$(`. */
function atCommandStart(prefix: string): boolean {
  const trimmed = prefix.trim();
  return ['', '-', 'run:', '- run:'].includes(trimmed) || /[;&|(]$/.test(trimmed);
}

/** The package a runner at `index` in `line` starts, its flags skipped. */
function runnerPackage(line: string, index: number): string {
  const words = line.slice(index).split(/\s+/);
  const afterRunner = words[0] === 'pnpm' || words[0] === 'yarn' ? 2 : 1;
  return words.slice(afterRunner).find((word) => !word.startsWith('-')) ?? '';
}

/** Why one code line installs or runs an unpinned version, or `''` when it does not. */
function unpinnedInstall(line: string): string {
  if (/:latest\b/.test(line)) return 'an image by its :latest tag';
  if (/@latest\b/.test(line)) return 'a package at @latest';
  const runner = RUNNER.exec(line);
  if (runner && atCommandStart(line.slice(0, runner.index))) {
    const spec = runnerPackage(line, runner.index);
    const version = spec.slice(spec.lastIndexOf('@') + 1);
    if (spec.lastIndexOf('@') <= 0 || !/^\d+\.\d+\.\d+$/.test(version)) {
      return `${spec} runs without an exact version`;
    }
  }
  // A `$variable` spec is checked where the variable is set (install-semgrep.sh: semgrep==<pin>).
  const pip = /\bpip3? install (?:--\S+ )*["']?([^\s"']+)/.exec(line)?.[1] ?? '';
  if (pip && !pip.startsWith('$') && !/==\d+\.\d+\.\d+$/.test(pip)) {
    return `pip installs ${pip} without ==version`;
  }
  if (/\bcurl\b[^|]*\|\s*(?:ba)?sh\b/.test(line)) return 'pipes a download into a shell';
  return '';
}

/**
 * Files exempt from the line check, with the reason. ensure-docker-daemon.sh is a byte-identical
 * copy of clinozy-be's (tests/ci/mirrored-files.policy.test.ts): its probe image
 * (`hello-world:latest`, run only to see that the daemon can start a container) is pinned in both
 * repositories in one change.
 */
const LINE_CHECK_EXEMPT = new Map([
  [
    'tooling/setup/agent/ensure-docker-daemon.sh',
    'mirrored from clinozy-be; pinned together',
  ],
]);

describe('pinned installs (H-12)', () => {
  it('finds the CI files and setup scripts (parser sanity)', () => {
    expect(ciFiles.length).toBeGreaterThan(10);
    expect(setupScripts.length).toBeGreaterThan(5);
  });

  it.each([
    ['image: x/y:latest', true],
    ['BACKEND_IMAGE: ghcr.io/a/b:latest', true],
    ['run: pnpm dlx @lhci/cli@0.15.x autorun', true],
    ['run: pnpm dlx @lhci/cli autorun', true],
    ['npx --yes netlify-cli deploy', true],
    ['npx --yes markdownlint-cli2@0.22.1 "**/*.md"', false],
    ['run: pnpm dlx @lhci/cli@0.15.1 autorun', false],
    ['run: pip install zizmor', true],
    ['run: pip install "zizmor==1.30.1"', false],
    ['curl -fsSL https://example.test/install.sh | sh', true],
    ['runs-on: ubuntu-latest', false],
    ['  for tool in node npm npx corepack pnpm pnpx; do', false],
    ['  value=$(npx --yes some-tool --flag)', true],
    ['  a && pnpm dlx shadcn@4.22.1 add x', false],
  ])('reads %s as unpinned: %s', (line, unpinned) => {
    expect(unpinnedInstall(line) !== '').toBe(unpinned);
  });

  it.each([...ciFiles, ...setupScripts].filter((file) => !LINE_CHECK_EXEMPT.has(file)))(
    '%s installs and runs pinned versions only',
    (file) => {
      const offences = codeLines(readFileSync(file, 'utf8'))
        .map(({ line, number }) => ({ number, why: unpinnedInstall(line) }))
        .filter(({ why }) => why !== '')
        .map(({ number, why }) => `${file}:${number} ${why}`);
      expect(offences).toEqual([]);
    },
  );

  it('checks every downloaded binary against a pinned SHA-256', () => {
    for (const [script, key] of [
      ['tooling/setup/agent/install-node.sh', 'NODE_SHA256_LINUX_'],
      ['tooling/setup/agent/install-gh.sh', 'GH_SHA256_LINUX_'],
      ['tooling/setup/agent/install-gitleaks.sh', 'GITLEAKS_SHA256_LINUX_'],
      ['tooling/setup/agent/install-headroom.sh', 'UV_SHA256_LINUX_'],
    ] as const) {
      const source = readFileSync(script, 'utf8');
      expect(source, script).toContain('download_verified');
      expect(source, script).toContain(key);
      expect(source, script).not.toMatch(
        /github_latest_tag|astral\.sh\/uv\/install\.sh"/,
      );
    }
    for (const key of [
      'NODE_SHA256_LINUX_X64',
      'NODE_SHA256_LINUX_ARM64',
      'GH_SHA256_LINUX_AMD64',
      'GH_SHA256_LINUX_ARM64',
      'UV_SHA256_LINUX_X64',
      'UV_SHA256_LINUX_ARM64',
    ]) {
      expect(pin(key), key).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('pins Node at .nvmrc, and the other tools at an exact version', () => {
    expect(pin('NODE_VERSION')).toBe(readFileSync('.nvmrc', 'utf8').trim());
    for (const key of ['GH_VERSION', 'UV_VERSION', 'HEADROOM_VERSION']) {
      expect(pin(key), key).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
