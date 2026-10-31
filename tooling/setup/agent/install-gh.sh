#!/usr/bin/env bash
# Install the GitHub CLI (`gh`) for cloud-agent sessions.
#
# Why: `pnpm github:sync`, the ruleset tooling, and the PR/CI helpers in
# agent-os/commands all shell out to `gh`. Cloud images do not ship it, and the
# session-start hook reports "gh absent" when it is missing.
#
# Installs from the official cli/cli GitHub release tarball rather than apt: the
# apt route needs a third-party keyring + sources.list entry (two more things to
# fail on a locked-down image) and ships an older build.
#
# Usage:  bash tooling/setup/agent/install-gh.sh
# Version: GH_VERSION in tool-versions.sh (an environment variable of that name wins, a trial),
# never the latest release, and the tarball must match its pinned SHA-256 (H-12).
#
# BEST-EFFORT: exits non-zero on failure; bootstrap.sh logs and carries on.
set -uo pipefail
LOG_TAG="install-gh"
# shellcheck source=tooling/setup/agent/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

if have gh; then
  log "already installed: $(gh --version 2>/dev/null | head -1) — nothing to do."
  exit 0
fi

arch="$(arch_for go)" || {
  log "unsupported architecture '$(uname -m)'."
  exit 1
}

version="$(pinned_version GH_VERSION)"
if [ -z "${version}" ]; then
  log "no GH_VERSION pinned in tool-versions.sh."
  exit 1
fi
arch_key="$(printf '%s' "${arch}" | tr '[:lower:]' '[:upper:]')"

tarball="gh_${version}_linux_${arch}.tar.gz"
url="https://github.com/cli/cli/releases/download/v${version}/${tarball}"
target="$(bin_dir)" || {
  log "no writable bin directory."
  exit 1
}

log "downloading ${url}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

download_verified "${url}" "${tmp}/${tarball}" "$(pinned_version "GH_SHA256_LINUX_${arch_key}")" || {
  log "download failed or did not match its pinned checksum — is github.com allowed by the network policy?"
  exit 1
}
tar -xzf "${tmp}/${tarball}" -C "${tmp}" || {
  log "extract failed."
  exit 1
}

# The tarball unpacks to gh_<version>_linux_<arch>/bin/gh.
src="${tmp}/gh_${version}_linux_${arch}/bin/gh"
[ -x "${src}" ] || {
  log "unexpected tarball layout — no bin/gh inside ${tarball}."
  exit 1
}
install -m 0755 "${src}" "${target}/gh" || {
  log "could not install to ${target}."
  exit 1
}
persist_path "${target}"

log "installed $("${target}/gh" --version 2>/dev/null | head -1) at ${target}/gh"
