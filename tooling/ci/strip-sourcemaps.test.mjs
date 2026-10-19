import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const STRIPPER = join(ROOT, 'tooling/ci/strip-sourcemaps.mjs');

/**
 * Run the stripper against a throwaway `dist`. `files === null` omits it.
 *
 * `survivors` is snapshotted INSIDE the try: the `finally` deletes the temp tree
 * before the caller ever sees the result, so a lazy `existsSync` closure would
 * report everything missing and quietly pass the "was it deleted?" assertions.
 */
function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'strip-sourcemaps-'));
  try {
    for (const [relativePath, content] of Object.entries(files ?? {})) {
      const file = join(root, relativePath);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    const result = spawnSync('node', [STRIPPER], {
      encoding: 'utf8',
      env: { ...process.env, STRIP_SOURCEMAPS_ROOT: root },
    });
    const survivors = new Set(
      Object.keys(files ?? {}).filter((path) => existsSync(join(root, path))),
    );
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
      survived: (relativePath) => survivors.has(relativePath),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it('removes maps from dist/assets and the dist root, keeping the code', () => {
  const { status, output, survived } = run({
    'dist/assets/index-abc123.js': 'export const a = 1;\n',
    'dist/assets/index-abc123.js.map': '{"version":3}\n',
    'dist/assets/vendor-def456.js.map': '{"version":3}\n',
    'dist/sw.js': 'self.addEventListener("fetch", () => {});\n',
    'dist/sw.js.map': '{"version":3}\n',
  });
  expect(status, output).toBe(0);
  expect(output).toMatch(/removed 3 source maps/);
  expect(survived('dist/assets/index-abc123.js.map')).toBe(false);
  expect(survived('dist/assets/vendor-def456.js.map')).toBe(false);
  expect(survived('dist/sw.js.map')).toBe(false);
  // The shipped code itself is untouched.
  expect(survived('dist/assets/index-abc123.js')).toBe(true);
  expect(survived('dist/sw.js')).toBe(true);
});

it('is a no-op when the build emitted none', () => {
  const { status, output } = run({
    'dist/assets/index-abc123.js': 'export const a = 1;\n',
  });
  expect(status, output).toBe(0);
  expect(output).toMatch(/nothing to remove/);
});

it('fails when the build has not run', () => {
  const { status, output } = run(null);
  expect(status, output).toBe(1);
  expect(output).toMatch(/run the build first/);
});
