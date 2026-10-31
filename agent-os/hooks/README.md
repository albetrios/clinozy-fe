# `agent-os/hooks/`

clinozy-fe's **own, self-contained** agent hook suite — Node scripts that
fire on Claude Code (and Cursor) events. Exposed at `.claude/hooks/` via symlink.
Fully independent: nothing here reaches into a sibling repo's paths, commands,
skills, or services — every gate, command, and skill reference is clinozy-fe's own.

**One runtime.** Every hook is a Node `.mjs` script run as `node agent-os/hooks/<script>`;
none needs bash or `jq`. The jobs every hook shares live once, in
[`_fe-hook.mjs`](_fe-hook.mjs): reading the JSON payload from stdin, the repository root
(`CLAUDE_PROJECT_DIR`, else two levels above the hook), whether a path is inside this
repository, and writing the outputs (PreToolUse `permissionDecision` deny,
`hookSpecificOutput.additionalContext`, `systemMessage`). A hook that installs tools (session
start) still spawns the installers — `pnpm`, `corepack`, `tooling/setup/agent/install-gitleaks.sh`
— from Node. Pinned by `tests/ci/agent-hook-runtime.policy.test.ts`.

**Every hook FAILS OPEN** — a malformed payload or any error exits 0 and allows the
action. A hook bug must never brick a session.

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

| Hook                         | Event (Claude)                                                      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fe-session-start.mjs`       | SessionStart · startup\|resume                                      | Verify/switch Node, install deps (web), launch the bring-up (web: `tooling/setup/agent/bootstrap.sh`, detached, once, as clinozy-be's hook launches its own — it leaves `pnpm dev` running on :5173; `Frontend:` banner line, log `/tmp/agent-stack/bootstrap-frontend.log`), scaffold default MCP pair, inject skill map (startup only; a resume gets the summary)                                                                                                                                                                                                                                       |
| `fe-prompt-skill-router.mjs` | UserPromptSubmit                                                    | On a build/change prompt, inject the FE skill chain (conservative), and on a PR to drive ("babysit", "make it green", "fix CI") name `fe-pr-babysit`; a new prompt resets the once-per-turn reminders (`_fe-turn-once.mjs`)                                                                                                                                                                                                                                                                                                                                                                               |
| `fe-guard-edits.mjs`         | PreToolUse · Edit\|Write\|MultiEdit                                 | **Deny** `../` imports, direct `lucide-react`, raw palette classes, generated files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `fe-guardrails.mjs`          | PreToolUse · Bash\|Read\|Grep\|Edit\|Write\|MultiEdit               | **Deny** reading or writing `.env*` (not `.env.example`), skipping the git hooks (`--no-verify`, `git commit -n`, `HUSKY=0`), destructive shell (`rm -rf`, force-push, fork bomb) + secret content (MultiEdit `edits[]` too); warn on vendored paths and on a `git push` of auth, token, CSP, routeTree or guard changes while `/fe-pre-merge-review` has no clean record for HEAD (`pnpm agent-os:review-clean`; only pushes in this repository, `git -C` and `cd` followed; fails open); never asks                                                                                                     |
| `fe-edit-hooks.mjs`          | PostToolUse · Edit\|Write (`if`: `Edit(**)`, `Write(**)`) · Stop    | One process per edit: queues the edited file and Prettier-formats the turn's files once at Stop; adds the skill(s) for the edited file and the gates implied by uncommitted changes as `additionalContext`, each once per turn (Codex: Stop, plain-text checklist; non-blocking)                                                                                                                                                                                                                                                                                                                          |
| `fe-turn-end-tests.mjs`      | Stop (`asyncRewake`, 120 s)                                         | At turn end, in the background: the tests the uncommitted changes affect (`pnpm test:select`, the change's own picks — the always-run security and scanner sets stay with the push) within a 60-second budget, one run at a time. A failure exits 2 and wakes the model with the failing tests; a selection of everything wakes it once per reason in a session with a heads-up that the next push runs the whole suite; a pass, a timeout or a skip says nothing. Skips a tree it already passed. Fails open                                                                                             |
| `fe-push-ci-watch.mjs`       | PostToolUse · Bash (`if`: `Bash(git push*)`; `asyncRewake`, 45 min) | After a push from the CLI, in the background: reads `gh run list --commit <sha>` every 30 s (5 min for the runs to appear, 40 to finish) and wakes the model when a run of the pushed commit fails, naming it and asking for `fe-ci-investigator`; a cancelled run counts only while HEAD is still that commit. Needs an authenticated `gh`; all green, no gh or any error stays silent. One watch per commit; only pushes in this repository (`_fe-push-target.mjs`, shared with the push review gate). A cloud session has no signed-in `gh` (telemetry `no-gh`); there the PR subscription watches CI. |
| `fe-compact-resume-card.mjs` | SessionStart (`compact`)                                            | After a compaction, re-inject a resume card (branch, uncommitted count, definition of done)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `fe-session-end.mjs`         | SessionEnd                                                          | Warn about uncommitted work (ephemeral cloud envs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `fe-gate-failure-hint.mjs`   | _(tool-failure; manifest-only)_                                     | Turn a failed `pnpm` gate into a fix hint, and name `--silent` when pnpm 12 rejects `-s` — wire only where supported                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `fe-cursor-shell-guard.mjs`  | Cursor · beforeShellExecution                                       | Same destructive-shell block for the Cursor agent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The file→skill map these hooks consult lives in
[`../docs/skill-triggers.md`](../docs/skill-triggers.md); its "By file pattern" table and
[`skill-routing.json`](skill-routing.json), which `fe-edit-hooks.mjs` reads, are generated by
`pnpm agent-os:generate` from `chains.json` and the skills' `trigger` frontmatter. FE gates are
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
  bootstrap's agent tools, `install-agent-tools.sh`) writes every repository's hooks there with absolute paths and
  `CLAUDE_PROJECT_DIR="<repository>"` in front of each command, and registers each repository's
  codegraph server at user level (`~/.claude.json`); it is a no-op in a single-repository checkout. Canary: the SessionStart context names the root the hooks ran from
  (`clinozy-fe session ready (hooks from …)`), and each run adds a `fe-session-start` row to the
  gitignored `agent-os/hooks/.telemetry.log`.

To change wiring, edit `hooks.json` then run `pnpm agent-os:generate`.

## Telemetry (measure, then prune)

Every hook records one line per run — `timestamp,hook-id,event,fired|silent` — to the
gitignored `agent-os/hooks/.telemetry.log` via the shared helper
[`_fe-telemetry.mjs`](_fe-telemetry.mjs) (clinozy-be's `_be-telemetry.mjs`, same format).
A run is **fired** when the hook actually acts (blocks or asks, adds context, warns, wakes the
model); **silent** when it no-ops. A hook with more than two outcomes still writes only `fired`
or `silent` and names the outcome in an optional 5th column (`fe-push-ci-watch`: `not-a-push`,
`no-gh`, `green`; `fe-turn-end-tests`: `no-changes`, `passed`, …), so the readers, which count
`fired`, never miss a real fire. Logging is fail-open — a telemetry error can never block or
fail the hook. The hook tests set `HOOK_TELEMETRY_LOG` (in `tests/utils/setup.ts`) so a test run
never counts in the real log.

Aggregate it with:

```bash
pnpm agent-os:hooks:report   # runs / fired / silent / silent% / last-fired per hook
```

For each pruning candidate it also prints why the hook stayed quiet: its top silent reasons
from the detail column, e.g. `fe-push-ci-watch: not-a-push 519, no-gh 18`. A dead hook and a
too-narrow trigger then read differently. Ids that `hooks.json` no longer declares (a renamed
hook's old rows) are listed apart as retired, not as candidates.

**Monthly ritual:** run the report and review the pruning candidates it flags — a hook that has
**never fired** or has been **silent for 30+ days** is dead weight. Either delete it (remove the
script, its `hooks.json` entry, and run `pnpm agent-os:generate`) or fix why it isn't firing. A
high silent ratio is fine for guard hooks (they should mostly pass through); a _zero fired_ count
over a month is the real smell. `fe-session-start.mjs` also names any hook silent 30+ days (or
never fired across 50+ runs), with its top silent reasons, in the session briefing.

## Authoring tips

- Keep hooks fail-open and dependency-light: a new hook is a `.mjs` script that imports
  `_fe-hook.mjs` for its payload, root, repository check and output — never its own stdin
  reader or root lookup, and never a bash or `jq` hook.
- **Own files only.** With several repositories in one session every repository's hooks see every
  edit, so `fe-guard-edits.mjs`, `fe-edit-hooks.mjs` and the `fe-guardrails.mjs`
  warnings act only on files under `$CLAUDE_PROJECT_DIR` (`isInsideRepository`, which resolves a
  relative path against the root first). The secret and destructive-shell blocks cover every
  path. Pinned by `tests/ci/agent-hooks-repository-scope.policy.test.ts`.
- **One rule set.** The destructive-shell patterns, the secret env paths and the edit rules
  (`editRuleViolations`, R1–R4 — the shape of clinozy-be's `_be-guard-rules.mjs`) live once, in
  `_fe-guard-rules.mjs`; the Claude guardrail (`fe-guardrails.mjs`), the edit guard
  (`fe-guard-edits.mjs`) and the Cursor mirror (`fe-cursor-shell-guard.mjs`) import it, so the
  platforms cannot drift apart.
- **Reach the model.** Plain stdout from PostToolUse or Stop never reaches it; a reminder goes
  out as `hookSpecificOutput.additionalContext` from PostToolUse, once per turn through
  `_fe-turn-once.mjs` (reset by `fe-prompt-skill-router.mjs`), so no Stop hook forces another turn.
- New blocking rule? Make it **mechanically unambiguous** (a normal edit must
  never be denied) and mirror an existing CI/validator rule.
- `update-config` (skill) writes `settings.json` safely; `hookify:hookify`
  (skill) generates hooks from natural-language descriptions.
