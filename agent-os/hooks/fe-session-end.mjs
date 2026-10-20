#!/usr/bin/env node
// Claude Code SessionEnd hook for clinozy-fe.
//
// When the session ends, surface anything that would be lost: uncommitted working-tree changes
// (a cloud env is ephemeral — uncommitted work is discarded when the container is reclaimed).
// Informational only, plain stdout; fail-open (always 0).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { repositoryRoot } from './_fe-hook.mjs';
import { recordTelemetry } from './_fe-telemetry.mjs';

let status = 'silent';
if (existsSync(repositoryRoot)) {
  const gitStatus = spawnSync('git', ['status', '--porcelain'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  const count =
    gitStatus.status === 0 ? gitStatus.stdout.split('\n').filter(Boolean).length : 0;
  console.log('');
  if (count > 0) {
    status = 'fired';
    console.log(
      `⚠ Session ending with ${count} uncommitted change(s). A cloud env is ephemeral —`,
    );
    console.log(
      '  commit + push to preserve: git add -A && git commit && git push -u origin "$(git branch --show-current)".',
    );
  } else {
    console.log('✓ Session ending — working tree clean.');
  }
}
recordTelemetry('fe-session-end', 'SessionEnd', status);
process.exit(0);
