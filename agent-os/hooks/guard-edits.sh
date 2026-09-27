#!/usr/bin/env bash
# Claude Code PreToolUse hook (Edit | Write | MultiEdit) for clinozy-fe.
#
# BLOCKS edits that introduce a hard-rule violation documented in CLAUDE.md and
# already enforced by ESLint / validators / CI — moving enforcement left from
# "you find out at lint/CI" to an instant denial at the keystroke.
#
# Rules (deliberately conservative — only unambiguous, mechanically-checkable
# violations, so a normal edit is never blocked; vendored components/ui/ is exempt
# where it owns the exception):
#   R1  a generated / do-not-edit file
#   R2  a `../` parent-relative import added under src/   (use the @/ alias)
#   R3  a direct `lucide-react` import in app code        (use @/shared/icons)
#   R4  a raw Tailwind palette class in app code          (use semantic tokens)
#
# Fails OPEN: any parsing hiccup, or a missing `jq`, allows the edit. A hook bug
# must never be able to brick a session.

INPUT=$(cat)
command -v jq >/dev/null 2>&1 || exit 0

FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
[[ -z "$FILE" ]] && exit 0

# The text being written: Write.content, Edit.new_string, MultiEdit.edits[].new_string.
CONTENT=$(printf '%s' "$INPUT" | jq -r '
  [ .tool_input.content, .tool_input.new_string, ( .tool_input.edits // [] | .[].new_string ) ]
  | map(select(. != null)) | join("\n")' 2>/dev/null || echo "")

base=${FILE##*/}

deny() {
  jq -cn --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# R1 — generated / do-not-edit files (change the source + regenerate instead).
case "$FILE" in
  *pnpm-lock.yaml | */dist/* | dist/* | */agent-os/skills-lock.json | *skills-lock.json)
    deny "'$base' is generated — do not hand-edit it. Change the source and regenerate (lockfile via pnpm; dist/ via pnpm build; skills-lock via the skills CLI)." ;;
esac

# Everything below is source under src/ only.
case "$FILE" in
  */src/*.ts | */src/*.tsx | src/*.ts | src/*.tsx) ;;
  *) exit 0 ;;
esac

# Vendored shadcn primitives own the exceptions (raw colors, direct lucide-react).
is_vendored_ui="no"
case "$FILE" in */components/ui/* | src/components/ui/*) is_vendored_ui="yes" ;; esac

# The @/shared/icons surface is the one place allowed to import icon libraries
# directly (mirrors eslint's src/shared/icons/** exemption + CLAUDE.md).
is_icon_surface="no"
case "$FILE" in */shared/icons/* | src/shared/icons/*) is_icon_surface="yes" ;; esac

# Page islands are the inverse: eslint's no-restricted-imports bans `@/pages/**`
# inside src/pages and the message mandates relative imports WITHIN an island
# (committed convention, e.g. login/forms/LoginForm). Exempt them from R2.
is_page="no"
case "$FILE" in */src/pages/* | src/pages/*) is_page="yes" ;; esac

# R2 — no `../` parent-relative imports under src/ (use the '@/' alias).
if [[ "$is_page" == "no" ]] && printf '%s' "$CONTENT" | grep -Eq "(from|require|import)[[:space:]]*\(?[[:space:]]*['\"]\.\./"; then
  deny "Relative parent import ('../') is banned under src/ — use the '@/' alias with an explicit .ts/.tsx extension (CLAUDE.md → Import Conventions; enforced by ESLint)."
fi

if [[ "$is_vendored_ui" == "no" ]]; then
  # R3 — icons come from the @/shared/icons barrel, never lucide-react directly.
  if [[ "$is_icon_surface" == "no" ]] && printf '%s' "$CONTENT" | grep -Eq "(from|import|require)[[:space:]]*\(?[[:space:]]*['\"]lucide-react['\"]"; then
    deny "Import icons from '@/shared/icons/index.ts', not 'lucide-react' directly (CLAUDE.md → Import Conventions; eslint-enforced; vendored components/ui/ is exempt)."
  fi
  # R4 — semantic tokens only in app code; no raw Tailwind palette utilities.
  if printf '%s' "$CONTENT" | grep -Eq '\b(bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|caret|accent)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\b'; then
    deny "Raw Tailwind palette class detected — use semantic tokens (bg-background, text-success, bg-brand, …), never raw palette colors (CLAUDE.md → Styling; enforced by pnpm validate:tokens; vendored components/ui/ is exempt)."
  fi
fi

exit 0
