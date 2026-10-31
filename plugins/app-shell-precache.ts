import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The service worker precaches the APP SHELL, not the whole app (F-8). Precaching every chunk
 * (5.8 MB, 454 files) downloaded every room, form and drawer on install — including chunks a
 * member may never open — and kept them at hand for whoever uses the browser next. What the
 * shell needs to boot and own the offline UX (`docs/reference/frontend-platform.md` → Offline
 * stance) is:
 *
 * - every file outside `assets/` — `index.html`, `offline.html`, the pre-paint init scripts,
 *   `config.js`, `registerSW.js`, the icons;
 * - the first paint: `index.html`'s entry script, its `modulepreload` list and its stylesheet;
 * - the fonts the first paint's stylesheet names (`assets/*.woff2`);
 * - the chunks the root route loads lazily at boot ({@link SHELL_LAZY_CHUNKS}) with every chunk
 *   they import statically — the splash's offline hold, the "Update required" notice, the
 *   cookie card.
 *
 * Everything else is fetched when first used and kept by the `app-assets` runtime cache
 * (`src/sw.ts`); a tab open across a deploy that asks for a chunk the new deploy no longer
 * serves recovers through `core/version/stale-chunk-recovery.ts`.
 */

/** The chunks the root route loads lazily at boot that the shell needs offline, by name. */
export const SHELL_LAZY_CHUNKS = [
  'AppSplashSlot',
  'CriticalUpdateNotice',
  'ConsentBanner',
] as const;

/** One precache entry, as workbox-build hands it to a manifest transform. */
interface PrecacheEntry {
  url: string;
  revision: string | null;
  size: number;
}

/** A static `import … from "./x.js"`, `export … from "./x.js"` or bare `import "./x.js"`. */
const STATIC_IMPORT = /(?:\bfrom|\bimport)\s*["']\.\/([\w.-]+\.js)["']/g;

/** `index.html`'s first paint: the entry script, its modulepreloads and its stylesheets. */
export function firstPaintFiles(indexHtml: string): string[] {
  const files = [
    ...indexHtml.matchAll(/<script type="module"[^>]*\ssrc="\/(assets\/[^"]+\.js)"/g),
    ...indexHtml.matchAll(/rel="modulepreload"[^>]*\shref="\/(assets\/[^"]+\.js)"/g),
    ...indexHtml.matchAll(/rel="stylesheet"[^>]*\shref="\/(assets\/[^"]+\.css)"/g),
  ].map((match) => match[1] ?? '');
  return [...new Set(files.filter(Boolean))];
}

/**
 * The shell's `assets/` files: the first paint, plus each {@link SHELL_LAZY_CHUNKS} chunk and
 * every chunk it imports statically (a lazy chunk that loads offline must find its imports
 * offline too). Throws when a named shell chunk is not in the build — a rename would otherwise
 * quietly take it out of the offline shell.
 */
export function appShellFiles({
  indexHtml,
  assetFiles,
  readChunk,
}: {
  indexHtml: string;
  assetFiles: readonly string[];
  readChunk: (file: string) => string;
}): Set<string> {
  const shell = new Set(firstPaintFiles(indexHtml));
  const pending: string[] = [];
  for (const name of SHELL_LAZY_CHUNKS) {
    const chunk = assetFiles.find((file) => file.startsWith(`assets/${name}-`));
    if (!chunk) {
      throw new Error(
        `[app-shell-precache] no assets/${name}-*.js in the build — update SHELL_LAZY_CHUNKS (plugins/app-shell-precache.ts).`,
      );
    }
    pending.push(chunk);
  }
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (shell.has(file)) continue;
    shell.add(file);
    for (const [, imported] of readChunk(file).matchAll(STATIC_IMPORT)) {
      if (imported) pending.push(`assets/${imported}`);
    }
  }
  return shell;
}

/** Whether a precache entry belongs to the app shell. */
function inShell(url: string, shell: ReadonlySet<string>): boolean {
  return !url.startsWith('assets/') || url.endsWith('.woff2') || shell.has(url);
}

/**
 * The `injectManifest.manifestTransforms` entry that narrows the precache to the app shell. Runs
 * after the client build has written `<outDir>/index.html` and its chunks.
 */
export function appShellPrecache(outDir: string) {
  return async (entries: PrecacheEntry[]) => {
    const shell = appShellFiles({
      indexHtml: readFileSync(join(outDir, 'index.html'), 'utf8'),
      assetFiles: entries.map((entry) => entry.url),
      readChunk: (file) => readFileSync(join(outDir, file), 'utf8'),
    });
    return {
      manifest: entries.filter((entry) => inShell(entry.url, shell)),
      warnings: [],
    };
  };
}
