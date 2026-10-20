#!/usr/bin/env bash
# Install semgrep for cloud-agent sessions — `pnpm security:semgrep:push` scans the pushed auth,
# HTTP client and CSP code with it (a warning, not a block, when it is missing: the PR's Semgrep
# lane scans everything).
#
# Usage:  bash tooling/setup/agent/install-semgrep.sh
# Version: SEMGREP_VERSION in tool-versions.sh — the version CI's Semgrep image runs. Installs when
# missing or different, through uv, else pipx, else pip --user (as clinozy-be's installer).
#
# BEST-EFFORT: never fails the setup chain over an optional tool.
set -uo pipefail
LOG_TAG="install-semgrep"
# shellcheck source=tooling/setup/agent/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

version="$(pinned_version SEMGREP_VERSION)"
installed="$(have semgrep && semgrep --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)"
package="semgrep==${version}"

if [ -n "${installed}" ] && [ "${installed}" = "${version}" ]; then
  log "semgrep ${installed} is at the pin — nothing to do."
  exit 0
fi

log "installing ${package} (found: ${installed:-none})"
if have uv && uv tool install --force "${package}" >&2 2>&1; then
  log "installed ${package} via uv."
elif have pipx && pipx install --force "${package}" >&2 2>&1; then
  log "installed ${package} via pipx."
elif python3 -m pip install --user "${package}" >&2 2>&1; then
  log "installed ${package} via pip --user."
else
  log "install failed — run \`uv tool install '${package}'\` manually (non-fatal)."
fi
exit 0
