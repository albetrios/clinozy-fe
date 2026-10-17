#!/usr/bin/env sh
# Before-commit guard — runs on every git commit via .husky/pre-commit.
# Ensures path-to-production gates pass: env docs, public assets, format, lint, types.
# See agent-os/skills/fe-before-commit-guard/SKILL.md for full documentation.
set -e

cd "$(dirname "$0")/../.."

echo ""
echo "Before-commit guard"
echo "==================="

# ── 1. .env.example documents all required vars ──
echo ""
echo "1. Env example validation..."
pnpm run validate:env-example

# ── 2. Required public assets exist ──
echo ""
echo "2. Public assets validation..."
pnpm run validate:public

# ── 3. ESLint + Prettier on staged files ──
echo ""
echo "3. Lint-staged (ESLint --fix + Prettier)..."
pnpm lint-staged

# ── 4. No env/mode sniffing (import.meta.env.DEV/PROD/MODE, environment===) ──
echo ""
echo "4. Env/mode sniffing gate..."
pnpm run validate:vite-env

# ── 5. TypeScript type checking ──
echo ""
echo "5. Type check..."
pnpm type-check

# ── 6. Lockfile ↔ package.json sync (only when deps/overrides change) ──
# A package.json dependency change (or an `overrides` change in
# pnpm-workspace.yaml) without a regenerated pnpm-lock.yaml causes
# ERR_PNPM_LOCKFILE_CONFIG_MISMATCH and reds every frozen-install CI job.
# Gated on the staged file set so normal commits stay fast.
STAGED_DEPS=$(git diff --cached --name-only --diff-filter=d | grep -E '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$' || true)
if [ -n "$STAGED_DEPS" ]; then
  echo ""
  echo "6. Lockfile sync..."
  pnpm run validate:lockfile
fi

# ── 7. Gitleaks secret scan on staged files (mandatory) ──
# A commit without the scan could carry a secret into history, so a missing gitleaks stops the
# commit (as in clinozy-be). Cloud sessions install it in setup and self-heal it at session start.
echo ""
echo "7. Staged secrets scan..."
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "ERROR: gitleaks is not installed, and the staged secrets scan is mandatory."
  echo "Install it: bash tooling/setup/agent/install-gitleaks.sh (Linux, cloud) or brew install gitleaks (macOS)."
  exit 1
fi
gitleaks protect --staged --config .gitleaks.toml --verbose

# ── 8. Reject committing gitignored env files (only .env.example is tracked) ──
# Two environments, one committed template: every other .env* is gitignored and
# deploys inject env from GitHub Environments. Catches a forced `git add -f .env*`
# before it can leak secrets (mirrors the pr-governance CI guard, locally).
echo ""
echo "8. Env-file guard..."
STAGED_ENV=$(git diff --cached --name-only --diff-filter=d | grep -E '^\.env($|\.)' | grep -vE '^\.env\.example$' || true)
if [ -n "$STAGED_ENV" ]; then
  echo "ERROR: Only .env.example may be committed. These are gitignored:"
  echo "$STAGED_ENV"
  echo "Provide real values via GitHub Environments (deploy) or your local .env.local."
  exit 1
fi

# ── 9. Reject merge conflict markers ──
# Git writes `<<<<<<< <label>` / `>>>>>>> <label>` (trailing space) and a bare
# 7-char `=======` line — anchored exactly so doc banner lines (`====…`) pass.
# Skip when nothing is staged: BSD xargs still runs its command on empty input,
# and `grep -r` with no file operands would scan the whole working tree.
echo ""
echo "9. Merge conflict markers..."
STAGED_FOR_CONFLICTS=$(git diff --cached --name-only --diff-filter=d || true)
if [ -n "$STAGED_FOR_CONFLICTS" ]; then
  CONFLICT_FILES=$(git diff --cached --name-only --diff-filter=d -z | xargs -0 grep -rlE '^(<{7} |>{7} |={7}$)' -- 2>/dev/null || true)
  if [ -n "$CONFLICT_FILES" ]; then
    echo "ERROR: Merge conflict markers found in:"
    echo "$CONFLICT_FILES"
    exit 1
  fi
fi

# ── 10. Reject large staged files (>3MB; iterations/ design exports exempt) ──
# Measures the STAGED blob, not the working tree — see the script header.
echo ""
echo "10. Large staged files (>3MB; iterations/ exempt)..."
./tooling/validate/large-staged-files.sh

echo ""
echo "==================="
echo "Before-commit guard passed."
echo ""
