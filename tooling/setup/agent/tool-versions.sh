# Pinned versions of the agent tooling — one place, read by:
#   - tooling/setup/agent/install-*.sh (via `pinned_version` in lib.sh): an installer moves the
#     machine TO the pin — installs when missing, reinstalls when the installed version differs,
#     and refuses a release download whose SHA-256 does not match
#   - CI (.github/workflows/pr-ci.yml): appends these lines to $GITHUB_ENV, so CI and cloud
#     sessions run the same versions; the Semgrep image tag is held to SEMGREP_VERSION by
#     tests/ci/agent-tool-versions.policy.test.ts
#
# Format: plain KEY=value lines only — no quotes, no spaces, no expansions — so bash can
# `source` the file and GitHub Actions can append it to $GITHUB_ENV unchanged. The same layout
# and versions as clinozy-be's tooling/setup/agent/tool-versions.sh.
#
# Bump: change a version and its checksums together, open a PR — CI installs and runs the new
# version before it lands. Rollback: revert the line. Trial without a commit: set the KEY (and
# its *_SHA256_* keys) as variables on a separate cloud environment; an environment variable
# overrides the pin here.
#
# Not here: Node (.nvmrc), pnpm (package.json `packageManager`), Docker images (compose files),
# gh (latest release, a platform fallback).

# gitleaks (github.com release binary) — the before-commit staged-secrets scan and the CI secret scan.
GITLEAKS_VERSION=8.30.1
GITLEAKS_SHA256_LINUX_X64=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
GITLEAKS_SHA256_LINUX_ARM64=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080

# semgrep — the CI SAST job runs the semgrep/semgrep image of this version (pinned by digest there).
SEMGREP_VERSION=1.179.0
