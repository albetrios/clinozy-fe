# agent-os/commands — cross-platform custom commands

Reusable, project-scoped slash commands shared by all three AI tools. This
directory is the **single source of truth**; each tool reads it through a symlink
(the same pattern as `agent-os/agents` and `agent-os/skills`).

## How each tool picks them up

| Tool            | Path                | Wiring                                       | Invoke                                      |
| --------------- | ------------------- | -------------------------------------------- | ------------------------------------------- |
| **Claude Code** | `.claude/commands/` | symlink → `../agent-os/commands` (committed) | `/fe-validate`, `/fe-build-requirement ...` |
| **Cursor**      | `.cursor/commands/` | symlink → `../agent-os/commands` (committed) | type `/` in chat (Cursor ≥ 1.6)             |
| **Codex**       | `~/.codex/prompts/` | user-global — see setup below                | `/<name>` in the TUI                        |

> Cursor ignores the YAML frontmatter and uses the markdown body as the prompt;
> Claude Code and Codex read `description` / `argument-hint` and expand
> `$ARGUMENTS`.

### Codex setup (one-time, per machine)

Codex loads prompts from `~/.codex/prompts/*.md` (user-global, not committable).
To use these with Codex, symlink each file into your prompts dir:

```bash
mkdir -p ~/.codex/prompts
for f in "$PWD"/agent-os/commands/*.md; do ln -sf "$f" ~/.codex/prompts/; done
```

## Commands

Granular procedures live in **skills** (invoked by name); these commands are **workflows** that orchestrate them. Names are collision-checked against skills (`pnpm agent-os:check`).

**Core gates**

| Command                     | Purpose                                                                                                                                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/fe-validate [--affected]` | Run `pnpm lint`, `pnpm type-check`, `pnpm validate:structure`, `pnpm validate:tokens`, `pnpm validate:testids`, `pnpm validate:theme-axis`; fix introduced issues. `--affected`: `pnpm test:affected` — what `git push` will run and the tests the selection picks, each with why; changes nothing. |
| `/fe-ci-local`              | Run `pnpm health` (local PR gate) and map failures to `.github/workflows/pr-ci.yml` lanes.                                                                                                                                                                                                          |
| `/fe-routes-sync`           | Re-sync `routeTree.tsx`, RBAC, and `docs/reference/routes-and-ui.md` after route changes.                                                                                                                                                                                                           |

**Autonomous build**

| Command                 | Purpose                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/fe-build-requirement` | Draft FE requirement → full production-ready slice (route island → tests → lint → docs) + reports bundle. Orchestrates **fe-auto-implement**. |

**Review**

| Command                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/fe-pre-merge-review [release]` | Read-only pipeline (steps and their `when` from `agent-os/agents/pipelines.json`: the verifier always, fe-docs-auditor on docs changes, fe-production-hardening-reviewer and the fe-full-code-review code pass when auth, tokens, CSP or tenancy change; `release`: everything since the last release tag) — the needed reviewers at once, in the background; one report in `REVIEW.md` → Findings format. |
| `/fe-prod-readiness`             | Read-only production-readiness sweep: fe-dependency-auditor + fe-production-hardening-reviewer at once (the hardening reviewer once per HEAD), then fe-bundle-size-reviewer → fe-perf-auditor (each builds); one report in `REVIEW.md` → Findings format.                                                                                                                                                  |

**PR lifecycle**

| Command               | Purpose                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/fe-open-pr [title]` | Push the branch + open a PR to **`main`** (explicit PR opt-in).                                                                                                                       |
| `/fe-watch-pr <n>`    | Triage CI + review comments until both required contexts — **`Quality gate`** + **`Checks`** — are green; then /fe-merge-pr.                                                          |
| `/fe-merge-pr <n>`    | Turn on GitHub auto-merge (`gh pr merge --auto --squash`): GitHub merges when every required check passes; never around a red one.                                                    |
| `/fe-ship [title]`    | Full flow: pre-merge-review (a critical or major finding stops the push) → open-pr → merge-pr (auto-merge on) → watch-pr.                                                             |
| _Release_             | Trunk-based (single `main`): merge the standing release-please **Release PR** to ship → tag + prod deploy. See [trunk-based-workflow.md](../../docs/process/trunk-based-workflow.md). |

**Maintenance**

| Command             | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `/fe-agent-os-sync` | Regenerate platform adapters + run agent-os gates; fix drift. |

**Backend-only (stub)**

| Command               | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `/fe-worker-complete` | Stub — points to clinozy-be; no worker runtime in clinozy-fe. |

## Not imported from clinozy-be

These clinozy-be commands are **backend-specific** and intentionally omitted:

| clinozy-be command    | Reason                         |
| --------------------- | ------------------------------ |
| `/be-new-domain`      | Drizzle domain scaffold — N/A  |
| `/be-schema-complete` | Schema → migration → RLS chain |
| `/be-route-complete`  | OpenAPI route catalog chain    |

## Related: SessionStart + guardrails

The session-start and guardrail follow-up is implemented — see
[`agent-os/hooks/README.md`](../hooks/README.md):

- **SessionStart** (`agent-os/hooks/fe-session-start.mjs`) — verifies Node/deps, installs if needed, prints the skill-trigger map.
- **Guardrails** — block destructive shell, secret writes and skipping the git hooks
  (`--no-verify`, `git commit -n`, `HUSKY=0`); warn on protected paths
  and cross-layer imports. Claude: `PreToolUse`; Cursor: `beforeShellExecution`
  - advisory rules; Codex: AGENTS.md policy + sandbox/approvals.

## Related docs

- Requirement format: [`docs/getting-started/requirement-format.md`](../../docs/getting-started/requirement-format.md)
- Auto-implement pipeline: [`agent-os/skills/fe-auto-implement/SKILL.md`](../skills/fe-auto-implement/SKILL.md)
- Route islands: [`agent-os/skills/fe-route-island/SKILL.md`](../skills/fe-route-island/SKILL.md)
- PR CI lanes: [`.github/workflows/pr-ci.yml`](../../.github/workflows/pr-ci.yml)
- Deploy / release: [`docs/deployment/cicd-and-netlify.md`](../../docs/deployment/cicd-and-netlify.md)
