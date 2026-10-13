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

Every raise is itemised here — the budget file is JSON and cannot carry its
reasons. Measured on a CI-equivalent build (no `.env.local`, no ambient
`VITE_*`), pinned with the script's own `headroomPercent`.

| Date       | Budget                | Before → after | Measured | Cause                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | --------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | `cssKb`, all 7 routes | 23.2 → 35.4 kB | 34.33 kB | The clinic launch's stylesheet (`launch-2026-09-30-jxmr`, decision D36): its design as the default look, the shadcn primitives it composes on and the shared clinic layer every room uses — Tailwind emits a source file's classes whether or not the first screen mounts it. Itemised row by row, with the trims made first, beside the Initial CSS limit in `run-size-limit.mjs` (23.5 → 35.9 kB); this budget was not moved with it. |

## Lighthouse CI

Category scores and resource budgets for public routes —
[`.lighthouserc.cjs`](../../.lighthouserc.cjs), run weekly by
`.github/workflows/lighthouse.yml`.
