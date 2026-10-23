#!/usr/bin/env bash
# The agent's own tools, apart from the app: the distro CLI tools, gh, gitleaks, semgrep, headroom +
# the default MCP pair + the CodeGraph index + the session hooks, and the Playwright browsers —
# clinozy-be's install-agent-tools.sh is the same step for the backend.
#
#   bash tooling/setup/agent/install-agent-tools.sh
#
# bootstrap.sh runs it inline in the Setup script (--install-only) and, in a session, detached once
# the dev server is live ($AGENT_STACK_DIR/agent-tools-frontend.log): the app needs none of these,
# so they never hold "live" up. Each installer finds a tool already at its pin and does nothing;
# the CodeGraph index and the session hooks follow the code, so they are refreshed every run.
# Best-effort: exit 1 when gitleaks is missing (commits stop on its scan), which bootstrap.sh logs
# and carries on from.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.." || exit 1
readonly AGENT_DIR="tooling/setup/agent"

# The installers may drop binaries in ~/.local/bin (uv always; gh and gitleaks when /usr/local/bin
# is not writable). They run as child processes and so cannot change THIS shell's PATH — without
# this, every `command -v` check below would report a tool just installed as missing.
case ":${PATH}:" in
  *":${HOME}/.local/bin:"*) ;;
  *) export PATH="${HOME}/.local/bin:${PATH}" ;;
esac

ok() { echo "✓ $*"; }
skip() { echo "• $*"; }

# Distro CLI tools -------------------------------------------------------------
bash "${AGENT_DIR}/install-apt-tools.sh" || true
present=""
for b in jq rg shellcheck rsvg-convert xz; do
  command -v "$b" >/dev/null 2>&1 && present="${present} ${b}"
done
if [ -n "${present}" ]; then ok "distro CLI tools:${present}"; else skip "distro CLI tools: none installed (non-fatal)"; fi

# GitHub CLI -------------------------------------------------------------------
bash "${AGENT_DIR}/install-gh.sh" || true
if command -v gh >/dev/null 2>&1; then
  ok "$(gh --version | head -1)"
else
  skip "gh unavailable (non-fatal — MCP GitHub tools still work)"
fi

# gitleaks (the pre-commit secret scan, mandatory) + semgrep (pnpm security:semgrep:push) -----
bash "${AGENT_DIR}/install-gitleaks.sh" || true
bash "${AGENT_DIR}/install-semgrep.sh" || true
gitleaks_missing=0
if command -v gitleaks >/dev/null 2>&1; then
  ok "gitleaks $(gitleaks version 2>/dev/null)"
else
  skip "gitleaks unavailable — commits fail until it is installed (bash ${AGENT_DIR}/install-gitleaks.sh)"
  gitleaks_missing=1
fi
if command -v semgrep >/dev/null 2>&1; then
  ok "semgrep $(semgrep --version 2>/dev/null)"
else
  skip "semgrep unavailable — pnpm security:semgrep:push warns until it is installed (bash ${AGENT_DIR}/install-semgrep.sh)"
fi

# headroom (uv) + the default MCP pair + the CodeGraph index it serves + the session hooks ------
bash "${AGENT_DIR}/install-headroom.sh" || true
if command -v uvx >/dev/null 2>&1; then
  ok "uvx ready ($(command -v uvx))"
else
  skip "uvx unavailable — headroom MCP will not start (codegraph unaffected)"
fi
pnpm mcp:setup:default || skip "mcp:setup:default failed — run it manually if MCP tools are missing"
if [ -f .mcp.json ]; then
  ok ".mcp.json declares fe-codegraph + fe-headroom"
else
  skip ".mcp.json absent (non-fatal)"
fi
pnpm setup:local --only-codegraph || skip "codegraph index failed — run \`pnpm setup:local --only-codegraph\` (non-fatal)"
if [ -f .codegraph/codegraph.db ]; then
  ok "codegraph index ready (.codegraph/)"
else
  skip "codegraph index absent — codegraph MCP answers nothing until it is built (non-fatal)"
fi
# A session that holds several repositories reads hooks only from the parent directory's
# .claude/settings.json, and no repository's .mcp.json; agent-os:session-hooks writes every
# repository's hooks there and registers its codegraph server at user level (a no-op in a
# single-repository checkout).
pnpm agent-os:session-hooks || skip "agent-os:session-hooks failed (non-fatal)"

# Playwright browsers (E2E) ------------------------------------------------------
browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"
# The installer's verdict, not a chromium* glob: an image's older chromium-<revision> does not run
# the pinned @playwright/test.
if bash "${AGENT_DIR}/install-playwright.sh"; then
  ok "chromium for the pinned @playwright/test available in ${browsers_path}"
else
  skip "no chromium build for the pinned @playwright/test — E2E unavailable (also needs clinozy-be on :3000)"
fi

exit "${gitleaks_missing}"
