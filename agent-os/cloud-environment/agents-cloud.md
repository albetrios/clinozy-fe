# Cloud agent instructions (clinozy-fe)

Read this on **remote / cloud** sessions (Cursor Cloud Agents, Claude Code on
the web) before tasks that need a browser or a live backend.

Canonical config: [`agent-os/cloud-environment/`](./) (`environment.json`, Cursor's) and the
bring-up scripts in [`tooling/setup/agent/`](../../tooling/setup/agent/README.md), which mirror
clinozy-be's layout and run under any agent harness. The one entry point is
[`bootstrap.sh`](../../tooling/setup/agent/bootstrap.sh), as in clinozy-be: everything else runs
inside it.
**Skills, MCPs, subagents:** [`skills-and-mcps.md`](skills-and-mcps.md).

clinozy-fe is a Vite SPA — there is **no** Postgres, Redis, Docker, or worker to
bring up. The cached `bootstrap.sh --install-only` gives you everything the static and unit lanes
need, and a web session's start brings the dev server up; only end-to-end browser tests need
more.

## When to run bring-up

| Task needs                                                                        | Run bring-up?                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Lint, `type-check`, unit tests (`pnpm test`), `pnpm agent-os:check`, `pnpm build` | No — runs cold after `bootstrap.sh --install-only`                                    |
| Playwright e2e (`pnpm test:e2e`)                                                  | Yes — install browsers **and** run clinozy-be on `:3000`                              |
| `pnpm dev` preview against a real backend                                         | No on the web — a session's start keeps it on `:5173`; it needs clinozy-be on `:3000` |

Everything in the "No" row runs on schema defaults: in `test` mode Vite loads no
env files, so the suite is hermetic on a fresh checkout.

## What `bootstrap.sh` does (idempotent)

[`tooling/setup/agent/bootstrap.sh`](../../tooling/setup/agent/bootstrap.sh) is the same entry
point clinozy-be has, at the same path, so both repos are brought up the same way: the
environment's Setup script and Cursor's `install` call it with `--install-only`, a web session's
start hook calls it without, and it runs by hand or from any agent harness (Claude Code, Cursor,
Codex).

In a session — the session-start hook launches it detached, as clinozy-be's hook launches its
own — four steps, in order:

1. **Node runtime** —
   [`install-node.sh`](../../tooling/setup/agent/install-node.sh) downloads the
   pinned Node (`.nvmrc`, major 24) into `/opt/node24`, then `bootstrap.sh`
   activates it on `PATH` and persists that for the session via
   `$CLAUDE_ENV_FILE`. It also links the pinned `node`, `npm`, `npx`, `corepack`
   and `pnpm` into `~/.local/bin`, which the image puts ahead of its own
   `/opt/node22/bin`, so every shell runs Node 24 even where no hook loads (a
   session that holds both repos); `NODE_LINK_USER_BIN=0` turns that off, and a
   Node from nvm is left alone. It does **not** probe for a version manager: cloud images
   ship Node 20/21/22 and no working one (`fnm` absent, the `nvm` shell function
   reports `N/A` with no `~/.nvm` tree), so probing silently leaves Node 22 in
   place and the install step then hard-fails on `engineStrict`. `.nvmrc` pins
   the exact release (`24.21.0`), which is downloaded as-is; a less specific pin
   (`24` or `24.21`) would be resolved from `nodejs.org/dist/index.json` at
   install time rather than hardcoded — either way the pin stays authoritative.
2. `corepack enable` + `pnpm install --frozen-lockfile` — only when Node or the lockfile changed
   since it last succeeded here (a stamp in `node_modules/.agent-stamps/`, as clinozy-be keeps).
3. `pnpm setup:local --only-env` — scaffolds `.env.local` (schema defaults; no
   secrets), with the Google / GitHub sign-in buttons off. The `--only-env` flag is required: a
   bare `pnpm setup:local` runs through to phase 5/5 and spawns a long-lived `pnpm dev`, which
   would hang this script.
4. **Dev server** — `pnpm dev` on :5173 in its own session, health checked (it serves the real
   app shell), then **left running**, as clinozy-be leaves its API running. One already serving
   the shell (a resumed session) is kept, never joined by a second.

Then, in the background — the app needs none of them, so they never hold the dev server up — the
agent's tools ([`install-agent-tools.sh`](../../tooling/setup/agent/install-agent-tools.sh)) and
SonarQube for the pre-push gate ([`start-sonarqube.sh`](../../tooling/setup/agent/start-sonarqube.sh)).
A lock in `/tmp/agent-stack/frontend/` keeps two bring-ups from racing.

The environment's Setup script runs the same script with `--install-only` (the switch
clinozy-be's `bootstrap.sh` takes): steps 1–3, then

4. **Docker** with the SonarQube images the pre-push gate runs (`install-docker-images.sh`: the
   `mirror.gcr.io` Docker Hub mirror, `dockerd`, pre-pull) — only here, never in a session, where
   a restart to apply the mirror would take clinozy-be's Postgres and Redis down with it.
5. **The agent's tools**, inline
   ([`install-agent-tools.sh`](../../tooling/setup/agent/install-agent-tools.sh)):
   - the distro CLI tools — `jq`, `ripgrep`, `shellcheck`, `rsvg-convert`, `xz`;
   - the GitHub CLI (`gh`) from the official `cli/cli` release;
   - **gitleaks** (the `.husky/pre-commit` secret scan is mandatory: a commit without gitleaks
     fails) and **semgrep** at its pin (`pnpm security:semgrep:push`);
   - **`uv`/`uvx`** — the prerequisite for the `headroom` MCP server;
   - `pnpm mcp:setup:default` — writes the default MCP pair (fe-codegraph + fe-headroom) to
     `.mcp.json`; then `pnpm setup:local --only-codegraph` builds the codegraph index the MCP
     server answers from (step 3's `--only-env` stops before it). The first build takes about 2–3
     minutes and ~250 MB in `.codegraph/`; later runs only `sync` it. Last,
     `pnpm agent-os:session-hooks` registers the hooks: a session that holds both repos takes them
     only from `/home/user/.claude/settings.json`, so it writes both repos' hooks there, each with
     absolute paths and its own `CLAUDE_PROJECT_DIR`, and registers each repo's codegraph server
     at user level (`~/.claude.json`), pointed at it with `--path` (a no-op with one repo). Each
     repo's file hooks then act only on its own files. To check it in a new session, look for one
     "session ready (hooks from …)" line per repo in the session context;
   - **Playwright browsers** — skipped when the image already ships them.

It starts no server: a cached Setup script must terminate. Any other option is refused.

```bash
bash tooling/setup/agent/bootstrap.sh --install-only   # the Setup script, and Cursor's install
```

The environment's Setup script runs outside the repositories, so it names each one by path — for
a session that holds both, one line per repository, clinozy-be's first:

```bash
bash /home/user/clinozy-be/tooling/setup/agent/bootstrap.sh --install-only
bash /home/user/clinozy-fe/tooling/setup/agent/bootstrap.sh --install-only
```

The tool installs are best-effort and log `•` without aborting; Node, the dependency install, the
env scaffold and, in a session, the dev server's healthcheck are hard gates.

Full reference — every step, env var, and network host:
[`tooling/setup/agent/README.md`](../../tooling/setup/agent/README.md).

## Environment variables (cloud)

A cloud session runs as **`local`** — the `.env.local` from step 3 — on **development** values for
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

`bootstrap.sh` (its agent tools, `install-agent-tools.sh`) scaffolds `codegraph` and `headroom` into
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
- `cdn.playwright.dev` — whenever the image's browsers are not the build the
  pinned `@playwright/test` needs (an image can ship `chromium-1194` while the
  pin needs `chromium-1248`). Blocked → E2E is unavailable.
