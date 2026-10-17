#!/usr/bin/env sh
# Before-commit guard — runs on every git commit via .husky/pre-commit.
# Ensures path-to-production gates pass: env docs, public assets, format, lint, types.
# See agent-os/skills/fe-before-commit-guard/SKILL.md for full documentation.
#
# Step 3 (lint-staged) runs first: it rewrites and restages files. Every other step only reads,
# so they run in parallel, each into its own log, printed afterwards in step order under its own
# heading. If the parallel runner itself breaks (no temporary directory, a step that left no exit
# code), the steps run again one by one. The step list is the same either way.
set -e

cd "$(dirname "$0")/../.."

echo ""
echo "Before-commit guard"
echo "==================="

# ── 1. .env.example documents all required vars ──
step_1() { pnpm run validate:env-example; }

# ── 2. Required public assets exist ──
step_2() { pnpm run validate:public; }

# ── 3. ESLint + Prettier on staged files (both cached under node_modules/.cache) ──
step_3() { pnpm lint-staged; }

# ── 4. No env/mode sniffing (import.meta.env.DEV/PROD/MODE, environment===) ──
step_4() { pnpm run validate:vite-env; }

# ── 5. TypeScript type checking (incremental: tsconfig.app.json's tsBuildInfoFile) ──
step_5() { pnpm type-check; }

# ── 6. Lockfile ↔ package.json sync (only when deps/overrides change) ──
# A package.json dependency change (or an `overrides` change in
# pnpm-workspace.yaml) without a regenerated pnpm-lock.yaml causes
# ERR_PNPM_LOCKFILE_CONFIG_MISMATCH and reds every frozen-install CI job.
# Gated on the staged file set so normal commits stay fast.
step_6() {
  STAGED_DEPS=$(git diff --cached --name-only --diff-filter=d | grep -E '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$' || true)
  if [ -z "$STAGED_DEPS" ]; then
    echo "  skipped — no dependency file staged"
    return 0
  fi
  pnpm run validate:lockfile
}

# ── 7. Gitleaks secret scan on staged files (mandatory) ──
# A commit without the scan could carry a secret into history, so a missing gitleaks stops the
# commit (as in clinozy-be). Cloud sessions install it in setup and self-heal it at session start.
step_7() {
  if ! command -v gitleaks >/dev/null 2>&1; then
    echo "ERROR: gitleaks is not installed, and the staged secrets scan is mandatory."
    echo "Install it: bash tooling/setup/agent/install-gitleaks.sh (Linux, cloud) or brew install gitleaks (macOS)."
    return 1
  fi
  gitleaks protect --staged --config .gitleaks.toml --verbose
}

# ── 8. Reject committing gitignored env files (only .env.example is tracked) ──
# Two environments, one committed template: every other .env* is gitignored and
# deploys inject env from GitHub Environments. Catches a forced `git add -f .env*`
# before it can leak secrets (mirrors the pr-governance CI guard, locally).
step_8() {
  STAGED_ENV=$(git diff --cached --name-only --diff-filter=d | grep -E '^\.env($|\.)' | grep -vE '^\.env\.example$' || true)
  if [ -n "$STAGED_ENV" ]; then
    echo "ERROR: Only .env.example may be committed. These are gitignored:"
    echo "$STAGED_ENV"
    echo "Provide real values via GitHub Environments (deploy) or your local .env.local."
    return 1
  fi
}

# ── 9. Reject merge conflict markers ──
# Git writes `<<<<<<< <label>` / `>>>>>>> <label>` (trailing space) and a bare
# 7-char `=======` line — anchored exactly so doc banner lines (`====…`) pass.
# Skip when nothing is staged: BSD xargs still runs its command on empty input,
# and `grep -r` with no file operands would scan the whole working tree.
step_9() {
  STAGED_FOR_CONFLICTS=$(git diff --cached --name-only --diff-filter=d || true)
  [ -n "$STAGED_FOR_CONFLICTS" ] || return 0
  CONFLICT_FILES=$(git diff --cached --name-only --diff-filter=d -z | xargs -0 grep -rlE '^(<{7} |>{7} |={7}$)' -- 2>/dev/null || true)
  if [ -n "$CONFLICT_FILES" ]; then
    echo "ERROR: Merge conflict markers found in:"
    echo "$CONFLICT_FILES"
    return 1
  fi
}

# ── 10. Reject large staged files (>3MB; iterations/ design exports exempt) ──
# Measures the STAGED blob, not the working tree — see the script header.
step_10() { ./tooling/validate/large-staged-files.sh; }

# ── 11. Dependency audit when pnpm-lock.yaml is staged (an early check) ──
# Warn-only until 2026-10-31, then it blocks; an unreachable registry passes (the PR audits).
step_11() { node tooling/ci/early-checks.mjs audit; }

# ── 12. Client env allowlist when the env schema is staged (an early check) ──
# validate:client-env for development and production; warn-only until 2026-10-31.
step_12() { node tooling/ci/early-checks.mjs client-env; }

step_label() {
  case "$1" in
    1) echo "Env example validation" ;;
    2) echo "Public assets validation" ;;
    3) echo "Lint-staged (ESLint --fix + Prettier)" ;;
    4) echo "Env/mode sniffing gate" ;;
    5) echo "Type check" ;;
    6) echo "Lockfile sync" ;;
    7) echo "Staged secrets scan" ;;
    8) echo "Env-file guard" ;;
    9) echo "Merge conflict markers" ;;
    10) echo "Large staged files (>3MB; iterations/ exempt)" ;;
    11) echo "Dependency audit (lockfile staged)" ;;
    12) echo "Client env allowlist (env schema staged)" ;;
  esac
}

# The read-only steps, run after lint-staged.
READ_ONLY_STEPS="1 2 4 5 6 7 8 9 10 11 12"

# One by one, in order; stops at the first failure.
run_serial() {
  for step in $READ_ONLY_STEPS; do
    echo ""
    echo "$step. $(step_label "$step")..."
    "step_$step" || return 1
  done
}

# All at once; prints each step's output in order. Returns 1 when a step failed, 2 when the
# runner itself broke (the caller then runs the steps one by one).
run_parallel() {
  logs=$(mktemp -d "${TMPDIR:-/tmp}/clinozy-fe-guard.XXXXXX" 2>/dev/null) || return 2
  for step in $READ_ONLY_STEPS; do
    (
      set +e
      "step_$step" >"$logs/$step.log" 2>&1
      echo "$?" >"$logs/$step.code"
    ) &
  done
  wait
  failed=0
  for step in $READ_ONLY_STEPS; do
    if [ ! -f "$logs/$step.code" ]; then
      rm -rf "$logs"
      return 2
    fi
    echo ""
    echo "$step. $(step_label "$step")..."
    cat "$logs/$step.log"
    [ "$(cat "$logs/$step.code")" = "0" ] || failed=1
  done
  rm -rf "$logs"
  return "$failed"
}

echo ""
echo "3. $(step_label 3)..."
step_3

status=0
run_parallel || status=$?
if [ "$status" -eq 2 ]; then
  echo ""
  echo "The parallel runner broke — running the steps one by one."
  status=0
  run_serial || status=$?
fi
if [ "$status" -ne 0 ]; then
  echo ""
  echo "==================="
  echo "Before-commit guard FAILED — see the step above that printed the error."
  exit 1
fi

echo ""
echo "==================="
echo "Before-commit guard passed."
echo ""
