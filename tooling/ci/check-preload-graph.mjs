#!/usr/bin/env node
/**
 * Preload-graph tripwire. Run AFTER `pnpm build`.
 *
 * The deferred-by-design libraries (observability, analytics, command palette,
 * forms) must never re-enter the first paint — dist/index.html's entry script
 * and its modulepreload list. A single static import anywhere in the entry graph
 * silently drags them back onto the first-paint network path (exactly how
 * Sentry's 460 KB chunk ended up preloaded before this gate existed).
 *
 * Allowed on the entry path: the entry itself, vendor (react/router), zod
 * (env validation at boot), query (QueryProvider). Everything else is a
 * regression.
 *
 * Two looks, because a leak no longer has to arrive as a chunk of its own:
 * - **By name** — a library with its own `codeSplitting` group in
 *   `vite.config.ts` (`sentry`, `posthog`, `rhf`) leaks as that chunk.
 * - **By code** — one with no group (`cmdk`) would be folded into the entry
 *   chunk by the group that collects the first paint's modules (`boot`), so each
 *   library is also recognized by a string its own code carries and app code
 *   never spells.
 *
 * PRELOAD_GRAPH_ROOT — check a different tree (it must contain `dist`). For
 * `check-preload-graph.test.mjs` only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { firstPaintAssets } from './first-paint.mjs';

const root = process.env.PRELOAD_GRAPH_ROOT ?? process.cwd();

const FORBIDDEN_CHUNKS = ['sentry', 'posthog', 'cmdk', 'rhf'];

/** A string only the library's own minified code carries. */
const FORBIDDEN_SIGNATURES = {
  sentry: '__SENTRY__', // @sentry/core's global carrier
  posthog: '__POSTHOG_TOOLBAR__', // posthog-js's toolbar global
  cmdk: 'cmdk-root', // cmdk's root attribute
  rhf: 'shouldUnregister', // react-hook-form's own option, read inside the library
};

const files = firstPaintAssets(root);

/** Each first-paint file's chunk name: `assets/sentry-a1b2.js` → `sentry`. */
const referenced = files.flatMap(
  (file) => /^assets\/([a-zA-Z]\w*)-[\w-]+\.js$/.exec(file)?.[1] ?? [],
);

const offenders = new Set(FORBIDDEN_CHUNKS.filter((name) => referenced.includes(name)));
for (const file of files) {
  const code = readFileSync(join(root, 'dist', file), 'utf8');
  for (const [name, signature] of Object.entries(FORBIDDEN_SIGNATURES)) {
    if (code.includes(signature)) offenders.add(`${name} (its code, in ${file})`);
  }
}

console.log(`build:check — entry references: ${[...new Set(referenced)].join(', ')}`);

if (offenders.size > 0) {
  console.error(
    `\nbuild:check FAILED — deferred chunk(s) back on the first-paint path: ${[...offenders].join(', ')}.`,
  );
  console.error(
    'A static import is leaking them into the entry graph. Find it with:\n' +
      "  grep -rn \"from '@sentry/react'\\|from 'posthog-js'\\|from 'cmdk'\\|from 'react-hook-form'\" src --include='*.ts*'\n" +
      'and convert it to a dynamic import (see errorHandler.ts / SettingsModalLazy.tsx).',
  );
  process.exit(1);
}
console.log('build:check OK — deferred chunks stay off the entry preload path.');
