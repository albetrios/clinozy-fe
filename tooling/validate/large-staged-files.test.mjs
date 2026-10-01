import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const GATE = join(ROOT, 'tooling/validate/large-staged-files.sh');
const LIMIT_BYTES = 1024 * 1024;

/**
 * Stage `files` (repo-relative path → size in bytes) in a throwaway repo and run
 * the gate there.
 *
 * A gate that has never been watched failing is a green checkmark, not a gate
 * (agent-os/skills/fe-guard-authoring). The gate reads the index of the repo it
 * runs in, so every case gets its own repo instead of staging into the real one.
 */
function runGateWith(files) {
  const repo = mkdtempSync(join(tmpdir(), 'large-staged-files-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: repo });
    for (const [path, size] of Object.entries(files)) {
      const file = join(repo, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.alloc(size, 'a'));
    }
    execFileSync('git', ['add', '--all'], { cwd: repo });
    const result = spawnSync('sh', [GATE], { cwd: repo, encoding: 'utf8' });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test('rejects a staged file over the limit', () => {
  const { status, output } = runGateWith({ 'src/big.bin': LIMIT_BYTES + 1 });
  assert.equal(status, 1, output);
  assert.match(output, /src\/big\.bin \(1048577 bytes\)/);
});

test('allows a staged file exactly at the limit', () => {
  const { status, output } = runGateWith({ 'src/edge.bin': LIMIT_BYTES });
  assert.equal(status, 0, output);
});

test('exempts design exports under iterations/', () => {
  const { status, output } = runGateWith({
    'iterations/launch-2026-09-30-jxmr/intake-files/Prototype.html': LIMIT_BYTES * 3,
  });
  assert.equal(status, 0, output);
});

test('the iterations/ exemption does not hide a large file elsewhere in the same commit', () => {
  const { status, output } = runGateWith({
    'iterations/launch-2026-09-30-jxmr/intake-files/Prototype.html': LIMIT_BYTES * 3,
    'docs/big.bin': LIMIT_BYTES + 1,
  });
  assert.equal(status, 1, output);
  assert.match(output, /docs\/big\.bin/);
  assert.doesNotMatch(output, /Prototype\.html/);
});

// Only the top-level iterations/ folder is exempt — not a path that merely
// contains the word.
for (const path of [
  'docs/iterations/big.bin',
  'iterations-archive/big.bin',
  'iterations.bin',
]) {
  test(`does not exempt ${path}`, () => {
    const { status, output } = runGateWith({ [path]: LIMIT_BYTES + 1 });
    assert.equal(status, 1, output);
    assert.match(output, /Files exceed 1MB limit/);
  });
}
