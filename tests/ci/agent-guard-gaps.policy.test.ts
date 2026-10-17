import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The guard gaps clinozy-be closed in agent-os/evals/guard-eval.ts, closed here too: guardrails.mjs
// sees Read, Grep and MultiEdit (its matcher used to route only Bash|Edit|Write), denies reading
// the gitignored env files, asks before `gh pr create`, and the reminders reach the model as
// PostToolUse additionalContext once per turn instead of plain Stop output.

const REPOSITORY_ROOT = process.cwd();
const HOOKS = join(REPOSITORY_ROOT, 'agent-os', 'hooks');
const FAKE_ACCESS_KEY = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
const HAS_JQ = spawnSync('/bin/bash', ['-c', 'command -v jq']).status === 0;

interface HookManifest {
  hooks: Array<{
    script: string;
    claude?: { event: string; matcher?: string };
    codex?: { event: string };
  }>;
}

const manifest = JSON.parse(
  readFileSync(join(HOOKS, 'hooks.json'), 'utf8'),
) as HookManifest;
const entry = (script: string) => manifest.hooks.find((hook) => hook.script === script);

let turnDirectory = '';

beforeEach(() => {
  turnDirectory = mkdtempSync(join(tmpdir(), 'fe-turn-once-'));
});

afterEach(() => {
  rmSync(turnDirectory, { recursive: true, force: true });
});

function runHook(script: string, payload: unknown) {
  const runtime = script.endsWith('.mjs') ? process.execPath : '/bin/bash';
  return spawnSync(runtime, [join(HOOKS, script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPOSITORY_ROOT, TMPDIR: turnDirectory },
  });
}

function guardDecision(tool: string, toolInput: Record<string, unknown>): string {
  const stdout = runHook('guardrails.mjs', {
    tool_name: tool,
    tool_input: toolInput,
  }).stdout.trim();
  if (!stdout) return 'silent';
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput?: { permissionDecision?: string };
  };
  return parsed.hookSpecificOutput?.permissionDecision ?? 'warn';
}

describe('agent-os guard gaps', () => {
  it('routes Read, Grep and MultiEdit to guardrails.mjs and the reminders', () => {
    expect(entry('guardrails.mjs')?.claude?.matcher?.split('|')).toEqual(
      expect.arrayContaining(['Bash', 'Read', 'Grep', 'Edit', 'Write', 'MultiEdit']),
    );
    for (const script of [
      'skill-reminder.sh',
      'stop-gate-reminder.sh',
      'format-edits.sh',
    ]) {
      expect(entry(script)?.claude).toEqual({
        event: 'PostToolUse',
        matcher: 'Edit|Write|MultiEdit',
      });
    }
    expect(entry('stop-gate-reminder.sh')?.codex?.event).toBe('Stop');
  });

  it.each([
    ['Read', { file_path: '.env.local' }],
    ['Read', { file_path: '/workspace/clinozy-fe/.env.production' }],
    ['Grep', { pattern: 'VITE_', path: '.env.development' }],
    ['Bash', { command: 'cat .env.local' }],
    ['Bash', { command: 'grep VITE_ .env.production | head' }],
  ])('denies the agent reading a gitignored env file: %s %j', (tool, toolInput) => {
    expect(guardDecision(tool, toolInput)).toBe('deny');
  });

  it('still lets the agent read the committed template', () => {
    expect(guardDecision('Read', { file_path: '.env.example' })).toBe('silent');
    expect(guardDecision('Bash', { command: 'cat .env.example' })).toBe('silent');
  });

  it('scans MultiEdit edits for secrets and secret paths', () => {
    expect(
      guardDecision('MultiEdit', {
        file_path: 'src/core/config/keys.ts',
        edits: [{ old_string: 'a', new_string: `const key = '${FAKE_ACCESS_KEY}';` }],
      }),
    ).toBe('deny');
    expect(
      guardDecision('MultiEdit', {
        file_path: '.env.local',
        edits: [{ old_string: 'a', new_string: 'b' }],
      }),
    ).toBe('deny');
  });

  it('asks before gh pr create (Bash(gh pr*) is allowlisted)', () => {
    expect(guardDecision('Bash', { command: 'gh pr create --title x --body y' })).toBe(
      'ask',
    );
    expect(guardDecision('Bash', { command: 'gh pr view 12' })).toBe('silent');
  });

  it.skipIf(!HAS_JQ)('a skill reminder reaches the model once per turn', () => {
    const edit = {
      session_id: 'policy-session',
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/pages/today/today.route.tsx' },
    };
    const first = JSON.parse(runHook('skill-reminder.sh', edit).stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(first.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(first.hookSpecificOutput.additionalContext).toContain('fe-route-island');

    expect(runHook('skill-reminder.sh', edit).stdout.trim()).toBe('');

    runHook('prompt-skill-router.sh', { session_id: 'policy-session', prompt: 'next' });
    expect(runHook('skill-reminder.sh', edit).stdout).toContain('fe-route-island');
  });
});
