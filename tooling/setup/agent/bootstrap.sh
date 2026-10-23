#!/usr/bin/env bash
# The one cloud-agent setup script for clinozy-fe, as clinozy-be's bootstrap.sh is for the backend:
# install everything, then bring the app up — the dev server serving the app shell, left running.
#
#   bash tooling/setup/agent/bootstrap.sh                 # the session: setup → the dev server live
#   bash tooling/setup/agent/bootstrap.sh --install-only  # environment Setup script: the installs,
#                                                         # cached; no server left running
#
# A session's steps (the session-start hook launches this detached in every web session):
#    1 Node                      the pinned .nvmrc Node, put first on PATH
#    2 Dependencies              pnpm install — only when Node or the lockfile changed
#    3 Environment (.env.local)  every run; the OAuth buttons off in the cloud
#    4 Dev server                `pnpm dev` on :5173 in its own session, health checked (it serves
#                                the app shell), then left running
# Then "live", and in the background the agent's own tools (install-agent-tools.sh: the distro CLI
# tools, gh, gitleaks, semgrep, headroom + the MCP pair + the CodeGraph index + the session hooks,
# the Playwright browsers) and SonarQube — the app needs none of them, so they never hold "live" up.
#
# The Setup script's steps (--install-only): 1 Node, 2 Dependencies, 3 Environment, 4 Docker + the
# SonarQube gate images, 5 the agent tools (inline). A cached Setup script must terminate, so it
# starts no server; Docker is touched only here, never in a session, where a restart to apply the
# registry mirror would take clinozy-be's Postgres and Redis down with it.
#
# A lock (stack-lock.lib.sh, in $AGENT_STACK_DIR/frontend) keeps two bring-ups from racing; a
# re-run is safe (a dev server already serving the app shell is kept). The logs sit in the
# directory clinozy-be's bring-up uses ($AGENT_STACK_DIR, default /tmp/agent-stack):
# bootstrap-frontend.log (this script, when the hook launches it), frontend.log (Vite),
# agent-tools-frontend.log and sonarqube-frontend.log.
#
# Works from any agent harness — Claude Code (web, CLI, desktop), Cursor cloud agents, Codex, or a
# plain shell. Nothing here is Claude-specific: the one harness integration is $CLAUDE_ENV_FILE,
# which is written only when the variable exists and is otherwise a no-op.
#
# Tool installs are BEST-EFFORT and log ✓/skip without aborting; Node, dependencies, the env
# scaffold and, in a session, the dev server's health check are HARD gates (non-zero exit).
#
# Env:
#   NODE_INSTALL_PREFIX        parent dir for node<major> (default /opt)
#   HEALTHCHECK_URL            the dev server's probe (default http://localhost:5173/)
set -uo pipefail

install_only=0
for argument in "$@"; do
  case "${argument}" in
    --install-only) install_only=1 ;;
    *)
      echo "✗ unknown option: ${argument} (only --install-only)" >&2
      exit 2
      ;;
  esac
done
# Every run but the cached Setup script brings the dev server live.
live=1
[ "${install_only}" = 1 ] && live=0

cd "$(dirname "${BASH_SOURCE[0]}")/../../.." || exit 1
readonly AGENT_DIR="tooling/setup/agent"
readonly STACK_DIR="${AGENT_STACK_DIR:-/tmp/agent-stack}"
# The lock's parent: clinozy-be's bring-up holds $STACK_DIR/lock, so this one is apart from it.
readonly LOCK_PARENT="${STACK_DIR}/frontend"
readonly STAMP_DIR="node_modules/.agent-stamps"
readonly DEV_SERVER_PORT=5173
TOTAL=4
[ "${install_only}" = 1 ] && TOTAL=5
start_ts=$(date +%s)

# shellcheck source=tooling/setup/agent/stack-lock.lib.sh
source "${AGENT_DIR}/stack-lock.lib.sh"

# Seconds since this run started, for the log.
elapsed() { echo "$(($(date +%s) - start_ts))s"; }

step() {
  echo ""
  echo "▶ $* (+$(elapsed))"
}
ok() { echo "✓ $*"; }
skip() { echo "• $*"; }
die() {
  echo "✗ $*" >&2
  exit 1
}

# start_detached NAME COMMAND… — COMMAND in its own session, so it outlives this script
# (and the hook that launched it); output in $STACK_DIR/NAME.log, pid in $STACK_DIR/NAME.pid.
start_detached() {
  local name=$1
  shift
  if command -v setsid >/dev/null 2>&1; then
    setsid nohup "$@" >"${STACK_DIR}/${name}.log" 2>&1 </dev/null &
  else
    nohup "$@" >"${STACK_DIR}/${name}.log" 2>&1 </dev/null &
  fi
  echo $! >"${STACK_DIR}/${name}.pid"
}

# One bring-up at a time (a session resume, or a manual run while the hook's runs). A lock
# whose holder is gone — or from another boot, carried in by a cached environment — is stale.
if [ "${live}" = 1 ]; then
  mkdir -p "${LOCK_PARENT}"
  if ! mkdir "${LOCK_PARENT}/lock" 2>/dev/null; then
    if lock_holder="$(stack_lock_holder "${LOCK_PARENT}")"; then
      echo "bootstrap: a bring-up is already running (pid ${lock_holder}) — follow ${STACK_DIR}/bootstrap-frontend.log" >&2
      exit 0
    fi
    echo "bootstrap: clearing a stale bring-up lock (pid $(cat "${LOCK_PARENT}/lock/pid" 2>/dev/null || echo '?') is no bring-up running in this boot)." >&2
    rm -f "${LOCK_PARENT}/lock/pid" "${LOCK_PARENT}/lock/boot_id"
    rmdir "${LOCK_PARENT}/lock" 2>/dev/null
    mkdir "${LOCK_PARENT}/lock" || die "cannot take the bring-up lock ${LOCK_PARENT}/lock"
  fi
  stack_lock_write "${LOCK_PARENT}"
  trap 'rm -f "${LOCK_PARENT}/lock/pid" "${LOCK_PARENT}/lock/boot_id"; rmdir "${LOCK_PARENT}/lock" 2>/dev/null' EXIT
fi

echo "clinozy-fe cloud bring-up — $(date -u '+%Y-%m-%d %H:%M:%SZ')$([ "${install_only}" = 1 ] && echo ' (install only)')"

# 1) Node runtime ------------------------------------------------------------
step "[1/${TOTAL}] Node runtime"
bash "${AGENT_DIR}/install-node.sh" >&2 || skip "install-node best-effort (using session Node)"

# install-node.sh drops the pinned Node into <prefix>/node<major>, but it runs in
# a child process and so cannot change THIS shell's PATH. Activate it here so
# every pnpm step below runs on the pinned Node; otherwise the image default
# (e.g. Node 22) trips pnpm's engine-strict gate at the install step. The
# SessionStart hook (agent-os/hooks/fe-session-start.mjs) does the same switch for
# interactive sessions, but does not run when bootstrap.sh is the Setup script.
#
# `cut -d. -f1` is load-bearing: .nvmrc pins `24.21.0`, so stripping the dots would
# yield major `24210` and look for a /opt/node24210 that never exists.
required_major="24"
[ -f .nvmrc ] && required_major="$(tr -dc '0-9.' <.nvmrc | cut -d. -f1)"
current_major="$(node -v 2>/dev/null | tr -dc '0-9.' | cut -d. -f1)"
current_major="${current_major:-0}"
if [ "${current_major}" -lt "${required_major}" ] 2>/dev/null; then
  node_prefix="${NODE_INSTALL_PREFIX:-/opt}"
  for candidate in \
    "${node_prefix}/node${required_major}/bin" \
    /opt/node"${required_major}"*/bin \
    "${HOME}/.nvm/versions/node/v${required_major}"*/bin \
    /usr/local/node"${required_major}"*/bin; do
    [ -x "${candidate}/node" ] || continue
    export PATH="${candidate}:${PATH}"
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      # SC2016: the literal `$PATH` is intentional — it must expand when the
      # agent session sources this file, not now.
      # shellcheck disable=SC2016
      printf 'export PATH=%s:$PATH\n' "${candidate}" >>"${CLAUDE_ENV_FILE}"
    fi
    echo "bootstrap: switched to Node $("${candidate}/node" -v) at ${candidate} (was v${current_major}.x)." >&2
    break
  done
fi

node -v >/dev/null 2>&1 || die "Node not available"
if [ "$(node -v 2>/dev/null | tr -dc '0-9.' | cut -d. -f1)" -lt "${required_major}" ] 2>/dev/null; then
  skip "[1/${TOTAL}] Node $(node -v) < required v${required_major} (.nvmrc) — engine-strict will reject the install below"
else
  ok "[1/${TOTAL}] Node $(node -v)"
fi

# pnpm via corepack (packageManager pin in package.json).
corepack enable >/dev/null 2>&1 || skip "corepack enable failed — ensure pnpm is on PATH"

# Installers below may drop binaries in ~/.local/bin (uv always; gh and gitleaks
# when /usr/local/bin is not writable). They run as child processes and so
# cannot change THIS shell's PATH — without this, every `command -v` check below
# would report a tool we just installed as missing. Added unconditionally: the
# directory may not exist until an installer creates it.
case ":${PATH}:" in
  *":${HOME}/.local/bin:"*) ;;
  *) export PATH="${HOME}/.local/bin:${PATH}" ;;
esac

# 2) Dependencies (HARD GATE) ------------------------------------------------
# Only when what it depends on changed since it last succeeded here (the cached Setup script, or an
# earlier bring-up in this container): the hash of Node and the lockfile, as clinozy-be stamps its
# own install.
step "[2/${TOTAL}] Dependencies (pnpm install --frozen-lockfile)"
hash_of() { "$@" 2>/dev/null | { sha256sum 2>/dev/null || shasum -a 256; } | cut -d' ' -f1; }
dependency_inputs() {
  node -v
  cat .nvmrc pnpm-lock.yaml pnpm-workspace.yaml patches/* 2>/dev/null
  grep '"packageManager"' package.json
}
dependency_stamp="$(hash_of dependency_inputs)"
if [ -f "${STAMP_DIR}/dependencies" ] && [ "$(cat "${STAMP_DIR}/dependencies")" = "${dependency_stamp}" ] &&
  [ -x node_modules/.bin/vite ]; then
  skip "[2/${TOTAL}] dependencies current — same Node and lockfile as the last install (${STAMP_DIR}/dependencies)"
else
  # Frozen deliberately: a desynced lockfile must fail loudly here rather than be
  # silently "fixed" in a throwaway session and then red every CI job on push.
  pnpm install --frozen-lockfile >&2 || die "pnpm install failed (frozen lockfile — run pnpm install locally and commit pnpm-lock.yaml if it is out of date)"
  mkdir -p "${STAMP_DIR}" && printf '%s\n' "${dependency_stamp}" >"${STAMP_DIR}/dependencies"
  ok "[2/${TOTAL}] node_modules ready"
fi

# 3) Environment file (HARD GATE) --------------------------------------------
step "[3/${TOTAL}] Environment (.env.local)"
# --only-env is REQUIRED: a bare `pnpm setup:local` runs through to phase 5/5
# and spawns a long-lived `pnpm dev`, which would hang this script.
pnpm setup:local --only-env >&2 || die "env scaffold failed (pnpm setup:local --only-env)"
# A cloud session has no real browser or provider accounts, so Google / GitHub sign-in can
# never complete there: hide their buttons. Local machines keep the schema default (true).
for oauth_key in VITE_AUTH_OAUTH_GOOGLE VITE_AUTH_OAUTH_GITHUB; do
  if grep -q "^${oauth_key}=" .env.local; then
    sed -i.bak "s/^${oauth_key}=.*/${oauth_key}=false/" .env.local && rm -f .env.local.bak
  else
    printf '%s=false\n' "${oauth_key}" >>.env.local
  fi
done
ok "[3/${TOTAL}] .env.local ready (OAuth buttons off in the cloud)"

if [ "${install_only}" = 1 ]; then
  # 4) Docker + the SonarQube gate images ------------------------------------
  # The pre-push SonarQube gate runs in Docker, so its images are pulled here, into the cached
  # Setup filesystem, once per environment.
  step "[4/${TOTAL}] Docker + the SonarQube gate images"
  if command -v docker >/dev/null 2>&1; then
    bash "${AGENT_DIR}/install-docker-images.sh" || true
    if docker info >/dev/null 2>&1; then
      ok "[4/${TOTAL}] Docker running (SonarQube images pre-pulled when reachable)"
    else
      skip "[4/${TOTAL}] Docker not reachable — the pre-push SonarQube gate starts it on demand"
    fi
  else
    skip "[4/${TOTAL}] Docker CLI absent — the pre-push SonarQube gate needs Docker"
  fi

  # 5) The agent's tools -------------------------------------------------------
  step "[5/${TOTAL}] Agent tools (distro CLI tools, gh, gitleaks, semgrep, headroom + MCP pair + CodeGraph index + session hooks, Playwright)"
  if bash "${AGENT_DIR}/install-agent-tools.sh"; then
    ok "[5/${TOTAL}] agent tools ready"
  else
    skip "[5/${TOTAL}] agent tools: gitleaks is missing — see the report above (non-fatal)"
  fi
  echo ""
  echo "✓ install complete in $(elapsed) — every session brings the dev server live itself (bash tooling/setup/agent/bootstrap.sh)."
  exit 0
fi

# 4) The dev server — started in its own session and left running (HARD GATE) --
# --strictPort: a taken :5173 fails at once in the log, instead of Vite drifting to a port the API's
# CORS list does not name. A server already serving the app shell (a resumed session) is kept,
# never joined by a second one, which would only fail on the taken port.
step "[4/${TOTAL}] Dev server live (Vite :${DEV_SERVER_PORT}, kept running)"
health_url="${HEALTHCHECK_URL:-http://localhost:${DEV_SERVER_PORT}/}"
mkdir -p "${STACK_DIR}"
running_shell="$(curl -fsS --max-time 5 "${health_url}" 2>/dev/null || true)"
if [[ "${running_shell}" == *'/src/main.tsx'* ]]; then
  ok "[4/${TOTAL}] dev server already live on :${DEV_SERVER_PORT}"
else
  start_detached frontend pnpm dev --port "${DEV_SERVER_PORT}" --strictPort
  if ! HEALTHCHECK_URL="${health_url}" bash "${AGENT_DIR}/healthcheck.sh"; then
    echo "---- pnpm dev log (tail) ----" >&2
    tail -20 "${STACK_DIR}/frontend.log" >&2
    die "dev server healthcheck failed (log: ${STACK_DIR}/frontend.log)"
  fi
  ok "[4/${TOTAL}] dev server live on :${DEV_SERVER_PORT} (kept running)"
fi

# The agent's tools, then SonarQube, in the background — the app needs neither. One tools run at a
# time.
agent_tools_pid="$(cat "${STACK_DIR}/agent-tools-frontend.pid" 2>/dev/null || true)"
if [ -n "${agent_tools_pid}" ] && ps -p "${agent_tools_pid}" -o args= 2>/dev/null | grep -q 'install-agent-tools\.sh'; then
  agent_tools_note="already running (pid ${agent_tools_pid})"
else
  start_detached agent-tools-frontend bash "${AGENT_DIR}/install-agent-tools.sh"
  agent_tools_note="installing in the background"
fi
# start-sonarqube.sh waits until clinozy-be's bring-up no longer holds its lock and Docker answers,
# so SonarQube's two-minute boot never competes with the backend's migrations and seed, and the
# first push finds the pre-push gate's server up instead of booting it.
start_detached sonarqube-frontend bash "${AGENT_DIR}/start-sonarqube.sh"
echo ""
echo "✓ dev server live in $(elapsed) — http://localhost:${DEV_SERVER_PORT}"
echo "  Agent tools  ${agent_tools_note} (log: ${STACK_DIR}/agent-tools-frontend.log)"
echo "  SonarQube    starting in the background for the pre-push gate (log: ${STACK_DIR}/sonarqube-frontend.log)"
echo "  Logs         ${STACK_DIR}/{bootstrap-frontend,frontend}.log · stop Vite: pkill -s \"\$(cat ${STACK_DIR}/frontend.pid)\""
echo "  Gates        pnpm health. E2E also needs clinozy-be on :3000."
