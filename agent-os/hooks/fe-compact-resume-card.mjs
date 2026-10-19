#!/usr/bin/env node
// Claude Code SessionStart hook (matcher `compact`) for clinozy-fe.
//
// Right after the conversation is compacted, re-inject a small, high-signal "resume card" so the
// essentials survive: current branch + uncommitted-change count, and a pointer to the agent-os
// skill-routing map + definition-of-done. Keeps a long unattended session from losing the thread
// across auto-compaction.
//
// Why SessionStart and not PreCompact: Claude Code adds nothing a PreCompact hook prints to the
// model's context, and rejects a `hookSpecificOutput` naming PreCompact — the card never
// arrived. SessionStart with the `compact` matcher is the documented way to re-inject context
// after a compaction.
//
// Output: the SessionStart additionalContext envelope. Fail-open: always exits 0.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { addModelContext, repositoryRoot } from './_fe-hook.mjs';

/** `git <args>` in the repository: its stdout, or `null` when git fails. */
function git(args) {
  const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

if (existsSync(repositoryRoot)) {
  const branch = git(['branch', '--show-current'])?.trim() ?? '?';
  const changedCount = (git(['status', '--porcelain']) ?? '')
    .split('\n')
    .filter(Boolean).length;
  addModelContext({
    event: 'SessionStart',
    context: [
      'RESUME CARD (preserve across compaction)',
      `- Branch: ${branch} · uncommitted files: ${changedCount}`,
      '- agent-os: consult agent-os/skills/fe-skill-registry/SKILL.md + agent-os/docs/skill-triggers.md FIRST for any file you change.',
      '- Definition of done: pnpm health green (tsc + lint + biome + format + validate:tokens + validate:structure + tests + docs).',
    ].join('\n'),
  });
}
process.exit(0);
