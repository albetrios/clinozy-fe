// The one copy of what every clinozy-fe hook does around its own rule: read the JSON payload
// from stdin, find this repository's root, tell whether a path is inside it, and write the
// outputs Claude Code reads. Every hook under agent-os/hooks/ is a Node script built on it, so no
// hook needs bash or jq, and no two hooks can read the payload or judge "this repository"
// differently.
//
// Fails open: a payload that cannot be read or parsed is `null`, and each hook then exits 0
// (allows the action) — a hook bug must never brick a session.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This repository's root: `CLAUDE_PROJECT_DIR` (Claude Code sets it; in a session that holds
 * several repositories tooling/agent-os/session-hooks.ts sets it per repository), else the
 * directory two levels above `agent-os/hooks/`.
 */
export const repositoryRoot = resolve(
  process.env.CLAUDE_PROJECT_DIR ||
    join(dirname(fileURLToPath(import.meta.url)), '../..'),
);

/**
 * Where the hooks keep their per-session state (the once-per-turn record, the format queue, the
 * locks): `$TMPDIR/clinozy-fe-hooks`, `/tmp` when `TMPDIR` is unset.
 */
export const hookStateDirectory = join(process.env.TMPDIR || '/tmp', 'clinozy-fe-hooks');

/**
 * The hook payload on stdin as an object, or `null` when there is none to read — a terminal, an
 * unreadable stream, malformed JSON, or JSON that is not an object (fail-open).
 */
export function readHookPayload() {
  if (process.stdin.isTTY) return null;
  try {
    const payload = JSON.parse(readFileSync(0, 'utf8'));
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : null;
  } catch {
    return null;
  }
}

/**
 * True when `path` — absolute, or relative to the repository root — is the root or inside it. A
 * session that holds several repositories runs every repository's hooks on every call, and
 * clinozy-fe's conventions judge only its own files.
 */
export function isInsideRepository(path) {
  const absolute = resolve(repositoryRoot, path);
  return absolute === repositoryRoot || absolute.startsWith(`${repositoryRoot}/`);
}

/** Prints `output` as the one JSON line Claude Code reads from a hook's stdout. */
export function writeHookOutput(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function endWithPermissionDecision({ decision, reason }) {
  writeHookOutput({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  });
  process.exit(0);
}

/** Ends a PreToolUse hook by blocking the tool call, `reason` shown to the model. */
export function denyToolCall(reason) {
  endWithPermissionDecision({ decision: 'deny', reason });
}

/** Ends a PreToolUse hook by putting the tool call to the user, `reason` shown with it. */
export function askBeforeToolCall(reason) {
  endWithPermissionDecision({ decision: 'ask', reason });
}

/**
 * Adds `context` to the model's context from the `event` hook (PostToolUse,
 * PostToolUseFailure, UserPromptSubmit or SessionStart): plain stdout from PostToolUse never
 * reaches the model, `hookSpecificOutput.additionalContext` does.
 */
export function addModelContext({ event, context }) {
  writeHookOutput({
    hookSpecificOutput: { hookEventName: event, additionalContext: context },
  });
}

/** Shows `message` to the user as a warning; it blocks nothing. */
export function showSystemMessage(message) {
  writeHookOutput({ systemMessage: message });
}
