# `tooling/setup/agent/` — cloud-agent bring-up

One command makes a fresh cloud session behave like a local checkout, the same entry point
clinozy-be's `bootstrap.sh` is for the backend — everything else runs inside it:

```bash
bash tooling/setup/agent/bootstrap.sh                 # the session: setup → the dev server live
bash tooling/setup/agent/bootstrap.sh --install-only  # the environment Setup script: the installs
```

A session's run (the session-start hook launches it detached) ends with the dev server on :5173
**left running**, then starts the agent's tools and SonarQube in the background. `--install-only`
(the same switch clinozy-be's `bootstrap.sh` takes) installs Docker's SonarQube images and the
agent's tools inline instead, and starts no server: a cached Setup script must terminate. Any other
option is refused.

Harness-agnostic by design. It runs the same on **Claude Code** (web, CLI,
desktop), **Cursor** cloud agents, **Codex**, CI, or a plain shell. The only
harness hook is `$CLAUDE_ENV_FILE` — written when the variable exists so the
session inherits the pinned Node on `PATH`, and a no-op everywhere else.

This mirrors `clinozy-be`'s `tooling/setup/agent/` layout so both repos are brought
up the same way. Where they differ, the difference is the stack: clinozy-be needs
Docker, Postgres, Redis, migrations and seed; clinozy-fe needs Playwright browsers
and a dev server that serves the app shell.

## Files

| File                       | Role                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `bootstrap.sh`             | Orchestrator — the one entry point: runs the steps, logs progress, enforces the hard gates         |
| `install-agent-tools.sh`   | The agent's own tools, every installer below but Node and Docker (same step as clinozy-be's)       |
| `stack-lock.lib.sh`        | The bring-up lock, so two runs never race (same script as clinozy-be)                              |
| `lib.sh`                   | Shared helpers (logging, arch detection, apt, download, PATH persistence)                          |
| `tool-versions.sh`         | The pinned tool versions and checksums (gitleaks, semgrep), read by the installers and CI          |
| `install-node.sh`          | Pinned Node from `.nvmrc` into `/opt/node<major>`, linked into `~/.local/bin`                      |
| `install-apt-tools.sh`     | `jq`, `ripgrep`, `shellcheck`, `librsvg2-bin`, `xz-utils`                                          |
| `install-gh.sh`            | GitHub CLI from the official `cli/cli` release                                                     |
| `install-semgrep.sh`       | Semgrep at the pin, for `pnpm security:semgrep:push` (a warning when missing)                      |
| `install-gitleaks.sh`      | Secret scanner used by `.husky/pre-commit` (mandatory there) and the CI gitleaks lane              |
| `install-docker-images.sh` | Docker Hub mirror (`mirror.gcr.io`) + pre-pull of the SonarQube gate images                        |
| `ensure-docker-daemon.sh`  | Starts or restarts `dockerd` (same script as clinozy-be); used by step 4 and `pnpm sonar:scan`     |
| `install-headroom.sh`      | `uv`/`uvx` — the prerequisite for the `headroom` MCP server                                        |
| `install-playwright.sh`    | E2E browsers; downloads only when the build the pinned `@playwright/test` needs is missing         |
| `healthcheck.sh`           | Probes the dev server for the real app shell                                                       |
| `start-sonarqube.sh`       | SonarQube for the pre-push gate, once no bring-up holds the stack lock (same script as clinozy-be) |

Each `install-*.sh` runs standalone as well as under `bootstrap.sh`, which reaches every one of them,
directly or through `install-agent-tools.sh` (pinned by `tests/ci/agent-session-start.policy.test.ts`).

## Steps and which ones can fail

| #   | Step                                                                      | Runs in      | Gate        |
| --- | ------------------------------------------------------------------------- | ------------ | ----------- |
| 1   | Node runtime (pinned major) + corepack                                    | both         | **hard**¹   |
| 2   | `pnpm install --frozen-lockfile` — only when Node or the lockfile changed | both         | **hard**    |
| 3   | `.env.local` (`setup:local --only-env`), OAuth buttons off                | both         | **hard**    |
| 4   | Dev server on :5173 serves the app shell — **left running**               | a session    | **hard**    |
| 4   | Docker + the SonarQube gate images                                        | Setup script | best-effort |
| 5   | The agent's tools (`install-agent-tools.sh`), inline                      | Setup script | best-effort |
| —   | The agent's tools, then SonarQube, detached once the dev server is live   | a session    | best-effort |

¹ The install itself is best-effort — a session Node of the right major is fine.
Missing Node entirely is fatal.
Best-effort steps log `•` and continue: a locked-down network should not cost
you a whole session over an optional linter.

Docker is touched only by the Setup script: in a session, `install-docker-images.sh` restarting the
daemon to apply the registry mirror would take clinozy-be's Postgres and Redis down with it.

## Environment variables

| Variable              | Effect                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| `NODE_INSTALL_PREFIX` | Parent dir for `node<major>` (default `/opt`)                                         |
| `GH_VERSION`          | Pin the `gh` release instead of resolving latest                                      |
| `GITLEAKS_VERSION`    | Trial another gitleaks than `tool-versions.sh` pins (set its `GITLEAKS_SHA256_*` too) |
| `HEALTHCHECK_URL`     | Override the probe URL (default `http://localhost:5173/`)                             |

## The session's `.env.local`

A clinozy-fe cloud session is **frontend only**: no clinozy-be, so type-check, lint, unit tests,
build and size all run, while sign-in, E2E and the signed-in screenshots need a Mac (or a session
that also brings up clinozy-be). Step 7 writes `.env.local` with nothing to hand over:

| Source                                                                | Keys                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `envProfiles.local.defaults` (`env-schema.ts`)                        | `VITE_APP_ENV=local`, `VITE_DEV_API_URL=http://localhost:3000`, diagnostics + E2E hooks on, version check off, `BUILD_I18N_MODE=multi`, team-only (`VITE_TEAM_ORGANIZATIONS=true`, `VITE_PERSONAL_ORGANIZATIONS=false`), Turnstile on with Cloudflare's public always-pass **test** site key (pairs with clinozy-be's local test secret) |
| `bootstrap.sh` (cloud only)                                           | `VITE_AUTH_OAUTH_GOOGLE=false`, `VITE_AUTH_OAUTH_GITHUB=false` — no provider sign-in can complete in a cloud session                                                                                                                                                                                                                     |
| Schema defaults                                                       | Everything else (`VITE_AUTH_EMAIL`, `VITE_AUTH_PASSKEY`, layout, Sentry sample rates, all clinic rooms on)                                                                                                                                                                                                                               |
| The environment's **variables** (optional, `setup:local` copies them) | `VITE_STRIPE_PUBLISHABLE_KEY` (a `pk_test_…` key, only to exercise billing), `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` (blank = analytics off). `VITE_SENTRY_DSN` stays blank (Sentry off).                                                                                                                                               |

Never set in a cloud session: `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`, `NETLIFY_*` and
`RELEASE_PLEASE_TOKEN` (CI only), `SONAR_*` (the Docker gate is skipped), a **real** Turnstile key,
`VITE_API_BASE_URL` and `VITE_CSP_REPORT_URI` (deploy only).

## Network allowlist

Cloud environments restrict egress. Each host maps to one capability, and a
blocked host degrades exactly one step:

| Host                            | Needed for              | If blocked                   |
| ------------------------------- | ----------------------- | ---------------------------- |
| `nodejs.org`                    | Pinned Node download    | **Bring-up fails** on step 2 |
| `registry.npmjs.org`            | `pnpm install`          | **Bring-up fails** on step 2 |
| `github.com` / `api.github.com` | `gh`, gitleaks releases | Those tools are skipped      |
| Distro apt mirrors              | Distro CLI tools        | Those tools are skipped      |
| `astral.sh` / `pypi.org`        | `uv` + headroom         | headroom MCP unavailable     |
| `cdn.playwright.dev`            | E2E browsers            | E2E unavailable              |
| `challenges.cloudflare.com`     | The Turnstile widget    | `/login` shows no captcha    |

Only the first two are required. In the Claude Code web UI: set Network access
to **Custom**, add the hosts you want, and keep "Also include default list of
common package managers" checked.

## Prerequisite parity with macOS

`tooling/dev/setup-prerequisites-mac-tools.manifest` is the source of truth for
what a developer's **Mac** installs via Homebrew (`pnpm setup:local` →
`tooling/dev/setup-mac-tools.sh`). This directory is the **Linux/cloud**
counterpart of that same list.

They are separate lists on purpose — brew formulae and apt packages do not map
one-to-one, and the cloud image already ships some tools. But that means adding
a prerequisite requires touching both:

1. Add the line to `setup-prerequisites-mac-tools.manifest` (macOS), and
2. Add it to `install-apt-tools.sh` — or a dedicated `install-<tool>.sh` when it
   is not an apt package — and surface it as a step in `bootstrap.sh`.

Two deliberate divergences from the Mac list:

- **Docker / colima** is not installed here. On a Mac it backs the SonarQube
  pre-push gate; in a cloud session that gate is skipped and the daemon is
  usually unavailable anyway.
- **codegraph** needs no installer: `@colbymchenry/codegraph` is a
  devDependency, so `pnpm exec codegraph` works after step 2. On clinozy-be it is a
  standalone CLI and does have one.

## Relationship to the other setup entry points

| Entry point                           | Audience                                                                                            | What it does                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm setup:local`                    | Developer on macOS/Linux                                                                            | 5 phases, ends by starting `pnpm dev`                                                    |
| `tooling/setup/agent/bootstrap.sh`    | Cloud agent session                                                                                 | This directory — the one entry point; a session's run leaves the dev server running      |
| `bootstrap.sh --install-only`         | Environment **Setup script** and Cursor's `install` (`agent-os/cloud-environment/environment.json`) | The installs only, no server — the same line clinozy-be's Setup script runs              |
| `agent-os/hooks/fe-session-start.mjs` | Every interactive session                                                                           | Fast path — switches Node, installs deps if missing; on the web, launches `bootstrap.sh` |

A cached **Setup script** must terminate, which is why `bootstrap.sh` passes
`--only-env` to `setup:local` and, with `--install-only`, starts no server. The Setup script runs
outside the repositories, so it names each one by path — in a session that holds both:

```bash
bash /home/user/clinozy-be/tooling/setup/agent/bootstrap.sh --install-only
bash /home/user/clinozy-fe/tooling/setup/agent/bootstrap.sh --install-only
```

In a web session the session-start hook launches `bootstrap.sh` detached — as clinozy-be's hook
launches its own — so the app is up beside clinozy-be's live stack without anyone asking. It
launches it once: a dev server already serving the app shell (a resumed session), or a bring-up
holding the lock (`stack-lock.lib.sh`, in `/tmp/agent-stack/frontend/`), is left alone, and a
bring-up that finds the shell already served keeps that server instead of starting a second one.
The logs sit in `/tmp/agent-stack/` (`$AGENT_STACK_DIR`, the directory clinozy-be's bring-up uses):
`bootstrap-frontend.log` (the bring-up), `frontend.log` (Vite) and `agent-tools-frontend.log`. Stop
the dev server with `pkill -s "$(cat /tmp/agent-stack/frontend.pid)"` — the pid is its session's,
so Vite, which pnpm runs in another process group, stops with it.

Once the dev server is live, `bootstrap.sh` launches `start-sonarqube.sh`, detached. The script
waits until no bring-up holds clinozy-be's agent-stack lock (its migrations and seed) and Docker
answers, then starts this repository's SonarQube, so the first push finds the pre-push gate's server
up instead of waiting about two minutes for it. It first checks the lock after 30 seconds, so a
check at once cannot miss a clinozy-be bring-up that is just starting. Its log is
`/tmp/agent-stack/sonarqube-frontend.log`; `SONAR=0` in the environment skips it, and the gate still
starts SonarQube itself whenever it is not up.
