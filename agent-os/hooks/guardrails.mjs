#!/usr/bin/env node
// Claude Code PreToolUse guardrail for clinozy-fe (self-contained — no other repo).
//
// BLOCK (deny): reading or writing secret files (.env*, not .env.example), secret content,
//   destructive shell commands.
// ASK: `gh pr create` — a PR only when the user asked (no-unrequested-pr.sh covers the MCP tool).
// WARN (systemMessage): edits to protected/vendored paths.
//
// Reads the PreToolUse payload on stdin. Fail-open by design: any parse/read
// error allows the tool (exit 0) so a guardrail bug can never brick the agent.
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
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
const repositoryRoot =
  process.env.CLAUDE_PROJECT_DIR ||
  resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const inRepository = !isAbsolute(filePath) || filePath.startsWith(`${repositoryRoot}/`);

const warnings = [];

// A gitignored env file holds real values: `.env`, `.env.local`, `.env.<environment>`, … —
// never the committed template `.env.example`.
function isSecretEnvPath(path) {
  if (!path) return false;
  if (/(^|\/)\.env\.example$/.test(path)) return false;
  return /(^|\/)\.env(\.[\w.-]+)?$/.test(path);
}

const SECRET_READ_DENIAL =
  'Blocked by clinozy-fe guardrail: the agent does not read gitignored env files (.env.local, ' +
  '.env.<environment>) — they hold real keys. The variable names and defaults are in ' +
  '.env.example and src/core/config/env-schema.ts; if a value is needed, ask the user.';

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

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

// --- BLOCK: destructive shell ------------------------------------------------
if (tool === 'Bash' && command) {
  // Scan with quoted strings + heredoc bodies removed, so a destructive pattern
  // that merely appears in a message/echo (e.g. a commit message) won't trigger.
  const scan = command
    .replace(/<<-?\s*['"]?[A-Za-z_]\w*['"]?[\s\S]*$/, ' ')
    .replace(/'[^']*'/g, ' ')
    .replace(/"[^"]*"/g, ' ');
  let why = '';
  if (/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i.test(scan)) {
    why = 'recursive force delete (rm -rf)';
  } else if (
    /\bgit\s+push\b/i.test(scan) &&
    (/--force(?!-with-lease)/i.test(scan) || /\s-f(?:\s|$)/.test(scan))
  ) {
    why = 'git push --force (use --force-with-lease, or push it yourself)';
  } else if (/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(scan)) {
    why = 'fork bomb';
  } else if (/\bmkfs\b|\bdd\s+if=/i.test(scan)) {
    why = 'filesystem-destroying command';
  }
  if (why) {
    deny(
      `Blocked by clinozy-fe guardrail: ${why}. Command: "${command.slice(0, 160)}". If you truly intend this, run it yourself in a terminal.`,
    );
  }
  if (/\bgh\s+pr\s+create\b/.test(scan)) {
    ask(
      'clinozy-fe policy: open a PR only when the user explicitly asked for one (Bash(gh pr*) is allowlisted, so this hook is the check). Confirm this was requested before proceeding.',
    );
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
  process.stdout.write(
    JSON.stringify({
      systemMessage: '⚠️ clinozy-fe guardrail:\n- ' + warnings.join('\n- '),
    }),
  );
}
process.exit(0);
