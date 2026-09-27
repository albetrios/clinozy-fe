#!/usr/bin/env node
/**
 * Preload-graph tripwire. Run AFTER `pnpm build`.
 *
 * The deferred-by-design chunks (observability, analytics, command palette,
 * forms, charts) must never re-enter dist/index.html's modulepreload list — a
 * single static import anywhere in the entry graph silently drags them back
 * onto the first-paint network path (exactly how Sentry's 460 KB chunk ended
 * up preloaded before this gate existed).
 *
 * Allowed on the entry path: the entry itself, vendor (react/router), zod
 * (env validation at boot), query (QueryProvider). Everything else is a
 * regression.
 */
import { readFileSync } from 'node:fs';

const FORBIDDEN_CHUNKS = ['sentry', 'posthog', 'cmdk', 'rhf', 'charts'];

const html = readFileSync('dist/index.html', 'utf8');
const referenced = [...html.matchAll(/assets\/([a-zA-Z][\w]*)-[\w-]+\.js/g)].map(
  (match) => match[1],
);

const offenders = FORBIDDEN_CHUNKS.filter((name) => referenced.includes(name));

console.log(`build:check — entry references: ${[...new Set(referenced)].join(', ')}`);

if (offenders.length > 0) {
  console.error(
    `\nbuild:check FAILED — deferred chunk(s) back on the first-paint path: ${offenders.join(', ')}.`,
  );
  console.error(
    'A static import is leaking them into the entry graph. Find it with:\n' +
      "  grep -rn \"from '@sentry/react'\\|from 'posthog-js'\\|from 'cmdk'\" src --include='*.ts*'\n" +
      'and convert it to a dynamic import (see errorHandler.ts / SettingsModalLazy.tsx).',
  );
  process.exit(1);
}
console.log('build:check OK — deferred chunks stay off the entry preload path.');
