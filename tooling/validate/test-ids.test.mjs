import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

it('validate:testids passes on the current tree', () => {
  const result = spawnSync('node', ['tooling/validate/test-ids.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  expect(
    result.status,
    `expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  ).toBe(0);
  expect(result.stdout).toMatch(/Test ID contracts OK/);
});
