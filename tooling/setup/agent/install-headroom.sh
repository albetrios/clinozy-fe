#!/usr/bin/env bash
# Ensure the `headroom` MCP server can start in a cloud-agent session.
#
# Why: agent-os/mcp/mcp.json runs headroom as
#   uvx --from headroom-ai[mcp]==<HEADROOM_VERSION> headroom mcp serve
# so the prerequisite is `uv`/`uvx` (Astral), not a global headroom install —
# uvx resolves the package into an ephemeral env on first use. The version is the pin in
# tool-versions.sh, never the latest release (H-7). This script makes
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

# uv from its pinned GitHub release, checksum-verified (H-12) — never astral.sh's install.sh, a
# script fetched at its latest and run unseen (and a host the default network policy blocks).
if ! have uvx; then
  uv_version="$(pinned_version UV_VERSION)"
  case "$(uname -m)" in
    x86_64 | amd64) uv_target="x86_64-unknown-linux-gnu" uv_key="X64" ;;
    aarch64 | arm64) uv_target="aarch64-unknown-linux-gnu" uv_key="ARM64" ;;
    *) uv_target="" uv_key="" ;;
  esac
  if [ -z "${uv_target}" ] || [ "$(uname -s)" != "Linux" ]; then
    log "uv not found and no pinned uv build for $(uname -s) $(uname -m) — install uv ${uv_version} yourself."
  else
    log "uv not found — installing uv ${uv_version} from its GitHub release."
    uv_directory="$(mktemp -d)"
    trap 'rm -rf "${uv_directory}"' EXIT
    uv_archive="uv-${uv_target}.tar.gz"
    if download_verified "https://github.com/astral-sh/uv/releases/download/${uv_version}/${uv_archive}" \
      "${uv_directory}/${uv_archive}" "$(pinned_version "UV_SHA256_LINUX_${uv_key}")" &&
      tar -xzf "${uv_directory}/${uv_archive}" -C "${uv_directory}"; then
      mkdir -p "${HOME}/.local/bin"
      install -m 0755 "${uv_directory}/uv-${uv_target}/uv" "${uv_directory}/uv-${uv_target}/uvx" "${HOME}/.local/bin/"
      export PATH="${HOME}/.local/bin:${PATH}"
    else
      log "could not install the pinned uv — is github.com allowed by the network policy?"
    fi
  fi
fi

if ! have uvx; then
  log "uvx still unavailable — the headroom MCP server will not start (codegraph is unaffected)."
  exit 1
fi

persist_path "${HOME}/.local/bin"
log "uv $(uv --version 2>/dev/null | awk '{print $2}') ready ($(command -v uvx))"

# Pre-warm: resolve + cache the pinned headroom-ai[mcp] now so the first MCP call in the
# session is instant. --help exits 0 without starting a server.
headroom_spec="headroom-ai[mcp]==$(pinned_version HEADROOM_VERSION)"
log "pre-warming ${headroom_spec} via uvx (first call in a session is otherwise a cold download)"
if uvx --from "${headroom_spec}" headroom --help >/dev/null 2>&1; then
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
