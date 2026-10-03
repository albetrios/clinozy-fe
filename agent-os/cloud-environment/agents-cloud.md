# Cloud agent instructions (clinozy-fe)

Read this on **remote / cloud** sessions (Cursor Cloud Agents, Claude Code on
the web) before tasks that need a browser or a live backend.

Canonical config: [`agent-os/cloud-environment/`](./) (`install.sh`,
`environment.json`) — `install.sh` is a thin wrapper over the bring-up scripts
in [`tooling/setup/agent/`](../../tooling/setup/agent/README.md), which mirror
clinozy-be's layout and run under any agent harness
(`bash tooling/setup/agent/bootstrap.sh`).
**Skills, MCPs, subagents:** [`skills-and-mcps.md`](skills-and-mcps.md).

clinozy-fe is a Vite SPA — there is **no** Postgres, Redis, Docker, or worker to
bring up. The cached `install.sh` gives you everything the static and unit lanes
need; only end-to-end browser tests need extra bring-up.

## When to run bring-up

| Task needs                                                                        | Run bring-up?                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Lint, `type-check`, unit tests (`pnpm test`), `pnpm agent-os:check`, `pnpm build` | No — runs cold after `install.sh`                        |
| Playwright e2e (`pnpm test:e2e`)                                                  | Yes — install browsers **and** run clinozy-be on `:3000` |
| `pnpm dev` preview against a real backend                                         | Yes — needs clinozy-be on `:3000`                        |

Everything in the "No" row runs on schema defaults: in `test` mode Vite loads no
env files, so the suite is hermetic on a fresh checkout.

## What `install.sh` does (cached, idempotent)

`install.sh` is a thin wrapper that `exec`s
[`tooling/setup/agent/bootstrap.sh`](../../tooling/setup/agent/bootstrap.sh) —
the same layout clinozy-be uses, so both repos are brought up the same way. The
Setup-script path stays stable while the logic lives under `tooling/`, and the
bring-up is runnable by hand or from any agent harness (Claude Code, Cursor,
Codex).

Ten steps, in order:

1. **Node runtime** —
   [`install-node.sh`](../../tooling/setup/agent/install-node.sh) downloads the
   pinned Node (`.nvmrc`, major 24) into `/opt/node24`, then `bootstrap.sh`
   activates it on `PATH` and persists that for the session via
   `$CLAUDE_ENV_FILE`. It does **not** probe for a version manager: cloud images
   ship Node 20/21/22 and no working one (`fnm` absent, the `nvm` shell function
   reports `N/A` with no `~/.nvm` tree), so probing silently leaves Node 22 in
   place and the install step then hard-fails on `engineStrict`. `.nvmrc` pins
   the exact release (`24.21.0`), which is downloaded as-is; a less specific pin
   (`24` or `24.21`) would be resolved from `nodejs.org/dist/index.json` at
   install time rather than hardcoded — either way the pin stays authoritative.
2. **Distro CLI tools** — `jq`, `ripgrep`, `shellcheck`, `rsvg-convert`, `xz`.
3. **GitHub CLI** (`gh`) from the official `cli/cli` release.
4. **gitleaks** — without it `.husky/pre-commit` silently skips the secret scan.
5. **`uv`/`uvx`** — the prerequisite for the `headroom` MCP server.
6. `corepack enable` + `pnpm install --frozen-lockfile`.
7. `pnpm setup:local --only-env` — scaffolds `.env.local` (schema defaults; no
   secrets). The `--only-env` flag is required: a bare `pnpm setup:local` runs
   through to phase 5/5 and spawns a long-lived `pnpm dev`, which would hang
   this script.
8. `pnpm mcp:setup:default` — writes the default MCP pair (codegraph + headroom)
   to `.mcp.json`.
9. **Playwright browsers** — skipped when the image already ships them.
10. **Healthcheck** — starts the dev server transiently, verifies it serves the
    real app shell, then stops it.

Steps 2–5 and 8–9 are best-effort and log `•` without aborting; Node, the
dependency install, the env scaffold, and the healthcheck are hard gates. No
service is left running unless you set `KEEP_APP=1`.

Full reference — every step, env var, and network host:
[`tooling/setup/agent/README.md`](../../tooling/setup/agent/README.md).

## Environment variables (cloud)

A cloud session runs as **`local`** — the `.env.local` from step 7 — on **development** values for
everything except the API it talks to (clinozy-be does the same with everything except its
database and Redis; see its `docs/integrations/claude-code-web-environment.md`):

- Never set `VITE_APP_ENV` or `BUILD_ENVIRONMENT`: the session is `local`.
- Set the development `VITE_*` values you need (Turnstile site key, Stripe publishable test key,
  PostHog, OAuth flags, …) as the environment's **Variables**. Vite gives the process env priority
  over `.env.local`, and Node tooling (`tooling/load-env-files.mjs`) no longer lets a blank `KEY=`
  placeholder in `.env.local` delete them.
- Leave `VITE_API_BASE_URL` blank and `VITE_DEV_API_URL` at `http://localhost:3000`: the API is the
  clinozy-be running in the session, on its own Postgres + Redis — the frontend's equivalent of
  "everything except the database and Redis".
- `pnpm dev` reads `.env.local` only; a `pnpm build` in the session is not asked and reads it too.
  Source maps never upload unless a build passes `--sentry`.

## On-demand: Playwright e2e

E2E is local/backend-coupled — CI never boots clinozy-be, and neither does the
cached install. When a task needs it:

```bash
pnpm exec playwright install --with-deps chromium   # browsers + OS deps
# start clinozy-be on :3000 in a sibling checkout, then:
pnpm test:e2e
```

`tests/e2e/global-setup.ts` fails fast if clinozy-be is not reachable on `:3000`.

## MCP default pair

`install.sh` scaffolds `codegraph` and `headroom` into
[`.mcp.json`](../../.mcp.json) via `pnpm mcp:setup:default` (same as local
`pnpm setup:local`). If MCP tools are missing in a session, confirm the platform
MCP settings match [`.mcp.default.json`](../../.mcp.default.json) and start a
fresh session. On-demand servers: `pnpm mcp:setup <name>`.

## Network allowlist (cloud)

Custom allowlist entries beyond defaults. Only the first two are **required** —
every other host degrades exactly one best-effort step:

- `nodejs.org` — **required**; `install-node.sh` resolves and downloads the Node
  tarball from `nodejs.org/dist`. It is not in the default Trusted list, so
  without it the install is blocked and every later step fails on the wrong
  Node major.
- `registry.npmjs.org` — **required**; `pnpm install`.
- `github.com` + `api.github.com` — `gh` and gitleaks release downloads.
  Blocked → those two tools are skipped (the pre-commit secret scan then
  silently no-ops).
- Distro apt mirrors — `jq`, `ripgrep`, `shellcheck`, `librsvg2-bin`, `xz-utils`.
- `astral.sh` + `pypi.org` — `uv`/`uvx`, needed by the `headroom` MCP server.
  Blocked → headroom does not start; `codegraph` is unaffected (it is a
  devDependency).
- `playwright.azureedge.net` (and `cdn.playwright.dev`) — only when the image
  does not already ship browsers.
