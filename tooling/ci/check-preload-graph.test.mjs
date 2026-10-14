import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TRIPWIRE = join(ROOT, 'tooling/ci/check-preload-graph.mjs');

const HTML = [
  '<script type="module" crossorigin src="/assets/index-abc.js"></script>',
  '<link rel="modulepreload" crossorigin href="/assets/vendor-def.js">',
].join('\n');

/**
 * Run the tripwire against a throwaway `dist/`. A gate nobody has watched fail
 * is a green checkmark (agent-os/skills/fe-guard-authoring), and the fixtures
 * that make it fail cannot live in the real build.
 */
function run({ entry = 'export const a = 1;\n', html = HTML, files = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'preload-graph-'));
  try {
    const all = {
      'dist/index.html': html,
      'dist/assets/index-abc.js': entry,
      'dist/assets/vendor-def.js': 'export const v = 1;\n',
      // A lazy chunk may carry anything: it is not first paint.
      'dist/assets/CommandPalette-ghi.js': 'const r={"cmdk-root":""};\n',
      ...files,
    };
    for (const [relativePath, content] of Object.entries(all)) {
      const file = join(root, relativePath);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    const result = spawnSync('node', [TRIPWIRE], {
      encoding: 'utf8',
      env: { ...process.env, PRELOAD_GRAPH_ROOT: root },
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('passes when the deferred libraries stay in lazy chunks', () => {
  const { status, output } = run();
  assert.equal(status, 0, output);
  assert.match(output, /build:check OK/);
});

test('fails on a deferred chunk in the modulepreload list', () => {
  const { status, output } = run({
    html: `${HTML}\n<link rel="modulepreload" crossorigin href="/assets/sentry-jkl.js">`,
    files: { 'dist/assets/sentry-jkl.js': 'export const s = 1;\n' },
  });
  assert.equal(status, 1, output);
  assert.match(output, /deferred chunk\(s\) back on the first-paint path: sentry/);
});

test('fails on a deferred library folded into the entry chunk', () => {
  // No chunk of its own to spot by name: the library's code is in the entry.
  const { status, output } = run({ entry: 'const r={"cmdk-root":""};export{r};\n' });
  assert.equal(status, 1, output);
  assert.match(output, /cmdk \(its code, in assets\/index-abc\.js\)/);
});

test('reads every first-paint chunk, not only the entry', () => {
  const { status, output } = run({
    files: { 'dist/assets/vendor-def.js': 'var g=globalThis.__SENTRY__;\n' },
  });
  assert.equal(status, 1, output);
  assert.match(output, /sentry \(its code, in assets\/vendor-def\.js\)/);
});
