# Agent platform access (clinozy-fe)

All project agents, skills, rules, hooks, and MCP templates live under [`agent-os/`](../). Tool directories (`.cursor/`, `.claude/`, `.codex/`) contain **symlinks only** plus gitignored personal files.

## Layout

| Source                                 | Purpose                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `agent-os/skills/`                     | Cursor, Claude, Codex (`.cursor/skills`, `.claude/skills`)                  |
| `agent-os/agents/`                     | Cursor, Claude agents                                                       |
| `agent-os/rules/`                      | Cursor rules                                                                |
| `agent-os/hooks/`                      | Hook scripts; `hooks.json` → `tooling/agent-os/generate.ts`                 |
| `.mcp.example.json`                    | Full MCP template (committed)                                               |
| `.mcp.default.json`                    | Default pair: codegraph + headroom (committed)                              |
| `agent-os/mcp/mcp.*.json`              | Mirrors of root templates                                                   |
| `.mcp.json`                            | Gitignored live config (`pnpm mcp:setup` / `setup:local`)                   |
| `agent-os/platforms/codex/config.toml` | Codex hooks only — **no project MCP** (configure MCP in Codex UI if needed) |

## Regenerate derived wiring

After editing `agent-os/hooks/hooks.json` or MCP templates:

```bash
pnpm agent-os:generate
pnpm agent-os:generate:check   # fails on drift
```

## Personal / machine-local files

| File                          | Purpose                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `.mcp.json`                   | Live MCP config (API keys) — `pnpm mcp:setup` or `pnpm setup:local` |
| `.claude/settings.local.json` | Claude Code permission overrides                                    |
| `~/.codex/config.toml`        | Codex sandbox policy (outside repo)                                 |

Never commit secrets.

## Invoke subagents

| Tool            | How                                                               |
| --------------- | ----------------------------------------------------------------- |
| **Cursor**      | `@<agent-name>` in Agent mode                                     |
| **Claude Code** | `"Read agent-os/agents/<agent-name>.md and follow the procedure"` |
| **Codex**       | Reference by name; skills from `agent-os/skills/`                 |

See [`agents/README.md`](../agents/README.md) for the local catalog.
