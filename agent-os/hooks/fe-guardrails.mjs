#!/usr/bin/env node
// Claude Code PreToolUse guardrail for clinozy-fe (self-contained — no other repo).
//
// BLOCK (deny): reading or writing secret files (.env*, not .env.example), secret content,
//   destructive shell commands, skipping the git hooks (--no-verify, `git commit -n`, HUSKY=0).
// WARN (systemMessage): edits to protected/vendored paths, and a `git push` of auth, token, CSP,
//   routeTree or guard changes with no clean /fe-pre-merge-review recorded for HEAD
//   (`pnpm agent-os:review-clean` records it).
// Nothing here asks: the permission mode decides every call no rule blocks.
//
// Reads the PreToolUse payload on stdin (_fe-hook.mjs). Fail-open by design: any parse/read
// error allows the tool (exit 0) so a guardrail bug can never brick the agent.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  destructiveShellReason,
  isSecretEnvPath,
  withoutQuotedText,
} from './_fe-guard-rules.mjs';
import {
  denyToolCall,
  isInsideRepository,
  readHookPayload,
  repositoryRoot,
  showSystemMessage,
} from './_fe-hook.mjs';
import { pushDirectory } from './_fe-push-target.mjs';
import { recordTelemetry } from './_fe-telemetry.mjs';

const payload = readHookPayload();
if (!payload) process.exit(0);

/** Ends the hook with a block, recorded as fired (clinozy-be's `deny`). */
function deny(reason) {
  recordTelemetry('fe-guardrails', 'PreToolUse', 'fired', 'deny');
  denyToolCall(reason);
}

const tool = payload.tool_name || '';
const input = payload.tool_input || {};
const filePath = input.file_path || input.path || '';
const command = input.command || '';
const isWrite = tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit';
const edits = Array.isArray(input.edits)
  ? input.edits.map((edit) => edit?.new_string)
  : [];
const content = [input.content, input.new_string, ...edits].filter(Boolean).join('\n');

// The WARN rules are clinozy-fe's conventions, so they judge only files in this repository; the
// BLOCK rules (destructive shell, secrets) guard every path. A session that holds several
// repositories runs every repository's hooks on every call (tooling/agent-os/session-hooks.ts).
const inRepository = isInsideRepository(filePath);

const warnings = [];

const SECRET_READ_DENIAL =
  'Blocked by clinozy-fe guardrail: the agent does not read gitignored env files (.env.local, ' +
  '.env.<environment>) — they hold real keys. The variable names and defaults are in ' +
  '.env.example and src/core/config/env-schema.ts; if a value is needed, ask the user.';

// --- BLOCK: agent reading secret env files ----------------------------------
if ((tool === 'Read' || tool === 'Grep') && isSecretEnvPath(filePath)) {
  deny(SECRET_READ_DENIAL);
}
if (tool === 'Bash' && command) {
  // Any token that resolves to a secret env file (cat/grep/cp/source/< redirection, …).
  const touchesSecret = command
    .split(/[\s;|&><()'"`]+/)
    .some((token) => isSecretEnvPath(token));
  if (touchesSecret) deny(SECRET_READ_DENIAL);
}

/** Pushed paths where a missed check leaks a session, a token or another clinic's data. */
const REVIEWED_PUSH_PATHS = [
  /^src\/shared\/auth\//,
  /^src\/core\/http\//,
  /^src\/core\/rbac\//,
  /^src\/app\/guards\//,
  /^src\/app\/routes\/routeTree\.tsx$/,
  /^src\/lib\/csp-api-origin\.ts$/,
  /^plugins\/csp-api-origin\.ts$/,
  /^index\.html$/,
  /^public\/_headers$/,
  /^netlify\.toml$/,
];

function gitIn(directory, args) {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

/**
 * Why a push should have had a review: it changes auth, tokens, CSP, routeTree or the guards and
 * no clean /fe-pre-merge-review is recorded for HEAD — or '' when it does not. Fails open.
 */
function unreviewedSensitivePush(scan) {
  const directory = pushDirectory({ command: scan, cwd: payload.cwd || repositoryRoot });
  if (!isInsideRepository(directory)) return '';
  const head = gitIn(repositoryRoot, ['rev-parse', 'HEAD']);
  const gitDirectory = gitIn(repositoryRoot, ['rev-parse', '--absolute-git-dir']);
  if (!(head && gitDirectory)) return '';
  if (existsSync(join(gitDirectory, 'fe-pre-merge-review', `${head}.clean`))) return '';
  const upstream = gitIn(repositoryRoot, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  const base = [upstream, 'origin/main', 'main'].find(
    (ref) => ref && gitIn(repositoryRoot, ['merge-base', 'HEAD', ref]),
  );
  if (!base) return '';
  const changed = gitIn(repositoryRoot, ['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .filter(Boolean);
  const sensitive = changed.filter((path) =>
    REVIEWED_PUSH_PATHS.some((pattern) => pattern.test(path)),
  );
  if (sensitive.length === 0) return '';
  const examples = sensitive.slice(0, 3).join(', ');
  return (
    `push review gate: this push changes auth, tokens, CSP, routeTree or the guards (${sensitive.length} file(s): ${examples}` +
    `${sensitive.length > 3 ? ', …' : ''}) and /fe-pre-merge-review has no clean result for HEAD ${head.slice(0, 7)}. ` +
    'Run /fe-pre-merge-review before the PR merges (a clean review records itself with pnpm agent-os:review-clean).'
  );
}

// --- BLOCK: destructive shell ------------------------------------------------
if (tool === 'Bash' && command) {
  // Quoted strings and heredoc bodies are blanked first, so a pattern that merely appears in a
  // message (e.g. a commit message) never triggers. The rules are shared with the Cursor mirror.
  const scan = withoutQuotedText(command);
  const why = destructiveShellReason(command);
  if (why) {
    deny(
      `Blocked by clinozy-fe guardrail: ${why}. Command: "${command.slice(0, 160)}". If you truly intend this, run it yourself in a terminal.`,
    );
  }
  if (/\bgit\s+(?:-C\s+\S+\s+)?push\b/i.test(scan)) {
    let reason = '';
    try {
      reason = unreviewedSensitivePush(scan);
    } catch {
      /* fail-open */
    }
    if (reason) warnings.push(reason);
  }
  if (/\bgit\s+reset\s+--hard\b/i.test(scan) || /\bgit\s+clean\s+-[a-z]*f/i.test(scan)) {
    warnings.push(
      `destructive git op ("${command.slice(0, 80)}") discards uncommitted work.`,
    );
  }
}

// --- BLOCK: secrets ----------------------------------------------------------
if (isWrite && isSecretEnvPath(filePath)) {
  deny(
    `Blocked by clinozy-fe guardrail: "${filePath}" is a gitignored secrets file. Put template keys in .env.example (VITE_ prefix = public) and provide real values via the environment, not source control.`,
  );
}
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
  /\bsk_live_[A-Za-z0-9]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
];
if (isWrite && content && secretPatterns.some((re) => re.test(content))) {
  deny(
    'Blocked by clinozy-fe guardrail: the content looks like a private key or live credential. Use environment variables / a secret manager instead of committing secrets.',
  );
}

// --- WARN: protected / vendored paths ----------------------------------------
if (isWrite && filePath && inRepository) {
  if (/\/components\/ui\/[^/]+\.(tsx?|css)$/.test(filePath)) {
    warnings.push(
      `editing a vendored shadcn/ui primitive (${filePath}) — prefer \`pnpm dlx shadcn@latest add\` / compose around it; hand-edits are lost on re-add (see agent-os/skills/shadcn).`,
    );
  }
  if (/(^|\/)src\/index\.css$/.test(filePath)) {
    warnings.push(
      `editing the Tailwind v4 @theme entry (${filePath}) — keep changes to design tokens; app code must use semantic tokens (pnpm validate:tokens).`,
    );
  }
  if (/routeTree\.tsx$/.test(filePath)) {
    warnings.push(
      `editing the route tree (${filePath}) — keep it in sync with the page manifests + docs/reference/routes-and-ui.md (fe-route-island skill).`,
    );
  }
}

if (warnings.length) {
  showSystemMessage('⚠️ clinozy-fe guardrail:\n- ' + warnings.join('\n- '));
}
recordTelemetry(
  'fe-guardrails',
  'PreToolUse',
  warnings.length ? 'fired' : 'silent',
  warnings.length ? 'warn' : '',
);
process.exit(0);
