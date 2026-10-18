#!/usr/bin/env node
// Cursor `beforeShellExecution` guardrail for clinozy-fe (Cursor agent hooks, beta).
//
// Blocks the same destructive shell commands, and the same git-hook skips, as the Claude PreToolUse guardrail
// (fe-guardrails.mjs). Cursor cannot block file writes, so secret/protected-path
// rules are advisory in agent-os/rules/. Self-contained — no other repo.
//
// Reads the hook payload on stdin; prints { "permission": "allow" | "deny", … }.
import { readFileSync } from 'node:fs';

function allow() {
  process.stdout.write(JSON.stringify({ continue: true, permission: 'allow' }));
  process.exit(0);
}
function deny(message) {
  process.stdout.write(
    JSON.stringify({
      continue: true,
      permission: 'deny',
      userMessage: message,
      agentMessage: message,
    }),
  );
  process.exit(0);
}

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  allow();
}

let payload = {};
try {
  payload = JSON.parse(raw);
} catch {
  allow();
}

const command =
  payload.command ||
  (payload.tool_input && payload.tool_input.command) ||
  payload.shellCommand ||
  '';
if (!command) allow();

// Scan with quoted strings + heredoc bodies removed, so destructive patterns
// that merely appear in a message/echo don't trigger a false block.
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
} else if (
  /\bgit(?:\s+-[cC]\s+\S+)*\s+(?:commit|push)\b[^;&|]*--no-verify\b/i.test(scan) ||
  /\bgit(?:\s+-[cC]\s+\S+)*\s+commit\b[^;&|]*\s-[a-zA-Z]*n[a-zA-Z]*(?=\s|$)/.test(scan) ||
  /(?:^|[\s;&|])HUSKY=0\b/.test(scan)
) {
  why =
    'skipping the git hooks (--no-verify, git commit -n, HUSKY=0) — the before-commit and pre-push gates are mandatory; fix what they report';
}

if (why) {
  deny(
    `Blocked by clinozy-fe guardrail: ${why}. Command: "${command.slice(0, 160)}". If you truly intend this, run it yourself in a terminal.`,
  );
}
allow();
