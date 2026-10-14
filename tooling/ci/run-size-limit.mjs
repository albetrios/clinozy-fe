#!/usr/bin/env node
/**
 * Measure first-paint JS/CSS from dist/index.html (entry + modulepreloads only).
 * Avoids summing every lazy `index-*.js` chunk that Vite emits alongside the entry.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { firstPaintAssets } from './first-paint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');

const css = html.match(
  /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/,
)?.[1];

const jsPaths = firstPaintAssets(root).map((file) => `dist/${file}`);
const cssPaths = css ? [`dist${css}`.replace(/^\//, '')] : [];

if (jsPaths.length === 0) {
  console.error('run-size-limit: could not parse entry JS from dist/index.html');
  process.exit(1);
}

// Budgets are a RATCHET (same philosophy as coverage thresholds): pinned just
// above the measured first-paint size (JS ~238 kB gz, CSS ~35 kB gz) so any
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
     *
     * 241.9 → 243.9 kB (same exemption, D48): measured 243.39 kB after the
     * Patients and Appointments screen rows (241.36 kB before them), each row
     * boundary built and attributed through the hidden source maps:
     * - L-32, the Patients room (+1.88 kB). The entry +1.08: the room's URL
     *   readers (`patients.search.ts` — view, filters, sort and the New
     *   patient prefill, whose mobile check brings `toAppPhone` along), the
     *   `create` route block and manifest, two builders and the route's
     *   preload list. The shared `icons` chunk +0.79: the WhatsApp and
     *   Instagram marks and five Lucide glyphs this room draws first — the
     *   icon barrel puts every glyph any screen draws into that
     *   entry-preloaded chunk, so splitting the clinic's marks off it is the
     *   next lever.
     * - L-32b +0.15 (the patients route's preload list names four more shared
     *   chunks, and the `organizationPatients` builder joins the entry with
     *   its first caller), L-36b +0.08 (the appointments route's preload list,
     *   the `Clock` glyph), L-37 +0.03 (`common`'s `cells.leadMark`), L-37b
     *   nothing (its card is not mounted yet).
     * Trimmed first: the Patients list read moved off the entry into
     * `patients.params.ts`, as `appointments.params.ts` had (−0.07 kB).
     *
     * 243.9 → 245.5 kB (same exemption, D48): measured 244.97 kB after the
     * Offerings rows and L-29 (243.76 kB before them), each commit built and
     * attributed through the hidden source maps:
     * - L-30b, the Offerings and Offers tabs (+0.91 kB): the Offers route
     *   block, its manifest and `offers.search.ts`, the Offerings tab's
     *   validators (`offerings.search.ts`), and the router's `useMatchRoute`
     *   (+0.08 in the vendor chunk), first used by RoomTabs' deepest match.
     * - L-30c +0.34 (the `create` and `$offeringId/edit` dialog routes, their
     *   manifests, the room's six builders, the `Minus` glyph), L-30d +0.27
     *   (the Offer drawer's two dialog routes and manifests, two builders, the
     *   `Pause` and `Play` glyphs), L-29 +0.05 (the shortcuts dialog's j · k
     *   row in the entry's English copy), L-30e nothing.
     * Trimmed first: once the Offers schema imported the Offerings one, the
     * bundler split the shared URL readers (`search-params.ts`,
     * `app-list-filters.ts`) into two more first-paint chunks; reading them
     * from the shared modules keeps them in the entry (−0.35 kB).
     *
     * 245.5 → 253.1 kB (same exemption, D48): measured 252.65 kB after the
     * Tasks, appointment form, Users, Payments, Medical and patient-file rows
     * (244.97 kB before them). Each row's own measure, from its builder (the
     * rows landed in parallel, so no per-commit build of this tree):
     * - L-50, the Medical room (+2.89 kB), all entry: its 23 route blocks —
     *   seven tabs and sixteen dialog routes — their manifests and builders.
     * - L-42 + L-44, the patient file and its photos (+1.68 kB): +1.01 the
     *   section and photo route registrations (the routes themselves load
     *   through one lazy module), +0.66 the shared icons chunk — the glyphs
     *   the file draws first.
     * - L-31b … L-31f, the Users room (+1.39 kB): the Team, Roles and
     *   Branches routes with their four dialog routes, manifests, builders
     *   and `users.search.ts` (L-31b +0.64 and L-31c +0.28 on their own,
     *   L-31f's "Leave clinic" +0.02).
     * - L-39, Payments (+1.31 kB): seven route blocks, eight manifests, two
     *   URL readers, eight builders and the preload lists.
     * - L-47b +0.58 and L-47d +0.11 (the task routes, their readers and
     *   manifests), L-47c nothing, L-38 +0.05.
     * The rows sum to +8.01; the tree measures +7.68, the difference being
     * their different bases and the integration's dedupe. Trimmed first: the
     * Tasks list read left `tasks.search.ts` for `tasks.params.ts`, which
     * loads with the room (≈ −0.06 kB). Almost all of it is route
     * registration — manifests, builders and validators of dialog routes
     * that render nothing on their own; L-54 moved it off (below).
     *
     * 253.1 → 255.1 kB (same exemption, D48): measured 254.67 kB after the
     * Today, Payments drawer, Day close, Medical drawer and Clinic stock rows
     * (252.65 kB before them), each row boundary built on this tree and
     * attributed through the hidden source maps:
     * - L-51, the Clinic stock room (+1.33 kB), all entry: its ten route
     *   blocks — three more tabs and seven dialog routes — their ten
     *   manifests, the room's builders (+1.06 kB of minified `builders.ts`),
     *   `stock.search.ts` (one dependency-free reader for every tab and the
     *   dialog prefills) and the new chunks' names in Vite's preload map.
     * - L-48, Today (+0.38 kB): its URL reader (`today.search.ts`: `lane`,
     *   `queue`) and `validateSearch`, the `tasks` copy on its loader, and
     *   the preload lists naming the chunks Today now shares with Tasks.
     * - L-51b +0.20, L-50b +0.07, L-39b +0.06: no route changes — the rooms'
     *   lazy imports name the shared chunks their drawers split off (the
     *   patient picker, the stacked-drawer host, the room dialog-route
     *   reader); L-39c −0.01, L-41 nothing.
     * Trimmed first: nothing obvious is left outside the registrations —
     * every reader these rows added is already dependency-free (no zod in
     * the entry) and each tab's list read loads with its tab; the route
     * registrations themselves left with L-54 (below).
     *
     * 255.1 → 256.1 kB (same exemption, D48): measured 255.66 kB after the
     * Invoice drawer and Medical flows rows (254.66 kB before them), each row
     * boundary built on this tree and attributed through the hidden source
     * maps:
     * - L-40, the shared Invoice drawer (+0.73 kB): +0.63 entry — its four
     *   route blocks (the `invoices/` host over the Payments ledger, create,
     *   `$invoiceId` and its edit) with their lazy imports' preload lists,
     *   their four manifests and the URL reader (`invoices.search.ts`:
     *   `type`, `patient`, `from`) — and +0.10 the glyphs the shared
     *   QuickLine draws joining the first-paint icons chunk.
     * - L-50c, the Medical flows (+0.27 kB), all entry: Medical › Payments'
     *   `validateSearch` (`validateMedicalPaymentsSearch`) with New sale's
     *   `from`, the `payments` copy on that tab's loader, and the Medical and
     *   Clinic stock routes' preload lists naming the chunks the flows share
     *   (the ledger units, the Invoice drawer, `usePayBill`); the ledger's
     *   filter values moved to `shared/api/app/` at no cost.
     * Trimmed first: nothing — the new readers are dependency-free, and the
     * drawer, its money module and the print preview load with their routes.
     *
     * 256.1 → 248.5 kB, lowered (L-54): measured 248.12 kB, from 257.43 kB on
     * top of the Visit sheet (L-49) — the rows since 256.1 had taken first
     * paint over the limit. Route registration left the entry chunk (209.5 →
     * 161.2 kB raw, 60.1 → 50.7 kB gzipped), each commit built on this tree
     * and attributed through the hidden source maps:
     * - The clinic rooms behind one lazy module (−4.78 kB): the 25 room pages,
     *   tabs and layouts and the invoices host load through `room-routes.ts`
     *   (`roomRoute(name)`), so the entry no longer carries their `import()`s'
     *   preload lists — every chunk each room shares, by name — nor the
     *   ~150 chunk names only those lists used. The org shell's loader and the
     *   signed-in warm-up fetch the module before a room needs it.
     * - The dialog routes' manifests (−2.50 kB): the 47 drawers, viewers and
     *   previews and the Visit sheet keep only their path in the entry;
     *   `dialogRoute(name)` loads the manifest and component from
     *   `dialog-routes.ts` — one import, not 48 — and `beforeLoad` awaits the
     *   manifest before the same gate a page runs.
     * - The room builders (−1.08 kB): `builders.ts` keeps the organization-
     *   level four the entry calls; each room's are imported by path.
     * - The dialog routes' search schemas (−0.96 kB): they moved to each
     *   room's `<room>.dialog-search.ts`, with `toAppPhone` and the Visit
     *   sheet's tab reader; the routes keep their search, typed for links, and
     *   the rooms parse it.
     * `pnpm build:check` (`check-entry-routes.mjs`) now fails on a dialog
     * manifest or a room builder in the first-paint chunks. ~0.4 kB of
     * headroom, as the earlier limits left.
     *
     * 248.5 → 247.1 kB, lowered (L-63, the old dashboard retired): measured
     * 246.82 kB on top of L-64. What left the first paint with it: the
     * dashboard's two routes (the org leaf and the personal `/dashboard` shell
     * with its two guards), its manifest and builder, the `dashboard`
     * namespace's eleven locale loaders, the nav's template-page branch, six
     * glyphs only the dashboard drew (`LayoutDashboard`, `CalendarDays`,
     * `GitBranch`, `Globe`, `Languages`, `Smartphone`) in all three icon sets,
     * the theme store's dashboard arrangement axis, the command menu's seed and
     * "Navigation" group, and the English copy only those used; the `/dashboard`
     * redirect and the org home's empty state (one `roomRoute` name) came
     * back. ~0.3 kB of headroom.
     *
     * 247.1 → 237 kB, lowered (L-65, the theme studio retired): measured
     * 236.61 kB, from 246.07 kB on main (928f9b21). What left the first paint:
     * the studio engine the theme store loaded at boot — the named presets,
     * the generated looks with their seeded generator and OKLCH maths, the
     * per-axis catalogs, Shuffle, the seed and its `?theme=` reader, the
     * store's axis setters and its v1–v7 migrations — the icon registry
     * (`makeIcon` and the Tabler / Phosphor set loader; the barrel exports
     * Lucide directly now), the boot palette's release, and the edge handle
     * the root mounted for Appearance. The Appearance drawer, the confirm frame
     * and the shortcuts drawer stay off it (`appearance-dialog.constants.test.ts`
     * pins the drawer's modules out of the entry). Not attributed per item;
     * ~0.4 kB of headroom.
     *
     * 237 → 243.4 kB (same exemption, D48): measured 242.9 kB after the
     * clinozy-be integration rows (236.8 kB at L-65), both ends built the same
     * way (no env file, as CI) and attributed through the hidden source maps —
     * +12.4 kB raw:
     * - The typed API layer and its errors (L-60, F1–F13, ~6.1 kB raw):
     *   `core/http/api.ts`, `wire-schema.ts`, the fetch client's idempotency
     *   key, `map-frontend-error.ts` and its error keys, `queryClient.ts`, and
     *   the parts of react-query the rooms now call (`queryClient.query`, the
     *   mutation cache) — 5.104.0 at both ends, so no dependency bump.
     * - Members, roles and access on permission codes (D83, ~2.7 kB raw):
     *   `organization-api.ts` reads the membership and role wire shapes,
     *   `core/types/permissions.ts` the code list.
     * - Invitations at sign-in (D84, ~1.5 kB raw): `my-invitations.ts` and the
     *   resolver's and me-context's branch for them.
     * - The analytics consent per account (D85, ~1.3 kB raw): `capture.ts`,
     *   the consent store and Sentry's replay gate.
     * - Session and boot (~1.1 kB raw): the auth shell's keys, the refresh
     *   service, `useAppSplashActive`; the deployment's module flags (D165,
     *   ~0.3 kB). Offsets: the theme store left first paint (−0.9 kB raw).
     * Trimmed first (−6.3 kB): `organization-api.ts` imported `servedTone`
     * from `app-tones.ts` — the tone class table and, through it, the
     * generated `app-schema.ts`, pages of zod — and read `weekdaySchema` from
     * that schema too. Both are declared beside it now (`app-tone-label.ts`,
     * `app-week.ts`), each pinned to the contract's enum by its test. ~0.5 kB
     * of headroom.
     *
     * 243.4 → 243.8 kB (same exemption, D48): measured 243.41 kB, from 242.90
     * kB at 182910e7, each end built the same way (no env file, as CI) and
     * the first-paint chunks compared:
     * - One live token per session (3b7d1e2c, +0.42 kB, all in the chunk that
     *   carries `queryClient.ts`): the fetch client's rotation replay and its
     *   wait on a switch in flight, the refresh service's check that the
     *   answer names this tab's organization (switching the tab back when it
     *   does not), and `token.ts`'s claim reader. The auth runtime is first
     *   paint by definition — every request goes through it.
     * - A taken workspace URL says so (383091da, +0.03 kB): its error key in
     *   `errors.constants.ts` and the English `errors` copy.
     * - The reuse audit (67614ea2, +0.06 kB): `notifyError` takes the full
     *   notify options and `notifyQueryError` its own message, duration and
     *   retry label; `pageOf` (one cursor-page reader for 45 fetchers) sits
     *   beside `toPaginated`; `publicIdPattern` splits out of `publicId`; and
     *   the organization store's `useOrganizationId` selector.
     * Trimmed first: nothing — each is a shared helper the rooms now call
     * instead of their own copies, or the auth runtime itself. ~0.4 kB of
     * headroom.
     *
     * 243.8 → 245.0 kB: a declared exemption, itemised — the critical-update
     * flow (a release can require every open tab to update; frontend-platform.md
     * → Critical updates). Measured 244.63 kB, from 243.73 kB on its base (the
     * npm-non-major bump had already spent the headroom above), both ends built
     * the same way (no env file, as CI) and the first-paint chunks compared:
     * - The checker's critical path (+0.79 kB, entry): `isCriticalUpdate`, the
     *   countdown with its offline wait and its loop guard (`check.ts`),
     *   `compareReleaseVersions` (`lib/app-version.ts`), the notice's lazy
     *   shell, its `useUIStore` field and `showCriticalUpdate`. First paint by
     *   definition: the checker runs in every tab from boot, and lazy-loading
     *   the decision would make "must this tab update?" depend on fetching a
     *   chunk the new deploy may already have removed.
     * - The notice's copy in `common` (+0.09 kB, the `i18n` chunk) and its two
     *   analytics event names (+0.03 kB).
     * Trimmed first: the notice itself loads on demand
     * (`CriticalUpdateNoticeLazy`, pinned by its test; −0.39 kB), and reads its
     * copy through the shared i18n instance — importing react-i18next from the
     * lazy chunk had split `useTranslation` into a first-paint chunk of its own
     * (−0.37 kB). ~0.4 kB of headroom.
     *
     * 245.0 → 238.6 kB, lowered: measured 238.16 kB, from 244.67 kB on main
     * (aeee944f), both built the same way (no env file, as CI). No module left
     * the first paint — the same code ships in five files instead of 24:
     * `vite.config.ts`'s `codeSplitting` collects the static entry graph in one
     * `boot` group (emitted as the entry chunk) beside `vendor`, `zod` and
     * `query`. The ~20 small chunks automatic splitting made of what the entry
     * shares with lazy chunks each carried their own import and export
     * bindings; in one chunk the minifier also inlines and mangles across them.
     * Every lazy chunk now imports those modules from the entry chunk, which is
     * loaded anyway. ~0.4 kB of headroom.
     * "Report a bug" (iteration feat-bug-report-2026-10-13-dgnx) spends ~0.25 kB of it,
     * measured against main built the same way: the `BugReportLazy` shell the clinic layout
     * mounts, and two registry glyphs — `Bug` (the trigger) and `Mic` (the voice button) — both
     * now in the entry chunk with the `boot` group. The widget, its voice hook, its copy and its
     * motion stylesheet load on demand. ~0.2 kB of headroom left.
     */
    limit: '238.6 kB',
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
           *
           * 37.5 → 39.5 kB (same exemption, D36): measured 39.06 kB (37.22
           * before the Patients and Appointments screen rows), each row boundary
           * built: the Agenda (+0.73 kB, L-36b: the sticky day groups and their
           * tone bands, the DataTable's group rows and refresh bars, the phone
           * re-grid, the 560px Filters popover with its month calendar, the
           * booking card and the status popover), the Day / Week / Month
           * calendars (+0.49, L-37: blocks placed by CSS variables, the rails,
           * the now line and past veil, the week's load bars, the status
           * edges), the shared Offering suggestions card (+0.57, L-37b: its
           * container queries and row grids — emitted although nothing mounts
           * it before the appointment form and the patient file), the patient
           * drawer's chip and "+91" fields (+0.12, L-32b) and the Patients list
           * (+0.02, L-32). Trimmed first: the Agenda header's band map spelled
           * all eleven tones for the six a day takes (−0.09 kB).
           *
           * 39.5 → 40.8 kB (same exemption, D36): measured 40.34 kB (39.06
           * before the Leads rows), each row boundary built: the lead drawer
           * (+0.80 kB, L-34b: its two panes sized by CSS variables, the chat's
           * resize handle, the cards, the progress track's tinted tiles, the
           * people popover, the copy-ID hover, the phone bar), the Leads list
           * (+0.40, L-33b: the in-place refresh bars as one rowgroup rule, the
           * hold dot, the claim pill, the team cell) and New lead with the
           * shared contact editor (+0.07, L-35: the 640px record drawer, the
           * 560px editor and its outside ×). Nothing here is unused; the next
           * trim is one in-place skeleton — the calendars still spell L-37's
           * `SKELETON_IN_PLACE` classes beside the table's rule.
           *
           * 40.8 → 43.1 kB (same exemption, D36): measured 42.61 kB (40.38
           * before these rows), each row's own measure from its builder: the
           * patient file and its photos (+1.32 kB, L-42 + L-44: the file's
           * frame by tier and the photo grid and viewer), the appointment form
           * (+0.42, L-38), the Tasks list
           * (+0.21, L-47b) and the task drawer (+0.13, L-47c), the Users rooms
           * (+0.18 together, L-31b … L-31f), Medical (+0.07, L-50) and Payments
           * (+0.03, L-39); L-47d nothing. They sum to +2.36; the tree measures
           * +2.23.
           *
           * 43.1 → 43.7 kB (same exemption, D36): measured 43.31 kB (42.61
           * before these rows), each row boundary built on this tree: Today
           * (+0.35 kB, L-48: the floor's two columns with the 312px aside,
           * the lane tiles' grid and the phone snap strip, the cards' grid,
           * the lane tones' borders, the greeting and pulse figures), the
           * stock drawers (+0.20, L-51b: Stock check's four-column grid and
           * its phone cards, the Use popover's toggles and focus ring), the
           * Medical drawers (+0.16, L-50b: the medicine's stock-level track
           * placed by CSS variables, the price panel's cells, the GST
           * toggle's on state) and Day close (+0.07, L-41: the display
           * figure, the strips' auto-fit grid, the review rows' 910px
           * container re-grid). The Clinic stock room took 0.08 off (L-51:
           * the placeholder Items page's own heading gave way to the room
           * toolbar's); L-39b and L-39c nothing.
           *
           * 43.7 → 43 kB, lowered (L-54): measured 42.68 kB. The rows since
           * 43.7 was set — the Invoice drawer and Medical flows, the patient
           * file's record drawers, notes and overview, the purchase quick
           * lines, the one in-place skeleton look (which took the calendars'
           * second one out) and the Visit sheet (+0.33 kB of its own) — had
           * taken it to 44.19 kB. The A4 print sheets' utilities — their
           * millimetre boxes, Arial and table layout, the first candidate
           * named above — then left the first paint (−0.89 kB): `index.css`
           * no longer scans `shared/components/PrintTemplate/`, whose own
           * `print-template.css` loads with the chunks that print (the two
           * token variants only the sheets use stay here, in its
           * `@source inline(…)`). The shadcn parts L-07 added that no screen
           * composed — `tabs`, `scroll-area` and `resizable` whole, the
           * sheet's and drawer's header, footer and close, the command
           * shortcut, the radio item, the toggle — left with knip's pass
           * (−0.62 kB). ~0.3 kB of headroom.
           *
           * 43 → 39.6 kB, lowered (L-63, the old dashboard retired): measured
           * 39.34 kB on top of L-64. Tailwind emits a source file's classes
           * whether or not anything mounts it, so the drop is the files that
           * left: the dashboard island and its ~25 widgets (the hero, the KPI
           * tiles, the charts, the bento and pulse arrangements, the heatmap,
           * the gantt, the activity map, the carousel's cards), the theme
           * showcase, the Appearance "Dashboard" card, the shadcn `chart`,
           * `carousel` and `table` primitives only they used, and the carousel
           * arrows' two Sharp-shape slots in `index.css`; the org home's empty
           * state reuses `EmptyState`'s look. ~0.3 kB of headroom.
           *
           * 39.6 → 35.9 kB, lowered (L-65): measured 35.53 kB, from 36.61 kB on
           * main (928f9b21 — one app shell had already taken it below 39.34).
           * What left with the theme studio: the four accent presets' light and
           * dark blocks (`violet`, `emerald`, `rose`, `ocean`) and the
           * swatch dots, the Tabler half of the icon-colour rules, the edge
           * handle's slot, and the Appearance studio's controls — Tailwind emits
           * a file's classes whether or not anything mounts it. ~0.4 kB of
           * headroom.
           *
           * 35.9 → 35.7 kB, lowered: measured 35.25 kB, from 35.89 kB on main
           * (aeee944f) — the cookie card (#57) and the sign-in showcase (#58)
           * had used the headroom above. The retired base-colour picker's tint
           * blocks (`[data-base='stone' | 'slate' | 'olive' | 'zinc' | 'warm']`,
           * light and dark: ten blocks, −0.64 kB) left `index.css`; nothing has
           * set `data-base` since the theme studio went (L-65), so no screen
           * changes. `pnpm perf:routes`' `cssKb` (35.4, measured 34.8) keeps its
           * pin — it only ever comes down. ~0.45 kB of headroom.
           */
          limit: '35.7 kB',
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
