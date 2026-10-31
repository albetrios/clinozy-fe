# HTTP, environment, new deployments and the PWA — clinozy-fe

Claude Code loads this file when it works in `src/core/`. It holds sections moved out of the root [`CLAUDE.md`](../../CLAUDE.md), which keeps a pointer to each; the root rules apply here too.

## HTTP / API

- Use `apiClient` from `@/core/http/fetch-client.ts` for all API calls.
- Exception: the auth service uses raw `fetch` (`authFetch`) to avoid interceptor recursion.
- ESLint bans a raw `fetch` (and `window`/`globalThis`/`self.fetch`) in `src/`. Six files are
  exempt: the client itself, the two `authFetch`s (`shared/auth/service.ts`,
  `shared/api/auth-api.ts`), the breach check (`lib/password-breach.ts`), the service worker
  and the `version.json` poll. `tests/ci/eslint-raw-fetch.policy.test.ts` pins the rule and
  fails when an exempt file stops calling `fetch`.
- The fetch client is the reactive auth layer: Bearer attach, single-flight 401 refresh
  (concurrent 401s share ONE refresh) + replay. clinozy-be keeps ONE live access token per
  session — every refresh, workspace switch or other tab's refresh retires the one before it —
  so a 401 for a token replaced while the request was in flight is replayed with the current
  token, no new refresh — unless that token names **another organization** (a workspace switch):
  no replay or retry ever goes out with another clinic's token, the request fails 401 instead;
  a refresh that waited for the lock while a newer token arrived does
  not rotate again. Only a refused refresh, or a token still rejected after two refreshes,
  means the session is dead → `forceLogout()`. The session's one token names the organization
  it was last switched to, so a refresh answering for **another** organization than this tab's
  `me/context` (another tab switched) switches the tab back before any request carries it —
  never another clinic's records under this tab's screen. A switch waits for a refresh in
  flight. A boot that got no answer (refresh or `me/context` offline, 429, 5xx) is asked again
  by the next guard, not settled as signed out. Writes auto-carry an `X-Idempotency-Key`
  (minted once per logical request, reused across retries/replay). One **write hold**
  (`setWriteHold`) may keep a write from leaving — a `403` whose `error.reason` is the hold's;
  the View-as preview holds the clinic's writes that way (`startViewAsWriteHold`, `useUIStore`),
  because they would go out as the signed-in member. Organization context:
  the **app URL** drives the active org — guards sync it via `/auth/switch-to-organization`,
  which re-mints the access token with a signed `org` claim. API requests carry **no**
  org header (`X-Organization-ID` does not exist) and no org id path segment; the backend
  scopes from the token claim.

## Environment Variables

Two **deploy** environments — **development** and **production** — each configured in its
own gitignored file, plus a **`local`** developer environment (`.env.local`, the default —
mirroring clinozy-be's `NODE_ENV=local`). **One `.env.<environment>` file per environment.**
`.env.example` is the **only committed** file. Deploys inject env from **GitHub
Environments** (never from files). No shared `.env`, no `.env.staging`. `pnpm setup:local`
scaffolds `.env.local`; `pnpm dev` loads it.

The **environment identity is an env variable, not the Vite mode**: `VITE_APP_ENV` is exactly
`local | development | production` — three environments, no `test` (an out-of-enum value fails
loudly at load in `env.config.ts`), and the **default is `local`** — mirroring clinozy-be's
`NODE_ENV=local` so both repos share one env vocabulary. It is decoupled from Vite's `mode`
because **Vite 8 forbids a mode literally named `local`**; Vite's mode is a mechanism detail
(dev → `dev-server`, build → `production`, Vitest → its default `test` mode). The dev server
never runs in Vite's default `development` mode, where `.env.development` would load on top of
`.env.local`: `pnpm dev` passes `--mode dev-server`, and `vite.config.ts` refuses any other
mode. A build is mode `production`; in a terminal `pnpm build` asks which `.env.<environment>` to
build with and reads that file alone (`--env <environment>` skips the question). Unasked —
pipes, scripts, `pnpm health` — it reads `.env.local` alone, clinozy-be's `local` default; only
CI (no `.env.local`) keeps Vite's default files. `pnpm build --defaults` reads no env file and
drops the shell's `VITE_*` — the schema defaults, as CI's Build verify lane builds; the pre-push
hook builds that way, so its bundle-size budget measures the bundle CI measures. Unlike clinozy-be,
`.env.local` is never layered over a deploy environment's file: a build ships what it reads.
`local` is not a deploy target (`DeployEnvironment` stays `development | production`,
while `AppEnvironment` adds `local` for its load-time contract). A **test run is not its own
environment** — it reports
`local` and is marked by the **`VITE_TEST_MODE`** env variable (injected by `plugins/test-env.ts`,
read via `platformConfig.testMode`), the single home for any test-only behavior. Vite loads
`.env.local` in every mode, so the Vitest runner's `envDir` is pointed at an empty dir
(`tooling/test/empty-env/`) to keep the suite hermetic.

```text
.env.example         # Reference for all env vars — the ONLY committed file
.env.local           # Local dev file (gitignored, NODE_ENV=local — the default): flags + secrets
.env.development     # `development` deploy-env file (gitignored): dev-tooling ON
.env.production      # `production` deploy-env file (gitignored): dev-tooling OFF (prod-safe)
```

- `VITE_` prefix = bundled into the client (public). No prefix = build-time only.
- Secrets go in GitHub Environments (deploy) or the gitignored `.env.local` (local) —
  never committed. A guardrail blocks agent edits to `.env*` (apply them yourself).
- **Behavior is env-driven, never mode-sniffed.** No `import.meta.env.DEV/PROD/MODE`
  **and no `platformConfig.environment === '<name>'`** branching in app code — named
  schema flags drive it: `VITE_DEBUG_LOGGING`, `VITE_DEVTOOLS`, `VITE_E2E_HOOKS`,
  `VITE_VERSION_CHECK`, `VITE_CAPTCHA_DISABLED` → read via `platformConfig`. `environment`
  is only ever a reported value (Sentry/PostHog tag). The three allowlisted raw readers
  (`tooling/validate/vite-env-reads.mjs`) are the config bootstrap (`env.config.ts`),
  `src/lib/i18n/build-env.ts`, and `src/core/version/check.ts` (only the Vite builtin
  `BASE_URL` — a build constant, not a mode sniff).
- **One behavior = one env variable.** Each behavior is owned by **exactly one** key, and
  `platformConfig` reads that key **1:1** — no umbrella, alias, or `VITE_DEVTOOLS || <other>`
  derived-from-another-flag logic. Never add a second variable that also drives a behavior
  another key already owns: two keys for one thing means ambiguous precedence (one value
  silently ignored) and two sources of truth. To move several flags together for a context
  (the test runner, a given deploy), set **each one's own key** at the **env layer** —
  `plugins/test-env.ts`, `.env.<environment>`, GitHub Environments — never by combining them
  in code. Conditions live in env; code stays 1:1.
- **Strict allowed values per environment.** `envProfiles.<env>.allowed` in `env-schema.ts`
  declares the permitted value set per key; `pnpm validate:client-env` **hard-fails** on
  a value out of range (e.g. production requires the diagnostics flags off, version-check on).
- **Per-environment defaults.** `envProfiles.<env>.defaults` in `env-schema.ts` is the single
  source of truth for each environment's starting values (local + development: dev-tooling on;
  production: safe). `pnpm setup:local` writes `envProfiles.local.defaults` into `.env.local`
  (via `injectEnvDefaults`); every default must be ⊆ that key's `allowed` (test-enforced). NOT
  applied by the runtime — defaults reach the app through the env layer, never a mode branch.
- **Tests are hermetic by construction — two halves, both required.** (1) The Vitest `envDir`
  points at an empty dir (`tooling/test/empty-env/`), so the runner (in `local` mode) loads no
  env **files** — not even `.env.local`, which Vite otherwise loads in every mode. (2)
  `plugins/test-env.ts` **strips ambient `VITE_*` from `process.env`** in its `config()` hook,
  because Vite's `loadEnv` copies every prefix-matching key out of `process.env` on a path
  `envDir` does not touch — so an exported shell variable (a cloud dev container, a developer's
  `export`) would otherwise re-point `import.meta.env` and the suite would silently stop testing
  schema defaults. It is unconditional and has no opt-out: `VITE_X=y pnpm test` is ignored (and
  logged), so change the schema default or the test, not the shell. Together they keep the suite
  on schema defaults on every machine and on CI; pinned by `tests/ci/env-hermetic.policy.test.ts`.
  Genuine test-runner env needs are injected by plugins, not app code or a manual pin:
  `plugins/i18n-build.ts` (multi-locale) and `plugins/test-env.ts` (`VITE_TEST_MODE` on,
  captcha off).
- **Where to get credentials and optional env:** docs/integrations/credentials-and-env.md

## New-deployment detection

- **Plugin** `plugins/version-json.ts`: at build time sets `VITE_APP_BUILD_ID` and writes/serves `version.json` (dev: middleware; prod: `dist/version.json`). `builtAt` is UTC (ISO 8601).
- **Runtime** `src/core/version/check.ts`: polls `/version.json` (every 5 min while visible + on tab refocus); if `buildId` differs from the app’s build, shows a persistent **“Update available”** toast with **Refresh now** (`app/version/show-update-available-toast.ts`) and **defers** `location.reload()` until it won’t lose work — never while a field is focused, immediately when the tab is hidden, otherwise once the user is idle (~60s) — at most **once per advertised buildId** (sessionStorage marker). The reload is **handed through the service worker** (pre-warmed `update()` at detection; `SKIP_WAITING` → `controllerchange` → reload, 10s deadline fallback) so it lands on the NEW precached shell — `src/sw.ts` activation is deliberately message-driven, never an unconditional `skipWaiting()`.
- **Critical updates skip the wait.** `MINIMUM_SUPPORTED_VERSION` (`src/core/version/minimum-version.constants.ts`, `null` unless a release is critical) is written into `version.json` as `minimumVersion` — only by a build that meets it — next to `version` (`VITE_APP_VERSION`). A tab whose own version is below it (and only when it is sure: unknown or malformed → the ordinary path) shows the non-dismissible **“Update required”** notice pill (`app/version/CriticalUpdateNotice.tsx`; the root mounts only `CriticalUpdateNoticeLazy`), counts down 60 s and reloads **even over a focused field** (dirty drawers/Settings/onboarding keep the browser's leave prompt); boot splash or hidden tab → reload at once; offline at the deadline → waits for `online`. To mark a release critical set the floor to the **patch bump of the current release** in the fix PR (`docs/process/release-versioning.md` → Critical releases; `tests/ci/minimum-version.policy.test.ts` rejects anything higher). The running app never imports the constant — only the deployed `version.json` counts.
- **Stale chunks are the second path** `src/core/version/stale-chunk-recovery.ts`: a tab open across a deploy still `import()`s the old hashed chunks, and Vite raises `vite:preloadError`. That event is **not** a stale-chunk signal by itself — offline, a flaky CDN and the cosmetic prefetches (`initDeferredIconSets`, `preloadBootRoutes`) raise it too — so the handler first asks `version.json` whether a **different `buildId`** is advertised (`isNewBuildAdvertised()`), and only then runs the same `reloadOntoLatestBuild()`: once per `buildId`, under its OWN sessionStorage key, never over a focused field. It never calls `preventDefault()` — Vite's helper is `import().catch(dispatch)`, so suppressing the rethrow would make the import **resolve with `undefined`** and the caller report a misleading `TypeError`. `netlify.toml` also answers a missing `/assets/*` with a real **404** instead of the SPA `index.html` rewrite (whose 200 surfaces as a bogus MIME-type error), but recovery does not depend on it. Both reload paths share `reload-marker.ts` and `lib/editable-focus.ts`; `pnpm build` ends with `strip-sourcemaps`, which deletes every `.map` the build emitted **after** the Sentry plugin has uploaded them — `build.sourcemap: 'hidden'` writes 145 of them and the plugin only removed `dist/assets/*` and only when `SENTRY_AUTH_TOKEN` was set, so a deploy without that secret published the lot. `pnpm build:check` independently fails on any map left anywhere under `dist/`.

## PWA manifest and icons

- **Source of truth:** `src/core/config/app-manifest.ts` → `public/manifest.webmanifest` (drift test: `app-manifest.test.ts`).
- **Icons:** `public/app-icon.svg` (the product mark — `ProductMark` — on its `#18181b` tile); PNGs via `rsvg-convert`. Skill: `agent-os/skills/fe-pwa-manifest/SKILL.md`.
- **Local perf audit:** `pnpm build && pnpm preview` — see `docs/reference/local-production-perf.md` (never Lighthouse on dev server).
- **Service worker navigations** (`src/sw.ts`): network first; a failed fetch gets the **precached app shell**, which owns the offline UX (splash offline hold, `OfflineIndicator`) — never a blanket offline page, since DNS/TLS failures reject while online. `offline.html` is the last resort. Read precached files with `matchPrecache`, never `caches.match` (revisioned keys). Emergency removal is `selfDestroying: true` in `VitePWA`, never deleting the worker — `docs/reference/frontend-platform.md` → Service worker emergency reset.
