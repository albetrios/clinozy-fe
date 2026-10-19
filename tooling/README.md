# Tooling

Project scripts and automation — mirrors the **clinozy-be** `tooling/` layout. Run from repo root via `pnpm` (prefer `pnpm <script>` over direct paths).

## Layout

```text
tooling/
├── agent-os/          # Derive platform wiring from agent-os/hooks + targets
├── dev/               # Local bootstrap (pnpm setup:local, mcp:setup)
├── ci/                # CI checks (patch coverage, contract drift, preload graph, …)
├── iterations/        # Design-iteration commands (pnpm iteration:*) + the README template
├── setup/
│   ├── setup.config.json
│   └── github/        # GitHub IaC sync (pnpm github:sync)
├── validate/          # Structure, tokens, env-example, health-check, pre-commit guard
├── sonar/             # Local SonarQube gate
├── stryker/           # Vitest runner shim for the weekly mutation lane (stryker.config.json)
├── tsdoc-coverage/    # TSDoc budget ratchet
├── reports/           # Code review report generator
├── validate/
│   └── sync-env-example.ts   # Schema ↔ .env.example parity (pnpm tool:sync-env-example)
├── load-env-files.mjs        # Node script env loader for tooling
```

## Writing a script

One way for each job a script does, each pinned by a `tests/ci` policy:

- **Command line** — `parseCommandLine(process.argv.slice(2), { options })` (node:util `parseArgs`,
  strict) and `if (isMain(import.meta.url))` from `ci/script.mjs`; add the script to the table in
  `ci/script.test.mjs`, which checks it stops on an unknown option.
- **git** — `git`, `tryGit` and `resolveBase` from `ci/git-environment.mjs`, never a `git` child
  process of its own.
- **`.ts` tooling** — run with `tsx <file>`.
- **Tests** — beside the script (`<script>.test.mjs`), on Vitest: `describe` / `it` / `expect`
  from `vitest`, run by the `tooling` project of `vitest.config.ts` (`pnpm test:github-scripts`).

## Common commands

| Command                   | Script                                          |
| ------------------------- | ----------------------------------------------- |
| `pnpm setup:local`        | `tooling/dev/setup-local.ts`                    |
| `pnpm mcp:setup`          | `tooling/dev/setup-mcp.ts`                      |
| `pnpm agent-os:generate`  | `tooling/agent-os/generate.mjs`                 |
| `pnpm health`             | `tooling/validate/health-check.sh`              |
| `pnpm github:sync`        | `tooling/setup/github/sync.mjs`                 |
| `pnpm iteration:new`      | `tooling/iterations/new-iteration.mjs`          |
| `pnpm iteration:intake`   | `tooling/iterations/intake-iteration.mjs`       |
| `pnpm iteration:diff`     | `tooling/iterations/diff-iterations.mjs`        |
| `pnpm iteration:baseline` | `tooling/iterations/set-iteration-baseline.mjs` |
| `pnpm iteration:status`   | `tooling/iterations/set-iteration-status.mjs`   |
| `pnpm iteration:list`     | `tooling/iterations/list-iterations.mjs`        |

## MCP templates (root + mirrors)

Committed templates live at the repo root (same as clinozy-be); `agent-os/mcp/` mirrors them:

| File                | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `.mcp.default.json` | Auto-start pair: codegraph + headroom                              |
| `.mcp.example.json` | Full frontend MCP set                                              |
| `.mcp.json`         | Gitignored live config (scaffolded by `setup:local` / `mcp:setup`) |
