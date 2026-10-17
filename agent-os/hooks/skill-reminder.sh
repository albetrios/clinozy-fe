#!/usr/bin/env bash
# Claude Code PostToolUse hook (Edit | Write | MultiEdit) for clinozy-fe.
# Reads the edited file path from the tool JSON and adds the skill reminders its
# file pattern implies as additionalContext — PostToolUse plain stdout never
# reaches the model. Each reminder appears once per turn (_turn-once.sh), not on
# every edit. Never blocks.
source "$(dirname "${BASH_SOURCE[0]}")/_turn-once.sh"

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
  2>/dev/null || echo "")

[[ -z "$FILE" ]] && exit 0
SESSION=$(echo "$INPUT" | python3 -c \
  "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null || echo "")

# Remind only for files in this repository. A session that holds several
# repositories runs every repository's hooks on every edit (tooling/agent-os/session-hooks.ts);
# another repository's files are its own hooks' to judge.
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
case "$FILE" in
  "$ROOT"/* | [!/]*) ;; # under this repository, or relative to it
  *) exit 0 ;;
esac

REMINDERS=()

[[ "$FILE" == *".route.tsx" || "$FILE" == *".manifest.ts" ]] && \
  REMINDERS+=("route island → fe-route-island (path, RBAC permission, head; register in routeTree + docs/reference/routes-and-ui.md)")

[[ "$FILE" == *".contracts.ts" ]] && \
  REMINDERS+=("contracts → Zod schema + inferred type; never hand-write the TS type (fe-api-data-patterns)")

[[ "$FILE" == *".api.ts" || "$FILE" == */hooks/use*/*.ts? ]] && \
  REMINDERS+=("data layer → react-best-practices (TanStack Query owns server state; mock + live branch)")

case "$FILE" in
  */components/ui/*) REMINDERS+=("vendored shadcn primitive → shadcn (add/compose via CLI; don't hand-edit)") ;;
  */components/*.tsx | */forms/*.tsx) REMINDERS+=("component/form → composition-patterns + frontend-design + fe-test-generation (colocate a *.test.tsx)") ;;
esac

[[ "$FILE" == *"index.css" || "$FILE" == *.css ]] && \
  REMINDERS+=("styles → semantic tokens only (bg-background/text-success/bg-brand); pnpm validate:tokens (frontend-design)")

[[ "$FILE" == *".test.tsx" || "$FILE" == *".test.ts" ]] && \
  REMINDERS+=("tests → fe-test-generation; E2E flows → fe-e2e-testids (tests/e2e/*.e2e.test.ts)")

[[ "$FILE" == *".env.example" ]] && \
  REMINDERS+=("env → fe-documentation-maintenance (VITE_ = public/bundled; secrets via environment, never committed)")

NEW_REMINDERS=()
for r in "${REMINDERS[@]}"; do
  turn_once "$SESSION" "skill-reminder:$r" && NEW_REMINDERS+=("$r")
done
[[ "${#NEW_REMINDERS[@]}" -gt 0 ]] || exit 0
text="⚡ Skill reminders for $(basename "$FILE"):"
for r in "${NEW_REMINDERS[@]}"; do
  text+=$'\n'"  • $r"
done
text+=$'\n'"  Full map: agent-os/docs/skill-triggers.md"
if command -v jq >/dev/null 2>&1; then
  jq -cn --arg c "$text" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
else
  printf '%s\n' "$text"
fi
exit 0
