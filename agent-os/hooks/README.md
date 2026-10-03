# `agent-os/hooks/`

clinozy-fe's **own, self-contained** agent hook suite — shell/node scripts that
fire on Claude Code (and Cursor) events. Exposed at `.claude/hooks/` via symlink.
Fully independent: nothing here reaches into a sibling repo's paths, commands,
skills, or services — every gate, command, and skill reference is clinozy-fe's own.

**Every hook FAILS OPEN** — a missing `jq`/`node`, a malformed payload, or any
error exits 0 and allows the action. A hook bug must never brick a session.

## The suite

`hooks.json` is the single source of truth for wiring. **`pnpm agent-os:generate`**
derives the committed artifacts under `agent-os/platforms/`:

| Generated artifact                                                    | Tool symlink            |
| --------------------------------------------------------------------- | ----------------------- |
| `platforms/claude/settings.json` (`hooks` block + shared permissions) | `.claude/settings.json` |
| `platforms/cursor/hooks.json`                                         | `.cursor/hooks.json`    |
| `platforms/codex/hooks.json`                                          | `.codex/hooks.json`     |
| `platforms/codex/config.toml` (from `mcp/mcp.default.json`)           | `.codex/config.toml`    |

Drift gate: `pnpm agent-os:generate:check`.

| Hook                     | Event (Claude)                      | What it does                                                                                   |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `session-start.sh`       | SessionStart                        | Verify/switch Node, install deps (web), scaffold default MCP pair, inject skill map            |
| `prompt-skill-router.sh` | UserPromptSubmit                    | On a build/change prompt, inject the FE skill chain (conservative)                             |
| `guard-edits.sh`         | PreToolUse · Edit\|Write\|MultiEdit | **Deny** `../` imports, direct `lucide-react`, raw palette classes, generated files            |
| `guardrails.mjs`         | PreToolUse · Bash\|Edit\|Write      | **Deny** destructive shell (`rm -rf`, force-push, fork bomb) + secrets; warn on vendored paths |
| `no-unrequested-pr.sh`   | PreToolUse · create_pull_request    | **Ask** before opening a PR unless explicitly requested                                        |
| `format-edits.sh`        | PostToolUse · Edit\|Write           | Prettier-format the edited file (Prettier owns formatting here)                                |
| `skill-reminder.sh`      | PostToolUse · Edit\|Write           | Print the skill(s) relevant to the edited file                                                 |
| `stop-gate-reminder.sh`  | Stop                                | Surface the gates implied by uncommitted changes (non-blocking)                                |
| `compact-resume-card.sh` | SessionStart (`compact`)            | After a compaction, re-inject a resume card (branch, uncommitted count, definition of done)    |
| `session-end.sh`         | SessionEnd                          | Warn about uncommitted work (ephemeral cloud envs)                                             |
| `gate-failure-hint.sh`   | _(tool-failure; manifest-only)_     | Turn a failed `pnpm` gate into a fix hint — wire only where supported                          |
| `cursor-shell-guard.mjs` | Cursor · beforeShellExecution       | Same destructive-shell block for the Cursor agent                                              |

The file→skill map these hooks consult lives in
[`../docs/skill-triggers.md`](../docs/skill-triggers.md); FE gates are
`pnpm health` (all phases) / `tsc` / `lint` / `validate:tokens` /
`validate:structure` / `test`.

## Wiring

- **Claude Code**: `.claude/settings.json` → `agent-os/platforms/claude/settings.json`
  (generated `hooks` block + shared permissions). Merges with `.claude/settings.local.json`
  (machine-local permission overrides — gitignored).
- **Cursor**: `.cursor/hooks.json` → `agent-os/platforms/cursor/hooks.json` (generated).
- **Codex**: `.codex/hooks.json` and `.codex/config.toml` → `agent-os/platforms/codex/` (generated).

To change wiring, edit `hooks.json` then run `pnpm agent-os:generate`.

## Authoring tips

- Keep hooks fail-open and dependency-light (`jq` optional).
- New blocking rule? Make it **mechanically unambiguous** (a normal edit must
  never be denied) and mirror an existing CI/validator rule.
- `update-config` (skill) writes `settings.json` safely; `hookify:hookify`
  (skill) generates hooks from natural-language descriptions.
