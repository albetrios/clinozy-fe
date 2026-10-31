// The once-per-turn record of clinozy-fe's hooks: a reminder reaches the model through
// PostToolUse additionalContext the first time it applies in a turn (fe-edit-hooks.mjs), and not
// again on every later edit of that turn. fe-prompt-skill-router.mjs (UserPromptSubmit) starts
// each turn by clearing the record.
//
// The record is one empty file per entry under $TMPDIR/clinozy-fe-hooks/<session_id>/. Fails open:
// when the directory cannot be written, every reminder counts as new.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { hookStateDirectory } from './_fe-hook.mjs';

/** The directory that holds `session`'s turn record. */
export function turnDirectory(session) {
  return join(hookStateDirectory, session || 'unknown-session');
}

/** True the first time `key` is seen in `session`'s turn, false after that. */
export function turnOnce({ session, key }) {
  const directory = turnDirectory(session);
  try {
    mkdirSync(directory, { recursive: true });
    const marker = join(
      directory,
      `once.${createHash('sha1').update(key).digest('hex')}`,
    );
    if (existsSync(marker)) return false;
    writeFileSync(marker, '');
  } catch {
    /* every reminder counts as new when the record cannot be written */
  }
  return true;
}

/** Clears `session`'s turn record: a new prompt starts a new turn. */
export function resetTurn(session) {
  const directory = turnDirectory(session);
  let entries = [];
  try {
    entries = readdirSync(directory);
  } catch {
    return; // no record yet
  }
  for (const entry of entries) {
    try {
      rmSync(join(directory, entry), { force: true });
    } catch {
      /* the record keeps that entry */
    }
  }
}
