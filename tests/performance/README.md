# Performance tests

## Public-route transfer budgets — `pnpm perf:routes`

Measures what a signed-out visitor actually downloads on every route they can
reach, **one route at a time, each in a fresh browser context**, and asserts it
against [`tooling/perf/public-route-budgets.json`](../../tooling/perf/public-route-budgets.json).

```bash
pnpm perf:routes           # measure + assert (exit 1 on a breach)
pnpm perf:routes:update    # re-pin budgets to what was just measured
pnpm perf:routes --json    # machine-readable
```

### Why it exists next to `pnpm size`

`pnpm size` (`tooling/ci/run-size-limit.mjs`) measures the entry chunk plus the
modulepreloads `index.html` declares — the **first-paint critical path**, and
nothing else. Everything a route pulls dynamically is invisible to it.

On the build this was written against, that gap was large:

|          | `pnpm size` reports | actually transferred |
| -------- | ------------------- | -------------------- |
| `/login` | 233.67 kB           | **792.5 kB**         |

The difference is idle-deferred work — Sentry (~150 kB), PostHog (~92 kB), the
deferred icon sets — plus every chunk the route imports dynamically. None of it
blocks first paint, all of it costs the visitor bandwidth and main thread on the
same visit, and none of it was gated.

So the two are complementary and both are worth keeping: `pnpm size` guards what
delays render, `pnpm perf:routes` guards what the visit costs.

### Why a fresh context per route

A visitor arriving at `/accept-invite/…` from an email has none of `/login`'s
chunks warm. Reusing one browser context would report every route after the
first as nearly free, which is the opposite of the number worth knowing.

### Why public routes only

They need no backend. The Playwright E2E suite is local-only because it needs
clinozy-be on `:3000` (see `CLAUDE.md`); guest routes render against nothing, so
this harness runs anywhere — including CI.

### The two numbers

- **first-paint** — transferred before the load event. What delays render.
- **total** — everything after a 3s idle settle. What the visit costs. The
  settle matters: observability registers on an idle callback, so a measurement
  that stops at `networkidle` misses the single largest chunk on the page.

### Budgets are a ratchet

Same philosophy as the coverage thresholds and the TSDoc budget: pinned just
above measured (`headroomPercent`), lowered as routes shrink, **never raised to
absorb growth**. A breach prints the five largest chunks on that route, so it
names its own cause instead of sending you to a bundle analyzer.

`cssKb` measures the same file as `pnpm size`'s **Initial CSS** — every public
route loads the one `index-*.css` — so a deliberate move of that limit in
`tooling/ci/run-size-limit.mjs` re-pins `cssKb` here in the same change. CI runs
this weekly (`lighthouse.yml`), not per PR, so a budget left behind is found a
week late.

### Re-pins

Every re-pin is itemised here — a raise with its cause, a tightening with what
made the old value loose — because the budget file is JSON and cannot carry its
reasons. Measured on a CI-equivalent build (no `.env.local`, no ambient
`VITE_*`), pinned with the script's own `headroomPercent`. `--update` re-pins
every key; a key it would raise keeps its old value unless the row says why.

| Date       | Budget                     | Before → after               | Measured       | Cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------- | ---------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | `cssKb`, all 7 routes      | 23.2 → 35.4 kB               | 34.33 kB       | The clinic launch's stylesheet (`launch-2026-09-30-jxmr`, decision D36): its design as the default look, the shadcn primitives it composes on and the shared clinic layer every room uses — Tailwind emits a source file's classes whether or not the first screen mounts it. Itemised row by row, with the trims made first, beside the Initial CSS limit in `run-size-limit.mjs` (23.5 → 35.9 kB); this budget was not moved with it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-13 | `totalJsKb`, all 7 routes  | 490.7–507 → 342.2–355.1 kB   | 332.2–344.8 kB | Tightened. Pinned in the initial commit on a build whose env named a Sentry DSN: Sentry's chunk (144 kB gzipped) loads after idle whenever a DSN is set, and CI builds with no env file, so it never loads there — every total allowed ~155–160 kB more than CI loads, loose enough to miss a regression of Sentry's size. PostHog waits for consent, so a cold visit never carries it. Per route: `/`, `/login`, `/accept-invite/$id` 490.7 → 342.2; `/mfa` 492.5 → 344.1; `/unauthorized` 495.3 → 345.4; `/callback/$provider` 507 → 355.1; `/not-found` 491.5 → 343.2 (measured 332.2, 332.2, 332.2, 334.1, 335.3, 344.8, 333.2 with the cookie card of #57 and the sign-in showcase of #58, ~11 kB over the 321.3–333.8 measured before them). `cssKb` and `firstPaintJsKb` keep their pins: `--update` would raise `cssKb` to 36.5 (measured 35.41 — #57 and #58 used up its headroom) and five of the seven `firstPaintJsKb`, which is reported, not asserted, and swings with the load event (`/` measured 239.3–319.8 kB locally and 244.4–251.0 in CI). |
| 2026-10-13 | `totalJsKb`, all 7 routes  | 342.2–355.1 → 304.0–318.9 kB | 295.1–309.6 kB | Tightened, ~37 kB a route. The signed-out header's theme toggle loads its Radix menu (popper, floating-ui, focus management — `ThemeModeMenu`, ~28 kB gzipped) on pointer-enter, focus or press instead of with the page, and the first paint ships as five files instead of 24 (`codeSplitting`'s `boot` group in `vite.config.ts`; −6.5 kB in import/export bindings and cross-module minification). Per route: `/`, `/login`, `/accept-invite/$id` 342.2 → 304.0; `/mfa` 344.1 → 305.8; `/unauthorized` 345.4 → 307.0; `/callback/$provider` 355.1 → 318.9; `/not-found` 343.2 → 304.9 (measured 295.1, 295.1, 295.1, 296.9, 298.1, 309.6, 296.0).                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-13 | `firstPaintJsKb`, 3 routes | 245–276 → 239.9 kB           | 233.0 kB       | Tightened where `--update` lowers it: `/` 275.8, `/unauthorized` 249.5, `/accept-invite/$id` 244.9 → 239.9 (the same five first-paint files on every route now). The other four keep their pins (235.4–238.3), which `--update` would raise to 239.9; the key is reported, not asserted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-13 | `cssKb`, all 7 routes      | 35.4 kB (kept)               | 34.8 kB        | Headroom back by trimming, not re-pinning: the retired base-colour picker's ten `[data-base]` tint blocks left `index.css` (−0.64 kB gzipped; nothing has set the attribute since the theme studio went). `pnpm size`'s Initial CSS limit came down with it (35.9 → 35.7 kB, measured 35.25); `--update` would raise this pin to 35.8, so it stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Lighthouse CI

Category scores and resource budgets for public routes —
[`.lighthouserc.cjs`](../../.lighthouserc.cjs), run weekly by
`.github/workflows/lighthouse.yml` (performance ≥ 0.9 warn, accessibility = 1.0
error, best-practices ≥ 0.95 warn; Lighthouse's default mobile emulation and
simulated throttling, three runs per URL).

### The reports

Every run's report (`lhr-*.json` and `lhr-*.html`) and `assertion-results.json`
upload as the **`lighthouse-results`** artifact of the workflow run. Lighthouse
writes them to `.lighthouseci/`, a dot-folder, and `actions/upload-artifact`
skips hidden files unless the step sets `include-hidden-files: true` — without
it the step found "no files" and the artifact was never created.
`tests/ci/artifact-uploads.policy.test.ts` fails any upload of a hidden path
without the flag. The log also links each URL's median report on temporary
public storage, which expires after a few days.

### A performance score needs an LCP

Lighthouse leaves the performance category empty (score `NaN`, audit error
`NO_LCP`) when Chrome records no Largest Contentful Paint — and Chrome records
none for a paint at opacity 0. The boot splash holds the app at opacity 0
underneath it, and a fade from exactly 0 runs on the compositor without
painting the page again, so every public route reported none until 2026-10-13.
The entering fade now starts one frame in (`index.html`, pinned in
`src/lib/app-splash.test.ts`): its first frame is painted, and LCP lands when
the app appears. A route that reports `NaN` again has content that first paints
at opacity 0 and is never painted again — a fade-in from exactly 0 on its
largest element, or on a wrapper around it.

### A first paint needs a contentful frame too

The splash's mark fades in from opacity 0 the same way, so Chrome never recorded it
as content either: First Contentful Paint waited for the "C" to start drawing, or for
the app. Lighthouse's simulation counts every script that finished before the observed
first paint as blocking it, so the later the paint was observed, the more of the boot it
charged to FCP (3.4 s on main). The mark's first frame is now 2% (`index.html`, pinned in
`src/lib/app-splash.test.ts`) — invisible, the frames' beat unchanged — and FCP lands on
the first paint. The mark is never the largest paint: LCP stays the destination's own
content.

### Where the simulated LCP goes

On main every public route measured ~5.1 s LCP: ~0.45 s of it document, the rest
**render delay** — Lighthouse's breakdown has no image to load. Simulated throttling
(150 ms RTT, 1.6 Mbps, the localhost preview's HTTP/1.1 with six connections) charges
every request that finished before the observed LCP, and the splash's 2,050 ms floor
means that is the whole boot: ~73 requests and ~475 kB on `/login`, so the time is the
bytes and the round trips before the first screen. The 2026-10-13 pass took ~20
requests off the first paint (one `boot` chunk), ~28 kB off every signed-out page (the
theme menu on intent) and 0.6 kB off the stylesheet: locally, with the CPU slowdown
matched to the CI runner's benchmark, `/login` went from 0.63–0.66 to 0.76 (LCP 5.2 → 4.3
s, FCP 4.0 → 2.7 s). What is left is bound by bytes — ~430 kB before the first screen,
fonts 72 kB of it — and the speed index by the splash's floor: on simulated slow 4G the
routes do not reach 0.9 without a smaller boot.

### Best practices

Two misses fixed on 2026-10-13, each a real defect rather than a lab artefact:

- **`inspector-issues`, every route.** Zod 4 probes `new Function('')` while it
  builds an object schema, and the CSP (no `'unsafe-eval'`) blocks it — caught,
  but reported as a violation on every page load. `src/lib/zod-jitless.ts`
  sets `jitless` first, which skips the probe.
- **`errors-in-console`, `/callback/google`.** With no `code`, the callback
  asked `/auth/refresh` even when this browser had never signed in, and the
  browser logs the refusal as a console error. It now asks only when the session
  hint is present (`pages/callback/CallbackPage.tsx`), as the boot does.
