#!/usr/bin/env bash
# Claude Code PostToolUse hook (Edit | Write | MultiEdit) for clinozy-fe.
#
# Auto-formats the file Claude just edited with the project's Prettier config
# (Prettier + prettier-plugin-tailwindcss own formatting here; Biome is a
# lint-only lane), so a stray indent / quote / class-order never reaches the
# `pnpm format:check` gate.
#
# Format-only: Prettier rewrites just formatting — no lint autofixes / import
# reordering — so the change stays minimal. ESLint + Biome still run at CI.
#
# Fails OPEN: a missing jq / prettier, a non-repo path, or any error leaves the
# file untouched and exits 0. A formatter hook must never block or fail an edit.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
[[ -z "$FILE" ]] && exit 0

# Normalise to an absolute path under the repo root.
case "$FILE" in
  /*) ABS="$FILE" ;;
  *) ABS="$ROOT/$FILE" ;;
esac
[[ -f "$ABS" ]] || exit 0

# Only this repository's files: a session that holds several repositories runs every
# repository's hooks on every edit (tooling/agent-os/session-hooks.ts), and clinozy-be
# formats with Biome, not Prettier.
case "$ABS" in
  "$ROOT"/*) ;;
  *) exit 0 ;;
esac

# Only Prettier-supported source/doc types; skip the lockfile + build output.
case "$ABS" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.jsonc | *.css | *.md | *.html | *.yml | *.yaml) ;;
  *) exit 0 ;;
esac
case "$ABS" in
  */dist/* | */node_modules/* | *pnpm-lock.yaml) exit 0 ;;
esac

prettier_bin="$ROOT/node_modules/.bin/prettier"
[[ -x "$prettier_bin" ]] || exit 0

# Format in place, quietly. Never let a formatter hiccup fail the edit.
"$prettier_bin" --write --log-level silent "$ABS" >/dev/null 2>&1 || true
exit 0
