# GitHub automation (clinozy-fe)

Single trunk: _main_. Every push to `main` deploys the `development` alias; a published release deploys `production`.

Workflow _file names_ describe _what_ runs; the YAML `name:` field is what appears in the GitHub Actions UI and in required status checks.

## Orchestrator workflows

| What it does                                              | File                                                 | When it runs                          |
| --------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| PR merge gate (lint, typecheck, unit, build)              | [pr-ci.yml](workflows/pr-ci.yml)                     | `pull_request` → `main`               |
| PR title, labels, `.env` guard                            | [pr-governance.yml](workflows/pr-governance.yml)     | Every PR event                        |
| Post-merge pipeline (release-please + development deploy) | [post-merge-ci.yml](workflows/post-merge-ci.yml)     | push to `main`                        |
| Production deploy (tag-pinned, reviewer-gated)            | [release-deploy.yml](workflows/release-deploy.yml)   | `release: published` + manual `{tag}` |
| Instant production rollback (restore, no rebuild)         | [rollback-deploy.yml](workflows/rollback-deploy.yml) | Manual `workflow_dispatch`            |
| Weekly Lighthouse budgets                                 | [lighthouse.yml](workflows/lighthouse.yml)           | Wed 03:00 UTC                         |

Playwright E2E is local-only (`pnpm test:e2e` against a live clinozy-be on `:3000`) — CI never boots the backend; deploys only need the backend URL (`VITE_API_BASE_URL`).

## Reusable workflows

| What it does                 | File                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| Vitest unit + patch coverage | [reusable-vitest-unit-only.yml](workflows/reusable-vitest-unit-only.yml) |
| Netlify deploy               | [reusable-netlify-deploy.yml](workflows/reusable-netlify-deploy.yml)     |

## Repo config

| Path                           | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| [environments/](environments/) | GitHub Environment docs + drift checks         |
| [rulesets/](rulesets/)         | Branch protection as code (`pnpm github:sync`) |
| [workflows/](workflows/)       | CI/CD YAML                                     |

Canonical deploy manifest: [`tooling/setup/setup.config.json`](../tooling/setup/setup.config.json).
