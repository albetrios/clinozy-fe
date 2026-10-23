#!/usr/bin/env node
// Claude Code SessionStart hook for clinozy-fe (self-contained — no other repo).
//
// Three jobs:
//   1. (web) Make the env usable: verify Node, switch to a new-enough Node when needed (pinned for
//      the session via $CLAUDE_ENV_FILE), and install deps so `pnpm health` / tests / linters
//      work. The installers stay what they are — pnpm, corepack and
//      tooling/setup/agent/install-gitleaks.sh, spawned from here.
//   2. (web) Launch the bring-up (`tooling/setup/agent/bootstrap.sh`, as clinozy-be's hook launches
//      its own) detached, so the dev server (Vite :5173) comes up beside clinozy-be's live stack
//      without anyone asking.
//   3. Inject session context: the agent-os skill-routing map plus a short env/commands summary,
//      as SessionStart additionalContext.
//
// Claude runs it on startup and resume only (hooks.json): /clear and compact leave the
// environment as it was, and fe-compact-resume-card.mjs covers compact. The 16 KB routing map goes
// in on startup; a resumed conversation already holds it, so a resume injects only the summary.
//
// stderr carries the install logs and diagnostics (NOT added to context). Fails open: any error
// exits 0.
import { spawn, spawnSync } from 'node:child_process';
import {
  accessSync,
  appendFileSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

import { addModelContext, readHookPayload, repositoryRoot } from './_fe-hook.mjs';
import { recordTelemetry } from './_fe-telemetry.mjs';

const DEFAULT_NODE_MAJOR = 24;
const isRemote = process.env.CLAUDE_CODE_REMOTE === 'true';
// `localhost`, as tooling/setup/agent/healthcheck.sh probes it: Vite binds `localhost`.
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
/** Exits 0 while a bring-up holds the frontend's lock (stack-lock.lib.sh), with bootstrap.sh's default. */
const FRONTEND_LOCK_HOLDER_COMMAND =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell parameter expansion, not a template.
  'source tooling/setup/agent/stack-lock.lib.sh && stack_lock_holder "${AGENT_STACK_DIR:-/tmp/agent-stack}/frontend"';

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
    return 'none yet on web (bootstrap.sh declares the pair); local: pnpm setup:local';
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

/**
 * The user-level MCP servers (`~/.claude.json`): Claude Code loads them wherever the session
 * starts, and they are all a session that holds several repositories gets — it runs from their
 * parent, where no repository's `.mcp.json` is read (tooling/agent-os/session-hooks.ts registers
 * each repository's codegraph there, install-headroom.sh the one headroom).
 */
function userLevelServers() {
  try {
    const config = JSON.parse(
      readFileSync(
        join(process.env.CLAUDE_CONFIG_DIR || homedir(), '.claude.json'),
        'utf8',
      ),
    );
    return Object.keys(config.mcpServers ?? {}).join(', ') || 'none';
  } catch {
    return 'none';
  }
}

/** The `gh` version, or `absent`. */
function githubCliStatus() {
  if (!onPath('gh')) return 'absent';
  const version = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  return (version.stdout || '').split('\n')[0].trim().split(/\s+/)[2] || 'absent';
}

/**
 * The pre-commit secret scan is mandatory, so a web session without gitleaks could not commit.
 * The cached Setup script installs it (install-agent-tools.sh, from bootstrap.sh), but an older
 * cached image can predate that: install it on demand when absent. A plain PATH check when present
 * (the common case).
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

/** True when the dev server already serves the app shell (Vite rewrites the /src/main.tsx entry). */
async function devServerServes() {
  try {
    const response = await fetch(`${DEV_SERVER_URL}/`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok && (await response.text()).includes('/src/main.tsx');
  } catch {
    return false;
  }
}

/**
 * The bring-up (web): `bootstrap.sh` (Node → dependencies → .env.local → the dev server on :5173,
 * kept running → the agent tools and SonarQube in the background) launched detached in its own
 * session, as clinozy-be's hook launches its own, so the session starts at once and the app comes
 * up beside clinozy-be's live stack. Never launches twice: a dev server already serving the app
 * shell (a resumed session) or a bring-up holding the lock (stack-lock.lib.sh's stack_lock_holder,
 * which treats a lock whose run is gone as stale) is left alone. Its log goes in the stack
 * directory clinozy-be's bring-up uses (`$AGENT_STACK_DIR`, default /tmp/agent-stack), and only
 * into one this user owns. Local sessions are untouched.
 */
async function frontendStatus() {
  if (!isRemote) return 'on demand (local session) — pnpm dev';
  if (await devServerServes()) return `live — ${DEV_SERVER_URL}`;
  const stackDirectory = process.env.AGENT_STACK_DIR || '/tmp/agent-stack';
  const logPath = join(stackDirectory, 'bootstrap-frontend.log');
  // The shell reads AGENT_STACK_DIR itself, as bootstrap.sh does: no value of it is ever part of
  // a command line.
  const lockHolder = spawnSync('bash', ['-c', FRONTEND_LOCK_HOLDER_COMMAND], {
    cwd: repositoryRoot,
    stdio: 'ignore',
  });
  if (lockHolder.status === 0) {
    return `starting (bring-up already running) — ${DEV_SERVER_URL} · follow: tail -f ${logPath}`;
  }
  if (!isExecutable(join(repositoryRoot, 'node_modules', '.bin', 'vite'))) {
    return 'not started (dependencies missing) — bash tooling/setup/agent/bootstrap.sh';
  }
  mkdirSync(stackDirectory, { recursive: true, mode: 0o700 });
  // A stack directory another user made in /tmp, or a link, could aim this log anywhere: refuse it.
  const directory = lstatSync(stackDirectory);
  if (!directory.isDirectory() || directory.uid !== process.getuid?.()) {
    return `not started (${stackDirectory} is not this user's directory) — bash tooling/setup/agent/bootstrap.sh`;
  }
  const log = openSync(logPath, 'w', 0o600);
  // detached: its own session (setsid), so it outlives this hook and the agent's process group.
  const bringUp = spawn('bash', ['tooling/setup/agent/bootstrap.sh'], {
    cwd: repositoryRoot,
    detached: true,
    stdio: ['ignore', log, log],
  });
  // A spawn that fails (bash gone, no permission) emits `error` later; unheard, that event would
  // crash the hook, which must fail open.
  bringUp.on('error', () => {});
  bringUp.unref();
  return `starting in the background — ${DEV_SERVER_URL} · follow: tail -f ${logPath}`;
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
 * Hook health from telemetry (clinozy-be's `hookHealth`): names any hook whose last `fired` row is
 * older than 30 days, or that never fired across 50+ runs, with why it stayed quiet (the detail
 * column, e.g. `not-a-push 519, no-gh 18`), so a dead hook and a too-narrow trigger read
 * differently. Empty when telemetry is absent.
 */
function hookHealth() {
  let rows;
  try {
    rows = readFileSync(
      join(repositoryRoot, 'agent-os', 'hooks', '.telemetry.log'),
      'utf8',
    ).split('\n');
  } catch {
    return '';
  }
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const hooks = new Map();
  for (const row of rows) {
    const [timestamp, hook, , status, detail] = row.split(',');
    if (status === undefined) continue;
    const entry = hooks.get(hook) ?? { runs: 0, lastFired: 0, quiet: new Map() };
    entry.runs += 1;
    if (status === 'fired')
      entry.lastFired = Math.max(entry.lastFired, Date.parse(timestamp) || 0);
    else entry.quiet.set(detail || status, (entry.quiet.get(detail || status) ?? 0) + 1);
    hooks.set(hook, entry);
  }
  const why = (quiet) =>
    [...quiet]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 3)
      .map(([reason, count]) => `${reason} ${count}`)
      .join(', ');
  const candidates = [...hooks]
    .map(([hook, { runs, lastFired, quiet }]) => {
      if (lastFired === 0 && runs >= 50)
        return `${hook} (never fired, ${runs} runs: ${why(quiet)})`;
      if (lastFired !== 0 && lastFired < cutoff) return `${hook} (silent >30d)`;
      return '';
    })
    .filter(Boolean);
  if (candidates.length === 0) return '';
  return `\n- Hook pruning candidates (silent 30+ days / never fired): ${candidates.join(' ')} — review with \`pnpm agent-os:hooks:report\` (agent-os/hooks/README.md)`;
}

async function sessionContext(source) {
  const requiredMajor = requiredNodeMajor();
  const node = provisionNode(requiredMajor);
  installDependencies({ node, requiredMajor });
  const frontend = await frontendStatus();
  const mcp = `${mcpStatus()} · user-level mcp ${userLevelServers()}`;
  const dependencies = isExecutable(join(repositoryRoot, 'node_modules', '.bin', 'vite'))
    ? 'installed'
    : 'missing';
  const githubCli = githubCliStatus();
  const gitleaks = gitleaksStatus();
  const health = hookHealth();
  const provisioned = node.adequate && dependencies === 'installed' ? 'yes' : 'no';
  const nodeNote = node.adequate
    ? ''
    : `  (switch to Node >=${requiredMajor} from .nvmrc, then pnpm install)`;
  return [
    `clinozy-fe session ready (hooks from ${repositoryRoot}) — environment provisioned: ${provisioned}.`,
    `- Node ${node.version} (need >=${requiredMajor}) · deps ${dependencies} · gh ${githubCli} · mcp ${mcp} · gitleaks ${gitleaks}${nodeNote}${health}`,
    `- Frontend: ${frontend}`,
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
    const context = await sessionContext(readHookPayload()?.source || 'startup');
    // Canary: the first context line names the root these hooks ran from, and the row shows the
    // hook ran — including in a session that holds several repositories.
    recordTelemetry('fe-session-start', 'SessionStart', 'fired');
    addModelContext({ event: 'SessionStart', context });
  }
} catch {
  /* fail-open */
}
