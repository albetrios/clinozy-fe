#!/usr/bin/env node
// Claude Code PreToolUse hook (mcp__github__create_pull_request) for clinozy-fe.
//
// Policy: open a pull request only when the user explicitly asked. This escalates every
// PR-creation attempt to an explicit user confirmation (permissionDecision "ask") — a
// deterministic backstop so an autonomous run never opens a PR unprompted. It does NOT block: a
// genuinely requested PR proceeds once confirmed. A turn the user started with /fe-ship or
// /fe-open-pr — the commands that ARE the request — goes through without asking again
// (fe-prompt-skill-router.mjs marks it; _fe-turn-once.mjs).
//
// Fails OPEN: an unreadable payload exits 0, leaving the normal permission flow in charge.
import { askBeforeToolCall, readHookPayload } from './_fe-hook.mjs';
import { isTurnMarked } from './_fe-turn-once.mjs';

const payload = readHookPayload();
if (payload && !isTurnMarked({ session: payload.session_id, mark: 'pr-requested' })) {
  const title = payload.tool_input?.title;
  askBeforeToolCall(
    [
      'clinozy-fe policy: open a PR only when the user explicitly asked for one.',
      ...(title ? [`Proposed PR title: "${title}".`] : []),
      'Confirm this was requested before proceeding.',
    ].join(' '),
  );
}
process.exit(0);
