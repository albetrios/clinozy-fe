#!/usr/bin/env node
// Claude Code PostToolUse (Edit | Write) and Stop hook for clinozy-fe; Codex Stop hook.
//
// One process per edit (it replaced three bash hooks: format-edits.sh, skill-reminder.sh and
// stop-gate-reminder.sh), as clinozy-be's fe-edit-hooks.mjs. The skill reminders come from the
// generated routing map (skill-routing.json):
//
// - PostToolUse queues the edited file for formatting and adds, as additionalContext (a
//   PostToolUse hook's plain stdout never reaches the model), the skill reminders its path implies
//   and the gates the uncommitted changes imply. Each reminder appears once per turn: the record
//   lives in the _fe-turn-once.sh directory, which fe-prompt-skill-router.sh clears at every prompt.
// - Stop formats every file queued during the turn with one Prettier call (with its cache), so a
//   turn of many edits formats once, then prints the gate checklist on stdout — Codex shows it;
//   Claude does not pass a Stop hook's stdout to the model, and the hook never blocks the stop.
//
// Formatting is format-only: Prettier (+ prettier-plugin-tailwindcss) rewrites formatting, no lint
// fixes or import reordering. ESLint and Biome still run at pre-commit and in CI.
//
// Only files in this repository are judged: a session that holds several repositories runs every
// repository's hooks (tooling/agent-os/session-hooks.ts), and clinozy-be formats with Biome. Fails
// open: any error exits 0 with no output — a hook must never block or fail an edit.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK_ID = 'fe-edit-hooks';
const SKILL_MAP = 'Full map: agent-os/docs/skill-triggers.md';
const FORMATTED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|css|md|html|yml|yaml)$/;
const UNFORMATTED = /(^|\/)(dist|node_modules)\/|pnpm-lock\.yaml$/;

/**
 * Skill reminders by edited path: the routing map, generated from agent-os/skills/chains.json and
 * each skill's `trigger` frontmatter (`pnpm agent-os:generate` → skill-routing.json, the rows of
 * agent-os/docs/skill-triggers.md). Read once per process; a missing or broken file gives none.
 */
function skillRoutes() {
  try {
    const routing = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), 'skill-routing.json'),
        'utf8',
      ),
    );
    return routing.routes.map((route) => ({
      ...route,
      patterns: route.globs.map(globPattern),
    }));
  } catch {
    return [];
  }
}

/** A trigger glob as a RegExp over a repository-relative path: `**` any depth, `*` one segment. */
function globPattern(glob) {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*' && glob[index + 1] === '*') {
      const slash = glob[index + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      index += slash ? 2 : 1;
    } else if (character === '*') source += '[^/]*';
    else if (character === '?') source += '[^/]';
    else source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(glob.includes('/') ? `^${source}$` : `(?:^|/)${source}$`);
}

/** Gates by uncommitted path (the Codex Stop checklist uses the same map). */
const GATE_REMINDERS = [
  [
    /\.tsx?$/,
    'source changed → pnpm tsc + pnpm lint (and a colocated *.test.tsx for new components/hooks)',
  ],
  [
    /\.route\.tsx$|\.manifest\.ts$/,
    'routes changed → pnpm validate:structure + sync routeTree & docs/reference/routes-and-ui.md (fe-route-island)',
  ],
  [/\.css$/, 'styles changed → pnpm validate:tokens (semantic tokens only)'],
  [
    /\.test\.tsx?$|tests\/e2e\//,
    'tests changed → pnpm test (unit) / pnpm exec playwright test (e2e); coverage ratchet (fe-test-generation)',
  ],
  [
    /\.env\.example$/,
    'env changed → keep VITE_ vars documented; secrets stay out of source (fe-documentation-maintenance)',
  ],
  [/\.md$|(^|\/)docs\//, 'docs changed → pnpm docs:lint'],
];

const repositoryRoot =
  process.env.CLAUDE_PROJECT_DIR ||
  resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stateRoot = join(process.env.TMPDIR || '/tmp', 'clinozy-fe-hooks');

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

/** The edited file as an absolute path in this repository, or "" when it is elsewhere. */
function repositoryFile(filePath) {
  if (!filePath) return '';
  const absolute = isAbsolute(filePath) ? filePath : join(repositoryRoot, filePath);
  return absolute.startsWith(`${repositoryRoot}/`) ? absolute : '';
}

/** Succeeds the first time `key` is seen this turn (the _fe-turn-once.sh record); fails open. */
function turnOnce(session, key) {
  const directory = join(stateRoot, session);
  try {
    mkdirSync(directory, { recursive: true });
    const marker = join(
      directory,
      `${HOOK_ID}-${createHash('sha1').update(key).digest('hex')}`,
    );
    if (existsSync(marker)) return false;
    writeFileSync(marker, '');
  } catch {
    /* every reminder counts as new when the record cannot be written */
  }
  return true;
}

/** The queue of files to format at Stop — outside the turn record, so a missed Stop formats later. */
function formatQueuePath(session) {
  return join(stateRoot, `${session}.format-queue`);
}

/** Uncommitted paths, status prefix stripped; `untracked: false` skips the slow untracked scan. */
function uncommittedPaths({ untracked }) {
  const status = spawnSync(
    'git',
    ['status', '--porcelain', untracked ? '-unormal' : '-uno'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    },
  );
  if (status.status !== 0) return [];
  return status.stdout
    .split('\n')
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3));
}

/** The gates the changed paths imply; `extraPaths` adds files the status call does not list. */
function gateReminders({ untracked, extraPaths = [] }) {
  const changed = [...uncommittedPaths({ untracked }), ...extraPaths];
  return GATE_REMINDERS.filter(([pattern]) =>
    changed.some((path) => pattern.test(path)),
  ).map(([, reminder]) => reminder);
}

function afterEdit(payload, session) {
  const file = repositoryFile(payload.tool_input?.file_path || '');
  if (!file) return;
  const relative = file.slice(repositoryRoot.length + 1);

  if (FORMATTED_EXTENSIONS.test(file) && !UNFORMATTED.test(relative)) {
    try {
      mkdirSync(stateRoot, { recursive: true });
      appendFileSync(formatQueuePath(session), `${file}\n`);
    } catch {
      /* not queued: the pre-commit lint-staged run still formats it */
    }
  }

  const sections = [];
  const skills = skillRoutes()
    .filter((route) => route.patterns.some((pattern) => pattern.test(relative)))
    .map((route) => {
      const optional = route.optional?.length ? ` (+ ${route.optional.join(', ')})` : '';
      const note = route.note ? ` — ${route.note}` : '';
      return `${route.skills.join(' → ')}${optional}${note}`;
    })
    .filter((reminder) => turnOnce(session, `skill-reminder:${reminder}`));
  if (skills.length > 0) {
    sections.push(
      [
        `⚡ Skill reminders for ${basename(file)}:`,
        ...skills.map((reminder) => `  • ${reminder}`),
        `  ${SKILL_MAP}`,
      ].join('\n'),
    );
  }
  // Tracked changes plus this file (a new one is untracked): the untracked scan is the slow
  // part, and the Stop checklist still reads the whole tree.
  const gates = gateReminders({ untracked: false, extraPaths: [relative] }).filter(
    (reminder) => turnOnce(session, `stop-gate-reminder:${reminder}`),
  );
  if (gates.length > 0) {
    sections.push(
      [
        '📋 Gates implied by your uncommitted changes (run them before you finish):',
        ...gates.map((reminder) => `  • ${reminder}`),
        `  Then: pnpm health (all phases). ${SKILL_MAP}`,
      ].join('\n'),
    );
  }
  if (sections.length === 0) return;
  process.stdout.write(
    `${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: sections.join('\n\n') } })}\n`,
  );
}

function formatQueuedFiles(session) {
  const queue = formatQueuePath(session);
  let files = [];
  try {
    files = [...new Set(readFileSync(queue, 'utf8').split('\n').filter(Boolean))].filter(
      (file) => existsSync(file),
    );
    rmSync(queue, { force: true });
  } catch {
    return;
  }
  const prettier = join(repositoryRoot, 'node_modules', '.bin', 'prettier');
  if (files.length === 0 || !existsSync(prettier)) return;
  spawnSync(prettier, ['--write', '--cache', '--log-level', 'silent', ...files], {
    cwd: repositoryRoot,
    stdio: 'ignore',
  });
}

function atStop(session) {
  formatQueuedFiles(session);
  const gates = gateReminders({ untracked: true });
  if (gates.length > 0) {
    console.log('\n📋 Before you finish — gates implied by your uncommitted changes:');
    for (const reminder of gates) console.log(`  • ${reminder}`);
    console.log(`  Then: pnpm health (all phases). ${SKILL_MAP}`);
    return;
  }
  console.log(
    '\n📋 Done. Quick check: pnpm health (tsc + lint + biome + format + tokens + structure + tests + docs).',
  );
  console.log('   Skill map: agent-os/docs/skill-triggers.md');
}

const payload = readPayload();
if (payload) {
  const session = payload.session_id || 'unknown-session';
  try {
    if ((payload.hook_event_name || 'Stop') === 'PostToolUse')
      afterEdit(payload, session);
    else atStop(session);
  } catch {
    /* fail-open */
  }
}
process.exit(0);
