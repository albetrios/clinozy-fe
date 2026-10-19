#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit | Write | MultiEdit) for clinozy-fe.
//
// BLOCKS edits that introduce a hard-rule violation documented in CLAUDE.md and already enforced
// by ESLint / validators / CI — moving enforcement left from "you find out at lint/CI" to an
// instant denial at the keystroke. The rules (R1 generated file, R2 `../` import under src/, R3
// direct lucide-react import, R4 raw palette class) live in _fe-guard-rules.mjs, as clinozy-be's
// edit rules live in its _be-guard-rules.mjs.
//
// Judges only files in this repository: a session that holds several repositories runs every
// repository's hooks on every edit (tooling/agent-os/session-hooks.ts), and another repository's
// files are its own hooks' to judge. Fails OPEN: an unreadable payload allows the edit.
import { editRuleViolations } from './_fe-guard-rules.mjs';
import { denyToolCall, isInsideRepository, readHookPayload } from './_fe-hook.mjs';

const input = readHookPayload()?.tool_input ?? {};
const filePath = typeof input.file_path === 'string' ? input.file_path : '';
if (filePath) {
  // The text being written: Write.content, Edit.new_string, MultiEdit.edits[].new_string.
  const edits = Array.isArray(input.edits)
    ? input.edits.map((edit) => edit?.new_string)
    : [];
  const content = [input.content, input.new_string, ...edits]
    .filter((text) => typeof text === 'string')
    .join('\n');
  const [violation] = editRuleViolations({
    filePath,
    content,
    inRepository: isInsideRepository(filePath),
  });
  if (violation) denyToolCall(violation.reason);
}
process.exit(0);
