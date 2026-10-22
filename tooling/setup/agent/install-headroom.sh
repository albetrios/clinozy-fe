#!/usr/bin/env bash
# Ensure the `headroom` MCP server can start in a cloud-agent session.
#
# Why: agent-os/mcp/mcp.json runs headroom as
#   uvx --from headroom-ai[mcp] headroom mcp serve
# so the prerequisite is `uv`/`uvx` (Astral), not a global headroom install —
# uvx resolves the package into an ephemeral env on first use. This script makes
# sure uv is on PATH and pre-warms the
# headroom env so the first MCP call in a session is not a cold download, then
# registers that command once at user level for a session that holds both repositories.
#
# The codegraph half of the default MCP pair needs nothing here: it is the
# @colbymchenry/codegraph devDependency and resolves from `pnpm exec` once
# `pnpm install` has run.
#
# Usage:  bash tooling/setup/agent/install-headroom.sh
#
# BEST-EFFORT: exits non-zero on failure; bootstrap.sh logs and carries on.
set -uo pipefail
LOG_TAG="install-headroom"
# shellcheck source=tooling/setup/agent/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

# uv installs to ~/.local/bin by default and the image may already have it there
# without that dir being on PATH for a non-login shell.
[ -d "${HOME}/.local/bin" ] && case ":${PATH}:" in
  *":${HOME}/.local/bin:"*) ;;
  *) export PATH="${HOME}/.local/bin:${PATH}" ;;
esac

if ! have uvx; then
  log "uv not found — installing from astral.sh (official installer)."
  installer="$(mktemp)"
  trap 'rm -f "${installer}"' EXIT
  if fetch "https://astral.sh/uv/install.sh" "${installer}"; then
    # UV_NO_MODIFY_PATH: we manage PATH via persist_path / $CLAUDE_ENV_FILE
    # rather than letting the installer edit shell rc files a Setup script's
    # session never sources.
    UV_NO_MODIFY_PATH=1 sh "${installer}" >/dev/null 2>&1 || log "uv installer returned an error."
    [ -d "${HOME}/.local/bin" ] && export PATH="${HOME}/.local/bin:${PATH}"
  else
    log "could not download the uv installer — is astral.sh allowed by the network policy?"
  fi
fi

if ! have uvx; then
  log "uvx still unavailable — the headroom MCP server will not start (codegraph is unaffected)."
  exit 1
fi

persist_path "${HOME}/.local/bin"
log "uv $(uv --version 2>/dev/null | awk '{print $2}') ready ($(command -v uvx))"

# Pre-warm: resolve + cache headroom-ai[mcp] now so the first MCP call in the
# session is instant. --help exits 0 without starting a server.
log "pre-warming headroom-ai[mcp] via uvx (first call in a session is otherwise a cold download)"
if uvx --from 'headroom-ai[mcp]' headroom --help >/dev/null 2>&1; then
  log "headroom ready via uvx."
else
  log "pre-warm failed — headroom will try again on first MCP use (needs pypi.org)."
  exit 1
fi

# One headroom for the whole session, registered at user level. A session that holds clinozy-fe
# and clinozy-be runs from their parent directory, where neither repository's .mcp.json is read
# (tooling/agent-os/session-hooks.ts registers each repository's codegraph at user level too), and
# headroom keeps no repository state. clinozy-be registers its pip-installed headroom with
# `headroom mcp install`; under uvx that command would register uv's cache path, which a cache
# clean removes, so this registers fe-headroom's own uvx command. An existing one is kept.
if ! have claude; then
  log "claude CLI not found — no user-level headroom MCP server registered."
elif claude mcp get headroom >/dev/null 2>&1 </dev/null; then
  log "user-level headroom MCP server already registered."
else
  server="$(node -e 'const { mcpServers } = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); console.log(JSON.stringify(mcpServers["fe-headroom"]));' "${REPO_ROOT}/.mcp.default.json")"
  if claude mcp add-json --scope user headroom "${server}" </dev/null >/dev/null 2>&1; then
    log "registered the user-level headroom MCP server (${server})."
  else
    log "could not register the user-level headroom MCP server (non-fatal)."
  fi
fi
