# SonarQube — local quality gate

SonarQube runs **locally** (Docker) and is enforced as a **pre-push gate**: when you push commits
that touch deployed-surface code (`src/` runtime), the hook scans the project and **blocks the
push if SonarQube reports any unresolved issue or hotspot**. Everything is local — there is no
hosted SonarQube and no CI dependency. Same setup as clinozy-be (`../clinozy-be`), ported for this repo.

## TL;DR

```bash
pnpm sonar:up      # start the local SonarQube server (detached; first boot ~2 min)
pnpm sonar:scan    # scan now + print the report; exits non-zero if anything is open
git push           # the pre-push hook runs the same gate automatically
pnpm quality       # full local quality story: pnpm health (all phases) + the Sonar gate
```

First run provisions an analysis token into `.env.local` (gitignored); after that a scan is
~60–90s. The pre-push gate auto-starts the server if it is down.

## Commands (`sonar:*` namespace)

| Command            | What it does                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `pnpm sonar:up`    | Start the local SonarQube server (`docker-compose.sonar.yml`).                                          |
| `pnpm sonar:scan`  | Run the quality gate now: ensure server up → scan → wait → report. Exit 1 if any issue/hotspot, else 0. |
| `pnpm sonar:down`  | Stop the server (keeps the analysis volume).                                                            |
| `pnpm sonar:reset` | Wipe the volume and start fresh (`down -v`). Use if auth/state gets stuck.                              |

The server UI is at <http://localhost:9000>. Admin credentials are generated on first run and
stored in `.env.local` as `SONAR_ADMIN_PASSWORD` / `SONAR_TOKEN` (gitignored — and the
forbidden-secret validator `pnpm validate:client-env` checks only git-tracked env files, so these
`SONAR_*` keys never trip it).

### Sharing port 9000 with clinozy-be

Both repos use `localhost:9000`. If clinozy-be's SonarQube is already running, the gate **reuses it**
(one server, two projects — `clinozy-fe` appears next to `clinozy-be` in the same UI). For the gate to
mint a `clinozy-fe` token there, copy `SONAR_ADMIN_PASSWORD` from `clinozy-be/.env.local` into this
repo's `.env.local`. The scanner container always targets the host port (`host.docker.internal:9000`),
so it reaches whichever server owns it.

## How the pre-push gate works

The `.husky/pre-push` hook runs the gate **only when the pushed commits include deployed-surface
code** — `src/**/*.{ts,tsx}` excluding tests, fixtures, and `*.placeholder-data.ts` modules. Pushes that touch
only tests, scripts, docs, or config skip the scan (Sonar excludes those anyway — see
[Scope](#what-sonarqube-analyzes)).

The gate ([`tooling/sonar/sonar-gate.mjs`](../../../tooling/sonar/sonar-gate.mjs), a plain-Node
port of clinozy-be's `tooling/sonar/sonar-gate.mjs`):

1. **Auto-starts** the SonarQube container if it is not already up, and waits for it to be ready.
2. **Provisions a token** on first run (changes the default `admin/admin` password to a generated
   one, mints a token, saves both to `.env.local`). Idempotent afterwards.
3. **Scans** via the `sonar-scanner-cli` container.
4. **Waits** for the server to finish processing the report.
5. **Reports** every unresolved issue + hotspot and **exits 1** (blocking the push) if there is at
   least one; exits 0 when clean.

### No bypass

There is **no per-gate skip** for Sonar: a red gate must be fixed, not dodged. (`git push
--no-verify` skips _all_ pre-push hooks — build, tests, everything — so it is not a Sonar
escape hatch and must not be used to route around a red gate.)

## What SonarQube analyzes

Analysis is scoped to the **deployed-application surface** (`src/` runtime). Excluded from
analysis (see [`sonar-project.properties`](../../../sonar-project.properties)):

- **Tests** — `*.test.ts(x)`, `*.spec.ts(x)`, `__tests__/`, plus the root `tests/` tree
  (Playwright e2e, vitest utils — dev tooling with trusted inputs).
- **Placeholder UI data** — `src/**/*.placeholder-data.ts`, `src/**/*.fixtures.ts` (REPLACE_WITH_API static stubs).
- **Generated and build artifacts** — `dist/`, `coverage/`, `*.d.ts`.

Coverage comes from vitest's lcov output (`pnpm test:ci` → `coverage/lcov.info`).

So a clean gate means **zero issues in the code that ships to production**.

## Troubleshooting

- **"failed to start SonarQube (is Docker running?)"** — start Docker Desktop, then retry. On Linux
  (a cloud session) the gate starts a stopped daemon itself (`tooling/setup/agent/ensure-docker-daemon.sh`),
  and the cached Setup script pre-pulls the images through the `mirror.gcr.io` Docker Hub mirror.
- **SonarQube stops during start-up on a nearly full disk** — Elasticsearch refuses an index on a
  disk under 10% free, so `docker-compose.sonar.yml` keeps the index on a 2 GB tmpfs; it is rebuilt
  from the database at every start.
- **"admin password is unknown"** — the instance was provisioned outside this flow (e.g. it is
  clinozy-be's server). Copy `SONAR_ADMIN_PASSWORD` from `clinozy-be/.env.local`, or run
  `pnpm sonar:reset` to start fresh.
- **Server swapped under stored credentials** (clinozy-be's instance went away and the gate booted a
  fresh one while `.env.local` still held the old password) — the gate self-heals: a 401 during
  token minting triggers re-provisioning from the fresh instance's `admin/admin` default.
- **Port 9000 already in use when `sonar:up` fails** — clinozy-be's server owns the port; that is
  fine, see [Sharing port 9000](#sharing-port-9000-with-clinozy-be).
- **Server slow / stuck after an upgrade** — `pnpm sonar:reset`.
- **Gate is red** — fix the reported issues, then re-push. There is no per-gate bypass.
