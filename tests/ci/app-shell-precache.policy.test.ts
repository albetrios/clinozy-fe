import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appShellFiles,
  appShellPrecache,
  firstPaintFiles,
  SHELL_LAZY_CHUNKS,
} from '../../plugins/app-shell-precache.ts';

const INDEX_HTML = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-a1.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-b2.js">
<link rel="modulepreload" crossorigin href="/assets/query-c3.js">
<link rel="stylesheet" crossorigin href="/assets/index-d4.css">
</head></html>`;

/** A built `dist/`: the shell, the boot-lazy chunks and a room nobody opened yet. */
const CHUNKS: Record<string, string> = {
  'assets/index-a1.js':
    'import"./vendor-b2.js";const r=()=>import("./patients.route-z9.js");',
  'assets/vendor-b2.js': 'export const v=1;',
  'assets/query-c3.js': 'export const q=1;',
  'assets/AppSplashSlot-e5.js':
    'import{a}from"./app-greeting-f6.js";import{v}from"./vendor-b2.js";',
  'assets/app-greeting-f6.js': 'export{t as a}from"./app-time-g7.js";',
  'assets/app-time-g7.js': 'export const t=1;',
  'assets/CriticalUpdateNotice-h8.js': 'import"./countdown-i9.js";',
  'assets/countdown-i9.js': 'export const c=1;',
  'assets/ConsentBanner-j1.js': 'import{s}from"./save-consent-preferences-k2.js";',
  'assets/save-consent-preferences-k2.js':
    'export const s=()=>import("./record-consent-l3.js");',
  'assets/record-consent-l3.js': 'export const r=1;',
  'assets/patients.route-z9.js': 'import{d}from"./DataTable-y8.js";',
  'assets/DataTable-y8.js': 'export const d=1;',
};

/** Every file the build emitted — the URLs Workbox would precache before the transform. */
const ASSET_FILES = [
  'index.html',
  'offline.html',
  'theme-init.js',
  'pwa-192x192.png',
  'assets/index-d4.css',
  'assets/inter-latin-400.woff2',
  'assets/patients-route-m4.css',
  ...Object.keys(CHUNKS),
];

const ENTRIES = ASSET_FILES.map((url) => ({ url, revision: null, size: 1 }));

/** The files the transform reads off `dist/`: the shell's HTML and every chunk. */
const DIST_FILES: Record<string, string> = { 'index.html': INDEX_HTML, ...CHUNKS };

const readChunk = (file: string) => CHUNKS[file] ?? '';

describe('the service worker precaches the app shell, not the whole app (F-8)', () => {
  it('reads the first paint off index.html — entry, modulepreloads, stylesheet', () => {
    expect(firstPaintFiles(INDEX_HTML)).toEqual([
      'assets/index-a1.js',
      'assets/vendor-b2.js',
      'assets/query-c3.js',
      'assets/index-d4.css',
    ]);
  });

  it('adds each boot-lazy shell chunk with every chunk it imports statically — never a lazy one', () => {
    const shell = appShellFiles({
      indexHtml: INDEX_HTML,
      assetFiles: ASSET_FILES,
      readChunk,
    });
    expect([...shell].sort()).toEqual(
      [
        'assets/index-a1.js',
        'assets/vendor-b2.js',
        'assets/query-c3.js',
        'assets/index-d4.css',
        'assets/AppSplashSlot-e5.js',
        'assets/app-greeting-f6.js',
        'assets/app-time-g7.js',
        'assets/CriticalUpdateNotice-h8.js',
        'assets/countdown-i9.js',
        'assets/ConsentBanner-j1.js',
        'assets/save-consent-preferences-k2.js',
      ].sort(),
    );
  });

  it('fails the build when a named shell chunk is gone — a rename must not drop it from the shell', () => {
    for (const name of SHELL_LAZY_CHUNKS) {
      expect(() =>
        appShellFiles({
          indexHtml: INDEX_HTML,
          assetFiles: ASSET_FILES.filter((url) => !url.startsWith(`assets/${name}-`)),
          readChunk,
        }),
      ).toThrow(new RegExp(`assets/${name}-`));
    }
  });

  it('keeps the root files, the fonts and the shell; drops every room chunk', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'app-shell-precache-'));
    try {
      mkdirSync(join(outDir, 'assets'));
      for (const [file, text] of Object.entries(DIST_FILES))
        writeFileSync(join(outDir, file), text);

      const { manifest } = await appShellPrecache(outDir)(ENTRIES);
      const kept = manifest.map((entry) => entry.url);

      expect(kept).toEqual(
        expect.arrayContaining([
          'index.html',
          'offline.html',
          'theme-init.js',
          'pwa-192x192.png',
          'assets/inter-latin-400.woff2',
          'assets/index-a1.js',
          'assets/AppSplashSlot-e5.js',
        ]),
      );
      expect(kept).not.toContain('assets/patients.route-z9.js');
      expect(kept).not.toContain('assets/DataTable-y8.js');
      expect(kept).not.toContain('assets/patients-route-m4.css');
      expect(kept).not.toContain('assets/record-consent-l3.js');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('is wired into the service worker build', async () => {
    const { readFileSync } = await import('node:fs');
    const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/manifestTransforms:\s*\[\s*appShellPrecache\(/);
  });
});
