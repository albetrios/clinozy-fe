# GitHub Environments (IaC)

Committed JSON under this directory describes **GitHub Environment protection**
(reviewers, deployment branch policy). Deploy **secrets** live in GitHub
Environments and are synced from gitignored `.env.development` /
`.env.production` at the repo root.

## Mapping

Single-trunk model — one branch (`main`) drives both environments by **purpose**,
not by branch:

| Trigger                        | GitHub Environment | Deploy                | Local secrets file |
| ------------------------------ | ------------------ | --------------------- | ------------------ |
| src-path push to `main`        | `development`      | `--alias development` | `.env.development` |
| a release (`vX.Y.Z`) on `main` | `production`       | `--prod`              | `.env.production`  |

Canonical manifest: [`tooling/setup/setup.config.json`](../../tooling/setup/setup.config.json).

## Required deploy secrets

These must be present or post-merge Netlify deploy **fails** (no silent skip):

- `VITE_API_BASE_URL`
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`

Optional (warn only): `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_PRIVACY_POLICY_URL`,
`VITE_TURNSTILE_SITE_KEY` (required by the production **client-env profile**, which also
refuses `VITE_CAPTCHA_DISABLED=true`), and the Sentry keys —
`VITE_SENTRY_DSN` (client reporting) plus build-time `SENTRY_AUTH_TOKEN` /
`SENTRY_ORG` / `SENTRY_PROJECT` (source-map upload; the deploy build activates the
upload plugin only when the token is set).

## GitHub Variables (per environment)

Non-secret deploy knobs are GitHub **Variables** on the same environments, read by
the deploy/preview workflows via `${{ vars.* }}` and validated against
`envProfiles.<env>.allowed` (`src/core/config/env-schema.ts`). They are **managed by
`pnpm github:sync`** from the gitignored `.env.<environment>` files — the managed set is
`deployVariables` in [`tooling/setup/setup.config.json`](../../tooling/setup/setup.config.json)
(aligned to the `vars.*` reads in the deploy workflow). Unlike secrets, variables are
**diffed**: a variable is pushed only when missing or changed, and one whose value equals
its **runtime schema default** (the env-independent Zod fallback) is **not pushed and is
pruned** — the runtime falls back to the identical default. Preview an environment with
`pnpm github:sync <env> --diff`; pass `--keep-schema-defaults` to push default-valued
variables verbatim. Full key catalog (kind, default, description):
[`docs/reference/env-catalog.md`](../../docs/reference/env-catalog.md) (`pnpm env:catalog`).

| Variable                               | development          | production           |
| -------------------------------------- | -------------------- | -------------------- |
| `VITE_CAPTCHA_DISABLED`                | `false`              | per captcha rollout  |
| `VITE_DEBUG_LOGGING` / `VITE_DEVTOOLS` | `false` (refused on) | `false` (enforced)   |
| `VITE_E2E_HOOKS`                       | `false` (refused on) | `false` (enforced)   |
| `VITE_VERSION_CHECK`                   | `true`               | `true` (enforced)    |
| `VITE_SENTRY_*_SAMPLE_RATE` (4 keys)   | optional             | optional             |
| `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`   | repo-level, optional | repo-level, optional |

"Refused on": both deploy workflows set the hosted-deploy marker `HOSTED_DEPLOYMENT=true` (clinozy-be's
A-4), and with it `pnpm validate:client-env` refuses `VITE_TEST_MODE`, `VITE_E2E_HOOKS`, `VITE_DEVTOOLS`
and `VITE_DEBUG_LOGGING` on, whatever the profile allows — set them `false` (or leave them unset) in
`.env.development` too. An unset variable falls back to the runtime schema default at build time; `VITE_APP_ENV`
is **not** a managed variable — the workflows derive it from the resolved environment
name (and a local `pnpm build --env <environment>` fills it the same way). A new
`.env.<environment>` scaffolded by `pnpm github:sync` starts from
`envProfiles.<environment>.defaults`. `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` is a **repository-level** variable (not
per-environment), so it stays hand-managed.

## Secret placement (repository vs environment)

A secret's **scope must match how the job that reads it is triggered**:

| A secret read by a job that…   | Scope           | Managed by                                                |
| ------------------------------ | --------------- | --------------------------------------------------------- |
| declares `environment: <name>` | **Environment** | `pnpm github:sync` (from `.env.<environment>`)            |
| declares **no** `environment:` | **Repository**  | **manual** — `gh secret set <NAME> --repo …` (no `--env`) |

Deploy/build values (`NETLIFY_*`, `VITE_*`) are read by the environment-gated
deploy job → **environment secrets** (github:sync uploads them).

**There are no repository secrets.** `RELEASE_PLEASE_TOKEN` is an **environment
secret on `development`**, read by `release-please` (post-merge-ci), the
`pat-canary` (scheduled-release-guards), and `dependabot-auto-merge`. All three
jobs therefore declare `environment: development`, and all three run on `main`
(a push, a schedule, a `workflow_run`):

It is a **managed deploy secret on `development`** (listed in that environment's
`deploySecrets`): clinozy-infra's `pnpm setup:infra` writes it into `.env.development`
(from its `GITHUB_TOKEN`) and `pnpm github:sync` pushes it like every other deploy value.
Because it is managed, a sync from a `.env.development` **without** the key deletes the
remote secret — keep the line in the file. To set it by hand instead (it then needs the line
in `.env.development` too, or the next sync removes it):

```bash
gh secret set RELEASE_PLEASE_TOKEN --env development --repo albetrios/clinozy-fe
```

The token needs Contents + Pull requests + Workflows (read/write) on this repo.

> **`development`, never `production`.** These three are automation jobs, not
> deploys. `production` carries `requiredReviewers` and would pause post-merge CI
> for approval on every merge to `main`.
>
> **`development` allows the `main` branch only** (`deploymentBranchPolicy`
> `protectedBranches: true`, H-1): it holds an account-wide Netlify token for the
> site production also serves, and the release PAT, so no job a pull request or a
> pushed branch starts may select it. A job that must react to a pull request and
> needs one of those secrets is split: the pull-request half holds nothing, and a
> `workflow_run` half (which runs main's copy of its file, and runs on `main`) reads
> the secret and runs no code from the PR — `preview.yml` → `preview-deploy.yml`,
> `dependabot-approval.yml` → `dependabot-auto-merge.yml`. `e2e-backend.yml` selects
> the environment only off pull requests. Pinned by
> `tests/ci/preview-deploy.policy.test.ts`, `tests/ci/dependabot-flows.policy.test.ts`,
> `tests/ci/post-merge-ci.policy.test.ts` and `tests/ci/release-guards.policy.test.ts`.
>
> **Moving the PAT out of `development`** into an environment of its own (only those
> three jobs selecting it) is not expressible here yet: `pnpm github:sync`'s
> consistency pre-flight requires every environment to be a Netlify deploy target
> (`tooling/setup/github/sync-consistency.mjs`). Until then, or until releases move to
> a GitHub App, the main-only branch policy is what keeps the PAT from a PR.

## Repository variables for pull-request jobs

A job a pull request starts selects no environment, so it sees **repository-level**
variables only. Two kinds, both public values (a browser sees them in the bundle) and
both **hand-managed** (`gh variable set <NAME> --repo albetrios/clinozy-fe --body …`):

| Variable                                                                                                             | Read by                          | Value                                                 |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| `PREVIEW_VITE_API_BASE_URL`                                                                                          | `preview.yml` (required)         | development's `VITE_API_BASE_URL`; unset → no preview |
| `PREVIEW_VITE_TURNSTILE_SITE_KEY`, `PREVIEW_VITE_STRIPE_PUBLISHABLE_KEY`                                             | `preview.yml`                    | development's site / publishable keys                 |
| `PREVIEW_VITE_POSTHOG_KEY`, `PREVIEW_VITE_POSTHOG_HOST`, `PREVIEW_VITE_PRIVACY_POLICY_URL`, `PREVIEW_CSP_REPORT_URI` | `preview.yml` (optional)         | development's values                                  |
| `VITE_PERSONAL_ORGANIZATIONS`, `VITE_TEAM_ORGANIZATIONS`, `VITE_DISABLED_MODULES`, `STORED_FILES_ORIGIN`, …          | `preview.yml`, `e2e-backend.yml` | a repository-level copy of development's variable     |

`PREVIEW_<KEY>` names a value development keeps as a **Secret**: a job may not read a
synced Secret's name through `vars.*` (`tests/ci/github-actions-hardening.policy.test.ts`).
A synced **Variable** is read under its own name; with no environment it resolves at
repository level, and an unset one falls back to the schema default.

## Commands

| Command                                   | Purpose                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm github:sync`                        | Scaffold `.env.*`, sync rulesets, ensure env shells, push secrets + diff/prune variables |
| `pnpm github:sync --check`                | Read-only drift (rulesets, shells, protection, secrets + variables) — fails on any       |
| `pnpm github:sync <env> --diff`           | Per-variable table: schema default vs local vs remote vs decision (read-only)            |
| `pnpm github:sync --dry-run`              | Preview the local-side values plan, no writes (no GitHub query)                          |
| `pnpm github:sync --keep-schema-defaults` | Push variables equal to their schema default instead of pruning                          |
| `pnpm github:sync --yes`                  | Skip the values-push confirmation (automation)                                           |
| `pnpm github:sync --prune`                | Flag rulesets for branches not in config (`--prune --yes` to delete)                     |
| `pnpm env:catalog` / `:check`             | (Re)generate / drift-check `docs/reference/env-catalog.md`                               |
| `pnpm validate:deploy-env`                | Fail if required deploy secrets missing (local, uses GitHub API)                         |

Every `github:sync` (all modes) runs a **consistency pre-flight** first: the
environments in `setup.config.json`, `.github/environments/*.json`, and the
reusable deploy workflow must agree, and `git.protectedBranches` / `defaultBranch`
must match the committed `.github/rulesets/*.json` (single trunk = `main` only).
It fails fast on drift before touching GitHub.

## Governance mode (personal ↔ team)

The production environment's `requiredReviewers` (`users` + `preventSelfReview`)
is one half of the repo's branch-governance mode; the trunk ruleset's
`pull_request` rule is the other. Do not edit them by hand — the coupled review
fields deadlock the maintainer in the wrong combination. Switch both atomically:

```bash
pnpm github:tool:governance-mode          # status
pnpm github:tool:governance-mode team     # four-eyes (needs ≥2 CODEOWNERS users)
pnpm github:sync                          # apply to GitHub
```

Full reference: [docs/reference/branch-governance.md](../../docs/reference/branch-governance.md).

## Pushing only what changed

`pnpm github:sync [environment...] --only KEY,KEY --yes` pushes just those keys (even one that
equals its schema default), skips rulesets, environment shells and protection, and deletes
nothing — instead of re-pushing every secret.

## Protection drift

GitHub does not expose a full “apply protection from JSON” API for all fields.
When [`production.json`](production.json) specifies required reviewers or branch
policies, apply them in **Settings → Environments → production** to match the
committed file, then run `pnpm github:sync --check`.

Required reviewers on a **private** repository's environments need **GitHub
Enterprise** (public repositories get them on every plan). When the plan can't
enforce them, `pnpm github:sync` and `--check` say the reviewers were not checked
and compare only the deployment branch policy, so the check doesn't fail on a
rule GitHub won't accept.

## CI

[`reusable-netlify-deploy.yml`](../workflows/reusable-netlify-deploy.yml) runs
`validate-github-env.mjs` with `GITHUB_ENV_VALIDATION_SOURCE=runtime` so missing
secrets fail the deploy job instead of skipping quietly.
