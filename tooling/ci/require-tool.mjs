/**
 * The one way a gate checks for a tool it needs: {@link requireTool} (clinozy-be's
 * `tooling/setup/common/require-tool.ts`, on this repository's plain-Node shape).
 *
 * Before this, each gate checked in its own way and said something different when the tool was
 * missing — the before-commit gitleaks step blocked with two install hints, Semgrep at push
 * warned with a bare `pip install`, Docker for SonarQube surfaced only as a failed `docker info`.
 * Now every gate names the tool, what it was needed for, and one fix.
 *
 * Which tools block is decided by the caller, once, in the `mode` it passes:
 * - `block` — gitleaks (the staged secrets scan) and Docker (the SonarQube gate): no stand-in.
 * - `warn` — semgrep at push: the PR's Semgrep lane scans everything, so the push goes on.
 *
 * Command line, for the shell gates: `node tooling/ci/require-tool.mjs <tool> <block|warn>
 * <purpose>` exits 0 when the tool runs, 1 when it is missing (after the message).
 */
import { spawnSync } from 'node:child_process';

import { isMain, parseCommandLine } from './script.mjs';

/** Each tool's version command and its one fix — the pinned installer where there is one. */
const TOOLS = {
  docker: {
    versionArguments: ['--version'],
    install:
      'Docker Desktop or OrbStack on macOS; a cloud session starts it with bash tooling/setup/agent/ensure-docker-daemon.sh',
  },
  gitleaks: {
    versionArguments: ['version'],
    install:
      'bash tooling/setup/agent/install-gitleaks.sh (pins: tooling/setup/agent/tool-versions.sh; macOS: brew install gitleaks)',
  },
  semgrep: {
    versionArguments: ['--version'],
    install:
      'bash tooling/setup/agent/install-semgrep.sh (pins: tooling/setup/agent/tool-versions.sh)',
  },
};

/**
 * The fix for a missing tool.
 *
 * @param {keyof typeof TOOLS} name
 * @returns {string}
 */
export function toolInstallHint(name) {
  return TOOLS[name].install;
}

/**
 * Whether `name` is installed; when it is not, says so — what it was needed for and how to
 * install it — as an error (`block`) or a warning (`warn`) on stderr. Never throws.
 *
 * @param {{ name: keyof typeof TOOLS, mode: 'block' | 'warn', purpose: string }} options
 * @returns {boolean}
 */
export function requireTool({ name, mode, purpose }) {
  const result = spawnSync(name, TOOLS[name].versionArguments, { stdio: 'ignore' });
  if (result.status === 0) return true;
  const marker = mode === 'block' ? '✖' : '⚠';
  const consequence = mode === 'block' ? 'cannot run' : 'skipped';
  console.error(
    `${marker} ${name} is not installed — ${purpose} ${consequence}. Install: ${toolInstallHint(name)}`,
  );
  return false;
}

if (isMain(import.meta.url)) {
  const { positionals } = parseCommandLine(process.argv.slice(2), { maxPositionals: 3 });
  const [name = '', mode = '', purpose = ''] = positionals;
  if (!(name in TOOLS) || (mode !== 'block' && mode !== 'warn') || purpose === '') {
    console.error(
      `Usage: node tooling/ci/require-tool.mjs <${Object.keys(TOOLS).join('|')}> <block|warn> <purpose>`,
    );
    process.exitCode = 2;
  } else {
    process.exitCode = requireTool({ name, mode, purpose }) ? 0 : 1;
  }
}
