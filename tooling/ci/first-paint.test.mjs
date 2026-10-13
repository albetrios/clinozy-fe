import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { firstPaintAssets } from './first-paint.mjs';

/** A throwaway root whose `dist/index.html` is `html`. */
function withIndexHtml(html, check) {
  const root = mkdtempSync(join(tmpdir(), 'first-paint-'));
  try {
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist/index.html'), html);
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('reads the entry script and every modulepreload, entry first', () => {
  withIndexHtml(
    [
      '<link rel="modulepreload" crossorigin href="/assets/vendor-def.js">',
      '<script type="module" crossorigin src="/assets/index-abc.js"></script>',
      '<link rel="modulepreload" crossorigin href="/assets/query-ghi.js">',
      '<link rel="stylesheet" crossorigin href="/assets/index-abc.css">',
    ].join('\n'),
    (root) =>
      assert.deepEqual(firstPaintAssets(root), [
        'assets/index-abc.js',
        'assets/vendor-def.js',
        'assets/query-ghi.js',
      ]),
  );
});

test('does not care where crossorigin sits, and lists a file once', () => {
  withIndexHtml(
    [
      '<script type="module" src="/assets/index-abc.js" crossorigin></script>',
      '<link rel="modulepreload" href="/assets/vendor-def.js" crossorigin>',
      '<link rel="modulepreload" crossorigin href="/assets/vendor-def.js">',
    ].join('\n'),
    (root) =>
      assert.deepEqual(firstPaintAssets(root), [
        'assets/index-abc.js',
        'assets/vendor-def.js',
      ]),
  );
});

test('reads nothing from an index without an entry or preloads', () => {
  withIndexHtml('<link rel="prefetch" href="/assets/lazy-xyz.js">', (root) =>
    assert.deepEqual(firstPaintAssets(root), []),
  );
});
