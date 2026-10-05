#!/usr/bin/env node
/**
 * Entry-route tripwire. Run AFTER `pnpm build` (part of `pnpm build:check`).
 *
 * `routeTree.tsx` IS the entry chunk, so whatever it — or anything else on the
 * first-paint path — imports statically ships on every load. L-54 took two kinds
 * of route weight off it, and this gate keeps them off:
 *
 * - **Dialog manifests.** The URL-driven dialog routes render nothing of their
 *   own; their manifests load with ONE lazy registry (`src/app/routes/
 *   dialog-routes.ts`) that `dialogRoute(name)` awaits before the gate. A dialog
 *   manifest imported statically again — by the route tree or by any module the
 *   entry reaches — puts its `path` back on the first paint.
 * - **Room builders.** Each clinic room's route builders live in their own module
 *   (`src/lib/routes/<room>-builders.ts`), imported by path; only the
 *   organization-level `builders.ts` rides the entry through the
 *   `@/lib/routes/index.ts` barrel. A room module re-exported from that barrel, or
 *   imported by an entry module, brings every path it spells.
 *
 * How it notices: by the paths themselves, which survive minification as string
 * literals. Forbidden on the first paint is every route path a dialog manifest
 * or a room builder module spells — except the paths of the pages the route
 * tree registers with a static manifest, which the entry carries on purpose (the
 * nav reads them, and each page's gate runs on its own). First paint is the
 * entry script plus every `modulepreload` in `dist/index.html`, as `pnpm size`
 * measures it.
 *
 * ENTRY_ROUTES_ROOT — check a different tree (it must contain `dist` and `src`).
 * For `check-entry-routes.test.mjs` only.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.ENTRY_ROUTES_ROOT ?? process.cwd();
const fail = (message) => {
  console.error(`\nbuild:check FAILED — ${message}`);
  process.exit(1);
};

const indexHtml = join(root, 'dist/index.html');
if (!existsSync(indexHtml)) fail('no dist/index.html. Run `pnpm build` first.');
const html = readFileSync(indexHtml, 'utf8');
const firstPaint = [
  ...html.matchAll(/<script type="module"[^>]*\ssrc="\/(assets\/[^"]+\.js)"/g),
  ...html.matchAll(/rel="modulepreload"[^>]*\shref="\/(assets\/[^"]+\.js)"/g),
].map((match) => match[1]);
if (firstPaint.length === 0) fail('no entry script in dist/index.html.');
const shipped = [...new Set(firstPaint)].map((file) => ({
  file,
  code: readFileSync(join(root, 'dist', file), 'utf8'),
}));

/** `'…'` / `"…"` / `` `…` `` literals that are an app route path. */
const ROUTE_LITERAL =
  /['"`](\/organization\/\$organizationSlug\/[^'"`$]*(?:\$[A-Za-z]+[^'"`$]*)*)['"`]/g;
const literalsIn = (source) => [...source.matchAll(ROUTE_LITERAL)].map((m) => m[1]);
const read = (file) => readFileSync(join(root, file), 'utf8');
/** `@/pages/…/x.manifest.ts` → `src/pages/…/x.manifest.ts`. */
const manifestImports = (source) =>
  [...source.matchAll(/from '@\/(pages\/[^']+\.manifest\.ts)'/g)].map(
    (m) => `src/${m[1]}`,
  );
/** A manifest's own `path:`. */
const manifestPath = (file) => read(file).match(/\bpath:\s*['"`]([^'"`]+)['"`]/)?.[1];

const registry = 'src/app/routes/dialog-routes.ts';
const dialogManifests = manifestImports(read(registry));
if (dialogManifests.length === 0) fail(`${registry} names no dialog manifest.`);
// The pages' own paths: manifests the route tree imports statically — never a
// dialog's, even when someone imports one there again (that is the regression).
const pagePaths = new Set(
  manifestImports(read('src/app/routes/routeTree.tsx'))
    .filter((file) => !dialogManifests.includes(file))
    .map(manifestPath),
);

const forbidden = new Map(); // path → the sources that spell it
const forbid = (path, source) => {
  if (!path || pagePaths.has(path)) return;
  forbidden.set(path, [...(forbidden.get(path) ?? []), source]);
};
for (const file of dialogManifests) forbid(manifestPath(file), file);
const builderDir = 'src/lib/routes';
const roomBuilders = readdirSync(join(root, builderDir))
  .filter((name) => name.endsWith('-builders.ts'))
  .map((name) => `${builderDir}/${name}`);
for (const file of roomBuilders) {
  for (const path of new Set(literalsIn(read(file)))) forbid(path, file);
}

const offenders = [];
for (const [path, sources] of forbidden) {
  const literal = new RegExp(
    `['"\`]${path.replace(/[$/.*+?^{}()|[\]\\]/g, '\\$&')}['"\`]`,
  );
  for (const { file, code } of shipped) {
    if (literal.test(code)) {
      offenders.push(`  ${path}  (spelled in ${sources.join(', ')}) in ${file}`);
    }
  }
}

console.log(
  `build:check — ${dialogManifests.length} dialog manifests and ${roomBuilders.length} room builder modules checked against ${shipped.length} first-paint chunks.`,
);
if (offenders.length > 0) {
  fail(
    `${offenders.length} dialog-route or room-builder path(s) on the first-paint path:\n${offenders.join('\n')}\n` +
      'A dialog manifest or a room builder module is statically imported from the entry again.\n' +
      'Register a dialog route with `...dialogRoute(name)` (its manifest in src/app/routes/dialog-routes.ts),\n' +
      'and import a room builder by its own path, never through `@/lib/routes/index.ts`.',
  );
}
console.log('build:check OK — no dialog manifest or room builder on the first paint.');
