import { afterEach, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnvironmentWithoutInheritedRepository } from '../ci/git-environment.mjs';
import {
  createThrowawayRepository,
  removeThrowawayRepositories,
} from '../ci/throwaway-repository.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const GATE = join(ROOT, 'tooling/validate/large-staged-files.sh');
const LIMIT_BYTES = 3 * 1024 * 1024;

/**
 * Stage `files` (repo-relative path → size in bytes) in a throwaway repo and run
 * the gate there.
 *
 * A gate that has never been watched failing is a green checkmark, not a gate
 * (agent-os/skills/fe-guard-authoring). The gate reads the index of the repo it
 * runs in, so every case gets its own repo instead of staging into the real one.
 */
function runGateWith(files) {
  const repository = createThrowawayRepository({ prefix: 'large-staged-files-' });
  repository.writeFiles(
    Object.fromEntries(
      Object.entries(files).map(([path, size]) => [path, Buffer.alloc(size, 'a')]),
    ),
  );
  repository.git(['add', '--all']);
  // From a git hook the inherited GIT_DIR / GIT_INDEX_FILE would outrank `cwd`: the gate would
  // then read the hook's own index.
  const result = spawnSync('sh', [GATE], {
    cwd: repository.root,
    encoding: 'utf8',
    env: gitEnvironmentWithoutInheritedRepository(),
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

afterEach(removeThrowawayRepositories);

it('rejects a staged file over the limit', () => {
  const { status, output } = runGateWith({ 'src/big.bin': LIMIT_BYTES + 1 });
  expect(status, output).toBe(1);
  expect(output.includes(`src/big.bin (${LIMIT_BYTES + 1} bytes)`), output).toBeTruthy();
});

it('allows a 2MB file — over the old 1MB limit, under 3MB', () => {
  const { status, output } = runGateWith({ 'src/medium.bin': 2 * 1024 * 1024 });
  expect(status, output).toBe(0);
});

it('allows a staged file exactly at the limit', () => {
  const { status, output } = runGateWith({ 'src/edge.bin': LIMIT_BYTES });
  expect(status, output).toBe(0);
});

it('exempts design exports under iterations/', () => {
  const { status, output } = runGateWith({
    'iterations/launch-2026-09-30-jxmr/intake-files/Prototype.html': LIMIT_BYTES * 3,
  });
  expect(status, output).toBe(0);
});

it('the iterations/ exemption does not hide a large file elsewhere in the same commit', () => {
  const { status, output } = runGateWith({
    'iterations/launch-2026-09-30-jxmr/intake-files/Prototype.html': LIMIT_BYTES * 3,
    'docs/big.bin': LIMIT_BYTES + 1,
  });
  expect(status, output).toBe(1);
  expect(output).toMatch(/docs\/big\.bin/);
  expect(output).not.toMatch(/Prototype\.html/);
});

// Only the top-level iterations/ folder is exempt — not a path that merely
// contains the word.
for (const path of [
  'docs/iterations/big.bin',
  'iterations-archive/big.bin',
  'iterations.bin',
]) {
  it(`does not exempt ${path}`, () => {
    const { status, output } = runGateWith({ [path]: LIMIT_BYTES + 1 });
    expect(status, output).toBe(1);
    expect(output).toMatch(/Files exceed 3MB limit/);
  });
}
