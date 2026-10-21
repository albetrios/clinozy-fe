#!/usr/bin/env bash
# Ensure Playwright browsers are available for the E2E lane in a cloud session.
#
# This is clinozy-fe's counterpart to clinozy-be's Docker step: the heavy, optional,
# frontend-specific dependency that a session may or may not need.
#
# Two things matter on cloud images:
#
#  1. Chromium is often PRE-INSTALLED (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers,
#     with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 so npm postinstall never refetches
#     it), but not always the build the pinned @playwright/test drives — an image
#     can ship chromium-1194 while the pin needs chromium-1248. So this script
#     asks Playwright which build directories the pin needs and downloads only
#     when one of them is missing, never a pointless ~150 MB re-download.
#  2. Downloading browsers must never fail the bring-up. E2E additionally needs
#     clinozy-be on :3000, which cloud sessions do not have, so the suite is
#     opt-in anyway (tests/e2e/global-setup.ts fails fast when it is down).
#
# Usage:  bash tooling/setup/agent/install-playwright.sh
# Installs Chromium only (the browser the E2E suites run); no OS deps.
#
# BEST-EFFORT: exits non-zero on failure; bootstrap.sh logs and carries on.
set -uo pipefail
LOG_TAG="install-playwright"
# shellcheck source=tooling/setup/agent/lib.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

cd "${REPO_ROOT}" || exit 1

if [ ! -d node_modules/@playwright ]; then
  log "@playwright/test is not installed yet — run pnpm install first."
  exit 1
fi

browsers="chromium"

# Already provisioned? Only the exact revisions the pin needs count: `--dry-run`
# prints their install locations (chromium-1248, chromium_headless_shell-1248,
# ffmpeg-1013, …) without downloading, and Playwright writes INSTALLATION_COMPLETE
# into each directory once its download has finished.
browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-${HOME}/.cache/ms-playwright}"
# shellcheck disable=SC2086
required=$(pnpm exec playwright install --dry-run ${browsers} | sed -n 's/^ *Install location: *//p')
if [ -z "${required}" ]; then
  log "could not list the browser builds @playwright/test needs (playwright install --dry-run printed none)."
  exit 1
fi
missing=""
while IFS= read -r directory; do
  [ -f "${directory}/INSTALLATION_COMPLETE" ] || missing="${missing} ${directory##*/}"
done <<<"${required}"

if [ -z "${missing}" ]; then
  log "browsers for the pinned @playwright/test already present in ${browsers_path} — nothing to download."
  exit 0
fi

log "missing for the pinned @playwright/test:${missing} — installing ${browsers} into ${browsers_path}"

# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD only guards npm postinstall; an explicit
# `playwright install` still downloads, which is what we want here.
# shellcheck disable=SC2086
if pnpm exec playwright install ${browsers} >&2; then
  log "browsers installed:${missing}"
else
  log "browser install failed — E2E will not run (needs cdn.playwright.dev; ffmpeg also tries playwright.download.prss.microsoft.com)."
  exit 1
fi
