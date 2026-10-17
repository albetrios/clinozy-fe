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

## Claude Code permissions

`agent-os/platforms/claude/settings.json` (`.claude/settings.json`) holds the permission rules; the
generator keeps them by hand and only derives the `hooks` block. Claude Code checks `deny`, then
`ask`, then `allow`.

| List    | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `allow` | named scripts only — the gates (`pnpm validate*`, `test*`, `lint*`, `type-check*`, `biome*`, `format*`, `health*`, …), `build*`, `dev*`, `preview*`, `iteration*`, `agent-os*`, `sonar*`, `pnpm install` without a package; `git add` / `commit` / `push` / `switch`; `gh pr`, `gh issue`, `gh run`; the context7, shadcn, tailwindcss, codegraph and headroom MCP tools and the read-only GitHub MCP tools (`get_*`, `list_*`, `search_*`, PR, issue and Actions reads) | the commands an agent chains run without a prompt; `main` stays protected by its ruleset                            |
| `ask`   | `gh pr create`, `pnpm dlx`, `pnpm add`, `pnpm exec`                                                                                                                                                                                                                                                                                                                                                                                                                      | a PR only when the user asked (`guardrails.mjs` asks too); a new dependency or a downloaded tool is the user's call |
| `deny`  | `git push --force`, `git push -f`, `rm -rf`, `mcp__github__delete_file`                                                                                                                                                                                                                                                                                                                                                                                                  | never run by an agent; `guardrails.mjs` blocks the shell ones too                                                   |

Any other `pnpm` script (`deploy`, `rebrand`, `github:*`, `setup:*`, `env:*`, …) and every other
GitHub MCP write still prompts. In a session that holds several repositories,
`pnpm agent-os:session-hooks` merges each repository's rules into the session root's
`.claude/settings.json`, because a repository's own settings contribute no permission rules there
(the same as clinozy-be).

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
