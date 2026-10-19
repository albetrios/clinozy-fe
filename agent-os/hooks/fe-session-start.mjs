#!/usr/bin/env node
// Claude Code SessionStart hook for clinozy-fe (self-contained — no other repo).
//
// Two jobs:
//   1. (web) Make the env usable: verify Node, switch to a new-enough Node when needed (pinned for
//      the session via $CLAUDE_ENV_FILE), and install deps so `pnpm health` / tests / linters
//      work. The installers stay what they are — pnpm, corepack and
//      tooling/setup/agent/install-gitleaks.sh, spawned from here.
//   2. Inject session context: the agent-os skill-routing map plus a short env/commands summary,
//      as SessionStart additionalContext.
//
// Claude runs it on startup and resume only (hooks.json): /clear and compact leave the
// environment as it was, and fe-compact-resume-card.mjs covers compact. The 16 KB routing map goes
// in on startup; a resumed conversation already holds it, so a resume injects only the summary.
//
// stderr carries the install logs and diagnostics (NOT added to context). Fails open: any error
// exits 0.
import { spawnSync } from 'node:child_process';
import {
  accessSync,
  appendFileSync,
  constants,
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { delimiter, join } from 'node:path';

import { addModelContext, readHookPayload, repositoryRoot } from './_fe-hook.mjs';

const DEFAULT_NODE_MAJOR = 24;
const isRemote = process.env.CLAUDE_CODE_REMOTE === 'true';

/** Writes one diagnostic line to stderr (never the model's context). */
function diagnose(message) {
  process.stderr.write(`session-start: ${message}\n`);
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** True when `name` is an executable on PATH (the shell's `command -v`). */
function onPath(name) {
  return (process.env.PATH || '')
    .split(delimiter)
    .some((directory) => directory && isExecutable(join(directory, name)));
}

/** The major version in a version text (`v24.2.0`, `24.2.0`), or `NaN`. */
function majorOf(text) {
  return Number.parseInt((text || '').replace(/[^0-9.]/g, '').split('.')[0] || 'NaN', 10);
}

/** The repository's Node major: `.nvmrc`, else 24. */
function requiredNodeMajor() {
  try {
    const major = majorOf(readFileSync(join(repositoryRoot, '.nvmrc'), 'utf8'));
    return Number.isNaN(major) ? DEFAULT_NODE_MAJOR : major;
  } catch {
    return DEFAULT_NODE_MAJOR;
  }
}

/** `<parent>/<prefix>*` directories, sorted, as the shell expands the glob. */
function matchingDirectories({ parent, prefix }) {
  try {
    return readdirSync(parent)
      .filter((entry) => entry.startsWith(prefix))
      .sort()
      .map((entry) => join(parent, entry));
  } catch {
    return [];
  }
}

/** The `bin` directories a new-enough Node may live in, in the order they are tried. */
function nodeCandidates(major) {
  return [
    `/opt/node${major}/bin`,
    ...matchingDirectories({ parent: '/opt', prefix: `node${major}` }).map((directory) =>
      join(directory, 'bin'),
    ),
    ...matchingDirectories({
      parent: join(process.env.HOME || '', '.nvm', 'versions', 'node'),
      prefix: `v${major}`,
    }).map((directory) => join(directory, 'bin')),
    ...matchingDirectories({ parent: '/usr/local', prefix: `node${major}` }).map(
      (directory) => join(directory, 'bin'),
    ),
  ];
}

/** The Node to work with: the one on PATH, or a new-enough one switched to for the session. */
function provisionNode(requiredMajor) {
  const current = { version: process.version, major: majorOf(process.version) };
  if (!(current.major < requiredMajor)) return { ...current, adequate: true };
  for (const candidate of nodeCandidates(requiredMajor)) {
    if (!isExecutable(join(candidate, 'node'))) continue;
    const version = spawnSync(join(candidate, 'node'), ['-v'], { encoding: 'utf8' });
    const major = majorOf(version.stdout);
    if (major >= requiredMajor) {
      process.env.PATH = `${candidate}:${process.env.PATH || ''}`;
      if (process.env.CLAUDE_ENV_FILE) {
        try {
          appendFileSync(process.env.CLAUDE_ENV_FILE, `export PATH=${candidate}:$PATH\n`);
        } catch {
          /* switched for this hook only */
        }
      }
      const switched = version.stdout.trim();
      diagnose(`switched to ${switched} at ${candidate} (persisted for the session).`);
      return { version: switched, major, adequate: true };
    }
  }
  return { ...current, adequate: false };
}

/** Runs `command` in the repository with its output on stderr; true when it exits 0. */
function runToStderr(command, args) {
  return (
    spawnSync(command, args, {
      cwd: repositoryRoot,
      stdio: ['ignore', process.stderr, process.stderr],
    }).status === 0
  );
}

/** Installs the dependencies in a web session, when Node is new enough and they are missing. */
function installDependencies({ node, requiredMajor }) {
  if (!isRemote) return;
  if (!node.adequate) {
    diagnose(
      `Node ${node.version} is below required v${requiredMajor} (.nvmrc) — skipping pnpm install.`,
    );
  } else if (isExecutable(join(repositoryRoot, 'node_modules', '.bin', 'vite'))) {
    diagnose('dependencies already present — skipping install.');
  } else {
    diagnose('installing dependencies (pnpm install)…');
    spawnSync('corepack', ['enable'], { cwd: repositoryRoot, stdio: 'ignore' });
    if (
      !runToStderr('pnpm', ['install', '--prefer-offline']) &&
      !runToStderr('pnpm', ['install'])
    ) {
      diagnose('pnpm install failed (see log above).');
    }
  }
}

/** How many MCP servers `.mcp.json` declares, or `?`. */
function declaredServerCount() {
  try {
    const servers = JSON.parse(
      readFileSync(join(repositoryRoot, '.mcp.json'), 'utf8'),
    ).mcpServers;
    return servers && typeof servers === 'object'
      ? String(Object.keys(servers).length)
      : '?';
  } catch {
    return '?';
  }
}

/**
 * The MCP config: declare the full template set before the first prompt. Claude Code / Cursor
 * read `.mcp.json` at startup (symlink → agent-os/mcp/mcp.json); on local sessions, scaffold the
 * full set from `.mcp.example.json` when absent — same as `pnpm setup:local` / `pnpm mcp:setup`.
 */
function mcpStatus() {
  if (existsSync(join(repositoryRoot, '.mcp.json')))
    return `${declaredServerCount()} declared`;
  if (isRemote || !existsSync(join(repositoryRoot, '.mcp.example.json'))) {
    return 'platform-managed on web (configure in environment MCP settings); local: pnpm setup:local';
  }
  const scaffolded = spawnSync('pnpm', ['exec', 'tsx', 'tooling/dev/setup-mcp.ts'], {
    cwd: repositoryRoot,
    stdio: 'ignore',
  });
  if (scaffolded.status !== 0) return 'template only (run: pnpm setup:local --no-start)';
  diagnose(
    'scaffolded .mcp.json via pnpm mcp:setup; set CONTEXT7_API_KEY in .env.local.',
  );
  return `${declaredServerCount()} scaffolded (full set)`;
}

/** The `gh` version, or `absent`. */
function githubCliStatus() {
  if (!onPath('gh')) return 'absent';
  const version = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  return (version.stdout || '').split('\n')[0].trim().split(/\s+/)[2] || 'absent';
}

/**
 * The pre-commit secret scan is mandatory, so a web session without gitleaks could not commit.
 * The cached Setup script installs it (bootstrap.sh step 4), but an older cached image can
 * predate that: install it on demand when absent. A plain PATH check when present (the common
 * case).
 */
function gitleaksStatus() {
  if (onPath('gitleaks')) return 'present';
  const installer = 'tooling/setup/agent/install-gitleaks.sh';
  if (!isRemote || !existsSync(join(repositoryRoot, installer))) return 'absent';
  diagnose('gitleaks missing — installing for the pre-commit secret scan (best-effort)…');
  runToStderr('bash', [installer]);
  return onPath('gitleaks')
    ? 'installed'
    : 'install-failed (run: bash tooling/setup/agent/install-gitleaks.sh)';
}

/** The skill-routing map on startup; on resume, a note that the conversation already holds it. */
function routingMapSection(source) {
  if (source === 'resume') {
    return '(Resumed: the skill-routing map from agent-os/docs/skill-triggers.md is already earlier in this conversation.)';
  }
  try {
    return readFileSync(
      join(repositoryRoot, 'agent-os', 'docs', 'skill-triggers.md'),
      'utf8',
    );
  } catch {
    return '';
  }
}

/**
 * Canary: the first context line names the root these hooks ran from, and each run appends a row
 * to the gitignored agent-os/hooks/.telemetry.log in clinozy-be's telemetry format, so `grep
 * fe-session-start agent-os/hooks/.telemetry.log` shows the hook ran — including in a session
 * that holds several repositories (tooling/agent-os/session-hooks.ts).
 */
function recordTelemetry() {
  try {
    const timestamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    appendFileSync(
      join(repositoryRoot, 'agent-os', 'hooks', '.telemetry.log'),
      `${timestamp},fe-session-start,SessionStart,fired\n`,
    );
  } catch {
    /* no telemetry row */
  }
}

function sessionContext(source) {
  const requiredMajor = requiredNodeMajor();
  const node = provisionNode(requiredMajor);
  installDependencies({ node, requiredMajor });
  const mcp = mcpStatus();
  const dependencies = isExecutable(join(repositoryRoot, 'node_modules', '.bin', 'vite'))
    ? 'installed'
    : 'missing';
  const githubCli = githubCliStatus();
  const gitleaks = gitleaksStatus();
  const provisioned = node.adequate && dependencies === 'installed' ? 'yes' : 'no';
  const nodeNote = node.adequate
    ? ''
    : `  (switch to Node >=${requiredMajor} from .nvmrc, then pnpm install)`;
  return [
    `clinozy-fe session ready (hooks from ${repositoryRoot}) — environment provisioned: ${provisioned}.`,
    `- Node ${node.version} (need >=${requiredMajor}) · deps ${dependencies} · gh ${githubCli} · mcp ${mcp} · gitleaks ${gitleaks}${nodeNote}`,
    '- Dev: pnpm dev (Vite :5173) + clinozy-be on :3000. Bootstrap: pnpm setup:local. Gates: pnpm health (all phases) · pnpm tsc · pnpm lint · pnpm validate:tokens · pnpm validate:structure · pnpm validate:testids · pnpm validate:theme-axis · pnpm test',
    '- Skill-first: consult agent-os/skills/fe-skill-registry/SKILL.md, then the listed skill(s) for the files you change.',
    '',
    routingMapSection(source),
  ]
    .join('\n')
    .replace(/\n+$/, '');
}

try {
  if (existsSync(repositoryRoot)) {
    process.chdir(repositoryRoot);
    // The payload's `source` (startup | resume | clear | compact); unknown → startup.
    const context = sessionContext(readHookPayload()?.source || 'startup');
    recordTelemetry();
    addModelContext({ event: 'SessionStart', context });
  }
} catch {
  /* fail-open */
}
