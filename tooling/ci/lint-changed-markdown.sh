#!/usr/bin/env bash
# Lint markdown files that have changed vs the target branch.
#
# Mirrors the GitHub Actions "Docs lint" lane in .github/workflows/ci.yml so
# contributors can reproduce CI locally before pushing. The pre-push hook
# (.husky/pre-push) calls this script when the push contains markdown changes.
#
# Usage:
#   pnpm docs:lint:changed                 # vs the upstream, else origin/<trunk>
#   pnpm docs:lint:changed --base <ref>    # vs <ref> (.husky/pre-push passes its push base)
#
# Exits 0 when no markdown files changed or all changed files lint clean.
# Compatible with bash 3.2 (default macOS shell).

set -eu

target=""
if [ "${1:-}" = "--base" ]; then target="${2:-}"; fi
# The base comes from resolveBase (tooling/ci/git-environment.mjs) unless --base names one.
target="${target:-$(node tooling/ci/git-environment.mjs base)}"
base_ref="${target#origin/}"

if ! git rev-parse --verify --quiet "${target}" >/dev/null; then
  if git fetch origin "${base_ref}" --quiet 2>/dev/null; then
    :
  else
    echo "Skipping changed-markdown lint: cannot resolve ${target} (no network or unknown branch)."
    exit 0
  fi
fi

changed_files_raw="$(git diff --name-only --diff-filter=ACMRT "${target}"..HEAD -- '*.md')"

# Strip files matching the canonical ignore list in `.markdownlint-cli2.jsonc`
# (CHANGELOG, PR template, vendored agent-os, .claude worktrees). We can't rely
# on cli2's auto-ignore here because we pass explicit file paths; mirror the
# patterns instead. Keep this list in sync with the `ignores` field of
# `.markdownlint-cli2.jsonc`.
changed_files="$(printf '%s\n' "${changed_files_raw}" \
  | grep -v -E '^CHANGELOG\.md$' \
  | grep -v -E '^\.github/PULL_REQUEST_TEMPLATE\.md$' \
  | grep -v -E '^\.claude/' \
  | grep -v -E '^agent-os/' \
  | grep -v -E '^\.cursor/' \
  || true)"

if [ -z "${changed_files}" ]; then
  echo "No changed markdown files vs ${target}."
  exit 0
fi

count="$(printf '%s\n' "${changed_files}" | wc -l | tr -d ' ')"
echo "Linting ${count} changed markdown file(s) vs ${target}:"
printf '  - %s\n' ${changed_files}

# shellcheck disable=SC2086
pnpm exec markdownlint-cli2 --config .markdownlint.json ${changed_files}
