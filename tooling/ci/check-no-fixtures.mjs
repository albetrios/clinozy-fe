#!/usr/bin/env node
/**
 * Fixture tripwire. Run AFTER `pnpm build` (part of `pnpm build:check`).
 *
 * `src/shared/api/app/fixtures/` is the prototype's clinic world — patient names, mobiles,
 * birth dates, addresses and treatments, staff e-mails — kept as TEST SUPPORT. `dist/` is
 * published verbatim (`netlify deploy --dir=dist`) and the service worker precaches every
 * chunk, so a single shipped `import('./fixtures/…')` (even one no screen reaches) put the
 * whole dataset at public URLs that download without signing in (F-2: `world.fixtures-*.js`,
 * 46 kB, plus three more chunks).
 *
 * Fails when, anywhere under `dist/`:
 *  - a file is named like a fixture module (`world.fixtures-<hash>.js`), or
 *  - a shipped text file references one (the precache manifest in `sw.js` lists every chunk),
 *    or carries one of {@link FIXTURE_MARKERS} — a seed string that survives minification, so a
 *    fixture inlined into an innocently named chunk is caught too.
 *
 * NO_FIXTURES_ROOT — check a different tree (it must contain `dist`).
 * For `check-no-fixtures.test.mjs` only.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { isMain } from './script.mjs';

/**
 * Strings only the fixture seeds spell: the seed plumbing's own error, a seeded lead's name,
 * a seeded branch's address and the seeded staff's e-mail domain. Split so this file's own
 * text never matches. `check-no-fixtures.test.mjs` fails when one of them stops appearing in
 * the fixture sources, so the list cannot rot into matching nothing.
 */
export const FIXTURE_MARKERS = [
  `Clinic ${'fixture'} world`,
  `Anaya ${'Desai'}`,
  `Shree Hari ${'Complex'}`,
  `@cresence${'.skin'}`,
];

/** A fixture module's file name, or a reference to one: `<name>.fixtures-<hash>.js`. */
const FIXTURE_FILE = /\.fixtures?[-.]/i;
const FIXTURE_REFERENCE = /[\w-]+\.fixtures?-[\w-]+\.m?js/gi;

/** What a browser can read as text: scripts, styles, pages, manifests. */
const TEXT_FILE = /\.(m?js|css|html|json|webmanifest|txt|md|svg|xml)$/i;

function filesUnder(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

/**
 * Every fixture artifact a build would publish, one finding per line (`<path>: <why>`).
 *
 * @param {string} root the tree that holds `dist`
 * @returns {string[]}
 */
export function findFixtureArtifacts(root) {
  const outDir = join(root, 'dist');
  const findings = [];
  for (const path of filesUnder(outDir)) {
    const shown = relative(root, path);
    if (FIXTURE_FILE.test(basename(path))) findings.push(`${shown}: a fixture chunk`);
    if (!TEXT_FILE.test(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const reference of new Set(text.match(FIXTURE_REFERENCE) ?? [])) {
      findings.push(`${shown}: references ${reference}`);
    }
    for (const marker of FIXTURE_MARKERS) {
      if (text.includes(marker))
        findings.push(`${shown}: carries the fixture seed "${marker}"`);
    }
  }
  return findings.sort();
}

if (isMain(import.meta.url)) {
  const root = process.env.NO_FIXTURES_ROOT ?? process.cwd();
  const assets = join(root, 'dist', 'assets');
  if (!existsSync(assets)) {
    console.error(
      `build:check FAILED — no ${relative(root, assets)} directory. Run \`pnpm build\` first.`,
    );
    process.exit(1);
  }
  const findings = findFixtureArtifacts(root);
  if (findings.length > 0) {
    console.error(
      `\nbuild:check FAILED — ${findings.length} fixture artifact${findings.length === 1 ? '' : 's'} would be published:`,
    );
    for (const finding of findings) console.error(`  ${finding}`);
    console.error(
      '\ndist/ is served as-is and the service worker precaches every chunk, so these are\n' +
        "public URLs handing out the fixture world's seed (patients, staff). Shipped code must\n" +
        'never import src/shared/api/app/fixtures/ — not even lazily: a dynamic import() still\n' +
        'emits the chunk. Fixtures are test support; read clinozy-be instead.',
    );
    process.exit(1);
  }
  console.log('build:check OK — no fixture chunk or seed in the published bundle.');
}
