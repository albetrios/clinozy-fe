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
# Not here: Node's version (.nvmrc — only its tarball checksums are here), pnpm (package.json
# `packageManager`), Docker images (compose files, pinned by digest).

# gitleaks (github.com release binary) — the before-commit staged-secrets scan and the CI secret scan.
GITLEAKS_VERSION=8.30.1
GITLEAKS_SHA256_LINUX_X64=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
GITLEAKS_SHA256_LINUX_ARM64=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080

# Node.js (nodejs.org release tarball) — install-node.sh refuses a download whose SHA-256 differs
# (H-12). NODE_VERSION is .nvmrc's exact version (tests/ci/agent-tool-versions.policy.test.ts holds
# them equal); the checksums are from https://nodejs.org/dist/v<version>/SHASUMS256.txt.
NODE_VERSION=24.21.0
NODE_SHA256_LINUX_X64=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6
NODE_SHA256_LINUX_ARM64=6ad1325edbdb5649c379b75a237147a666c95d4f9ae8d340fef2d1575d289ad2

# gh (github.com/cli/cli release tarball) — install-gh.sh, when the image has no gh. Checksums from
# the release's gh_<version>_checksums.txt.
GH_VERSION=2.89.0
GH_SHA256_LINUX_AMD64=d0422caade520530e76c1c558da47daebaa8e1203d6b7ff10ad7d6faba3490d8
GH_SHA256_LINUX_ARM64=9e64a623dfc242990aa5d9b3f507111149c4282f66b68eaad1dc79eeb13b9ce5

# uv (github.com/astral-sh/uv release tarball) — install-headroom.sh, when the image has no uvx; it
# runs the fe-headroom MCP server. Checksums from the release's <archive>.sha256 files.
UV_VERSION=0.11.32
UV_SHA256_LINUX_X64=aab924fd522efd06f1c5f3b93a243864fc453132c94b2dc49f1371b528a4b967
UV_SHA256_LINUX_ARM64=4d4fa08d95b06642e5800df6a22bd71455f23f988269e18da2847971d8c0bf31

# headroom (PyPI: headroom-ai, `mcp` extra) — the fe-headroom MCP server, run by uvx from the
# `headroom-ai[mcp]==<version>` spec in .mcp.default.json (tests/ci/mcp-config.policy.test.ts
# holds the two equal); install-headroom.sh pre-warms this version.
HEADROOM_VERSION=0.40.0

# semgrep — install-semgrep.sh (`pnpm security:semgrep:push`); the CI SAST job runs the
# semgrep/semgrep image of this version (pinned by digest there).
SEMGREP_VERSION=1.179.0
