import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIXTURE_MARKERS } from './check-no-fixtures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TRIPWIRE = join(ROOT, 'tooling/ci/check-no-fixtures.mjs');
const FIXTURES = join(ROOT, 'src/shared/api/app/fixtures');

/** Built at run time, so this file's own text never trips the guard it is testing. */
const fixtureChunk = (name) => `assets/${name}.${'fixtures'}-pBhbfIYL.js`;

/**
 * Run the tripwire against a throwaway `dist/`. A gate nobody has watched fail is a green
 * checkmark (agent-os/skills/fe-guard-authoring), and a fixture that makes it fail cannot live
 * in the real `dist/`.
 *
 * `files === null` omits `dist/assets` entirely (the "did you build?" case).
 */
function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'no-fixtures-'));
  try {
    if (files !== null) {
      mkdirSync(join(root, 'dist/assets'), { recursive: true });
      for (const [relativePath, content] of Object.entries(files)) {
        const file = join(root, relativePath);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
    }
    const result = spawnSync('node', [TRIPWIRE], {
      encoding: 'utf8',
      env: { ...process.env, NO_FIXTURES_ROOT: root },
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const CLEAN = {
  'dist/index.html': '<script type="module" src="/assets/index-abc123.js"></script>\n',
  'dist/assets/index-abc123.js': 'export const a = "Messages wait in the queue";\n',
  'dist/sw.js': 'precacheAndRoute([{url:"assets/index-abc123.js",revision:null}]);\n',
};

it('passes on a bundle with no fixture chunk or seed', () => {
  const { status, output } = run(CLEAN);
  expect(status, output).toBe(0);
  expect(output).toMatch(/build:check OK/);
});

it('fails on a published fixture chunk', () => {
  const { status, output } = run({
    ...CLEAN,
    [`dist/${fixtureChunk('world')}`]: 'export const w = 1;\n',
  });
  expect(status, output).toBe(1);
  expect(output).toMatch(/build:check FAILED/);
  expect(output).toMatch(/world\.fixtures-pBhbfIYL\.js: a fixture chunk/);
});

it('fails on a precache manifest that lists a fixture chunk', () => {
  // The service worker precaches every chunk it is told about — one listed here downloads on
  // install, signed in or not.
  const { status, output } = run({
    ...CLEAN,
    'dist/sw.js': `precacheAndRoute([{url:"${fixtureChunk('staff')}",revision:null}]);\n`,
  });
  expect(status, output).toBe(1);
  expect(output).toMatch(/dist\/sw\.js: references staff\.fixtures-pBhbfIYL\.js/);
});

it('fails on a seed string inlined into an innocently named chunk', () => {
  for (const marker of FIXTURE_MARKERS) {
    const { status, output } = run({
      ...CLEAN,
      'dist/assets/messages-api-BT7mjqHQ.js': `const seed = ${JSON.stringify(marker)};\n`,
    });
    expect(status, `${marker}\n${output}`).toBe(1);
    expect(output).toContain(
      `messages-api-BT7mjqHQ.js: carries the fixture seed "${marker}"`,
    );
  }
});

it('leaves a binary asset unread — only text files are scanned for seeds', () => {
  const { status, output } = run({
    ...CLEAN,
    'dist/pwa-192x192.png': FIXTURE_MARKERS.join(' '),
  });
  expect(status, output).toBe(0);
});

it('fails when the build has not run', () => {
  const { status, output } = run(null);
  expect(status, output).toBe(1);
  expect(output).toMatch(/Run `pnpm build` first/);
});

it('names only markers the fixture seeds still spell — the list cannot rot into matching nothing', () => {
  const seeds = readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.fixtures.ts'))
    .map((name) => readFileSync(join(FIXTURES, name), 'utf8'))
    .join('\n');
  for (const marker of FIXTURE_MARKERS) expect(seeds, marker).toContain(marker);
});

it('flags the real fixture sources, as a bundler would inline them', () => {
  const seeds = readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.fixtures.ts'))
    .map((name) => readFileSync(join(FIXTURES, name), 'utf8'))
    .join('\n');
  const { status, output } = run({ ...CLEAN, 'dist/assets/chunk-abc123.js': seeds });
  expect(status, output).toBe(1);
  for (const marker of FIXTURE_MARKERS) expect(output).toContain(marker);
});
