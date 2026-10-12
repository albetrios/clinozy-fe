/**
 * The build's first-paint JS, read from `dist/index.html` — shared by the
 * gates that measure or police it (`run-size-limit.mjs`, `check-entry-routes.mjs`,
 * `check-preload-graph.mjs`), so they all agree on what "first paint" is.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The entry `<script type="module">` and every `<link rel="modulepreload">` in
 * `<root>/dist/index.html`, as `assets/….js` paths relative to `dist/` —
 * deduplicated, entry first. Attribute order is not assumed: Vite's
 * `crossorigin` may sit before or after `src` / `href`.
 *
 * @param {string} root The repository (or fixture) root holding `dist/`.
 * @returns {string[]} The first-paint JS files, e.g. `['assets/index-abc.js', 'assets/vendor-def.js']`.
 */
export function firstPaintAssets(root) {
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  const files = [
    ...html.matchAll(/<script type="module"[^>]*\ssrc="\/(assets\/[^"]+\.js)"/g),
    ...html.matchAll(/rel="modulepreload"[^>]*\shref="\/(assets\/[^"]+\.js)"/g),
  ].map((match) => match[1]);
  return [...new Set(files)];
}
