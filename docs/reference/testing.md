# Testing — full matrix (clinozy-fe)

Single reference for **every test kind** in this repo: where it lives, how to run it, and which skill/doc governs it.

## Two layers

| Layer                  | Tool         | Location               | Pattern              | Command               | Server                                   |
| ---------------------- | ------------ | ---------------------- | -------------------- | --------------------- | ---------------------------------------- |
| **Unit / component**   | Vitest + RTL | Colocated under `src/` | `*.test.ts(x)`       | `pnpm test:unit`      | None — `vi.mock()` only                  |
| **Security tripwires** | Vitest       | `tests/security/`      | `*.security.test.ts` | `pnpm test:security`  | None                                     |
| **CI-flow policy**     | Vitest       | `tests/ci/`            | `*.policy.test.ts`   | `pnpm test:ci-policy` | None — reads workflow/config files       |
| **E2E**                | Playwright   | `tests/e2e/`           | `*.e2e.test.ts`      | `pnpm test:e2e`       | **clinozy-be** on `:3000` (**required**) |

**Never** use `.spec.ts` or the words `real`/`live` in test file names.

## Unit tests

- Colocated beside source: `Component.tsx` → `Component.test.tsx`
- jsdom — no browser, no HTTP server
- Stub with `vi.mock()` (API modules, hooks, `dataProvider`, router)
- Reset mocks in `beforeEach` with `vi.resetAllMocks()`, never `vi.clearAllMocks()` (ESLint rejects it): clearing keeps whatever implementation a test installed, so it leaks into every later test. Give each mock its default as `vi.fn(impl)`, because a reset restores that, while a bare `vi.fn()` resets to returning `undefined`
- `renderWithProviders` from `tests/utils/`
- `vitest-axe` required on components (`toHaveNoViolations()`)

Details: `agent-os/rules/fe-testing-requirements.mdc`, `agent-os/skills/fe-test-generation/SKILL.md`.

## E2E tests (Playwright)

All specs live in `tests/e2e/*.e2e.test.ts`. One command: `pnpm test:e2e`.

**Prerequisite:** **clinozy-be** running on `:3000` (`GET /readyz` must succeed). `tests/e2e/global-setup.ts` fails fast if clinozy-be is down — there is no skip path.

### Local run — required env & steps (authoritative)

Run the suites this way; do not improvise other env. **All values live in each repo's
`.env.local`** (the gitignored dev file, `NODE_ENV=local`) — **never** a plain `.env` or an
ad-hoc shell prefix. `pnpm dev` / `pnpm test:e2e` then work with no extra flags. CI does the
equivalent with `NODE_ENV=test`.

**1. clinozy-be `.env.local`** (in the clinozy-be repo) — required to boot against local Docker
Postgres/Redis and to survive a loopback test flood:

| Key                                                           | Value    | Why                                                                                                                                                                                                                   |
| ------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RATE_LIMIT_RELAXED_CAPS`                                     | `true`   | Public-auth routes (`send-code`, login) cap at **5 req/min per IP** when `false` (hardened default) → a loopback E2E flood produces `429 send-code failed` and authenticated flows fail. `true` lifts it to 5000/min. |
| `DATABASE_TLS_ENFORCED`                                       | `false`  | Local Docker Postgres is plaintext; the TLS guard is fail-closed for hosted only (its own message: acceptable for local docker).                                                                                      |
| `DATABASE_RLS_SAFETY_ENFORCED`                                | `false`  | The Docker `core` role is a superuser (BYPASSRLS); the RLS guard is fail-closed for hosted only.                                                                                                                      |
| `PERSONAL_ORGANIZATION_ENABLED` / `TEAM_ORGANIZATION_ENABLED` | per mode | Pick the deployment mode to exercise (see the matrix below). At least one must be `true`.                                                                                                                             |
| `S3_*` (bucket, region, both keys)                            | set      | `patient-photos.e2e.test.ts` uploads real files; the bucket's CORS must admit the origin under test. `pnpm setup:local` fills the keys from `.env.development`.                                                       |

**2. clinozy-fe `.env.local`** (this repo):

| Key                       | Value                      | Why                                                                                                 |
| ------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `VITE_DEV_API_URL`        | `http://localhost:3000`    | Vite proxies `/api` → local clinozy-be.                                                             |
| `VITE_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` | Cloudflare always-pass **test** key (already shipped). Do **not** set `VITE_CAPTCHA_DISABLED=true`. |

**3. Run:**

```bash
# terminal 1 — clinozy-be repo (values above are in its .env.local)
pnpm dev                       # boots on :3000; wait for GET /readyz → 200

# terminal 2 — clinozy-fe repo
pnpm test:e2e                  # full Playwright suite (Chrome) against live clinozy-be
```

The suite boots its own dev server on `:5180`. When clinozy-be's `ALLOWED_ORIGINS` admits only
`:3000` and `:5173` (refresh and writes from `:5180` then answer 403), run it against the dev
server that is already up instead — `E2E_BASE_URL=http://localhost:5173 pnpm test:e2e` skips the
config's `webServer` and re-points the shared storage state (cookie consent answered) at that
origin.

To swap deployment mode: change the two `*_ORGANIZATION_ENABLED` values in clinozy-be's
`.env.local`, restart clinozy-be (env loads once at boot), and re-run. The
`deployment-*.e2e.test.ts` specs auto-skip unless `me/context` matches their required pair.

#### Why these live in `.env.local` — not a shell prefix (agent-friendly)

`RATE_LIMIT_RELAXED_CAPS`, `DATABASE_TLS_ENFORCED`, `DATABASE_RLS_SAFETY_ENFORCED` are
**non-secret local-dev flags** (no keys/tokens), so they belong in `.env.local`, which
the repo owner maintains. Putting them there — instead of prefixing the boot command with
`DATABASE_TLS_ENFORCED=false … pnpm dev` — matters for **agent-run testing**:

- An automated agent's safety classifier **blocks a command that disables named safety guards
  inline** (`*_ENFORCED=false pnpm dev` reads as "disarm TLS/RLS"), and it will **not** self-add
  a permission rule to tunnel around that. So an agent cannot boot clinozy-be by passing those
  flags on the command line, and shouldn't be asked to.
- With the flags already in `.env.local`, the agent (and CI, and you) boot with a **plain
  `pnpm dev`** — no bypass flags in the command, nothing for the classifier to flag, no
  permission prompt. The human/repo owner made the local-safety decision once, in the file;
  the agent just runs the suite.

**Rule of thumb:** local-dev/test toggles that relax a guard go in `.env.local` (never a
plain `.env`, never an ad-hoc shell prefix). Then no one — human or agent —
needs to pass or approve them per run. Note `env-schema.ts` still pins
`RATE_LIMIT_RELAXED_CAPS=false` (and the DB guards enforced) for **production**, so this only
loosens local Docker.

**CAPTCHA (manual dev + E2E):** clinozy-fe mounts invisible Cloudflare Turnstile when `VITE_TURNSTILE_SITE_KEY` is set (`.env.local` ships the always-pass test key `1x00000000000000000000AA`; do **not** set `VITE_CAPTCHA_DISABLED=true`). Pair with clinozy-be `CAPTCHA_PROVIDER=turnstile` and the matching test secret. Auth buttons wait for a Turnstile token before POST (`useTurnstileReady`). `global-setup` probes clinozy-be and caches working auth headers for E2E (typically `X-Captcha-Bypass: true` in local/test `NODE_ENV`).

| Spec                                          | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.e2e.test.ts`                            | Login UI, redirects, auth flows                                                                                                                                                                                                                                                                                                                                                                                                      |
| `auth-api.e2e.test.ts`                        | Auth HTTP contracts (`playwright.request` → `:3000`)                                                                                                                                                                                                                                                                                                                                                                                 |
| `session-api.e2e.test.ts`                     | Session API contracts                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tenancy-api.e2e.test.ts`                     | Tenancy API contracts                                                                                                                                                                                                                                                                                                                                                                                                                |
| `billing-api.e2e.test.ts`                     | Billing API contracts                                                                                                                                                                                                                                                                                                                                                                                                                |
| `deployment-personal-only.e2e.test.ts`        | Personal-only deployment (`TEAM_ORGANIZATION_ENABLED=false`)                                                                                                                                                                                                                                                                                                                                                                         |
| `deployment-team-only.e2e.test.ts`            | Team-only deployment (`PERSONAL_ORGANIZATION_ENABLED=false`)                                                                                                                                                                                                                                                                                                                                                                         |
| `deployment-personal-and-team.e2e.test.ts`    | Dual deployment (both flags true — default local)                                                                                                                                                                                                                                                                                                                                                                                    |
| `home.e2e.test.ts`, `settings.e2e.test.ts`, … | UI flows through the browser                                                                                                                                                                                                                                                                                                                                                                                                         |
| `routes-integration.e2e.test.ts`              | Full live route matrix (public + auth + journey)                                                                                                                                                                                                                                                                                                                                                                                     |
| `org-switching.e2e.test.ts`                   | Account menu › Switch clinic: clinic ↔ clinic, and personal ↔ team where personal workspaces exist                                                                                                                                                                                                                                                                                                                                   |
| `invitations.e2e.test.ts`                     | Invitations for the person signing in (D84): invited into no clinic → the picker lists the invitation, Accept in the app → profile-only onboarding → the clinic; Decline (confirmed) → onboarding, and the inviter's in-app notice; already in a clinic → the avatar's count and Switch clinic's Invited row → the picker. Skips where the local Free plan has no seat to invite with (`seat_limit_reached`)                         |
| `session-timeout.e2e.test.ts`                 | Idle sign-out under a **virtual clock** (`page.clock`): the warning's Sign out (real `mouse.down()`…`up()`, and the keyboard), the 90 s deadline, and Stay signed in — each sign-out proven to stay signed out after a fresh load                                                                                                                                                                                                    |
| `boot-splash.e2e.test.ts`                     | Cold load is one continuous screen: the splash fades **exactly once** and the page is **never blank** behind it (`/auth/refresh` held open 1.5 s so the invariant bites on localhost)                                                                                                                                                                                                                                                |
| `consent-card.e2e.test.ts`                    | The cookie card (claude.com's model): Customize · Reject all · Accept all, the Customize categories, Escape rejects, "Privacy choices" reopens it, Global Privacy Control never asked, an old-policy answer asked again, **signing out keeps the answer**; placement — bottom-start corner, ≤ 456px, RTL mirror, one-row buttons on phones, rides above the mobile tab bar (runs with an _undecided_ storage state)                  |
| `app-rooms.e2e.test.ts`                       | Launch smoke (L-55): each of the eleven clinic rooms on a new clinic, at desktop (1440) and phone (375) — opened from the shell (pinned tab, or All sections / the tab bar's More) and one happy path each (Check in on Today; a record or a New drawer and its dialog-route URL elsewhere; the patient file from Patients)                                                                                                          |
| `app-writes.e2e.test.ts`                      | Write flows (#78): on a new clinic, each room's create drawer (offerings, stock, tasks, patients, leads, Receive, New appointment) and Today's check-in save on clinozy-be, the room lists the record, and a full reload still does — desktop only; Users' save is `org-lifecycle.e2e.test.ts`, Medical is parked                                                                                                                    |
| `app-roles.e2e.test.ts`                       | Role QA (L-60, D157): a new clinic with one branch and one patient, walked as Front desk, Doctor, Accountant and Marketing through the owner's View-as — each role's home, the rooms that open and the ones that send it to its first viewable room, the New / Receive controls by code, and the patient file's Prescriptions section (`patient_prescription:read`, else Timeline). View-as because a local Free plan holds one seat |
| `app-dialog-routes.e2e.test.ts`               | Dialog-route deep links (`S:115`): create routes open their drawer over their page on a cold load; record routes reopen after a reload; an unknown id stays on its page with "<Record> not found · it may have been deleted"; an unknown in-clinic path goes to the role home with "Page not found"                                                                                                                                  |
| `patient-photos.e2e.test.ts`                  | Patient photos: on a new clinic, four photos picked through "Choose photos" upload and are filed on the patient; Select → Compare opens them side by side on `?compare=`; Linked zooms every photo from where it stands, Separate one at a time; a cold load of the same photos in another order reopens it as left — needs object storage (step 1)                                                                                  |

**Deployment-mode matrix:** `deployment-personal-only.e2e.test.ts`, `deployment-team-only.e2e.test.ts`, and `deployment-personal-and-team.e2e.test.ts` each probe the live deployment and **skip** unless clinozy-be matches the required env pair. me/context no longer carries the flags, so the probe (`probeLiveDeployment`) reads them from a fresh account — a personal workspace only where personal organizations are on — and assumes team organizations on (personal-only is not detected). Restart clinozy-be with the matching `PERSONAL_ORGANIZATION_ENABLED` / `TEAM_ORGANIZATION_ENABLED` values to exercise personal-only or team-only locally; default dev (both `true`) runs the dual suite only.

**Local:** Vite serves the FE on `:5173` and proxies `/api` → `http://localhost:3000`. Start clinozy-be, then `pnpm test:e2e`.

**CI:** none — E2E is **local-only**. No workflow boots postgres/redis/clinozy-be (see `pr-ci.yml` header note); run the suite locally against clinozy-be on `:3000`.

**Naming:** UI flows → `<feature>.e2e.test.ts`; HTTP contract suites → `<feature>-api.e2e.test.ts`.

Hybrid selectors: `data-testid` for actions, `getByRole`/`getByLabel` for a11y — `agent-os/skills/fe-playwright-e2e/SKILL.md`, `tests/utils/e2e-hybrid.ts`.

Helpers: `tests/utils/e2e-auth.ts`, `tests/utils/axe-for-dialog.ts`.

## Security specs (Vitest)

| Spec                                       | Focus                              |
| ------------------------------------------ | ---------------------------------- |
| `token-storage.security.test.ts`           | Tokens not in localStorage         |
| `token-egress.security.test.ts`            | Tokens never leave via URL/logs    |
| `static-security-config.security.test.ts`  | CSP / security headers config      |
| `route-access-matrix.security.test.ts`     | Route permission matrix            |
| `settings-access-matrix.security.test.ts`  | Settings-section permission matrix |
| `cross-tenant-query-keys.security.test.ts` | Query keys scoped per organization |
| `redirect-safety.security.test.ts`         | Safe post-auth redirect targets    |
| `xss-sinks.security.test.ts`               | Dangerous sink patterns            |

## Commands

| Command                                   | What runs                                               |
| ----------------------------------------- | ------------------------------------------------------- |
| `pnpm test`                               | Vitest all projects — unit + security + ci-policy       |
| `pnpm test:unit`                          | Colocated `src/**/*.test.*` only                        |
| `pnpm test:security`                      | `tests/security/`                                       |
| `pnpm test:e2e`                           | All Playwright specs in `tests/e2e/`                    |
| `pnpm test:e2e:integration`               | Routes integration + org-switching only                 |
| `pnpm test:e2e:integration:cross-browser` | Same, on Chromium + Firefox + WebKit (live clinozy-be)  |
| `pnpm test:visual`                        | Screenshot regression (`visual.e2e.test.ts`)            |
| `pnpm coverage:patch`                     | Changed-lines ≥ 90% (PR CI)                             |
| `pnpm test:select [--why\|--run]`         | The Vitest files a change can affect, and why           |
| `pnpm test:affected [--base <ref>]`       | What `git push` will run, and the tests picked, and why |

Contract drift (scheduled CI): `pnpm contracts:drift` vs `clinozy-be/docs/routes.txt`.

## Test selection (`pnpm test:select`)

`tooling/ci/test-selection.mjs` names the Vitest files a set of changed files can affect (changes
since the merge base with `origin/main` plus the working tree, or `--files a,b`). A test is selected
when its imports reach a changed file (static and dynamic `import`, `vi.mock`, `import.meta.glob`),
when it mentions the changed path (the `tests/ci` policy tests that read files), or when it is the
changed test itself. Pages never import pages, so a page change stays inside its section. A file
name alone counts as a mention only when no other file has it and it is not part of a longer name.
Any `src/` change also runs `tests/security/`, every test that imports nothing from the repository,
and every test no single change selects (it builds its paths at run time — 2 today).

It runs everything for the escalation list — dependencies, `tsconfig`, the Vitest and Vite config
and the plugins they load, `src/locales/`, and the test setup (`tests/utils/setup.ts`) with
everything it imports (i18n, `shared/api`, auth, the stores: every test runs through it) — and fails
closed: a path outside the known roots, a deleted file nothing imports, or any error selects
everything. `--why` lists each test's reason, `--json` the whole selection, `--run` runs it (`pnpm
test` when everything is selected), `--changed-only` drops the always-run set, `--exclude <glob>`
leaves tests out. The pre-push hook still runs the whole suite; the selector feeds the faster
signals built on it. Its rules are pinned by `tooling/ci/test-selection.test.mjs` (`pnpm
test:github-scripts`), which also pins its project list to `vitest.config.ts`.

**Fixtures.** `pnpm agent-os:check` holds the selector to its fixtures
(`tooling/ci/selector-fixtures.check.mjs`): one generated per route island — a change to its main
file selects its own test and no test in another section (a top-level page, or an organization
room; a layout wires its own children, so siblings inside a section may reach each other) — 105
today; one file of each escalating kind running everything; the misses recorded in
`tooling/ci/selector-fixtures.json`; and the unreachable tests always run.

**Selector misses.** When a PR's merged unit shards fail, the `Unit + global` job's `Selector miss
check` step (not a gate) lists every failed file `pnpm test:select` would have skipped for the PR's
changes — a selector miss, or a flake — as a warning, in the job summary, and as a fixture line for
`tooling/ci/selector-fixtures.json`, which the selection must satisfy from then on. `pnpm
test:selector-misses --base <ref> --results <dir of Vitest JSON reports>` runs it locally.

## Mutation testing (Stryker, weekly)

Stryker mutates the pure runtime logic and checks that its tests notice. CI:
`.github/workflows/mutation-test.yml`, Mondays 05:00 UTC and `workflow_dispatch` — a report, never a
merge gate. Config: `stryker.config.json`, pinned on the PR gate by
`tests/ci/mutation-config.policy.test.ts`.

| Setting            | Value                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `mutate`           | rbac, `env.ts`, the data provider, the app guards, `shared/auth`, `shared/tenancy`, `lib/routes`, `csv.ts`, `utils.ts` (`.ts` only) |
| `testFiles`        | the `*.test.*` files of those folders + `tests/security/` — a module's own tests must kill its mutants                              |
| `thresholds.break` | 70 — the run fails below a 70% score; never lowered                                                                                 |
| `testRunner`       | `vitest-shim` (`tooling/stryker/vitest-runner-shim.mjs`) — the upstream runner plus its two missing Vitest 5 fixes                  |
| `ignorePatterns`   | agent tooling (`.claude`, `.cursor`, `.mcp.json`, `agent-os`), docs, design intakes, build output                                   |

Why each of those exists:

- **`.mcp.json` ignored.** It is a tracked symlink to a gitignored file, so it dangles on a fresh
  checkout and Stryker's sandbox copy failed with `ENOENT`. The policy test fails on any dangling
  symlink left out of `ignorePatterns`.
- **`testFiles`.** Without it the initial run takes every suite Vitest's `related` mode links to a
  mutated file — `cn` (`lib/utils.ts`) and the auth/tenancy runtime are imported by nearly every
  component — and Stryker's Vitest runner runs them on **one** thread, so it outgrew its 15-minute
  limit. Scoped, it is 71 test files.
- **The runner shim.** On Vitest 5 the runner's per-test filter matches nothing
  ([stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210)), so every covered
  mutant ran zero tests and survived; and with `testFiles` a static mutant was activated after its
  module had loaded ([#6144](https://github.com/stryker-mutator/stryker-js/issues/6144)). Delete the
  shim once a runner release fixes both.

Measured on `ubuntu-latest` (2026-10-13): 58 files, 1,894 mutants (1,602 scored, the rest are the
excluded string/regex/template mutators), initial run ≈ 3 minutes, whole run 26 m 38 s, score
**76.09%**. The 48 static mutants are about half of that time, because each reloads and reruns its
module's tests. The job limit is 60 minutes and the initial-run limit 15.

Run it locally — Stryker is installed ad hoc, as in CI, and never lands in the lockfile:

```bash
pnpm add -D @stryker-mutator/core@10.0.0 @stryker-mutator/vitest-runner@10.0.0
pnpm exec stryker run                                                   # the whole lane
pnpm exec stryker run --mutate src/lib/csv.ts --testFiles 'src/lib/csv*.test.ts'  # one module
git checkout -- package.json pnpm-lock.yaml && pnpm install --frozen-lockfile
```

The report is `reports/mutation/mutation-report.html` (the CI run uploads it as `stryker-report`).

## Cross-browser smoke (production build)

Playwright runs **Chromium, Firefox, and WebKit** against `pnpm preview` (static shell — no clinozy-be):

```bash
pnpm build && pnpm test:cross-browser
```

Covers login shell, PWA manifest assets, version-update toast, and toast dismiss.  
CI: `.github/workflows/cross-browser.yml` (weekly).

## Cross-browser live integration (clinozy-be required)

**Chromium, Firefox, and WebKit** against the live FE ↔ BE stack (`routes-integration` + `org-switching`):

```bash
# clinozy-be on :3000, DATABASE_URL for email codes
pnpm build   # CI uses preview; local dev can use `pnpm dev` via config reuseExistingServer
DATABASE_URL=postgresql://clinozy:clinozy@localhost:5432/clinozy pnpm test:e2e:integration:cross-browser
```

CI: none — live FE ↔ BE integration runs are local-only (CI never boots clinozy-be).  
Details: **`docs/reference/cross-browser-support.md`**.

## Local production performance

Measure bundle size and Lighthouse on a **production build**, not `pnpm dev`.

```bash
pnpm build
pnpm preview --port 5173 --strictPort   # canonical — same as .lighthouserc.cjs
pnpm size                               # gzip budgets on dist/
```

Static `npx serve dist -s -l 5173` works for manual Lighthouse; prefer `pnpm preview`
when matching CI. Full workflow: **`docs/reference/local-production-perf.md`**.
