#!/usr/bin/env bash
# Install the repo's pinned Node.js into /opt/node<major> for cloud-agent
# sessions (Claude Code on the web, Cursor cloud agents).
#
# Why this exists: the cloud image ships Node 20/21/22 (under /opt/nodeXX) and
# NO working version manager — `fnm` is absent and the `nvm` shell function is
# non-functional (`nvm ls` reports N/A, there is no ~/.nvm/versions tree).
# clinozy-fe sets `engineStrict: true` (pnpm-workspace.yaml) with
# `engines.node >= 24.15`, so `pnpm install` HARD FAILS on the image default.
# Probing for a version manager silently falls back to Node 22 and the whole
# install aborts.
#
# This installs the pinned version into /opt/node<major> — the same layout the
# image uses and exactly where agent-os/hooks/fe-session-start.mjs looks — so the
# SessionStart hook switches PATH to it and runs `pnpm install` automatically.
# No repo files change; nothing depends on a version manager being present.
#
# The hook's PATH switch reaches only the Bash tool, and only when the hook loads — a
# session that holds both repos loads none. So the pinned node, npm, npx, corepack and
# pnpm are also linked into ~/.local/bin, which the image puts ahead of its own
# /opt/node22/bin: every shell resolves the pinned Node, Claude Code's own process
# included. Only on the image layout — a Node from nvm or anywhere else is left alone.
#
# Usage (called by bootstrap.sh; also runnable on its own):
#   bash tooling/setup/agent/install-node.sh
#
# Network: needs egress to nodejs.org, which is NOT in the default "Trusted"
# allowlist. Set Network access to "Custom", add `nodejs.org`, and keep
# "Also include default list of common package managers" checked.
#
# Env:
#   NODE_INSTALL_PREFIX (default /opt) — parent dir for node<major>
#   NODE_LINK_USER_BIN  (default 1)    — 0 skips the ~/.local/bin links
#
# Fails FAST (set -euo pipefail): a setup-time install error should surface, not
# leave a half-broken toolchain. Idempotent: re-running is a no-op once the
# pinned version is present (Setup scripts re-run on cache rebuilds).
set -euo pipefail

readonly DIST_INDEX="https://nodejs.org/dist/index.json"
readonly INSTALL_PREFIX="${NODE_INSTALL_PREFIX:-/opt}"

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

log() { printf 'install-node: %s\n' "$*" >&2; }

# .nvmrc may pin a bare major (`24`), a major.minor (`24.19`), or an exact
# major.minor.patch (`24.21.0` — what this repo pins today, the latest 24 LTS).
# Only an exact version yields a tarball URL, so anything less specific is
# resolved against the dist index to the newest matching release. This is what keeps .nvmrc authoritative instead
# of decorative: hardcoding a version here would silently drift from the pin.
requested=""
if [ -f "${repository_root}/.nvmrc" ]; then
  requested="$(tr -dc '0-9.' <"${repository_root}/.nvmrc")"
fi
if [ -z "${requested}" ]; then
  log "ERROR: no Node version in .nvmrc — it is the one Node pin."
  exit 1
fi

# Resolve `requested` to an exact x.y.z. The index is ordered newest-first, so
# the first match for the prefix is the newest release in that line.
resolve_version() {
  local prefix="$1" escaped
  escaped="${prefix//./\\.}"
  curl -fsSL --max-time 30 "${DIST_INDEX}" 2>/dev/null |
    grep -o "\"version\":\"v${escaped}\.[0-9.]*\"" |
    head -n 1 |
    tr -dc '0-9.'
}

case "${requested}" in
  *.*.*)
    version="${requested}"
    ;;
  *)
    log "resolving newest Node ${requested}.x from ${DIST_INDEX}"
    version="$(resolve_version "${requested}" || true)"
    if [ -z "${version}" ]; then
      log "ERROR: could not resolve ${requested}.x (nodejs.org unreachable?) — pin an exact x.y.z in .nvmrc."
      exit 1
    fi
    ;;
esac
readonly version

major="${version%%.*}"
readonly major
readonly target_dir="${INSTALL_PREFIX}/node${major}"

# Link the pinned toolchain into ~/.local/bin (see the header). Skipped unless the node on
# PATH is the image's (<prefix>/node<major>), missing, or an earlier link of this script.
link_pinned_toolchain() {
  [ "${NODE_LINK_USER_BIN:-1}" = 1 ] || return 0
  local user_bin="${HOME}/.local/bin" current tool linked=""
  current="$(command -v node 2>/dev/null || true)"
  case "${current}" in
    "" | "${INSTALL_PREFIX}"/node*/bin/node | "${user_bin}/node") ;;
    *)
      log "node on PATH is ${current}, not the image layout — not linking."
      return 0
      ;;
  esac
  # pnpm comes from the pinned Node's corepack (package.json pins the version), not the image's.
  [ -x "${target_dir}/bin/pnpm" ] ||
    "${target_dir}/bin/corepack" enable --install-directory "${target_dir}/bin" pnpm ||
    log "corepack enable pnpm failed (non-fatal)."
  mkdir -p "${user_bin}"
  for tool in node npm npx corepack pnpm pnpx; do
    [ -x "${target_dir}/bin/${tool}" ] || continue
    ln -sfn "${target_dir}/bin/${tool}" "${user_bin}/${tool}" && linked="${linked} ${tool}"
  done
  log "linked${linked} from ${target_dir}/bin into ${user_bin}."
}

# Idempotent: skip the download when the target already has this exact version.
if [ -x "${target_dir}/bin/node" ] && [ "$("${target_dir}/bin/node" -v 2>/dev/null)" = "v${version}" ]; then
  log "Node v${version} already present at ${target_dir} — nothing to download."
  link_pinned_toolchain
  exit 0
fi

case "$(uname -m)" in
  x86_64) arch="x64" ;;
  aarch64 | arm64) arch="arm64" ;;
  *)
    log "unsupported architecture '$(uname -m)'."
    exit 1
    ;;
esac
readonly arch

readonly tarball="node-v${version}-linux-${arch}.tar.xz"
readonly url="https://nodejs.org/dist/v${version}/${tarball}"

if ! mkdir -p "${INSTALL_PREFIX}" 2>/dev/null || [ ! -w "${INSTALL_PREFIX}" ]; then
  log "cannot write to ${INSTALL_PREFIX} — run as root or set NODE_INSTALL_PREFIX to a writable dir."
  exit 1
fi

log "downloading ${url}"
# Stage inside INSTALL_PREFIX so the final swap is a same-filesystem rename.
staging_dir="$(mktemp -d "${INSTALL_PREFIX}/.node-install.XXXXXX")"
cleanup() { rm -rf "${staging_dir}"; }
trap cleanup EXIT

curl -fsSL --max-time 300 "${url}" -o "${staging_dir}/${tarball}"

mkdir -p "${staging_dir}/unpacked"
tar -xJf "${staging_dir}/${tarball}" -C "${staging_dir}/unpacked" --strip-components=1

# Replace atomically-ish rather than untarring over the old tree, so a version
# change never leaves stale files from the previous install behind.
rm -rf "${target_dir}"
mv "${staging_dir}/unpacked" "${target_dir}"

log "installed Node $("${target_dir}/bin/node" -v) at ${target_dir}"
link_pinned_toolchain
