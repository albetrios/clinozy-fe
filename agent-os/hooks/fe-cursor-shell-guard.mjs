#!/usr/bin/env node
// Cursor `beforeShellExecution` guardrail for clinozy-fe (Cursor agent hooks, beta).
//
// Blocks the same destructive shell commands, and the same git-hook skips, as the Claude PreToolUse guardrail
// (fe-guardrails.mjs). Cursor cannot block file writes, so secret/protected-path
// rules are advisory in agent-os/rules/. The rules come from _fe-guard-rules.mjs, the one copy
// both guards import.
//
// Reads the hook payload on stdin (_fe-hook.mjs; an unreadable one is allowed); prints
// { "permission": "allow" | "deny", … } — Cursor's output shape, not Claude Code's.
import { destructiveShellReason } from './_fe-guard-rules.mjs';
import { readHookPayload, writeHookOutput } from './_fe-hook.mjs';
import { recordTelemetry } from './_fe-telemetry.mjs';

function allow() {
  recordTelemetry('fe-cursor-shell-guard', 'beforeShellExecution', 'silent');
  writeHookOutput({ continue: true, permission: 'allow' });
  process.exit(0);
}
function deny(message) {
  recordTelemetry('fe-cursor-shell-guard', 'beforeShellExecution', 'fired');
  writeHookOutput({
    continue: true,
    permission: 'deny',
    userMessage: message,
    agentMessage: message,
  });
  process.exit(0);
}

const payload = readHookPayload() ?? {};
const command =
  payload.command ||
  (payload.tool_input && payload.tool_input.command) ||
  payload.shellCommand ||
  '';
if (typeof command !== 'string' || !command) allow();

// The same rules as the Claude guardrail, from one module (quoted text and heredocs are ignored).
const why = destructiveShellReason(command);
if (why) {
  deny(
    `Blocked by clinozy-fe guardrail: ${why}. Command: "${command.slice(0, 160)}". If you truly intend this, run it yourself in a terminal.`,
  );
}
allow();
