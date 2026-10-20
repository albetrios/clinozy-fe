import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The guard gaps clinozy-be closed in agent-os/evals/guard-eval.ts, closed here too: fe-guardrails.mjs
// sees Read, Grep and MultiEdit (its matcher used to route only Bash|Edit|Write), denies reading
// the gitignored env files, asks before `gh pr create`, and the reminders reach the model as
// PostToolUse additionalContext once per turn instead of plain Stop output.

const REPOSITORY_ROOT = process.cwd();
const HOOKS = join(REPOSITORY_ROOT, 'agent-os', 'hooks');
const FAKE_ACCESS_KEY = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');

interface HookManifest {
  hooks: Array<{
    id: string;
    script: string;
    claude?: { event: string; matcher?: string; if?: string[] };
    codex?: { event: string };
  }>;
}

const manifest = JSON.parse(
  readFileSync(join(HOOKS, 'hooks.json'), 'utf8'),
) as HookManifest;
const entry = (script: string) => manifest.hooks.find((hook) => hook.script === script);
const byId = (id: string) => manifest.hooks.find((hook) => hook.id === id);

let turnDirectory = '';

beforeEach(() => {
  turnDirectory = mkdtempSync(join(tmpdir(), 'fe-turn-once-'));
});

afterEach(() => {
  rmSync(turnDirectory, { recursive: true, force: true });
});

function runHook(script: string, payload: unknown) {
  return spawnSync(process.execPath, [join(HOOKS, script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPOSITORY_ROOT, TMPDIR: turnDirectory },
  });
}

function guardDecision(tool: string, toolInput: Record<string, unknown>): string {
  const stdout = runHook('fe-guardrails.mjs', {
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
  it('routes Read, Grep and MultiEdit to fe-guardrails.mjs and the reminders', () => {
    expect(entry('fe-guardrails.mjs')?.claude?.matcher?.split('|')).toEqual(
      expect.arrayContaining(['Bash', 'Read', 'Grep', 'Edit', 'Write', 'MultiEdit']),
    );
    // One edit hook (formatter + skill and gate reminders), spawned only for an Edit or Write call.
    expect(byId('fe-edit-hooks')?.claude).toEqual({
      event: 'PostToolUse',
      matcher: 'Edit|Write',
      if: ['Edit(**)', 'Write(**)'],
    });
    expect(byId('fe-edit-hooks-stop')?.claude?.event).toBe('Stop');
    expect(byId('fe-edit-hooks-stop')?.codex?.event).toBe('Stop');
    expect(byId('fe-edit-hooks-stop')?.script).toBe('fe-edit-hooks.mjs');
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

  it('a turn the user started with /fe-ship or /fe-open-pr is the PR request; the next prompt is not', () => {
    const prompt = (session_id: string, text: string) =>
      runHook('fe-prompt-skill-router.mjs', {
        session_id,
        hook_event_name: 'UserPromptSubmit',
        prompt: text,
      });
    const decisions = (session_id: string) => {
      const decision = (stdout: string) =>
        stdout.trim()
          ? (
              JSON.parse(stdout) as {
                hookSpecificOutput: { permissionDecision: string };
              }
            ).hookSpecificOutput.permissionDecision
          : 'silent';
      return [
        decision(
          runHook('fe-guardrails.mjs', {
            session_id,
            tool_name: 'Bash',
            tool_input: { command: 'gh pr create --title x --body y' },
          }).stdout,
        ),
        decision(
          runHook('fe-no-unrequested-pr.mjs', {
            session_id,
            tool_name: 'mcp__github__create_pull_request',
            tool_input: { title: 'feat: x' },
          }).stdout,
        ),
      ];
    };

    prompt('ship-session', '/fe-ship feat: billing invoices');
    expect(decisions('ship-session')).toEqual(['silent', 'silent']);
    prompt('ship-session', 'now tidy the docs');
    expect(decisions('ship-session')).toEqual(['ask', 'ask']);

    prompt('open-session', '  /fe-open-pr');
    expect(decisions('open-session')).toEqual(['silent', 'silent']);

    prompt('look-alike-session', '/fe-shipping-notes then /fe-ship');
    expect(decisions('look-alike-session')).toEqual(['ask', 'ask']);
    expect(decisions('never-prompted-session')).toEqual(['ask', 'ask']);
  });

  it('a skill reminder reaches the model once per turn', () => {
    const edit = {
      session_id: 'policy-session',
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/pages/today/today.route.tsx' },
    };
    const first = JSON.parse(runHook('fe-edit-hooks.mjs', edit).stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(first.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(first.hookSpecificOutput.additionalContext).toContain('fe-route-island');

    expect(runHook('fe-edit-hooks.mjs', edit).stdout.trim()).toBe('');

    runHook('fe-prompt-skill-router.mjs', {
      session_id: 'policy-session',
      prompt: 'next',
    });
    expect(runHook('fe-edit-hooks.mjs', edit).stdout).toContain('fe-route-island');
  });
});
