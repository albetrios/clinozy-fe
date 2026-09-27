import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('validate:testids passes on the current tree', () => {
  const result = spawnSync('node', ['tooling/validate/test-ids.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    `expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.match(result.stdout, /Test ID contracts OK/);
});
