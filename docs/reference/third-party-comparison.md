# Third-party dependency comparison — clinozy-fe

Verdict summary for major libraries used in this repo. Full stack list: [tools-and-usage.md](./tools-and-usage.md).

## Charts

| Current                         | Size (gzip, approx.)             | Alternatives                           | Verdict                                                                  |
| ------------------------------- | -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| **Recharts** via shadcn `chart` | ~40–60 KB in lazy `charts` chunk | @nivo (~110 KB), visx, Chart.js, uPlot | **REMOVED** (L-63) — the old dashboard was its only user. @nivo removed. |

## Animation

| Current                             | Alternatives                                     | Verdict                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Anime.js + CSS + tw-animate-css** | framer-motion (~39 KB), motion-one, react-spring | **KEEP** — Anime.js for the few JS-driven motions (onboarding steps); overlays use `tw-animate-css`; page fade via custom keyframes. framer-motion not used. |

## Error tracking

| Current                                   | Alternatives                            | Verdict                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@sentry/react** (idle + dynamic import) | Rollbar, Bugsnag, OpenTelemetry browser | **KEEP** — defer init in `main.tsx`; active when `VITE_SENTRY_DSN` is set (dev + prod); replay/profiling on all DSN environments; separate `sentry` chunk. |

## Analytics

| Current                                | Alternatives          | Verdict                                                                                |
| -------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| **posthog-js** (idle + dynamic import) | Plausible, Umami, GA4 | **KEEP** — product analytics via lazy `posthog` chunk (feature-flag provider planned). |

## Routing

| Current                    | Alternatives    | Verdict                                                                                      |
| -------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| **@tanstack/react-router** | React Router v7 | **KEEP** — typed routes, loaders, search params for table state; Sentry tracing integration. |

## Data & forms

| Library               | Alternatives          | Verdict                                                                        |
| --------------------- | --------------------- | ------------------------------------------------------------------------------ |
| @tanstack/react-table | AG Grid, MUI DataGrid | **KEEP** — headless; tablecn-style toolbar in `shared/components/DataTable*/`. |
| react-hook-form + zod | Formik, Final Form    | **KEEP** — split `rhf` + `zod` chunks.                                         |
| zustand               | Redux, Jotai          | **KEEP** — client/session/onboarding only.                                     |
| TanStack Query        | RTK Query, SWR        | **KEEP** — server state.                                                       |

## Skipped (not needed today)

| Library                 | Why skip                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| MSW                     | Not used — **clinozy-be** for dev/E2E; unit tests use `vi.mock()`. |
| nuqs                    | Router search params cover URL-synced tables.                      |
| axios / ky              | Intentional `fetch` client + 401 refresh queue.                    |
| react-i18n              | English-in-code until product requires UI localization.            |
| Storybook               | Heavy; optional for design system later.                           |
| @tanstack/react-virtual | Add when tables exceed ~1k visible rows.                           |

## API in dev and tests

The FE always calls **clinozy-be** over HTTP. Local dev: Vite proxies `/api` → `VITE_DEV_API_URL` (default `:3000`). E2E and manual QA require clinozy-be (`/readyz`). Unit tests stub modules with `vi.mock()` — no HTTP server, no MSW.
