#!/usr/bin/env bash
# Claude Code PostToolUse hook (Edit | Write | MultiEdit) and Codex Stop hook for clinozy-fe.
#
# Look at the uncommitted working-tree changes and surface the
# SPECIFIC gate(s) those files imply — reusing the same file→skill map as
# [`skill-reminder.sh`](skill-reminder.sh) and
# [`agent-os/docs/skill-triggers.md`](../docs/skill-triggers.md). When nothing
# relevant changed (or the tree is clean), it falls back to the generic checks.
#
# Claude: after each edit, the gates not yet shown this turn go out as PostToolUse
# additionalContext — a Stop hook's plain stdout never reaches the model, and a blocking
# one would force another turn. Each gate appears once per turn (_turn-once.sh), and the
# generic fallback is left out there so an ordinary edit adds nothing. Codex keeps the Stop
# wiring and its plain-stdout checklist. NON-blocking either way. Fails OPEN: any error exits 0.
set -uo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_turn-once.sh"
INPUT=$(cat 2>/dev/null || true)
EVENT=$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null || echo "")
SESSION=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "")

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT" 2>/dev/null || exit 0

# Uncommitted (staged + unstaged + untracked) paths, status prefix stripped.
changed="$(git status --porcelain 2>/dev/null | sed 's/^...//')" || changed=""

REMINDERS=()
match() { printf '%s\n' "$changed" | grep -Eq "$1"; }

match '\.(tsx?)$' && \
  REMINDERS+=("source changed → pnpm tsc + pnpm lint (and a colocated *.test.tsx for new components/hooks)")
match '\.route\.tsx$|\.manifest\.ts$' && \
  REMINDERS+=("routes changed → pnpm validate:structure + sync routeTree & docs/reference/routes-and-ui.md (fe-route-island)")
match '\.css$|index\.css$' && \
  REMINDERS+=("styles changed → pnpm validate:tokens (semantic tokens only)")
match '\.test\.(tsx?)$|tests/e2e/' && \
  REMINDERS+=("tests changed → pnpm test (unit) / pnpm exec playwright test (e2e); coverage ratchet (fe-test-generation)")
match '\.env\.example$' && \
  REMINDERS+=("env changed → keep VITE_ vars documented; secrets stay out of source (fe-documentation-maintenance)")
match '\.md$|/docs/' && \
  REMINDERS+=("docs changed → pnpm docs:lint")

if [[ "$EVENT" == "PostToolUse" ]]; then
  NEW_REMINDERS=()
  for r in "${REMINDERS[@]}"; do
    turn_once "$SESSION" "stop-gate-reminder:$r" && NEW_REMINDERS+=("$r")
  done
  [[ "${#NEW_REMINDERS[@]}" -gt 0 ]] || exit 0
  text="📋 Gates implied by your uncommitted changes (run them before you finish):"
  for r in "${NEW_REMINDERS[@]}"; do
    text+=$'\n'"  • $r"
  done
  text+=$'\n'"  Then: pnpm health (all phases). Full map: agent-os/docs/skill-triggers.md"
  jq -cn --arg c "$text" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}' 2>/dev/null \
    || printf '%s\n' "$text"
  exit 0
fi

echo ""
if [[ "${#REMINDERS[@]}" -gt 0 ]]; then
  echo "📋 Before you finish — gates implied by your uncommitted changes:"
  for r in "${REMINDERS[@]}"; do
    echo "  • $r"
  done
  echo "  Then: pnpm health (all phases). Full map: agent-os/docs/skill-triggers.md"
else
  echo "📋 Done. Quick check: pnpm health (tsc + lint + biome + format + tokens + structure + tests + docs)."
  echo "   Skill map: agent-os/docs/skill-triggers.md"
fi
exit 0
