#!/usr/bin/env bash
# Claude Code SessionStart hook (matcher `compact`) for clinozy-fe.
#
# Right after the conversation is compacted, re-inject a small, high-signal
# "resume card" so the essentials survive: current branch + uncommitted-change
# count, and a pointer to the agent-os skill-routing map + definition-of-done.
# Keeps a long unattended session from losing the thread across auto-compaction.
#
# Why SessionStart and not PreCompact: Claude Code adds nothing a PreCompact hook
# prints to the model's context, and rejects a `hookSpecificOutput` naming
# PreCompact — the card never arrived. SessionStart with the `compact` matcher is
# the documented way to re-inject context after a compaction.
#
# Output: SessionStart additionalContext envelope (jq); plain stdout fallback
# (also added to the context for SessionStart). Fail-open: always exits 0.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT" 2>/dev/null || exit 0

branch="$(git branch --show-current 2>/dev/null || echo '?')"
changed_count="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

card="$(
  echo "RESUME CARD (preserve across compaction)"
  echo "- Branch: ${branch} · uncommitted files: ${changed_count}"
  echo "- agent-os: consult agent-os/skills/fe-skill-registry/SKILL.md + agent-os/docs/skill-triggers.md FIRST for any file you change."
  echo "- Definition of done: pnpm health green (tsc + lint + biome + format + validate:tokens + validate:structure + tests + docs)."
)"

if command -v jq >/dev/null 2>&1; then
  jq -cn --arg c "$card" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'
else
  printf '%s\n' "$card"
fi
exit 0
