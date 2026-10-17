#!/usr/bin/env bash
# Claude Code UserPromptSubmit hook for clinozy-fe.
#
# When a prompt describes a build/change task, inject the relevant skill chain —
# plus the "consult fe-skill-registry FIRST" rule — as additionalContext. This
# operationalizes CLAUDE.md's skill-first workflow at PROMPT time; the PostToolUse
# the skill reminders ([`edit-hooks.mjs`](edit-hooks.mjs)) only fire reactively,
# AFTER an edit. The keyword→skill map mirrors
# [`agent-os/docs/skill-triggers.md`](../docs/skill-triggers.md).
#
# Conservative by design: requires a build/change verb AND a domain noun, so
# ordinary prompts (questions, "run the tests", "explain this") produce nothing
# and never nag. Fails OPEN: a missing jq, no prompt, or no match exits 0 silently.
set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
# A new prompt is a new turn: the reminder hooks may speak once more (_turn-once.sh).
source "$(dirname "${BASH_SOURCE[0]}")/_turn-once.sh"
SESSION=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "")
turn_reset "$SESSION"
PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || echo "")
[[ -z "$PROMPT" ]] && exit 0

# /fe-ship and /fe-open-pr are the user asking for a PR in so many words: no-unrequested-pr.sh and
# guardrails.mjs let this turn's PR creation through without a second confirmation. (The hook sees
# the prompt as typed — `/fe-ship <title>` — checked on Claude Code 2.1.302.)
if printf '%s' "$PROMPT" | grep -Eq '^[[:space:]]*/fe-(ship|open-pr)([[:space:]]|$)'; then
  turn_mark "$SESSION" "pr-requested"
fi

lower=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Gate on a build/change intent verb to avoid nagging on questions / read-only asks.
printf '%s' "$lower" \
  | grep -Eq '\b(add|create|new|implement|build|introduce|scaffold|generate|wire|register|redesign|beautify|style|restyle)\b' \
  || exit 0

HINTS=()

printf '%s' "$lower" | grep -Eq '\b(page|route|screen)\b' && \
  HINTS+=("page/route → fe-page-scaffolding → fe-route-island (path, manifest, RBAC permission, routeTree + docs/reference/routes-and-ui.md)")

printf '%s' "$lower" | grep -Eq '\b(component|widget|card|button|modal|dialog|drawer|sheet|table|menu|dropdown)\b' && \
  HINTS+=("component/UI → shadcn (pick + add) → frontend-design → composition-patterns → fe-test-generation")

printf '%s' "$lower" | grep -Eq '\b(form|input|field|validation)\b' && \
  HINTS+=("form → composition-patterns (react-hook-form + Zod) → fe-test-generation")

printf '%s' "$lower" | grep -Eq '\b(hook|query|mutation|fetch|api|endpoint)\b' && \
  HINTS+=("data/hook → react-best-practices (TanStack Query owns server state; contracts.ts Zod schemas)")

printf '%s' "$lower" | grep -Eq '\b(style|styles|styling|theme|tokens|tailwind|css|design|beautify|premium)\b' && \
  HINTS+=("styling/theme → frontend-design (semantic tokens only — pnpm validate:tokens; fe-ui-sources rule)")

printf '%s' "$lower" | grep -Eq '\b(test|tests|e2e|playwright|spec|coverage)\b' && \
  HINTS+=("tests → fe-test-generation → fe-e2e-testids")

printf '%s' "$lower" | grep -Eq '\b(icon|icons)\b' && \
  HINTS+=("icons → import from @/shared/icons (fe-ui-sources rule), never lucide-react directly")

printf '%s' "$lower" | grep -Eq '\b(accessib|a11y|aria|keyboard|screen reader)\b' && \
  HINTS+=("a11y/UX → web-design-guidelines / ui-ux-pro-max")

printf '%s' "$lower" | grep -Eq 'env var|environment variable|\.env\b' && \
  HINTS+=("env var → fe-documentation-maintenance (VITE_ = public; secrets via environment, .env.example template)")

[[ "${#HINTS[@]}" -eq 0 ]] && exit 0

context="🧭 clinozy-fe skill routing — consult agent-os/skills/fe-skill-registry/SKILL.md FIRST, then run:"
for h in "${HINTS[@]}"; do
  context="${context}"$'\n'"  • ${h}"
done
context="${context}"$'\n'"Full map: agent-os/docs/skill-triggers.md · Done = pnpm health green."

jq -cn --arg c "$context" \
  '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$c}}'
exit 0
