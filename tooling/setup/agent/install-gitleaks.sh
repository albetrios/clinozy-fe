#!/usr/bin/env bash
# Install gitleaks (secret scanner) for cloud-agent sessions.
#
# Why: `.husky/pre-commit` runs a staged-secret scan and CI has a gitleaks lane.
# Without the binary the pre-commit hook prints "gitleaks not installed.
# Skipping secret scan." — the commit still succeeds, so a secret can reach a
# branch and only get caught later by CI. Installing it locally makes the agent
# session enforce the same gate a developer's machine does.
#
# Usage:  bash tooling/setup/agent/install-gitleaks.sh
# Version: pinned in tool-versions.sh (GITLEAKS_VERSION + GITLEAKS_SHA256_LINUX_<ARCH>), which the
# CI `security-secrets` job reads too — one pin, no drift. Installs when missing, reinstalls when
# the installed version differs, and refuses a release download whose SHA-256 does not match.
#
# BEST-EFFORT: exits non-zero on failure; bootstrap.sh logs and carries on.
set -uo pipefail
LOG_TAG="install-gitleaks"
# shellcheck source=tooling/setup/agent/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

version="$(pinned_version GITLEAKS_VERSION)"
installed="$(have gitleaks && gitleaks version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)"
if [ -n "${installed}" ] && [ "${installed}" = "${version}" ]; then
  log "gitleaks ${installed} is at the pin — nothing to do."
  exit 0
fi

arch="$(arch_for go)" || {
  log "unsupported architecture '$(uname -m)'."
  exit 1
}

if [ -z "${version}" ]; then
  log "no GITLEAKS_VERSION in tool-versions.sh."
  exit 1
fi
log "installing gitleaks ${version} (found: ${installed:-none})"

# Release assets use x64/arm64 (not amd64) from 8.19 onward.
asset_arch="${arch}"
[ "${asset_arch}" = "amd64" ] && asset_arch="x64"

tarball="gitleaks_${version}_linux_${asset_arch}.tar.gz"
expected_sha256="$(pinned_version "GITLEAKS_SHA256_LINUX_$(printf '%s' "${asset_arch}" | tr '[:lower:]' '[:upper:]')")"
url="https://github.com/gitleaks/gitleaks/releases/download/v${version}/${tarball}"
target="$(bin_dir)" || {
  log "no writable bin directory."
  exit 1
}

log "downloading ${url}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

download_verified "${url}" "${tmp}/${tarball}" "${expected_sha256}" || {
  log "download failed or unverified — is github.com allowed by the network policy?"
  exit 1
}
tar -xzf "${tmp}/${tarball}" -C "${tmp}" gitleaks 2>/dev/null || tar -xzf "${tmp}/${tarball}" -C "${tmp}" || {
  log "extract failed."
  exit 1
}
[ -x "${tmp}/gitleaks" ] || {
  log "unexpected tarball layout — no gitleaks binary inside ${tarball}."
  exit 1
}

install -m 0755 "${tmp}/gitleaks" "${target}/gitleaks" || {
  log "could not install to ${target}."
  exit 1
}
persist_path "${target}"

log "installed gitleaks $("${target}/gitleaks" version 2>/dev/null) at ${target}/gitleaks (SHA-256 verified)"
