#!/usr/bin/env node
/**
 * Measure first-paint JS/CSS from dist/index.html (entry + modulepreloads only).
 * Avoids summing every lazy `index-*.js` chunk that Vite emits alongside the entry.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');

const entry = html.match(
  /<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>/,
)?.[1];
const preloads = [
  ...html.matchAll(/rel="modulepreload" crossorigin href="(\/assets\/[^"]+\.js)"/g),
].map((m) => m[1]);
const css = html.match(
  /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/,
)?.[1];

const jsPaths = [...new Set([entry, ...preloads].filter(Boolean))].map((p) =>
  `dist${p}`.replace(/^\//, ''),
);
const cssPaths = css ? [`dist${css}`.replace(/^\//, '')] : [];

if (jsPaths.length === 0) {
  console.error('run-size-limit: could not parse entry JS from dist/index.html');
  process.exit(1);
}

// Budgets are a RATCHET (same philosophy as coverage thresholds): pinned just
// above the measured first-paint size (JS ~216 kB gz, CSS ~22 kB gz) so any
// regression trips CI immediately — lower as the bundle shrinks, never raise
// to absorb growth.
//
// No `running` key: it is an option contributed by @size-limit/time, which this
// repo does not install (it never measured runtime here — `running` was only
// ever set to false). Re-adding it without that plugin fails the run outright
// with "Config option running needs @size-limit/time plugin".
const config = [
  {
    name: 'Initial JS (entry + vendor)',
    path: jsPaths,
    /*
     * 225 → 235 kB, and the earlier justification for it was WRONG — corrected
     * here rather than left standing.
     *
     * Measured: main builds 221.2 kB and this tree 228.4 kB on the SAME
     * dependency versions, so the +7.2 kB is app code, not the Dependabot bump.
     *
     * What the first version of this comment claimed — that `card` and
     * `WidgetErrorBoundary` (2.8 kB) entered the entry chunk because App.tsx and
     * routeTree.tsx now mount containment boundaries — is misattributed. main's
     * own App.tsx already imports `Card`/`CardContent` (for GlobalErrorFallback)
     * and `react-error-boundary` directly, and this branch does not touch those
     * imports. Only ~1.5 kB is genuinely attributable to the new boundaries.
     *
     * So the reclaim is arithmetically out of reach here: deleting the entire
     * boundary chunk still lands at ~226.9 kB, over the old limit. Roughly
     * 5.7 kB of the regression is elsewhere — branch app code and locale keys —
     * and is NOT yet itemised. This is therefore a declared exemption, not a
     * fix, and the honest next step is to attribute that 5.7 kB.
     *
     * Lazy-splitting the fallback was considered and rejected: if the fallback
     * chunk fails to load, React.lazy throws during the boundary's OWN fallback
     * render, which React cannot catch — it escalates to the global boundary and
     * turns a contained widget failure into a whole-app replacement, the exact
     * outcome these boundaries exist to prevent.
     *
     * The split is otherwise intact: build:check reports no deferred module on
     * the first-paint path, and the module-scope import() audit is clean.
     *
     * 235 → 234 kB. Part of that un-itemised 5.7 kB is now attributed: the
     * root-mounted `AppearanceDialog` imported `settings.constants.ts` for THREE
     * header keys, which put the whole Settings key table (~17 kB of source,
     * ~3 kB gzipped) on the first paint of every load. It declares those keys
     * locally now (pinned by `appearance-dialog.constants.test.ts`), and the cookie
     * consent card went lazy. Measured after: 232.8 kB, against main's 234.3 —
     * while the same change ADDED the boot warm-up, the router pending policy
     * and the pending-revoke sign-out. Lowered per the rule above; the ~1.2 kB
     * of headroom matches what the previous limit left.
     *
     * 234 → 240 kB. A deliberate exception to the ratchet rule above, by the
     * owner's decision: first paint measures 232.8 kB, so 234 kB left ~1.2 kB and
     * the next feature would trip it. 240 kB leaves ~7 kB of headroom for the
     * launch work; lower it again, per the rule, once that work has landed.
     *
     * 240 → 241.9 kB: a declared exemption, itemised (iterations/
     * launch-2026-09-30-jxmr, decision D48 — the JS twin of the CSS budget's
     * D36). Attributed through the build's hidden source maps, entry +
     * modulepreloads, 239.73 → 241.36 kB:
     * - Route registrations and their `<page>.search.ts` validators.
     *   `routeTree.tsx` IS the entry chunk by design, so every route block,
     *   manifest, builder and URL reader lands in it. L-33's leads routes
     *   (~1.7 kB) already spent most of the headroom above; L-36's appointments
     *   routes add +0.60 kB (the create / `$appointmentId` / edit blocks, two
     *   manifests, three builders, `appointments.search.ts`, `matchOf` and
     *   `RECORD_ID`) — the readers stay dependency-free, no zod in the entry.
     * - The boot splash, first paint by definition (L-52, +1.04 kB): the boot
     *   controller's hold, offline and exit logic (`app-splash.ts`), the slot's
     *   lazy shell (the slot itself loads on demand), `useOnlineStatus` (which
     *   `OfflineIndicator` now shares) and the `splash.*` copy in `common` — the
     *   offline line must not wait on a lazy namespace.
     * Trimmed first: the shell had imported the slot's whole key and test-id
     * table for one key (−0.16 kB); nothing else large rides the entry. Lower
     * it again as soon as a route group can leave the entry chunk.
     */
    limit: '241.9 kB',
    gzip: true,
  },
  ...(cssPaths.length
    ? [
        {
          name: 'Initial CSS',
          path: cssPaths,
          /*
           * 25 → 23.5 kB. The stylesheet had crept to 25.01 kB and the cause
           * was not the app: Tailwind's automatic detection reads every tracked
           * file, so class-shaped strings in `docs/`, agent-os skills, `tooling/`
           * gate fixtures and E2E specs were being emitted — 196 utilities,
           * ~2.2 kB gzipped, including raw-palette classes `validate:tokens`
           * forbids in app code. `src/index.css` now scopes the scan
           * (`source('../src')`, tests excluded) and `build:check` trips if it
           * ever widens again. Measured after: 22.76 kB, below main's 23.8.
           * Lowered per the ratchet rule; ~0.7 kB of headroom.
           *
           * 23.5 → 25.5 kB: a declared exemption, itemised — the clinic launch
           * (iterations/launch-2026-09-30-jxmr, decision D36) makes its design
           * the default look, and a default look is first-paint by definition.
           * Measured 25.28 kB: the self-hosted Inter + JetBrains Mono
           * `@font-face` rules (+0.57 kB, L-02 — the CSP forbids a font CDN),
           * the full-surface `clinozy-zinc-pastel` preset with its dark and
           * light-pinned blocks and slot rules (+1.12 kB, L-03), the dark values
           * of the new base tokens and section tones (+0.67 kB; their light
           * values stay tree-shaken in @theme until a screen uses them) and the
           * room metrics by tier (+0.27 kB). Lower it again as soon as anything
           * here can leave the first paint.
           *
           * 25.5 → 27 kB (L-07, same exemption): the eleven shadcn primitives the
           * launch composes on — sheet, drawer, command, tabs, toggle,
           * toggle-group, hover-card, accordion, scroll-area, radio-group,
           * resizable — +1.4 kB measured (26.63 kB). Tailwind emits a source
           * file's classes whether or not anything imports it yet, so the cost
           * lands with the files, not with their first screen. Upstream variants
           * the launch never draws (CommandDialog, drawer top / left / right,
           * the physical sheet sides, vertical tabs and resizable groups) were
           * trimmed first (−0.8 kB).
           *
           * 27 → 36 kB (L-07a … L-23, same exemption): the launch's shared
           * clinic layer — every unit the rooms compose — measured by building
           * each row boundary (35.74 kB at the last). The foundations (+1.78 kB:
           * the phone bottom stack, the icon marks, and the literal tone class
           * maps — eleven tones × ten utilities, which Tailwind can only see
           * spelled out), the section-bar shell and the room islands (+1.63),
           * the reason confirm and the toast bar (+0.58), the DataTable's folds,
           * phone rows and bulk bar (+1.16), the Picker and its date / time /
           * calendar pickers (+1.38), the record drawer and its steps and footer
           * (+0.85), the cells, person cards and tooltip (+0.48), the upload
           * tray (+0.16) and the A4 print sheets' millimetre utilities (+1.06,
           * print-only — the first candidate to leave the first paint, into a
           * stylesheet the print host loads). Re-itemise as the screens land.
           *
           * 36 → 37.5 kB (same exemption, D36): measured 37.22 kB — the room
           * toolbar (+0.62 kB, L-16: the tabs and their fold, the search, the
           * Filters popover and its 82% sheet, the floating "New" and the view
           * bar), the clinic command menu (+0.08, L-28) and the shared chat
           * column (+0.68, L-34: the thread, its bubbles and history chips, the
           * composer and its Suggestions popover). The boot splash's frames
           * (L-52) are inline CSS in index.html, outside this stylesheet; its
           * old breathe keyframes left it.
           */
          limit: '37.5 kB',
          gzip: true,
        },
      ]
    : []),
];

const configPath = path.join(root, '.size-limit.generated.json');
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

const args = ['size-limit', '--config', configPath];
if (process.argv.includes('--json')) args.push('--json');

execFileSync('pnpm', args, { cwd: root, stdio: 'inherit' });
