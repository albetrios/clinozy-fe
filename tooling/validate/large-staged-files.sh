#!/usr/bin/env sh
# Large staged files — before-commit-guard step 10.
#
# Rejects any staged blob over 3MB. Sizes come from the STAGED blob
# (`git cat-file -s :<path>`), not the working tree, so renames/partial stages
# measure what would actually be committed.
#
# iterations/ is exempt: it holds design-tool exports (a prototype HTML/JS bundle
# and the specs extracted from it, one folder per iteration — see
# docs/design-workflow/process/). They are reference material, never built or
# deployed, and a prototype bundle routinely exceeds the limit.
#
# Checks the repository in the current directory, so a test can point it at a
# throwaway repo (tooling/validate/large-staged-files.test.mjs).

LIMIT_BYTES=3145728 # 3 * 1024 * 1024

# The case pattern takes POSIX's optional leading paren: inside $( ), bash 3.2
# (macOS /bin/sh) reads a bare `iterations/*)` as the end of the substitution.
LARGE_FILES=$(git diff --cached --name-only --diff-filter=d | while read -r f; do
  case "$f" in (iterations/*) continue ;; esac
  SIZE=$(git cat-file -s ":$f" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt "$LIMIT_BYTES" ]; then echo "  $f ($SIZE bytes)"; fi
done)
if [ -n "$LARGE_FILES" ]; then
  echo "ERROR: Files exceed 3MB limit:"
  echo "$LARGE_FILES"
  exit 1
fi
