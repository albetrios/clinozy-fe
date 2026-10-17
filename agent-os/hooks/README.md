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

| Hook                     | Event (Claude)                                        | What it does                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-start.sh`       | SessionStart · startup\|resume                        | Verify/switch Node, install deps (web), scaffold default MCP pair, inject skill map (startup only; a resume gets the summary)                                                                                                                                                       |
| `prompt-skill-router.sh` | UserPromptSubmit                                      | On a build/change prompt, inject the FE skill chain (conservative); a new prompt resets the once-per-turn reminders (`_turn-once.sh`)                                                                                                                                               |
| `guard-edits.sh`         | PreToolUse · Edit\|Write\|MultiEdit                   | **Deny** `../` imports, direct `lucide-react`, raw palette classes, generated files                                                                                                                                                                                                 |
| `guardrails.mjs`         | PreToolUse · Bash\|Read\|Grep\|Edit\|Write\|MultiEdit | **Deny** reading or writing `.env*` (not `.env.example`), skipping the git hooks (`--no-verify`, `git commit -n`, `HUSKY=0`), destructive shell (`rm -rf`, force-push, fork bomb) + secret content (MultiEdit `edits[]` too); **ask** before `gh pr create`; warn on vendored paths |
| `no-unrequested-pr.sh`   | PreToolUse · create_pull_request                      | **Ask** before opening a PR unless explicitly requested                                                                                                                                                                                                                             |
| `format-edits.sh`        | PostToolUse · Edit\|Write\|MultiEdit                  | Prettier-format the edited file (Prettier owns formatting here)                                                                                                                                                                                                                     |
| `skill-reminder.sh`      | PostToolUse · Edit\|Write\|MultiEdit                  | Add the skill(s) relevant to the edited file as `additionalContext`, each reminder once per turn                                                                                                                                                                                    |
| `stop-gate-reminder.sh`  | PostToolUse · Edit\|Write\|MultiEdit                  | Add the gates implied by uncommitted changes as `additionalContext`, each once per turn (Codex: Stop, plain text; non-blocking)                                                                                                                                                     |
| `compact-resume-card.sh` | SessionStart (`compact`)                              | After a compaction, re-inject a resume card (branch, uncommitted count, definition of done)                                                                                                                                                                                         |
| `session-end.sh`         | SessionEnd                                            | Warn about uncommitted work (ephemeral cloud envs)                                                                                                                                                                                                                                  |
| `gate-failure-hint.sh`   | _(tool-failure; manifest-only)_                       | Turn a failed `pnpm` gate into a fix hint — wire only where supported                                                                                                                                                                                                               |
| `cursor-shell-guard.mjs` | Cursor · beforeShellExecution                         | Same destructive-shell block for the Cursor agent                                                                                                                                                                                                                                   |

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
- **Claude Code, several repositories in one session**: a web session that holds clinozy-fe and
  clinozy-be runs from their parent (`/home/user`) and takes hooks only from
  `/home/user/.claude/settings.json`. `pnpm agent-os:session-hooks`
  ([`tooling/agent-os/session-hooks.ts`](../../tooling/agent-os/session-hooks.ts), run by the cloud
  bootstrap's step 8) writes every repository's hooks there with absolute paths and
  `CLAUDE_PROJECT_DIR="<repository>"` in front of each command; it is a no-op in a
  single-repository checkout. Canary: the SessionStart context names the root the hooks ran from
  (`clinozy-fe session ready (hooks from …)`), and each run adds a `session-start` row to the
  gitignored `agent-os/hooks/.telemetry.log`.

To change wiring, edit `hooks.json` then run `pnpm agent-os:generate`.

## Authoring tips

- Keep hooks fail-open and dependency-light (`jq` optional).
- **Own files only.** With several repositories in one session every repository's hooks see every
  edit, so `guard-edits.sh`, `format-edits.sh`, `skill-reminder.sh` and the `guardrails.mjs`
  warnings act only on files under `$CLAUDE_PROJECT_DIR`. The secret and destructive-shell blocks
  cover every path. Pinned by `tests/ci/agent-hooks-repository-scope.policy.test.ts`.
- **Reach the model.** Plain stdout from PostToolUse or Stop never reaches it; a reminder goes
  out as `hookSpecificOutput.additionalContext` from PostToolUse, once per turn through
  `_turn-once.sh` (reset by `prompt-skill-router.sh`), so no Stop hook forces another turn.
- New blocking rule? Make it **mechanically unambiguous** (a normal edit must
  never be denied) and mirror an existing CI/validator rule.
- `update-config` (skill) writes `settings.json` safely; `hookify:hookify`
  (skill) generates hooks from natural-language descriptions.
