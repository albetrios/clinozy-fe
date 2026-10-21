#!/usr/bin/env bash
# One-shot cloud-session bring-up for clinozy-fe cloud agents.
#
# Runs every agent setup helper in order — Node, distro CLI tools, gh, gitleaks and Docker,
# headroom/uv — installs dependencies, scaffolds a self-contained `.env.local`
# (`pnpm setup:local --only-env`) and the default MCP pair, provisions Playwright
# browsers, then verifies the Vite dev server actually serves the app shell. A
# single command to make a cloud session "same as local", with a progress log
# after each step so anyone watching the session sees live status.
#
#   bash tooling/setup/agent/bootstrap.sh
#
# Works from any agent harness — Claude Code (web, CLI, desktop), Cursor cloud
# agents, Codex, or a plain shell. Nothing here is Claude-specific: the one
# harness integration is $CLAUDE_ENV_FILE, which is written only when the
# variable exists and is otherwise a no-op.
#
# Steps 1-5 (tool installs) and 8-9 (MCP, browsers) are BEST-EFFORT and log
# ✓/skip without aborting; dependencies, the env scaffold, and the healthcheck
# are HARD gates (non-zero exit on failure). The dev server is started only
# transiently for the healthcheck (on :5173 — --strictPort) and then stopped; one
# already serving the app shell there (a web session's start hook keeps one) is
# probed and left running.
#
# Env:
#   NODE_INSTALL_PREFIX        parent dir for node<major> (default /opt)
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.." || exit 1
readonly AGENT_DIR="tooling/setup/agent"
readonly TOTAL=10
start_ts=$(date +%s)

step() {
  echo ""
  echo "▶ $*"
}
ok() { echo "✓ $*"; }
skip() { echo "• $*"; }
die() {
  echo "✗ $*" >&2
  exit 1
}

# --- process-tree teardown for the transient dev server ----------------------
# `pnpm dev` spawns pnpm -> vite (-> esbuild/rolldown workers). Killing only the
# pnpm pid orphans Vite and leaves :5173 bound, so walk the real tree. Reading
# ppid from /proc/<pid>/stat must skip past "(comm)" — a process name can itself
# contain spaces and parentheses, which breaks naive field splitting.
ppid_of() {
  local stat
  stat="$(cat "/proc/$1/stat" 2>/dev/null)" || return 1
  stat="${stat##*) }"
  # shellcheck disable=SC2086  # deliberate word-splitting: state=$1, ppid=$2
  set -- ${stat}
  printf '%s' "${2:-}"
}

# Children of a pid: /proc on Linux (the cloud image), `pgrep -P` where there is
# no /proc (macOS, when this is run by hand) — without the fallback the Vite child
# survived and kept the port bound.
children_of() {
  local p pid
  if [ -d /proc/self ]; then
    for p in /proc/[0-9]*; do
      pid="${p#/proc/}"
      [ "${pid}" = "$$" ] && continue
      [ "$(ppid_of "${pid}" 2>/dev/null)" = "$1" ] && printf '%s\n' "${pid}"
    done
  else
    pgrep -P "$1" 2>/dev/null || true
  fi
}

kill_tree() {
  local root="$1" pid
  for pid in $(children_of "${root}"); do
    kill_tree "${pid}"
  done
  kill -TERM "${root}" 2>/dev/null || true
}

echo "clinozy-fe cloud bring-up — $(date -u '+%Y-%m-%d %H:%M:%SZ')"

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

# 2) Distro CLI tools --------------------------------------------------------
step "[2/${TOTAL}] Distro CLI tools (jq, ripgrep, shellcheck, rsvg-convert, xz)"
bash "${AGENT_DIR}/install-apt-tools.sh" || true
present=""
for b in jq rg shellcheck rsvg-convert xz; do
  command -v "$b" >/dev/null 2>&1 && present="${present} ${b}"
done
if [ -n "${present}" ]; then ok "[2/${TOTAL}] present:${present}"; else skip "[2/${TOTAL}] none installed (non-fatal)"; fi

# 3) GitHub CLI --------------------------------------------------------------
step "[3/${TOTAL}] GitHub CLI (gh)"
bash "${AGENT_DIR}/install-gh.sh" || true
if command -v gh >/dev/null 2>&1; then
  ok "[3/${TOTAL}] $(gh --version | head -1)"
else
  skip "[3/${TOTAL}] gh unavailable (non-fatal — MCP GitHub tools still work)"
fi

# 4) The git hooks' gate tools: gitleaks + Docker with the SonarQube images --
# The pre-commit secret scan is mandatory and the pre-push SonarQube gate runs in Docker, so both
# are provisioned here, in the cached Setup script, once per container.
step "[4/${TOTAL}] Gate tools (gitleaks secret scan, Docker + SonarQube images)"
bash "${AGENT_DIR}/install-gitleaks.sh" || true
if command -v gitleaks >/dev/null 2>&1; then
  ok "[4/${TOTAL}] gitleaks $(gitleaks version 2>/dev/null)"
else
  skip "[4/${TOTAL}] gitleaks unavailable — commits fail until it is installed (bash ${AGENT_DIR}/install-gitleaks.sh)"
fi
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

# 5) headroom / uv (MCP context compression) ---------------------------------
step "[5/${TOTAL}] headroom via uvx (MCP context compression)"
bash "${AGENT_DIR}/install-headroom.sh" || true
if command -v uvx >/dev/null 2>&1; then
  ok "[5/${TOTAL}] uvx ready ($(command -v uvx))"
else
  skip "[5/${TOTAL}] uvx unavailable — headroom MCP will not start (codegraph unaffected)"
fi

# 6) Dependencies (HARD GATE) ------------------------------------------------
step "[6/${TOTAL}] Dependencies (pnpm install --frozen-lockfile)"
# Frozen deliberately: a desynced lockfile must fail loudly here rather than be
# silently "fixed" in a throwaway session and then red every CI job on push.
pnpm install --frozen-lockfile >&2 || die "pnpm install failed (frozen lockfile — run pnpm install locally and commit pnpm-lock.yaml if it is out of date)"
ok "[6/${TOTAL}] node_modules ready"

# 7) Environment file (HARD GATE) --------------------------------------------
step "[7/${TOTAL}] Environment (.env.local)"
# --only-env is REQUIRED: a bare `pnpm setup:local` runs through to phase 5/5
# and spawns a long-lived `pnpm dev`, which would hang this script.
pnpm setup:local --only-env >&2 || die "env scaffold failed (pnpm setup:local --only-env)"
# A cloud session has no real browser or provider accounts, so Google / GitHub sign-in can
# never complete there: hide their buttons. Local machines keep the schema default (true).
for oauth_key in VITE_AUTH_OAUTH_GOOGLE VITE_AUTH_OAUTH_GITHUB; do
  if grep -q "^${oauth_key}=" .env.local; then
    sed -i.bak "s/^${oauth_key}=.*/${oauth_key}=false/" .env.local && rm -f .env.local.bak
  else
    printf '%s=false\n' "${oauth_key}" >> .env.local
  fi
done
ok "[7/${TOTAL}] .env.local ready (OAuth buttons off in the cloud)"

# 8) MCP default pair + the codegraph index it serves + session hooks --------
step "[8/${TOTAL}] MCP default pair (.mcp.json) + codegraph index + session hooks"
pnpm mcp:setup:default >&2 || skip "mcp:setup:default failed — run it manually if MCP tools are missing"
if [ -f .mcp.json ]; then
  ok "[8/${TOTAL}] .mcp.json written (fe-codegraph + fe-headroom)"
else
  skip "[8/${TOTAL}] .mcp.json absent (non-fatal)"
fi
# Step 7's --only-env stops before the index phase of setup:local, so build it here.
pnpm setup:local --only-codegraph >&2 || skip "codegraph index failed — run \`pnpm setup:local --only-codegraph\` (non-fatal)"
if [ -f .codegraph/codegraph.db ]; then
  ok "[8/${TOTAL}] codegraph index ready (.codegraph/)"
else
  skip "[8/${TOTAL}] codegraph index absent — codegraph MCP answers nothing until it is built (non-fatal)"
fi
# A session that holds several repositories reads hooks only from the parent directory's
# .claude/settings.json; agent-os:session-hooks writes every repository's there (a no-op in a
# single-repository checkout).
pnpm agent-os:session-hooks >&2 || skip "agent-os:session-hooks failed (non-fatal)"

# 9) Playwright browsers -----------------------------------------------------
step "[9/${TOTAL}] Playwright browsers (E2E)"
bash "${AGENT_DIR}/install-playwright.sh" || true
browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"
if ls -d "${browsers_path}"/chromium* >/dev/null 2>&1; then
  ok "[9/${TOTAL}] chromium available in ${browsers_path}"
else
  skip "[9/${TOTAL}] no browsers — E2E unavailable (also needs clinozy-be on :3000)"
fi

# 10) App health (dev server serves the app shell) ---------------------------
step "[10/${TOTAL}] App health (Vite dev server serves the app shell)"
health_port=5173
health_url="${HEALTHCHECK_URL:-http://localhost:${health_port}/}"
# A web session's start hook keeps a dev server on :5173 (fe-session-start.mjs): that one is
# probed and left running, since a second on the same port would only fail --strictPort.
running_shell="$(curl -fsS --max-time 5 "${health_url}" 2>/dev/null || true)"
if [[ "${running_shell}" == *'/src/main.tsx'* ]]; then
  ok "[10/${TOTAL}] app shell served (the dev server already running on :${health_port})"
else
  app_log="$(mktemp)"
  # --strictPort: a port already in use fails at once with Vite's own message,
  # instead of Vite drifting to the next port while the probe waits 90s on this one.
  pnpm dev --port "${health_port}" --strictPort >"${app_log}" 2>&1 &
  dev_pid=$!
  if HEALTHCHECK_URL="${health_url}" bash "${AGENT_DIR}/healthcheck.sh"; then
    ok "[10/${TOTAL}] app shell served"
    app_ok=1
  else
    echo "---- pnpm dev log (tail) ----" >&2
    tail -20 "${app_log}" >&2
    app_ok=0
  fi

  kill_tree "${dev_pid}"
  echo "  stopped the transient dev server." >&2
  rm -f "${app_log}"
  [ "${app_ok}" = "1" ] || die "healthcheck failed"
fi

echo ""
echo "✓ bring-up complete in $(($(date +%s) - start_ts))s — session matches local."
echo "  Next: \`pnpm dev\` (Vite :5173). Gates: \`pnpm health\`. E2E also needs clinozy-be on :3000."
