# Tooling

Project scripts and automation — mirrors the **clinozy-be** `tooling/` layout. Run from repo root via `pnpm` (prefer `pnpm <script>` over direct paths).

## Layout

```text
tooling/
├── agent-os/          # Derive platform wiring from agent-os/hooks + targets
├── dev/               # Local bootstrap (pnpm setup:local, mcp:setup)
├── ci/                # CI checks (patch coverage, contract drift, preload graph, …)
├── setup/
│   ├── setup.config.json
│   └── github/        # GitHub IaC sync (pnpm github:sync)
├── validate/          # Structure, tokens, env-example, health-check, pre-commit guard
├── sonar/             # Local SonarQube gate
├── tsdoc-coverage/    # TSDoc budget ratchet
├── reports/           # Code review report generator
├── validate/
│   └── sync-env-example.ts   # Schema ↔ .env.example parity (pnpm tool:sync-env-example)
├── load-env-files.mjs        # Node script env loader for tooling
```

## Common commands

| Command                  | Script                             |
| ------------------------ | ---------------------------------- |
| `pnpm setup:local`       | `tooling/dev/setup-local.ts`       |
| `pnpm mcp:setup`         | `tooling/dev/setup-mcp.ts`         |
| `pnpm agent-os:generate` | `tooling/agent-os/generate.mjs`    |
| `pnpm health`            | `tooling/validate/health-check.sh` |
| `pnpm github:sync`       | `tooling/setup/github/sync.mjs`    |

## MCP templates (root + mirrors)

Committed templates live at the repo root (same as clinozy-be); `agent-os/mcp/` mirrors them:

| File                | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `.mcp.default.json` | Auto-start pair: codegraph + headroom                              |
| `.mcp.example.json` | Full frontend MCP set                                              |
| `.mcp.json`         | Gitignored live config (scaffolded by `setup:local` / `mcp:setup`) |
