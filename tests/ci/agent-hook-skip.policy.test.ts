import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { gitEnvironmentWithoutInheritedRepository } from '../../tooling/ci/git-environment.mjs';
import {
  createThrowawayRepository,
  removeThrowawayRepositories,
} from '../../tooling/ci/throwaway-repository.mjs';

// Agents never skip the git hooks: fe-guardrails.mjs (Claude PreToolUse) and fe-cursor-shell-guard.mjs
// (Cursor beforeShellExecution) deny `--no-verify` on commit or push, `git commit -n` and
// HUSKY=0. The same cases as clinozy-be's agent-os/evals/guard-eval.ts.

const HOOKS = join(process.cwd(), 'agent-os', 'hooks');

// The guard's push review gate reads the repository's unpushed diff, so a look-alike `git push`
// would turn into an ask whenever this checkout holds unpushed auth or guard changes (a merge of
// main does). The cases run in a throwaway repository with one empty commit instead.
const REPOSITORY = createThrowawayRepository({ prefix: 'fe-hook-skip-' }).root;
afterAll(removeThrowawayRepositories);

function claudeDecision(command: string): string {
  const result = spawnSync(process.execPath, [join(HOOKS, 'fe-guardrails.mjs')], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    cwd: REPOSITORY,
    encoding: 'utf8',
    env: {
      ...gitEnvironmentWithoutInheritedRepository(),
      CLAUDE_PROJECT_DIR: REPOSITORY,
    },
  });
  const stdout = result.stdout.trim();
  if (!stdout) return 'silent';
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput?: { permissionDecision?: string };
  };
  return parsed.hookSpecificOutput?.permissionDecision ?? 'warn';
}

function cursorDecision(command: string): string {
  const result = spawnSync(process.execPath, [join(HOOKS, 'fe-cursor-shell-guard.mjs')], {
    input: JSON.stringify({ command }),
    encoding: 'utf8',
  });
  return (JSON.parse(result.stdout) as { permission: string }).permission;
}

const SKIPS = [
  'git commit --no-verify -m wip',
  'git commit -nm wip',
  'git -C . commit -an -m wip',
  'git push --no-verify origin x',
  'HUSKY=0 git commit -m wip',
];
const LOOK_ALIKES = [
  'git log --grep commit -n 3',
  'git push -n origin x',
  'git commit -m "never use --no-verify"',
];

describe('agents never skip the git hooks', () => {
  it.each(SKIPS)('denies %s', (command) => {
    expect(claudeDecision(command)).toBe('deny');
    expect(cursorDecision(command)).toBe('deny');
  });

  it.each(LOOK_ALIKES)('allows the look-alike %s', (command) => {
    expect(claudeDecision(command)).toBe('silent');
    expect(cursorDecision(command)).toBe('allow');
  });
});
