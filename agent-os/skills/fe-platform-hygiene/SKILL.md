---
name: fe-platform-hygiene
description: Platform config, env read paths, dead code and deploy validators (platformConfig, knip, validate:vite-env, validate:client-env). Use when touching env schema, Vite env reads, knip or platform wiring.
trigger: src/core/config/env-schema.ts, **/platform-config.ts, **/build-env.ts, knip.jsonc, .env.example, plugins/dev-server-mode.ts, plugins/build-environment.ts, tooling/ci/build.mjs, tooling/setup/github/scaffold-env-files.mjs, .github/rulesets/**, .github/environments/**, tooling/setup/github/governance-mode.mjs
triggerNote: Env schema, Vite env reads, knip; which env file each command reads; governance mode — use github:tool:governance-mode, never hand-edit review fields
---

# Platform hygiene (clinozy-fe)

Use this skill when changing **how config enters the app**, **env validation**, or
**dead-code / deploy gates**. For **adding/removing env keys**, chain **`fe-env-schema-add`**
first — this skill covers **read paths and validators** around that.

**Overview:** `docs/reference/frontend-platform.md`  
**Env add/rename/remove:** `agent-os/skills/fe-env-schema-add/SKILL.md`

---

## Config read paths (single source of truth)

| Need                                                       | Read from                                             | Never                                      |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| Runtime platform (API URL, auth flags, modules, Sentry, …) | `platformConfig` from `@/core/config/env.ts`          | Raw `import.meta.env.VITE_*` in app code   |
| Build metadata (build id, version, i18n build mode)        | `readInjected*` in `src/lib/i18n/build-env.ts`        | Direct `import.meta.env` outside allowlist |
| Env parsing / overrides                                    | `env.config.ts` (`getClientEnv`, `window.__CONFIG__`) | Duplicate Zod schemas                      |

**Allowlisted raw Vite reads:** only `build-env.ts` and `env.config.ts` (`pnpm validate:vite-env`).

**No env/mode sniffing.** App code must never read `import.meta.env.DEV/PROD/MODE` or
compare `platformConfig.environment === '<name>'` / `.MODE === '<name>'`. Behavior is
driven by named `platformConfig` flags; `environment` is a reported value only (Sentry/
PostHog tag). Genuine test-runner env needs come from Vite plugins (`plugins/i18n-build.ts`,
`plugins/test-env.ts`), not app code. Enforced by `pnpm validate:vite-env`.

### Which env file each command reads

Vite lays `.env.<mode>` over `.env.local`, so the mode decides whether a deploy-env file
(`.env.development` / `.env.production`, the files `pnpm github:sync` pushes from) leaks into
local work. Each command therefore reads **one** file:

| Command | Reads | Owner (pinned by) |
| --- | --- | --- |
| `pnpm dev` | `.env.local` only (mode `dev-server`; any other dev-server mode is refused) | `plugins/dev-server-mode.ts` (`tests/ci/dev-server-env.policy.test.ts`) |
| `pnpm build` in a terminal / `--env <env>` / `BUILD_ENVIRONMENT` | the chosen `.env.<env>` alone; `VITE_APP_ENV` filled from the choice, a mismatch refused | `tooling/ci/build.mjs`, `plugins/build-environment.ts` (`tests/ci/build-environment.policy.test.ts`) |
| `pnpm build` unasked (scripts, hooks, `pnpm health`) | `.env.local` alone — clinozy-be's `local` default | same |
| CI / deploy build (no `.env.local`) | Vite's own files: the materialized `.env.production.local` | same |
| Vitest | none (`envDir` = `tooling/test/empty-env/`) | `tests/ci/env-hermetic.policy.test.ts` |

Never layer `.env.local` over a deploy environment's file (clinozy-be does, safely — its
`.env.local` never reaches a container; a FE build ships what it reads). Source maps go to
Sentry only on request (`SENTRY_UPLOAD_SOURCEMAPS=true` from the deploy, or `--sentry`), read
from the process env before any file loads (`tests/ci/sentry-upload.policy.test.ts`). Netlify
never builds: every `netlify deploy` passes `--no-build` (`tests/ci/netlify-no-build.policy.test.ts`).
Full table: `docs/deployment/runbooks/environment-variables.md`.

---

## Checklist — platform / env change

1. **Env key?** → run **`fe-env-schema-add`** checklist (schema, `.env.example`, sync, tests, runbook).
2. **Runtime consumer?** → wire `platform-config.ts` / `auth-methods.ts`; import `platformConfig` in app code.
3. **Build-time injection?** → extend `build-env.ts` + allowlist in `tooling/validate/vite-env-reads.mjs`.
4. **Types** — `src/vite-env.d.ts` for new `VITE_*` keys.
5. **Tests** — `env-schema.test.ts`, `platform-config.test.ts`, `build-env` tests as applicable.
6. **Validators:**

```bash
pnpm validate:vite-env
pnpm validate:client-env --production   # deploy conditional keys; local may warn on unset API URL
pnpm tool:sync-env-example
```

7. **Dead code** — after removing exports/deps:

```bash
pnpm knip
```

8. **Health** — `pnpm health` or CI-equivalent lanes after broad changes.
9. **Branch governance?** — never hand-edit the review fields in `.github/rulesets/*.json` or
   `.github/environments/production.json` (coupled → deadlock). Switch posture with
   `pnpm github:tool:governance-mode <personal|team>`, then `pnpm github:sync`. See
   `docs/reference/branch-governance.md`.

---

## Validator reference

| Command                                  | Enforces                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm validate:vite-env`                 | No env/mode sniffing: `import.meta.env.VITE_*`/`DEV`/`PROD`/`MODE` outside allowlist, or `.environment`/`.MODE ===` compares |
| `pnpm validate:client-env --production`  | Production deploy env completeness (e.g. captcha, API URL)                                                                   |
| `pnpm knip`                              | Unused exports, deps, files (see `knip.jsonc`)                                                                               |
| `pnpm tool:sync-env-example`             | Schema ↔ `.env.example` parity                                                                                               |
| `pnpm validate:lockfile`                 | `pnpm-lock.yaml` ↔ `package.json` in sync (frozen install; deps + `pnpm-workspace.yaml` overrides)                           |
| `pnpm github:tool:governance-mode:check` | Branch governance (personal↔team) — ruleset ↔ prod env agree, no self-review deadlock (also in the `ci-policy` lane)         |

CI: static-sync lane runs vite-env + client-env; Netlify reusable workflow runs client-env for production builds.

---

## `platformConfig` vs legacy

- Import **`platformConfig`** from `@/core/config/env.ts` — not a deprecated `config` alias.
- Auth surface: `enabledOAuthProviders(authMethods.oauth)` — no redundant OAuth wrapper helpers.
- Module disable: `VITE_DISABLED_MODULES` on manifest `module` — not mixed into auth booleans.

---

## Post-deploy overrides

`public/config.js` → `window.__CONFIG__` with keys **without** `VITE_` prefix. Document operator keys in the file header. See CSP/Trusted Types runbook for SRI promotion.

---

## Dependencies & the lockfile

**A dependency or `overrides` change and its `pnpm-lock.yaml` update are one atomic
change.** After editing `package.json` deps or the `overrides` in `pnpm-workspace.yaml`, run
`pnpm install` and stage the changed manifest **and** `pnpm-lock.yaml` together.

A desynced lockfile produces `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` on `pnpm install --frozen-lockfile` (what CI runs), which **reds every CI job** on the PR — and any open **release-please** PR inherits the mismatch and goes all-red until it is regenerated. So it **must never reach main**.

- Enforced locally: `pnpm run validate:lockfile` (frozen install), run by the before-commit
  guard whenever a commit stages `package.json` or `pnpm-lock.yaml`.
- Never hand-edit `pnpm-lock.yaml`; let `pnpm install` regenerate it.
- Fix a mismatch: `pnpm install --no-frozen-lockfile`, then commit the regenerated lockfile.

---

## Anti-patterns

- `import.meta.env.VITE_FOO` in pages, shared, or core (except allowlist files)
- `import.meta.env.DEV/PROD/MODE` or `platformConfig.environment === '<name>'` branching — use a named flag
- Secrets in `VITE_*` (bundled to client)
- Adding env to `.env.example` without schema field
- Skipping `knip` after deleting modules or dependencies
- Duplicating env parsing outside `env.config.ts`
- Starting the dev server with a bare `vite`, or a measuring/deploy build that silently mixes env files — use `pnpm dev` / `pnpm build --env <env>`
- `netlify deploy` without `--no-build` (it rebuilds, and ships a bundle nobody validated)
- Changing `package.json` deps / `pnpm-workspace.yaml` overrides without regenerating `pnpm-lock.yaml` (breaks frozen-install CI — see [Dependencies & the lockfile](#dependencies--the-lockfile))

---

## Verify

### Export cleanup

1. Inventory consumers before removing an export or forwarding barrel. Include
   tests, fixtures, tooling, computed imports, and source-reading validators, not
   just application imports reported by Knip.
2. Remove an unused forwarding export without changing a used owning API. Preserve
   genuine public consumers with a precise reason; do not add blanket ignores or
   label unused declarations public merely to silence the scanner.
3. For a private runtime declaration used only to infer a type, prefer an
   equivalent TypeScript type when no runtime validation consumes it. Preserve
   optionality and public names; check assignability and the real callers. Keep
   schemas that actually parse or validate values.
4. When retaining removed source as a local archive, use a non-source extension
   outside application paths. Do not weaken lint configuration to accommodate an
   archive. `docs/reference/project-tree.txt` is generated from tracked files and
   gitignored — never stage it; rerun `pnpm sync:check` after commit against the
   same tracked snapshot CI receives.
5. Run Knip, type-check, lint, relevant tests, and `pnpm sync:check`. A scanner pass
   alone does not establish that the cleanup preserved behavior.

```bash
pnpm validate:vite-env
pnpm validate:client-env --production
pnpm knip
pnpm type-check
pnpm test -- --run src/core/config/ src/lib/i18n/build-env.test.ts
```

---

## Browser verification

- Use a dedicated E2E server with the intended local environment: `pnpm dev` (Vite mode
  `dev-server`) reads `.env.local` and no deploy-env file; `vite.config.ts` refuses a dev
  server in any other mode (`plugins/dev-server-mode.ts`). Confirm the existing E2E hooks are
  enabled; never add a login bypass.
- The backend must allow the exact frontend origin, including its port. A local
  refresh `403` is not proof of a frontend race. Inspect sanitized response codes
  and configuration; do not disable CSRF checks to make a test pass.
- Finish anonymous bootstrap before an API-based login helper creates its refresh
  cookie. Do not race startup refresh against installation of an earlier token.
- Use the shared visible-element helper for responsive shell controls. Never turn
  locator errors into a conditional skip. Assert scenario prerequisites explicitly.
- Freeze source changes before browser runs; HMR during authentication invalidates
  the result. Report skipped and `fixme` scenarios separately from passing tests.
- Keep alternate build output outside the repository so generated files cannot
  influence Tailwind discovery, lint, or project-tree checks.

## Related

- Skill: `fe-env-schema-add`, `fe-documentation-maintenance`, `fe-code-quality-security`
- Rule: `agent-os/rules/fe-platform-hygiene-sync.mdc`, `agent-os/rules/fe-env-schema-add-sync.mdc`
- Runbook: `docs/deployment/runbooks/environment-variables.md`
