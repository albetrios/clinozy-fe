# Runbook: environment variables (clinozy-fe)

Canonical reference for every workflow that touches environment variables in
**clinozy-fe** — local bootstrap, Netlify/GitHub sync, adding keys, and troubleshooting.

Related: [`docs/integrations/credentials-and-env.md`](../../integrations/credentials-and-env.md),
[`docs/reference/frontend-platform.md`](../../reference/frontend-platform.md).

## TL;DR

| What                                  | Command                                           |
| ------------------------------------- | ------------------------------------------------- |
| Verify schema ↔ `.env.example` parity | `pnpm tool:sync-env-example`                      |
| Auto-append missing keys to template  | `pnpm tool:sync-env-example --fix`                |
| Pre-commit / CI parity gate           | `pnpm validate:env-example`                       |
| Bootstrap local env files             | `pnpm github:sync`                                |
| Verify GitHub Environment secrets     | `CONFIG=<env> pnpm validate:deploy-env`           |
| Add a new env var (skill)             | read `agent-os/skills/fe-env-schema-add/SKILL.md` |

## 1. Mental model

**One schema** declares which keys exist and how they validate:

```text
src/core/config/env-schema.ts   ← Zod + envSchemaKeys
  │
  ├── src/core/config/env.config.ts      ← getClientEnv(), runtime resolution
  ├── src/core/config/platform-config.ts ← auth, modules, deployment flags
  └── .env.example (committed)           ← operator template
```

### Three env classes (FE)

| Class               | Prefix     | Read where                                         | Examples                                  |
| ------------------- | ---------- | -------------------------------------------------- | ----------------------------------------- |
| **Build-time**      | `BUILD_*`  | Vite plugins / `vite.config.ts` only               | `BUILD_I18N_MODE`, `BUILD_I18N_LOCALE`    |
| **Runtime public**  | `VITE_*`   | Client bundle; overridable via `window.__CONFIG__` | `VITE_AUTH_*`, `VITE_DISABLED_MODULES`    |
| **Runtime private** | no `VITE_` | CI / build scripts only                            | `SENTRY_AUTH_TOKEN`, `NETLIFY_AUTH_TOKEN` |

**Client resolution order:** `window.__CONFIG__[key]` → `import.meta.env.VITE_${key}` → Zod default.

### Which env files each command reads

Vite loads `.env`, `.env.local`, `.env.<mode>` and `.env.<mode>.local` from the project root, the
later file winning key by key, and a variable already in the shell beats every file. `.env.local`
loads in every mode, so the mode decides whether a deploy-env file lands on top of it:

| Command                                    | Vite mode    | Env files read                                                                                                                       |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                                 | `dev-server` | `.env.local` only — no file is named after this mode                                                                                 |
| `pnpm build` in a terminal                 | `production` | asks which environment, listing every `.env.local` / `.env.development` / `.env.production` present; reads the chosen file **alone** |
| `pnpm build --env <environment>`           | `production` | `.env.<environment>` alone, no question (`BUILD_ENVIRONMENT=<environment>` from the shell does the same)                             |
| `pnpm build` in a pipe, a script or a hook | `production` | not asked: `.env.local` alone — the `local` default, as in clinozy-be                                                                |
| `pnpm build` in CI (no `.env.local`)       | `production` | Vite's own files, unchanged: the deploy's materialized `.env.production.local`                                                       |
| `pnpm test` (Vitest)                       | `test`       | none — `envDir` is the empty `tooling/test/empty-env/`                                                                               |

**External credentials in `.env.local`.** `envProfiles.local.externalCredentials` in
`env-schema.ts` lists the third-party integration keys whose development value is also right on
localhost — today `VITE_STRIPE_PUBLISHABLE_KEY` (test mode; development forbids `pk_live_`),
`VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`. `pnpm setup:local` fills each into `.env.local` from
`.env.development` when that file sets it, else from the process environment (a cloud session's
Variables, an exported shell variable): into a new file, and on later runs wherever the key is
missing or blank — never overwriting a value already set, and printing key names and sources
only. A key no source sets is named as a warning, for you to fill by hand. Keys whose local value differs on purpose stay off the list: the API base and app
environment, the Sentry DSN, and the Turnstile site key (bound to its domains). Add a key there
when a new integration's development value works locally as-is.

The dev server never runs in Vite's default `development` mode: there `.env.development` — the
development deploy-env file `pnpm github:sync` pushes from — would override `.env.local`, and a
local dev server would call the hosted API. `vite.config.ts` refuses to serve in any other mode
(`plugins/dev-server-mode.ts`, pinned by `tests/ci/dev-server-env.policy.test.ts`), so start the
dev server with `pnpm dev`, never a bare `vite`. To point local dev at a hosted API on purpose,
set `VITE_API_BASE_URL` in `.env.local` or the shell.

A build is always mode `production`, so left to itself Vite mixes `.env.local` and `.env.production`
key by key. A build therefore reads **one** env file (`plugins/build-environment.ts`, pinned by
`tests/ci/build-environment.policy.test.ts`): in a terminal, `pnpm build` (`tooling/ci/build.mjs`)
asks which environment whenever an env file is present and passes the answer as
`BUILD_ENVIRONMENT`; when nothing chose one — a pipe, a script, `pnpm health`, the pre-push hook —
it reads `.env.local`, the same `local` default clinozy-be takes for an unset `NODE_ENV`. A shell
variable still beats the file. Only where there is no `.env.local` (CI, deploys) do Vite's own
files load, exactly as before. `pnpm build:bundle` is the bare chain (`tsc -b`, `vite build`,
`strip-sourcemaps`) for callers that must never stop to ask.

One deliberate difference from clinozy-be: clinozy-be lays `.env.local` over a deploy
environment's file as a machine-local override (safe there — `.env.local` never exists in a
deployed container). A FE build bakes its env into the bundle that ships, so a chosen
environment's file is read alone and `.env.local` never rides along.
`deploy:netlify:prod` builds with `--env production`. Source maps go to Sentry only when a build
asks — the deploy workflow's `SENTRY_UPLOAD_SOURCEMAPS=true`, or `pnpm build --sentry` — never
because an env file holds `SENTRY_AUTH_TOKEN` ([sentry-sourcemaps.md](../../integrations/sentry-sourcemaps.md)).

**Not env:** live session and organization context from **`GET /auth/me/context`**.

**Also not fetched at boot:** login auth surface (OAuth buttons, email OTP, passkey). Set matching `VITE_AUTH_*` on clinozy-fe and credential env on clinozy-be — no `GET /auth/oauth/providers`.

### `.env.example` halves

Two top-level banners mirror GitHub Secret vs Variable classification:

```text
# ### GitHub Secrets ###     → gh secret set / Netlify sensitive
# ### GitHub Variables ###   → gh variables / public knobs
```

`pnpm github:sync` classifies each key by the **allowlist** in
[`tooling/setup/setup.config.json`](../../../tooling/setup/setup.config.json): `deploySecrets`
(pushed as GitHub Secrets, `secrets.*`) and `deployVariables` (managed as GitHub Variables,
`vars.*`), aligned to how the deploy workflow reads each key. The `.env.example` half a key
sits under is documentation; the allowlist is the authority. Secrets are always pushed;
variables are diffed (pushed only when missing/changed) and pruned when equal to the runtime
schema default — see [`.github/environments/README.md`](../../../.github/environments/README.md)
and the generated [`env-catalog.md`](../../reference/env-catalog.md).

## 2. Platform switches

### Environment identity (`VITE_APP_ENV`)

`VITE_APP_ENV` is the **environment vocabulary** — exactly `local` (default) |
`development` | `production`, decoupled from Vite's `mode` (Vite 8 forbids a mode
named `local`). It is **reported-only** (the Sentry environment tag and PostHog
super-property) and never branched on; an out-of-enum value fails loudly at load
(`env.config.ts`). The deploy workflows derive it from the resolved GitHub
Environment name and both deploy profiles **require** it
(`envProfiles.<env>.required`), so a deployed bundle can never silently fall back
to `local`. Locally, `pnpm setup:local` writes `VITE_APP_ENV=local` into
`.env.local`.

### Auth — per-method booleans (`VITE_AUTH_*`)

| Surface           | Env switch                    | Default |
| ----------------- | ----------------------------- | ------- |
| Email OTP         | `VITE_AUTH_EMAIL`             | on      |
| OAuth Google      | `VITE_AUTH_OAUTH_GOOGLE`      | on      |
| OAuth GitHub      | `VITE_AUTH_OAUTH_GITHUB`      | on      |
| OAuth Apple       | `VITE_AUTH_OAUTH_APPLE`       | off     |
| Passkey           | `VITE_AUTH_PASSKEY`           | on      |
| Auto-start Google | `VITE_AUTH_OAUTH_AUTO_GOOGLE` | off     |

**Not** in `VITE_DISABLED_MODULES`. Monolithic `VITE_AUTH_OAUTH` is removed — use per-provider flags.

### Feature modules — disable list (`VITE_DISABLED_MODULES`)

Comma-separated **product module keys** (e.g. `billing,members`). Disabled modules:

- Routes with `manifest.module` → 404 via `requireModuleGate`
- Nav/settings entries should hide via `isPlatformModuleEnabled()`

See module catalog in [`docs/reference/frontend-platform.md`](../../reference/frontend-platform.md).

### Deployment mode overrides

Optional tri-state env overrides (when set, override API flags from `me/context`):

- `VITE_PERSONAL_ORGANIZATIONS`
- `VITE_TEAM_ORGANIZATIONS`

### Diagnostics / dev tooling — named flags (no build-mode sniffing)

Behavior is env-driven, **never** sniffed from `import.meta.env.DEV/PROD/MODE` in app
code. Each flag is read via `platformConfig`; defaults are production-safe and the local
`.env.local` flips them on (see `injectLocalDevDefaults` in `tooling/dev/setup-local.ts`):

| Flag                 | Dev | Prod (strict) | Effect                                                       |
| -------------------- | --- | ------------- | ------------------------------------------------------------ |
| `VITE_DEBUG_LOGGING` | any | `false` only  | `[Module]` diagnostic console logs                           |
| `VITE_DEVTOOLS`      | any | `false` only  | React Query Devtools + localhost debug panel + theme shuffle |
| `VITE_E2E_HOOKS`     | any | `false` only  | Playwright hooks on `globalThis` (`navigateInApp`, …)        |
| `VITE_VERSION_CHECK` | any | `true` only   | Poll `/version.json` for new deployments (off locally/tests) |

**Strict allowed values (hard fail).** `envProfiles.<env>.allowed` in `env-schema.ts`
declares the permitted value set per key per environment. `pnpm validate:client-env`
**fails** if `.env.<env>` (locally) or the injected GitHub Environment (CI) holds a value
out of range — e.g. `VITE_DEBUG_LOGGING=true` in production is rejected. Development permits
either boolean (typos still rejected).

The only remaining raw env read is the config bootstrap (`env.config.ts`, allowlisted by
`pnpm validate:vite-env`). Tests are **hermetic by construction**: the runner loads no env
files (`vitest.config.ts` points `envDir` at the empty `tooling/test/empty-env/` — Vite would
otherwise load `.env.local` in every mode, `test` included), so the suite runs on schema defaults;
test-runner env is injected by Vite plugins via `test.env` —
`i18n-build` (multi-locale) and `test-env` (`VITE_CAPTCHA_DISABLED`).

## 3. Build-time deploy (GitHub Actions → Netlify)

clinozy-fe **builds in GitHub Actions**, not on Netlify. All `VITE_*` values are
**baked into the bundle at build time** from GitHub Environment Secrets/Variables
(via `pnpm github:sync` → `.env.<environment>` → GHA workflow env).

| When to set vars                     | Where                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Normal production deploy             | GitHub Environment Variables/Secrets consumed by the build workflow                                              |
| Post-deploy override without rebuild | `public/config.js` → `window.__CONFIG__` (edit the deployed `config.js` / Netlify snippet injection)             |
| Local dev                            | `.env.local` (gitignored — your local dev file; `.env.development` / `.env.production` are the deploy-env files) |

Do **not** rely on Netlify UI env vars unless you intentionally build on Netlify
(this repo does not). See [cicd-and-netlify.md](../cicd-and-netlify.md).

## 4. Runtime override (`config.js`)

A deploy may inject `public/config.js` with `window.__CONFIG__` (no Docker in this
repo — the Netlify deploy serves the static file as-built unless you edit it):

- Strip `VITE_` prefix for keys (e.g. `AUTH_OAUTH_GOOGLE`, not `VITE_AUTH_OAUTH_GOOGLE`)
- Same keys as bundled client env
- See comments in [`public/config.js`](../../../public/config.js)

## 5. Adding or changing a key

Follow **`agent-os/skills/fe-env-schema-add/SKILL.md`** end-to-end:

1. Add field to `src/core/config/env-schema.ts`
2. Wire resolver in `env-resolvers.ts` / `platform-config.ts` if platform-facing
3. Place key in correct `.env.example` half + sub-section
4. Run `pnpm tool:sync-env-example --fix` then `pnpm tool:sync-env-example`
5. Update local `.env.<environment>` and `pnpm github:sync <env> --dry-run`
6. Add PR description block from sync tool output

## 6. Troubleshooting

| Symptom                                              | Check                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OAuth button missing                                 | `VITE_AUTH_OAUTH_<PROVIDER>` not `false`; no backend provider fetch                                                                                                                  |
| OAuth click fails                                    | clinozy-be may lack provider credentials — fix both sides                                                                                                                            |
| Module route 404                                     | Key in `VITE_DISABLED_MODULES` or manifest `module` mismatch                                                                                                                         |
| Production boot error on CAPTCHA                     | Set `VITE_TURNSTILE_SITE_KEY` or `VITE_CAPTCHA_DISABLED=true`                                                                                                                        |
| `validate:client-env` warns on `VITE_CSP_REPORT_URI` | Expected with no CSP collector. Set it to start the violation stream the [Trusted Types runbook](./csp-trusted-types-production.md) needs, or leave it — `warn` never fails the gate |
| `validate:env-example` fails                         | Run `pnpm tool:sync-env-example --fix`                                                                                                                                               |
| MCP servers missing in Cursor                        | Run `pnpm setup:local --no-start` or `pnpm mcp:setup`                                                                                                                                |
| Context7 MCP fails                                   | Set `CONTEXT7_API_KEY` in `.env.local` and reload Cursor                                                                                                                             |
| `The dev server runs in mode "dev-server"` on start  | Vite was started bare or with `--mode`; run `pnpm dev` (see [Which env files each command reads](#which-env-files-each-command-reads))                                               |
| Local dev errors show up in Sentry                   | `VITE_SENTRY_DSN` is set in `.env.local` — blank it ([Keeping local dev out of Sentry](../../integrations/sentry-frontend.md#keeping-local-dev-out-of-sentry))                       |

## 7. Related files

| File                                   | Role                   |
| -------------------------------------- | ---------------------- |
| `src/core/config/env-schema.ts`        | Zod schema + key list  |
| `src/core/config/env.config.ts`        | Client env parse       |
| `src/core/config/platform-config.ts`   | Typed platform config  |
| `tooling/validate/sync-env-example.ts` | Schema ↔ template sync |
| `tooling/load-env-files.mjs`           | Node script env loader |
